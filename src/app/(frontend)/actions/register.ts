'use server'

import { randomUUID } from 'node:crypto'
import { insert, rows } from '@/lib/db'
import { PRIVATE_RECEIPTS_BUCKET, removeStorageFile, uploadStorageFile } from '@/lib/storage'

export type RegistrationState = {
  success: boolean
  message: string
  errors?: Record<string, string>
}

const initialState: RegistrationState = {
  success: false,
  message: '',
}

export { initialState }

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
    receiptStoragePath = await uploadStorageFile(PRIVATE_RECEIPTS_BUCKET, storageName, receiptBytes, receiptFile.type)

    const experienceRows = await rows<{ id: number; capacity: number | null }>('experiences', {
      select: 'id, capacity',
      eq: { id: experience, status: 'published' },
      limit: 1,
    })
    const selectedExperience = experienceRows[0]
    if (!selectedExperience) throw new Error('Experience is not open for registration.')

    if (selectedExperience.capacity) {
      const registrations = await rows<{ id: number }>('registrations', {
        select: 'id',
        eq: { experience_id: experience },
        neq: { payment_status: 'rejected' },
      })
      if (registrations.length >= selectedExperience.capacity) {
        throw new Error('Experience capacity has been reached.')
      }
    }

    const receipt = await insert<{ id: number }>('payment_receipts', {
      filename: storageName,
      original_filename: receiptFile.name.replace(/[/\\\0]/g, '').slice(0, 255),
      mime_type: receiptFile.type,
      size_bytes: receiptFile.size,
    })
    await insert('registrations', {
      experience_id: experience,
      receipt_id: receipt.id,
      full_name: fullName,
      email,
      phone,
      payment_reference: paymentReference,
      check_in_token: randomUUID(),
    })

    return {
      success: true,
      message: copy.success,
    }
  } catch {
    if (receiptStoragePath) await removeStorageFile(PRIVATE_RECEIPTS_BUCKET, receiptStoragePath).catch(() => undefined)
    return {
      success: false,
      message: copy.failure,
    }
  }
}
