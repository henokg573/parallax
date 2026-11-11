'use server'

import { randomUUID } from 'node:crypto'
import { publicRpc, publicRows } from '@/lib/db'
import { PRIVATE_RECEIPTS_BUCKET, removeStorageFile, uploadStorageFile } from '@/lib/storage'
import {
  sendRegistrationNotification,
  sendRegistrationReceiptNotification,
} from '@/lib/telegram'

export type RegistrationState = {
  success: boolean
  message: string
  errors?: Record<string, string>
  notificationWarning?: string
}

function text(formData: FormData, name: string, max: number): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

const messages = {
  en: {
    experience: 'The selected experience is missing.',
    fullName: 'Enter your full name.',
    email: 'Enter a valid email address.',
    phone: 'Enter a valid phone number.',
    paymentReference: 'Enter your payment transaction reference.',
    paymentReceipt: 'Upload a screenshot or PDF receipt up to 5 MB.',
    check: 'Please check the highlighted fields.',
    success: 'Registration received. We will email your QR ticket after payment verification.',
    notificationWarning: 'The registration was saved, but the team notification could not be delivered. Please contact Parallax if you need help.',
    failure: 'We could not submit this registration. The experience may no longer be open.',
  },
  am: {
    experience: 'የተመረጠው ዝግጅት አልተገኘም።',
    fullName: 'ሙሉ ስምዎን ያስገቡ።',
    email: 'ትክክለኛ ኢሜይል ያስገቡ።',
    phone: 'ትክክለኛ ስልክ ቁጥር ያስገቡ።',
    paymentReference: 'የክፍያ ማጣቀሻ ቁጥሩን ያስገቡ።',
    paymentReceipt: 'እስከ 5 MB የሆነ ስክሪንሾት ወይም PDF ደረሰኝ ይጫኑ።',
    check: 'ምልክት የተደረገባቸውን መስኮች ያረጋግጡ።',
    success: 'ምዝገባዎ ደርሷል። ክፍያው ከተረጋገጠ በኋላ የQR ትኬትዎን በኢሜይል እንልካለን።',
    notificationWarning: 'ምዝገባው ተቀምጧል፣ ግን የቡድን ማሳወቂያው አልደረሰም። እርዳታ ከፈለጉ Parallaxን ያነጋግሩ።',
    failure: 'ምዝገባውን ማስገባት አልቻልንም። ዝግጅቱ ለምዝገባ ዝግ ሊሆን ይችላል።',
  },
} as const

export async function registerForExperience(
  _previous: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const experience = Number(text(formData, 'experience', 100))
  const fullName = text(formData, 'fullName', 120)
  const email = text(formData, 'email', 180).toLowerCase()
  const phone = text(formData, 'phone', 40)
  const preferredChannel = text(formData, 'preferredChannel', 20)
  const paymentReference = text(formData, 'paymentReference', 120)
  const locale = text(formData, 'locale', 2) === 'am' ? 'am' : 'en'
  const copy = messages[locale]
  const receipt = formData.get('paymentReceipt')
  const receiptFile = receipt instanceof File ? receipt : null
  const errors: Record<string, string> = {}

  if (!Number.isSafeInteger(experience) || experience <= 0) errors.experience = copy.experience
  if (fullName.length < 2) errors.fullName = copy.fullName
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = copy.email
  }
  if (phone.length < 7) errors.phone = copy.phone
  if (!['email', 'phone', 'whatsapp', 'telegram'].includes(preferredChannel)) {
    errors.preferredChannel = 'Choose a preferred communication channel.'
  }
  if (paymentReference.length < 3) {
    errors.paymentReference = copy.paymentReference
  }
  if (
    !receiptFile ||
    receiptFile.size === 0 ||
    receiptFile.size > 5 * 1024 * 1024 ||
    (!receiptFile.type.startsWith('image/') && receiptFile.type !== 'application/pdf')
  ) {
    errors.paymentReceipt = copy.paymentReceipt
  }

  if (Object.keys(errors).length) {
    return {
      success: false,
      message: copy.check,
      errors,
    }
  }

  let receiptStoragePath: string | undefined
  try {
    if (!receiptFile) throw new Error('Receipt validation failed.')

    const mimeExtensions: Record<string, string> = {
      'application/pdf': 'pdf',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    }
    const extension = mimeExtensions[receiptFile.type]
    if (!extension) throw new Error('Unsupported receipt type.')

    const receiptBytes = Buffer.from(await receiptFile.arrayBuffer())
    if (receiptFile.type === 'application/pdf' && !receiptBytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      throw new Error('Invalid PDF receipt.')
    }
    if (receiptFile.type.startsWith('image/')) {
      const { default: sharp } = await import('sharp')
      await sharp(receiptBytes).metadata()
    }

    const storageName = `${randomUUID()}.${extension}`
    receiptStoragePath = await uploadStorageFile(
      PRIVATE_RECEIPTS_BUCKET,
      storageName,
      receiptBytes,
      receiptFile.type,
      true,
    )

    const registrationID = await publicRpc<number>('create_public_registration', {
      p_experience_id: experience,
      p_filename: storageName,
      p_original_filename: receiptFile.name.replace(/[/\\\0]/g, '').slice(0, 255),
      p_mime_type: receiptFile.type,
      p_size_bytes: receiptFile.size,
      p_full_name: fullName,
      p_email: email,
      p_phone: phone,
      p_preferred_channel: preferredChannel,
      p_payment_reference: paymentReference,
      p_check_in_token: randomUUID(),
    })

    let notificationFailed = false
    try {
      const experiences = await publicRows<{ title_en: string }>('experiences', {
        select: 'title_en',
        eq: { id: experience },
        limit: 1,
      })
      const registration = {
        id: Number(registrationID),
        experienceTitle: experiences[0]?.title_en || `Experience ${experience}`,
        fullName,
        email,
        phone,
        preferredChannel,
        paymentReference,
      }
      const [notification, receiptNotification] = await Promise.all([
        sendRegistrationNotification(registration, 'new'),
        sendRegistrationReceiptNotification(registration, {
          bytes: receiptBytes,
          filename: receiptFile.name.replace(/[/\\\0]/g, '').slice(0, 128) || `receipt.${mimeExtensions[receiptFile.type]}`,
          contentType: receiptFile.type,
        }),
      ])
      notificationFailed = !notification.ok || !receiptNotification.ok
    } catch (error) {
      notificationFailed = true
      console.error('[telegram] New registration notification could not be prepared.', error)
    }

    return {
      success: true,
      message: copy.success,
      notificationWarning: notificationFailed ? copy.notificationWarning : undefined,
    }
  } catch (error) {
    if (receiptStoragePath) await removeStorageFile(PRIVATE_RECEIPTS_BUCKET, receiptStoragePath).catch(() => undefined)
    console.error(
      '[registration] submission failed',
      error instanceof Error ? error.message : error,
    )
    return {
      success: false,
      message: copy.failure,
    }
  }
}
