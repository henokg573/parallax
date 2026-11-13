import 'server-only'
import QRCode from 'qrcode'

export type TelegramResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'request_failed' | 'rejected' }

export type RegistrationNotification = {
  id: number
  experienceTitle: string
  fullName: string
  email: string
  phone: string
  preferredChannel: string
  paymentReference: string
}

function escapeHTML(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function isTelegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
}

export async function sendTelegramMessage(text: string): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatID = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatID) return { ok: false, reason: 'not_configured' }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatID,
        text: text.slice(0, 4000),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    const result = await response.json() as { ok?: boolean }
    if (response.ok && result.ok) return { ok: true }

    console.error('[telegram] Bot API rejected a notification.', { status: response.status })
    return { ok: false, reason: 'rejected' }
  } catch {
    console.error('[telegram] Notification request failed.')
    return { ok: false, reason: 'request_failed' }
  }
}

async function sendTelegramDocument(
  bytes: Uint8Array,
  filename: string,
  contentType: string,
  caption: string,
): Promise<TelegramResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatID = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatID) return { ok: false, reason: 'not_configured' }

  try {
    const formData = new FormData()
    formData.set('chat_id', chatID)
    formData.set('caption', caption.slice(0, 1024))
    formData.set('parse_mode', 'HTML')
    formData.set(
      'document',
      new Blob([new Uint8Array(bytes)], { type: contentType }),
      filename,
    )

    const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
      method: 'POST',
      body: formData,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    const result = await response.json() as { ok?: boolean }
    if (response.ok && result.ok) return { ok: true }

    console.error('[telegram] Bot API rejected a receipt document.', { status: response.status })
    return { ok: false, reason: 'rejected' }
  } catch {
    console.error('[telegram] Receipt document request failed.')
    return { ok: false, reason: 'request_failed' }
  }
}

export function sendRegistrationNotification(
  registration: RegistrationNotification,
  status: 'new' | 'verified' | 'rejected',
) {
  const title = status === 'new'
    ? 'New registration received'
    : status === 'verified'
      ? 'Registration verified'
      : 'Registration rejected'
  const statusLabel = status === 'new' ? 'Pending review' : status === 'verified' ? 'Verified' : 'Rejected'

  return sendTelegramMessage([
    `<b>${title}</b>`,
    `Registration: <code>${registration.id}</code>`,
    `Experience: ${escapeHTML(registration.experienceTitle)}`,
    `Name: ${escapeHTML(registration.fullName)}`,
    `Email: ${escapeHTML(registration.email)}`,
    `Phone: ${escapeHTML(registration.phone)}`,
    `Preferred contact: ${escapeHTML(registration.preferredChannel)}`,
    `Payment reference: ${escapeHTML(registration.paymentReference)}`,
    `Status: <b>${statusLabel}</b>`,
  ].join('\n'))
}

export function sendRegistrationReceiptNotification(
  registration: Pick<RegistrationNotification, 'id' | 'experienceTitle' | 'fullName'>,
  receipt: { bytes: Uint8Array; filename: string; contentType: string },
) {
  const caption = [
    '<b>Payment receipt</b>',
    `Registration: <code>${registration.id}</code>`,
    `Experience: ${escapeHTML(registration.experienceTitle)}`,
    `Name: ${escapeHTML(registration.fullName)}`,
  ].join('\n')

  return sendTelegramDocument(receipt.bytes, receipt.filename, receipt.contentType, caption)
}

// —— Resend email (verified-registration confirmation) ——

export type EmailResult =
  | { ok: true }
  | { ok: false; reason: 'not_configured' | 'request_failed' | 'rejected' }

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.PARALLAX_FROM_EMAIL)
}

export async function sendRegistrationConfirmationEmail(options: {
  to: string
  fullName: string
  experienceTitle: string
  experienceID: number
  registrationID: number
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.PARALLAX_FROM_EMAIL
  if (!apiKey || !from) return { ok: false, reason: 'not_configured' }

  const siteURL = process.env.NEXT_PUBLIC_SITE_URL || ''
  const experienceURL = siteURL ? `${siteURL}/experiences` : ''
  const name = escapeHTML(options.fullName) || 'there'

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [options.to],
        reply_to: process.env.PARALLAX_REPLY_TO_EMAIL || undefined,
        subject: 'Registration received — Parallax',
        html: [
          `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#102e26">`,
          `<p style="font-size:12px;letter-spacing:2px;color:#9a6b20">PARALLAX · REGISTRATION RECEIVED</p>`,
          `<h1 style="margin:4px 0 16px">Hi ${name},</h1>`,
          `<p>Your registration for <strong>${escapeHTML(options.experienceTitle)}</strong> has been received and is pending payment verification.</p>`,
          `<p style="background:#f3f6f4;border-radius:8px;padding:14px 16px">Registration reference: <strong>#${options.registrationID}</strong></p>`,
          `<p>We will email your entry QR code to this address as soon as your payment has been verified. Keep your payment reference handy in case you contact us.</p>`,
          experienceURL ? `<p style="margin-top:24px"><a href="${experienceURL}" style="color:#102e26">View Parallax experiences</a></p>` : '',
          `<p style="margin-top:32px;font-size:12px;color:#6b7c75">You are receiving this email because you registered with this address on viewparallax.net. If this wasn't you, you can ignore this message.</p>`,
          `</div>`,
        ].join(''),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (response.ok) return { ok: true }
    console.error('[resend] Confirmation email rejected.', { status: response.status })
    return { ok: false, reason: 'rejected' }
  } catch {
    console.error('[resend] Confirmation email request failed.')
    return { ok: false, reason: 'request_failed' }
  }
}

export async function sendVerifiedRegistrationTicketEmail(options: {
  to: string
  fullName: string
  experienceTitle: string
  registrationID: number
  checkInToken: string
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.PARALLAX_FROM_EMAIL
  if (!apiKey || !from) return { ok: false, reason: 'not_configured' }

  const siteURL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '')
  const checkInURL = `${siteURL}/check-in/${options.checkInToken}`
  let qrCode: Buffer
  try {
    qrCode = await QRCode.toBuffer(checkInURL, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 720,
    })
  } catch {
    console.error('[resend] Ticket QR code could not be generated.')
    return { ok: false, reason: 'request_failed' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: 'Your Parallax entry QR code',
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#102e26"><p style="font-size:12px;color:#9a6b20">PARALLAX · PAYMENT VERIFIED</p><h1>You are on the list, ${escapeHTML(options.fullName)}.</h1><p>Your payment for <strong>${escapeHTML(options.experienceTitle)}</strong> has been verified. Your entry QR code is attached. Keep it ready when you arrive.</p><p>Registration reference: <strong>#${options.registrationID}</strong></p></div>`,
        attachments: [{
          filename: 'parallax-entry-qr.png',
          content: qrCode.toString('base64'),
        }],
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (response.ok) return { ok: true }

    const body = await response.json().catch(() => null) as { name?: unknown } | null
    const code = typeof body?.name === 'string' ? body.name : undefined
    console.error('[resend] Ticket email rejected.', {
      status: response.status,
      ...(code ? { code } : {}),
    })
    return { ok: false, reason: 'rejected' }
  } catch {
    console.error('[resend] Ticket email request failed.')
    return { ok: false, reason: 'request_failed' }
  }
}
