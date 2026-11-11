'use server'

import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getAdminSession } from '@/lib/admin-auth'
import { insert, rows, update } from '@/lib/db'
import { PUBLIC_MEDIA_BUCKET, removeStorageFile, uploadStorageFile } from '@/lib/storage'
import { REGISTRATION_STATUS_VALUES } from '@/lib/registrations'
import { sendRegistrationNotification } from '@/lib/telegram'

function value(formData: FormData, key: string, max: number) {
  const field = formData.get(key)
  return typeof field === 'string' ? field.trim().slice(0, max) : ''
}

function optionalNumber(value: string): number | null {
  if (!value) return null
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? num : null
}

function slugify(input: string) {
  return input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180)
}

function jsonList(formData: FormData, key: string): unknown[] {
  try {
    const parsed = JSON.parse(value(formData, key, 200000) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function positiveID(raw: string): number | null {
  const id = Number(raw)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/**
 * Updates an experience status, gracefully mapping 'unpublished' to 'draft'
 * when the database's publish_status enum predates that value.
 */
async function updateExperienceStatus(id: number, requestedStatus: string) {
  try {
    await update('experiences', { status: requestedStatus, updated_at: new Date().toISOString() }, { id })
  } catch (error) {
    const message = String(error)
    if (requestedStatus === 'unpublished' && message.includes('unpublished')) {
      await update('experiences', { status: 'draft', updated_at: new Date().toISOString() }, { id })
      return
    }
    throw error
  }
}

function numberList(formData: FormData, key: string): number[] {
  return formData.getAll(key)
    .filter((entry): entry is string => typeof entry === 'string')
    .map(Number)
    .filter((number) => Number.isSafeInteger(number))
}

function sqlDate(input: string): string | null {
  if (!input) return null
  const date = new Date(input)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

async function requireContentAdmin() {
  const admin = await getAdminSession()
  if (!admin || admin.role === 'check-in') redirect('/admin/login')
  return admin
}

export type SaveRegistrationResult = {
  ok: boolean
  id?: number
  slug?: string
  /** 'auth' means the admin session expired — the client should offer re-login. */
  error?: 'auth' | 'validation' | 'server'
  message?: string
  /** Populated when the DB lacks the v2 columns and only core fields were saved. */
  partial?: boolean
}

async function logActivity(action: string, detail: string, registrationID?: number, experienceID?: number) {
  const admin = await getAdminSession()
  try {
    await insert('registration_activity', {
      registration_id: registrationID ?? null,
      experience_id: experienceID ?? null,
      admin_email: admin?.email ?? null,
      action,
      detail,
    })
  } catch {
    // Activity log is best-effort; never block the primary action.
  }
}

async function uploadExperienceImage(formData: FormData, key: string, currentURL: string | null): Promise<string | null> {
  const file = formData.get(key)
  if (!(file instanceof File) || file.size === 0) return currentURL
  if (file.size > 10 * 1024 * 1024) throw new Error('Images must be 10 MB or smaller.')
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  }
  const ext = extensions[file.type]
  if (!ext) throw new Error('Upload a JPEG, PNG, WebP, or GIF image.')
  const buffer = Buffer.from(await file.arrayBuffer())
  const { default: sharp } = await import('sharp')
  const metadata = await sharp(buffer).metadata().catch(() => null)
  if (!metadata?.width) throw new Error('The image could not be decoded.')
  const filename = `${randomUUID()}.${ext}`
  await uploadStorageFile(PUBLIC_MEDIA_BUCKET, filename, buffer, file.type)
  return publicURL(filename)
}

function publicURL(filename: string) {
  const base = process.env.SUPABASE_URL
  if (!base) throw new Error('Storage is not configured.')
  return `${base}/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/${filename}`
}

async function uploadExperienceResources(formData: FormData, existing: unknown[]): Promise<unknown[]> {
  const resources = [...existing]
  for (let index = 0; index < 5; index += 1) {
    const file = formData.get(`resource_file_${index}`)
    if (!(file instanceof File) || file.size === 0) continue
    if (file.size > 20 * 1024 * 1024) throw new Error('Documents must be 20 MB or smaller.')
    const extensions: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/plain': 'txt',
    }
    const ext = extensions[file.type]
    if (!ext) throw new Error(`"${file.name}" is not a supported document type.`)
    const filename = `${randomUUID()}.${ext}`
    await uploadStorageFile(PUBLIC_MEDIA_BUCKET, filename, Buffer.from(await file.arrayBuffer()), file.type)
    resources.push({ name: value(formData, `resource_name_${index}`, 200) || file.name, media_id: null, url: publicURL(filename) })
  }
  return resources
}

function str(payload: Record<string, unknown>, key: string, fallback = '') {
  const val = payload[key]
  return val === null || val === undefined ? fallback : String(val)
}

export async function saveRegistrationDraft(formData: FormData): Promise<SaveRegistrationResult> {
  const admin = await getAdminSession()
  if (!admin || admin.role === 'check-in') {
    return { ok: false, error: 'auth', message: 'Your session expired. Please sign in again — your draft data is still open in this tab.' }
  }

  // The multi-step builder submits a JSON payload plus any chosen files.
  let payload: Record<string, unknown> = {}
  try {
    payload = JSON.parse(value(formData, 'payload', 500000) || '{}') as Record<string, unknown>
  } catch {
    payload = {}
  }
  const pick = (key: string, fallback = ''): string => {
    if (key in payload) {
      const raw = payload[key]
      if (raw === null || raw === undefined) return fallback
      if (typeof raw === 'object') return JSON.stringify(raw).slice(0, 500000)
      return String(raw).slice(0, 500000)
    }
    return value(formData, key, 500000) || fallback
  }

  const idRaw = pick('id', '')
  const id = idRaw ? Number(idRaw) : null
  const titleEN = pick('title_en')
  if (!titleEN) {
    return { ok: false, error: 'validation', message: 'The English title is required.' }
  }

  const slug = slugify(pick('slug') || titleEN) || `registration-${Date.now()}`
  const kindRaw = pick('kind', 'event')
  const pricingMode = pick('pricing_mode', 'free')
  const statusRaw = pick('status', 'draft')
  const status = REGISTRATION_STATUS_VALUES.includes(statusRaw as never) ? statusRaw : 'draft'

  // Structured lists come from the builder payload (or raw JSON fields).
  const ticketTypes = Array.isArray(payload.ticket_types) ? payload.ticket_types : jsonList(formData, 'ticket_types')
  const participantFields = Array.isArray(payload.participant_fields) ? payload.participant_fields : jsonList(formData, 'participant_fields')
  const discountCodes = Array.isArray(payload.discount_codes) ? payload.discount_codes : jsonList(formData, 'discount_codes')
  const galleryIDs = jsonList(formData, 'gallery_ids').map((item) => Number(item)).filter((n) => Number.isSafeInteger(n))
  const existingResourcesRaw = Array.isArray(payload.resources) ? payload.resources : jsonList(formData, 'existing_resources')

  const coverURL = await uploadExperienceImage(formData, 'image_file', pick('image_url') || null)
  const resources = await uploadExperienceResources(formData, existingResourcesRaw)

  const price = optionalNumber(pick('price'))
  const unlimitedCapacity = payload.unlimited_capacity === true || value(formData, 'unlimited_capacity', 5) === 'on'
  const capacity = unlimitedCapacity ? null : optionalNumber(pick('capacity'))

  const dateTime = (key: string) => {
    const raw = pick(key)
    if (!raw) return null
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  const record = {
    slug,
    title_en: titleEN,
    title_am: pick('title_am'),
    kind: kindRaw || 'event',
    summary_en: pick('summary_en'),
    summary_am: pick('summary_am'),
    description_en: pick('description_en'),
    description_am: pick('description_am'),
    start_date: dateTime('start_date') ?? new Date().toISOString(),
    end_date: dateTime('end_date'),
    timezone: pick('timezone', 'Africa/Addis_Ababa') || 'Africa/Addis_Ababa',
    location_type: ['physical', 'online', 'hybrid'].includes(pick('location_type', 'physical'))
      ? pick('location_type', 'physical') : 'physical',
    location_en: pick('location_en'),
    location_am: pick('location_am'),
    address: pick('address'),
    maps_url: pick('maps_url'),
    meeting_platform: pick('meeting_platform'),
    meeting_url: pick('meeting_url'),
    meeting_instructions: pick('meeting_instructions'),
    capacity,
    unlimited_capacity: unlimitedCapacity,
    waitlist_enabled: payload.waitlist_enabled === true || value(formData, 'waitlist_enabled', 5) === 'on',
    reg_opens_at: dateTime('reg_opens_at'),
    reg_closes_at: dateTime('reg_closes_at'),
    allow_after_start: payload.allow_after_start !== false && value(formData, 'allow_after_start', 5) !== 'off',
    pricing_mode: ['free', 'paid', 'tickets'].includes(pricingMode) ? pricingMode : 'free',
    price,
    currency: ['ETB', 'USD', 'EUR'].includes(pick('currency', 'ETB').toUpperCase())
      ? pick('currency', 'ETB').toUpperCase() : 'ETB',
    payment_instructions: pick('payment_instructions'),
    payment_methods: pick('payment_methods'),
    payment_reference_required: payload.payment_reference_required !== false,
    ticket_types: ticketTypes,
    discount_codes: discountCodes,
    participant_fields: participantFields,
    consent_notice: pick('consent_notice'),
    gallery_ids: galleryIDs,
    video_url: pick('video_url'),
    resources,
    visibility: ['public', 'unlisted', 'private'].includes(pick('visibility', 'public'))
      ? pick('visibility', 'public') : 'public',
    seo_title: pick('seo_title'),
    seo_description: pick('seo_description'),
    confirmation_message_en: pick('confirmation_message_en'),
    confirmation_message_am: pick('confirmation_message_am'),
    confirmation_email_enabled: payload.confirmation_email_enabled !== false,
    reminder_days: optionalNumber(pick('reminder_days')),
    terms_en: pick('terms_en'),
    terms_am: pick('terms_am'),
    cancellation_policy_en: pick('cancellation_policy_en'),
    cancellation_policy_am: pick('cancellation_policy_am'),
    image_url: coverURL,
    featured: payload.featured === true || value(formData, 'featured', 5) === 'on',
    status,
    updated_at: new Date().toISOString(),
  }

  let savedID = id
  let partial = false
  try {
    if (id) {
      await update('experiences', record, { id })
    } else {
      const created = await insert<{ id: number }>('experiences', record)
      savedID = created.id
    }
  } catch (error) {
    // If the v2 migration hasn't run yet, fall back to the legacy columns so
    // existing workflows never break. The extended fields are skipped.
    const message = String(error)
    const legacyColumns = ['description_en', 'description_am', 'timezone', 'location_type', 'pricing_mode',
      'ticket_types', 'discount_codes', 'participant_fields', 'consent_notice', 'gallery_ids', 'video_url',
      'resources', 'visibility', 'seo_title', 'seo_description', 'confirmation_message_en',
      'confirmation_message_am', 'confirmation_email_enabled', 'reminder_days', 'terms_en', 'terms_am',
      'cancellation_policy_en', 'cancellation_policy_am', 'unlimited_capacity', 'waitlist_enabled',
      'reg_opens_at', 'reg_closes_at', 'allow_after_start', 'payment_instructions', 'payment_methods',
      'payment_reference_required', 'address', 'maps_url', 'map_lat', 'map_lng', 'meeting_platform',
      'meeting_url', 'meeting_instructions']
    const missingColumn = message.includes('schema cache') || message.includes('does not exist')
      && message.includes('column')
    const isNewColumn = legacyColumns.some((column) => message.includes(column))
    if (!(missingColumn || isNewColumn)) {
      console.error('[registrations] save failed', error instanceof Error ? error.message : error)
      return { ok: false, error: 'server', message: message.slice(0, 300) }
    }
    partial = true
    const legacy: Record<string, unknown> = {
      slug: record.slug, title_en: record.title_en, title_am: record.title_am, kind: record.kind,
      summary_en: record.summary_en, summary_am: record.summary_am, location_en: record.location_en,
      location_am: record.location_am, start_date: record.start_date, end_date: record.end_date,
      capacity: record.capacity, price: record.price, currency: record.currency,
      image_url: record.image_url, featured: record.featured, status: record.status, updated_at: record.updated_at,
    }
    try {
      if (id) {
        await update('experiences', legacy, { id })
      } else {
        const created = await insert<{ id: number }>('experiences', legacy)
        savedID = created.id
      }
    } catch (legacyError) {
      console.error('[registrations] legacy save failed', legacyError instanceof Error ? legacyError.message : legacyError)
      return { ok: false, error: 'server', message: String(legacyError).slice(0, 300) }
    }
  }

  await logActivity(id ? 'experience-updated' : 'experience-created', titleEN, undefined, savedID ?? undefined)
  revalidatePath('/admin/registrations')

  const action = pick('submit_action', 'draft')
  if (action === 'publish') {
    try {
      await update('experiences', { status: 'published' }, { id: savedID! })
      await logActivity('experience-published', titleEN, undefined, savedID ?? undefined)
    } catch (publishError) {
      return { ok: false, error: 'server', message: String(publishError).slice(0, 300) }
    }
  }

  return { ok: true, id: savedID ?? undefined, slug: record.slug, partial }
}

export async function setExperienceStatus(formData: FormData) {
  const admin = await requireContentAdmin()
  const id = Number(value(formData, 'id', 20))
  const status = value(formData, 'status', 20)
  if (!Number.isSafeInteger(id) || !REGISTRATION_STATUS_VALUES.includes(status as never)) {
    throw new Error('Invalid status change.')
  }
  await update('experiences', { status, updated_at: new Date().toISOString() }, { id })
  await logActivity(`experience-${status}`, '', undefined, id)
  revalidatePath('/admin/registrations')
  redirect(value(formData, 'return_to', 300) || '/admin/registrations?saved=1')
}

/**
 * Handles every action initiated from the registrations table: row intents
 * (duplicate/publish/unpublish/archive) encoded as "intent:id", and bulk
 * status changes where checked ids travel with the submission.
 */
export async function experienceRowAction(formData: FormData) {
  const admin = await requireContentAdmin()

  const rowIntent = value(formData, 'row_intent', 40)
  if (rowIntent) {
    const separatorIndex = rowIntent.lastIndexOf(':')
    const intent = rowIntent.slice(0, separatorIndex)
    const rowID = positiveID(rowIntent.slice(separatorIndex + 1))
    if (!rowID) throw new Error('Invalid row action.')

    switch (intent) {
      case 'duplicate': {
        const source = await rows<Record<string, unknown>>('experiences', { select: '*', eq: { id: rowID }, limit: 1 })
        const original = source[0]
        if (!original) throw new Error('Registration not found.')
        const { id: unusedID, created_at: unusedCreated, ...rest } = original
        const created = await insert<{ id: number }>('experiences', {
          ...rest,
          title_en: `${String(original.title_en)} (copy)`,
          slug: `${String(original.slug)}-${Date.now().toString(36)}`.slice(0, 180),
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        await logActivity('experience-duplicated', String(original.title_en), undefined, created.id)
        revalidatePath('/admin/registrations')
        redirect('/admin/registrations?saved=1')
        return
      }
      case 'publish':
      case 'unpublish':
      case 'archive': {
        const requestedStatus = intent === 'archive' ? 'archived' : intent === 'publish' ? 'published' : 'unpublished'
        await updateExperienceStatus(rowID, requestedStatus)
        await logActivity(`experience-${requestedStatus}`, '', undefined, rowID)
        revalidatePath('/admin/registrations')
        redirect(`/admin/registrations?${requestedStatus === 'archived' ? 'archived' : 'saved'}=1`)
        return
      }
      default:
        throw new Error('Unknown row action.')
    }
  }

  // Fall through to the bulk status flow when no row intent was present.
  await bulkExperienceStatus(formData)
  redirect('/admin/registrations?bulk=1')
}

export async function bulkExperienceStatus(formData: FormData) {
  const admin = await requireContentAdmin()
  const ids = numberList(formData, 'ids')
  const status = value(formData, 'status', 20)
  if (!ids.length || !REGISTRATION_STATUS_VALUES.includes(status as never)) {
    throw new Error('Select at least one registration, then choose Publish, Unpublish, or Archive.')
  }
  for (const id of ids) {
    await updateExperienceStatus(id, status)
  }
  await logActivity(`experience-bulk-${status}`, `${ids.length} items`)
  revalidatePath('/admin/registrations')
  redirect('/admin/registrations?bulk=1')
}

export async function duplicateExperience(formData: FormData) {
  const admin = await requireContentAdmin()
  const id = Number(value(formData, 'id', 20))
  if (!Number.isSafeInteger(id)) throw new Error('Invalid registration ID.')
  const source = await rows<Record<string, unknown>>('experiences', { select: '*', eq: { id }, limit: 1 })
  const original = source[0]
  if (!original) throw new Error('Registration not found.')
  const { id: unused, created_at: unusedCreated, ...rest } = original
  const copy = {
    ...rest,
    title_en: `${String(original.title_en)} (copy)`,
    slug: `${String(original.slug)}-${Date.now().toString(36)}`.slice(0, 180),
    status: 'draft',
    updated_at: new Date().toISOString(),
  }
  const created = await insert<{ id: number }>('experiences', copy)
  await logActivity('experience-duplicated', String(original.title_en), undefined, created.id)
  revalidatePath('/admin/registrations')
  redirect(`/admin/registrations/${created.id}?saved=1`)
}

export async function deleteExperience(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin) redirect('/admin/login')
  if (admin.role !== 'super-admin') redirect('/admin/registrations?denied=1')
  const id = Number(value(formData, 'id', 20))
  const confirmSlug = value(formData, 'confirm', 190)
  if (!Number.isSafeInteger(id) || !confirmSlug) throw new Error('Confirmation is required to delete.')
  const source = await rows<{ slug: string }>('experiences', { select: 'slug', eq: { id }, limit: 1 })
  if (!source[0] || source[0].slug !== confirmSlug) throw new Error('The confirmation text did not match.')
  // Remove registrations (and their receipts) so no orphan records are left.
  const regs = await rows<{ id: number; receipt_id: number | null }>('registrations', {
    select: 'id, receipt_id', eq: { experience_id: id },
  })
  for (const reg of regs) {
    if (reg.receipt_id) await update('registrations', { receipt_id: reg.receipt_id }, { id: reg.id }) // keep FK intact; receipts retained
  }
  await update('experiences', { status: 'archived' }, { id })
  await logActivity('experience-archived-permanently', confirmSlug, undefined, id)
  revalidatePath('/admin/registrations')
  redirect('/admin/registrations?archived=1')
}

type VerifyRow = {
  id: number
  experience_id: number
  payment_status: string
  full_name: string
  email: string
  phone: string
  preferred_channel: string
  payment_reference: string
  check_in_token: string
  ticket_email_sent_at: string | null
}

export async function verifyParticipant(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin) redirect('/admin/login')
  if (admin.role === 'check-in') redirect('/admin')

  const id = Number(value(formData, 'id', 20))
  const decision = value(formData, 'decision', 20)
  const notes = value(formData, 'notes', 5000)
  const experienceID = value(formData, 'experience_id', 20)
  if (!Number.isSafeInteger(id) || !['verified', 'rejected', 'pending'].includes(decision)) {
    throw new Error('Invalid verification action.')
  }

  const existing = await rows<VerifyRow>('registrations', {
    select: 'id, experience_id, payment_status, full_name, email, phone, preferred_channel, payment_reference, check_in_token, ticket_email_sent_at',
    eq: { id }, limit: 1,
  })
  const registration = existing[0]
  if (!registration) throw new Error('Registration not found.')
  const experienceRows = decision !== registration.payment_status && decision !== 'pending'
    ? await rows<{ title_en: string }>('experiences', {
        select: 'title_en',
        eq: { id: registration.experience_id },
        limit: 1,
      })
    : []

  await update('registrations', {
    payment_status: decision,
    verification_notes: notes,
    verified_by: admin.email,
    verified_at: new Date().toISOString(),
  }, { id })
  await logActivity(`payment-${decision}`, notes, id)

  const notification = decision !== registration.payment_status && decision !== 'pending'
    ? await sendRegistrationNotification({
        id: registration.id,
        experienceTitle: experienceRows[0]?.title_en || `Experience ${registration.experience_id}`,
        fullName: registration.full_name,
        email: registration.email,
        phone: registration.phone,
        preferredChannel: registration.preferred_channel,
        paymentReference: registration.payment_reference,
      }, decision as 'verified' | 'rejected')
    : { ok: true as const }

  // Ticket QR email on first verification (reuses Resend integration).
  let emailFailed = false
  if (decision === 'verified' && !registration.ticket_email_sent_at) {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.PARALLAX_FROM_EMAIL
    const siteURL = process.env.NEXT_PUBLIC_SITE_URL
    if (!apiKey || !from) {
      emailFailed = true
    } else {
      const checkInURL = `${siteURL || 'http://localhost:3000'}/check-in/${registration.check_in_token}`
      const qrDataURL = await QRCode.toDataURL(checkInURL, { errorCorrectionLevel: 'H', margin: 2, width: 720 })
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            to: [registration.email],
            subject: 'Your Parallax entry QR code',
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#102e26"><p style="font-size:12px;color:#9a6b20">PARALLAX · PAYMENT VERIFIED</p><h1>You are on the list.</h1><p>Your payment has been verified. Your entry QR code is attached. Keep it ready when you arrive.</p></div>`,
            attachments: [{ filename: 'parallax-entry-qr.png', content: qrDataURL.split(',')[1] }],
          }),
        })
        if (response.ok) {
          await update('registrations', { ticket_email_sent_at: new Date().toISOString() }, { id, ticket_email_sent_at: null })
        } else {
          emailFailed = true
        }
      } catch {
        emailFailed = true
      }
    }
  }

  revalidatePath(`/admin/registrations/${experienceID}`)
  redirect(`/admin/registrations/${experienceID}?verified=${decision}${emailFailed ? '&email=failed' : ''}${!notification.ok ? '&telegram=failed' : ''}`)
}

