import 'server-only'

// —— SMSEthiopia SMS gateway ——
// Endpoint: POST https://smsethiopia.com/api/sms/send
// Auth: custom `KEY` header (NOT Authorization Bearer).
// Body: { msisdn: "2519XXXXXXXX", text: "message" }
// Response: { response_code: 200, response_description: "OK", message_id?, campaign_id? } on success,
//           { error_message: "..." } on failure.

export type SMSResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'request_failed' | 'rejected' }

export function isSMSConfigured() {
  return Boolean(process.env.SMSETHIOPIA_API_KEY)
}

/** Normalise any Ethiopian phone input (09xxxxxxxx, +2519xxxxxxxx, 2519xxxxxxxx) to 2519XXXXXXXX. */
export function toSMSEthiopiaMsisdn(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, '').replace(/^\+/, '')
  if (/^0(9|7)\d{8}$/.test(digits)) return `251${digits.slice(1)}`
  if (/^251(9|7)\d{8}$/.test(digits)) return digits
  if (/^(9|7)\d{8}$/.test(digits)) return `251${digits}`
  return null
}

export async function sendSMS(to: string, text: string): Promise<SMSResult> {
  const apiKey = process.env.SMSETHIOPIA_API_KEY
  if (!apiKey) return { ok: false, reason: 'not_configured' }

  const msisdn = toSMSEthiopiaMsisdn(to)
  if (!msisdn) {
    console.error('[sms] Could not normalise recipient phone number.', { phone: to })
    return { ok: false, reason: 'rejected' }
  }

  try {
    const response = await fetch('https://smsethiopia.com/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', KEY: apiKey },
      body: JSON.stringify({ msisdn, text: text.slice(0, 1000) }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (response.ok) return { ok: true }

    const body = await response.json().catch(() => null) as { error_message?: unknown } | null
    console.error('[sms] SMSEthiopia rejected the message.', {
      status: response.status,
      ...(body?.error_message ? { message: body.error_message } : {}),
    })
    return { ok: false, reason: 'rejected' }
  } catch (error) {
    console.error('[sms] SMSEthiopia request failed.', error instanceof Error ? error.message : error)
    return { ok: false, reason: 'request_failed' }
  }
}

// —— Notification texts mirroring the Resend emails ——

export async function sendRegistrationConfirmationSMS(options: {
  phone: string
  fullName: string
  experienceTitle: string
  registrationID: number
}): Promise<SMSResult> {
  const first = options.fullName.trim().split(/\s+/)[0] || 'there'
  return sendSMS(
    options.phone,
    `Parallax: Hi ${first}, your registration for ${options.experienceTitle} has been received and is pending payment verification. Reference #${options.registrationID}. We will SMS/email your QR ticket once your payment is verified.`,
  )
}

export async function sendVerifiedRegistrationTicketSMS(options: {
  phone: string
  fullName: string
  experienceTitle: string
  registrationID: number
  checkInToken: string
}): Promise<SMSResult> {
  const siteURL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')
  return sendVerifiedRegistrationTicketSMSWithURL({
    ...options,
    checkInURL: `${siteURL}/check-in/${options.checkInToken}`,
  })
}

export async function sendVerifiedRegistrationTicketSMSWithURL(options: {
  phone: string
  fullName: string
  experienceTitle: string
  registrationID: number
  checkInURL: string
}): Promise<SMSResult> {
  const first = options.fullName.trim().split(/\s+/)[0] || 'there'
  return sendSMS(
    options.phone,
    `Parallax: Hi ${first}, your payment for ${options.experienceTitle} is verified. You are on the list! Show this check-in link on arrival: ${options.checkInURL} (Ref #${options.registrationID})`,
  )
}

export async function sendRejectedRegistrationSMS(options: {
  phone: string
  fullName: string
  experienceTitle: string
  registrationID: number
}): Promise<SMSResult> {
  const first = options.fullName.trim().split(/\s+/)[0] || 'there'
  return sendSMS(
    options.phone,
    `Parallax: Hi ${first}, we could not verify the payment for your ${options.experienceTitle} registration (Ref #${options.registrationID}). Please contact us for help.`,
  )
}
