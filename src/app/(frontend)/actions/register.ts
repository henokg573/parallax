'use server'

import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { database } from '@/lib/db'

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

  let receiptPath: string | undefined
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
    const receiptDirectory = path.join(process.cwd(), 'var', 'uploads', 'payment-receipts')
    await mkdir(receiptDirectory, { recursive: true })
    receiptPath = path.join(receiptDirectory, storageName)
    await writeFile(receiptPath, receiptBytes, { flag: 'wx' })

    const connection = await database.getConnection()
    try {
      await connection.beginTransaction()
      const [experienceRows] = await connection.execute(
        `SELECT id, capacity FROM experiences
         WHERE id = ? AND status = 'published' LIMIT 1 FOR UPDATE`,
        [experience],
      )
      const selectedExperience = (
        experienceRows as Array<{ id: number; capacity: number | null }>
      )[0]
      if (!selectedExperience) throw new Error('Experience is not open for registration.')

      if (selectedExperience.capacity) {
        const [countRows] = await connection.execute(
          `SELECT COUNT(*) AS total FROM registrations
           WHERE experience_id = ? AND payment_status != 'rejected'`,
          [experience],
        )
        const registrationCount = Number((countRows as Array<{ total: number }>)[0]?.total || 0)
        if (registrationCount >= selectedExperience.capacity) {
          throw new Error('Experience capacity has been reached.')
        }
      }

      const [receiptResult] = await connection.execute(
        `INSERT INTO payment_receipts (filename, original_filename, mime_type, size_bytes)
         VALUES (?, ?, ?, ?)`,
        [storageName, receiptFile.name.replace(/[/\\\0]/g, '').slice(0, 255), receiptFile.type, receiptFile.size],
      )
      const receiptID = (receiptResult as { insertId: number }).insertId
      await connection.execute(
        `INSERT INTO registrations
          (experience_id, receipt_id, full_name, email, phone, payment_reference, check_in_token)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [experience, receiptID, fullName, email, phone, paymentReference, randomUUID()],
      )
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

    return {
      success: true,
      message: copy.success,
    }
  } catch {
    if (receiptPath) await unlink(receiptPath).catch(() => undefined)
    return {
      success: false,
      message: copy.failure,
    }
  }
}