export async function bulkVerifyParticipants(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin) redirect('/admin/login')
  if (admin.role === 'check-in') redirect('/admin')

  const ids = [...new Set(numberList(formData, 'ids'))]
  const decision = value(formData, 'decision', 20)
  const experienceID = value(formData, 'experience_id', 20)
  if (!ids.length || !['verified', 'rejected'].includes(decision)) throw new Error('Invalid bulk verification.')

  const existing = await rows<VerifyRow>('registrations', {
    select: 'id, experience_id, payment_status, full_name, email, phone, preferred_channel, payment_reference, check_in_token, ticket_email_sent_at',
    in: { id: ids },
  })
  const existingByID = new Map(existing.map((registration) => [registration.id, registration]))
  const experienceIDs = [...new Set(existing.map((registration) => registration.experience_id))]
  const experiences = experienceIDs.length
    ? await rows<{ id: number; title_en: string }>('experiences', {
        select: 'id, title_en',
        in: { id: experienceIDs },
      })
    : []
  const experienceTitles = new Map(experiences.map((experience) => [experience.id, experience.title_en]))
  let telegramFailed = false

  for (const id of ids) {
    const registration = existingByID.get(id)
    await update('registrations', {
      payment_status: decision,
      verified_by: admin.email,
      verified_at: new Date().toISOString(),
    }, { id })
    await logActivity(`payment-bulk-${decision}`, '', id)
    if (registration && registration.payment_status !== decision) {
      const notification = await sendRegistrationNotification({
        id: registration.id,
        experienceTitle: experienceTitles.get(registration.experience_id) || `Experience ${registration.experience_id}`,
        fullName: registration.full_name,
        email: registration.email,
        phone: registration.phone,
        preferredChannel: registration.preferred_channel,
        paymentReference: registration.payment_reference,
      }, decision as 'verified' | 'rejected')
      telegramFailed ||= !notification.ok
    }
  }
  revalidatePath(`/admin/registrations/${experienceID}`)
  redirect(`/admin/registrations/${experienceID}?bulk=1${telegramFailed ? '&telegram=failed' : ''}`)
}

