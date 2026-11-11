import 'server-only'

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