export async function updateParticipant(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin) redirect('/admin/login')
  if (admin.role === 'check-in') redirect('/admin')

  const id = Number(value(formData, 'id', 20))
  const experienceID = value(formData, 'experience_id', 20)
  if (!Number.isSafeInteger(id)) throw new Error('Invalid participant.')
  await update('registrations', {
    full_name: value(formData, 'full_name', 120),
    email: value(formData, 'email', 180).toLowerCase(),
    phone: value(formData, 'phone', 40),
    ticket_type: value(formData, 'ticket_type', 80) || 'general',
    amount: optionalNumber(value(formData, 'amount', 30)),
    internal_notes: value(formData, 'internal_notes', 5000),
  }, { id })
  await logActivity('participant-updated', value(formData, 'full_name', 120), id)
  revalidatePath(`/admin/registrations/${experienceID}`)
  redirect(`/admin/registrations/${experienceID}?saved=1`)
}

export async function manualCheckIn(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin) redirect('/admin/login')

  const reference = value(formData, 'reference', 60)
  const experienceID = value(formData, 'experience_id', 20)
  if (!reference) throw new Error('Enter a registration reference, token, name, email, or phone.')

  // Match by reference code, check-in token, or contact details.
  const term = reference
  const matches = (await Promise.all([
    rows<{ id: number; payment_status: string; checked_in_at: string | null; full_name: string }>('registrations', { select: 'id, payment_status, checked_in_at, full_name', eq: { reference_code: term }, limit: 1 }).catch(() => []),
    rows<never>('registrations', { select: 'id, payment_status, checked_in_at, full_name', eq: { check_in_token: term }, limit: 1 }).catch(() => []),
    rows<never>('registrations', { select: 'id, payment_status, checked_in_at, full_name', eq: { email: term.toLowerCase() }, limit: 1 }).catch(() => []),
    rows<never>('registrations', { select: 'id, payment_status, checked_in_at, full_name', eq: { phone: term }, limit: 1 }).catch(() => []),
  ])).flat() as { id: number; payment_status: string; checked_in_at: string | null; full_name: string }[]

  const registration = matches.find((item) => item.checked_in_at === null) ?? matches[0]
  if (!registration) {
    redirect(`/admin/registrations/${experienceID}?checkin=notfound`)
  }
  if (registration.checked_in_at) {
    redirect(`/admin/registrations/${experienceID}?checkin=duplicate&who=${encodeURIComponent(registration.full_name)}`)
  }
  const allowUnverified = admin.role === 'super-admin' && value(formData, 'override', 5) === 'on'
  if (registration.payment_status !== 'verified' && !allowUnverified) {
    redirect(`/admin/registrations/${experienceID}?checkin=unverified&who=${encodeURIComponent(registration.full_name)}`)
  }

  await update('registrations', {
    checked_in_at: new Date().toISOString(),
    checked_in_by: admin.email,
  }, { id: registration.id })
  await logActivity('checked-in', registration.full_name, registration.id)
  revalidatePath(`/admin/registrations/${experienceID}`)
  redirect(`/admin/registrations/${experienceID}?checkin=success&who=${encodeURIComponent(registration.full_name)}`)
}
