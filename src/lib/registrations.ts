// Shared data layer for the Registrations module.
// Uses the existing Supabase-backed helpers in @/lib/db.

import { rows, publicRows } from '@/lib/db'
import { publicMediaURL } from '@/lib/storage'

import {
  FIELD_TYPES,
} from '@/lib/registration-constants'

export {
  CATEGORY_OPTIONS, CATEGORY_LABELS, FIELD_TYPES,
  type RegistrationCategory,
} from '@/lib/registration-constants'

export type TicketType = {
  id: string
  name_en: string
  name_am: string
  description: string
  price: number
  quantity: number | null
  sale_starts: string | null
  sale_ends: string | null
  per_person_limit: number
}

export type DiscountCode = {
  code: string
  percent_off: number
  active: boolean
}

export type ParticipantField = {
  key: string
  label_en: string
  label_am: string
  type: (typeof FIELD_TYPES)[number]
  required: boolean
  options?: string[]
}

export type StoredResource = {
  name: string
  media_id: number | null
  url: string | null
}

export type ExperienceLike = {
  id: number
  slug: string
  title_en: string
  title_am: string
  kind: string
  summary_en: string
  summary_am: string
  description_en: string
  description_am: string
  location_type: string
  location_en: string
  location_am: string
  address: string
  maps_url: string
  start_date: string
  end_date: string | null
  timezone: string
  capacity: number | null
  unlimited_capacity: boolean
  waitlist_enabled: boolean
  reg_opens_at: string | null
  reg_closes_at: string | null
  allow_after_start: boolean
  pricing_mode: string
  price: number | null
  currency: string
  payment_instructions: string
  payment_methods: string
  ticket_types: TicketType[]
  status: string
  created_at: string
  image_url: string | null
  gallery_ids: number[]
  video_id: number | null
  video_url: string | null
  resources: StoredResource[]
  consent_notice: string
  terms_en: string
  terms_am: string
  visibility: string
}

export const REGISTRATION_STATUS_VALUES = ['draft', 'published', 'unpublished', 'archived'] as const

const EXTENDED_EXPERIENCE_SELECT = [
  'id, slug, title_en, title_am, kind, summary_en, summary_am, location_en, location_am,',
  'start_date, end_date, capacity, price, currency, image_url, status, created_at,',
  'description_en, description_am, timezone, location_type, address, maps_url, meeting_platform,',
  'meeting_url, meeting_instructions, unlimited_capacity, waitlist_enabled, reg_opens_at,',
  'reg_closes_at, allow_after_start, pricing_mode, payment_instructions, payment_methods,',
  'payment_reference_required, ticket_types, discount_codes, participant_fields, consent_notice,',
  'gallery_ids, video_url, resources, visibility, seo_title, seo_description,',
  'confirmation_message_en, confirmation_message_am, confirmation_email_enabled, reminder_days,',
  'terms_en, terms_am, cancellation_policy_en, cancellation_policy_am',
].join(' ')

const LEGACY_EXPERIENCE_SELECT =
  'id, slug, title_en, title_am, kind, summary_en, summary_am, location_en, location_am, start_date, end_date, capacity, price, currency, image_url, status, created_at'

async function experienceSelectFallback(): Promise<boolean> {
  // Probe once per process whether the v2 columns exist.
  // biome-ignore lint/suspicious/noExplicitAny: module cache
  const probe = (globalThis as any).__plx_reg_v2 as boolean | undefined
  if (probe !== undefined) return probe
  try {
    await rows('experiences', { select: 'id, description_en', limit: 1 })
    // biome-ignore lint/suspicious/noExplicitAny: module cache
    ;(globalThis as any).__plx_reg_v2 = true
    return true
  } catch {
    // biome-ignore lint/suspicious/noExplicitAny: module cache
    ;(globalThis as any).__plx_reg_v2 = false
    return false
  }
}

export async function hasExtendedSchema() {
  return experienceSelectFallback()
}

function parseJSON(value: unknown, fallback: unknown) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return fallback
    }
  }
  return value
}

function normalizeExperience(raw: Record<string, unknown>): ExperienceLike {
  return {
    id: Number(raw.id),
    slug: String(raw.slug ?? ''),
    title_en: String(raw.title_en ?? ''),
    title_am: String(raw.title_am ?? ''),
    kind: String(raw.kind ?? 'event'),
    summary_en: String(raw.summary_en ?? ''),
    summary_am: String(raw.summary_am ?? ''),
    description_en: String(raw.description_en ?? ''),
    description_am: String(raw.description_am ?? ''),
    location_type: String(raw.location_type ?? 'physical'),
    location_en: String(raw.location_en ?? ''),
    location_am: String(raw.location_am ?? ''),
    address: String(raw.address ?? ''),
    maps_url: String(raw.maps_url ?? ''),
    start_date: String(raw.start_date ?? ''),
    end_date: raw.end_date ? String(raw.end_date) : null,
    timezone: String(raw.timezone ?? 'Africa/Addis_Ababa'),
    capacity: raw.capacity === null || raw.capacity === undefined ? null : Number(raw.capacity),
    unlimited_capacity: Boolean(raw.unlimited_capacity),
    waitlist_enabled: Boolean(raw.waitlist_enabled),
    reg_opens_at: raw.reg_opens_at ? String(raw.reg_opens_at) : null,
    reg_closes_at: raw.reg_closes_at ? String(raw.reg_closes_at) : null,
    allow_after_start: raw.allow_after_start !== false,
    pricing_mode: String(raw.pricing_mode ?? ((raw.price ?? null) !== null ? 'paid' : 'free')),
    price: raw.price === null || raw.price === undefined ? null : Number(raw.price),
    currency: String(raw.currency ?? 'ETB'),
    payment_instructions: String(raw.payment_instructions ?? ''),
    payment_methods: String(raw.payment_methods ?? ''),
    ticket_types: parseJSON(raw.ticket_types, []) as TicketType[],
    status: String(raw.status ?? 'draft'),
    created_at: String(raw.created_at ?? ''),
    image_url: raw.image_url ? String(raw.image_url) : null,
    gallery_ids: parseJSON(raw.gallery_ids, []) as number[],
    video_id: raw.video_id === null || raw.video_id === undefined ? null : Number(raw.video_id),
    video_url: raw.video_url ? String(raw.video_url) : null,
    resources: parseJSON(raw.resources, []) as StoredResource[],
    consent_notice: String(raw.consent_notice ?? ''),
    terms_en: String(raw.terms_en ?? ''),
    terms_am: String(raw.terms_am ?? ''),
    visibility: String(raw.visibility ?? 'public'),
  }
}

export type ListOptions = {
  search?: string
  category?: string
  status?: string
  paymentMode?: string
  sort?: 'newest' | 'oldest' | 'popularity' | 'revenue'
}

export type ExperienceListItem = ExperienceLike & {
  participant_count: number
  verified_count: number
  revenue: number
}

export async function listRegistrations(options: ListOptions = {}): Promise<ExperienceListItem[]> {
  const extended = await hasExtendedSchema()
  const sortMap: Record<string, { column: string; ascending?: boolean }> = {
    newest: { column: 'created_at', ascending: false },
    oldest: { column: 'created_at' },
    popularity: { column: 'participant_count', ascending: false },
    revenue: { column: 'revenue', ascending: false },
  }
  const data = await rows<Record<string, unknown>>(
    'experiences_with_stats',
    { ...(extended ? {} : {}), select: '*', order: sortMap[options.sort ?? 'newest'], limit: 500 },
  ).catch(async () => {
    // Fallback when the analytics view is missing: query experiences directly.
    const base = await rows<Record<string, unknown>>('experiences', {
      select: extended ? EXTENDED_EXPERIENCE_SELECT : LEGACY_EXPERIENCE_SELECT,
      order: { column: 'created_at', ascending: (options.sort ?? 'newest') !== 'oldest' },
      limit: 500,
    })
    return base
  })

  let items: ExperienceLike[] = data.map(normalizeExperience)
  if (options.search) {
    const q = options.search.toLowerCase()
    items = items.filter((item) =>
      item.title_en.toLowerCase().includes(q) || item.title_am.includes(options.search!) || item.slug.includes(q))
  }
  if (options.category && options.category !== 'all') items = items.filter((item) => item.kind === options.category)
  if (options.status && options.status !== 'all') items = items.filter((item) => item.status === options.status)
  if (options.paymentMode === 'free') items = items.filter((item) => item.pricing_mode === 'free')
  if (options.paymentMode === 'paid') items = items.filter((item) => item.pricing_mode !== 'free')

  return attachStats(items)
}

export async function attachStats(items: ExperienceLike[]): Promise<ExperienceListItem[]> {
  const ids = items.map((item) => item.id)
  if (!ids.length) return []
  // Prices are the authoritative fallback whenever a registration row has no
  // stored amount (older rows, or RPCs created before amount tracking existed).
  const prices = await rows<{ id: number; price: number | null }>('experiences', {
    select: 'id, price', in: { id: ids },
  }).catch(() => [] as { id: number; price: number | null }[])
  const priceByExperience = new Map(prices.map((item) => [Number(item.id), Number(item.price ?? 0)]))

  const regs = await rows<Record<string, unknown>>('registrations', {
    select: 'id, experience_id, payment_status, amount',
    in: { experience_id: ids },
  }).catch(async (): Promise<Record<string, unknown>[]> => {
    // Legacy schema: no `amount` column — derive revenue purely from the price.
    const legacy = (await rows<Record<string, unknown>>('registrations', {
      select: 'id, experience_id, payment_status',
      in: { experience_id: ids },
    }).catch(() => [])) as Record<string, unknown>[]
    return legacy.map((reg) => ({ ...reg, amount: null }))
  })
  const stats = new Map<number, { count: number; verified: number; revenue: number }>()
  for (const reg of regs) {
    const experienceID = Number(reg.experience_id)
    const entry = stats.get(experienceID) ?? { count: 0, verified: 0, revenue: 0 }
    if (reg.payment_status !== 'rejected') entry.count += 1
    if (reg.payment_status === 'verified') {
      entry.verified += 1
      const stored = reg.amount === null || reg.amount === undefined ? null : Number(reg.amount)
      entry.revenue += stored ?? priceByExperience.get(experienceID) ?? 0
    }
    stats.set(experienceID, entry)
  }
  return items.map((item) => {
    const entry = stats.get(item.id) ?? { count: 0, verified: 0, revenue: 0 }
    return { ...item, participant_count: entry.count, verified_count: entry.verified, revenue: entry.revenue }
  })
}

export async function getExperienceFull(id: number): Promise<ExperienceLike | null> {
  const extended = await hasExtendedSchema()
  const data = await rows<Record<string, unknown>>('experiences', {
    select: extended ? EXTENDED_EXPERIENCE_SELECT : LEGACY_EXPERIENCE_SELECT,
    eq: { id },
    limit: 1,
  })
  if (!data[0]) return null
  return normalizeExperience(data[0])
}

export type ParticipantRow = {
  id: number
  reference_code: string | null
  full_name: string
  email: string
  phone: string
  ticket_type: string
  created_at: string
  amount: number | null
  currency: string
  payment_status: string
  verified_at: string | null
  verified_by: string | null
  verification_notes: string | null
  check_in_token: string
  checked_in_at: string | null
  receipt_id: number | null
  internal_notes: string | null
  answers: Record<string, unknown>
}

export async function listParticipants(experienceID: number, filters: {
  search?: string
  status?: string
} = {}): Promise<ParticipantRow[]> {
  const participants = await rows<Record<string, unknown>>('registrations', {
    select: '*',
    eq: { experience_id: experienceID },
    order: { column: 'created_at', ascending: false },
    limit: 1000,
  }).catch(async (): Promise<Record<string, unknown>[]> => {
    // Legacy schema: select only columns that always exist, and fill the rest.
    const legacy = (await rows<Record<string, unknown>>('registrations', {
      select: 'id, experience_id, full_name, email, phone, preferred_channel, payment_reference, payment_status, check_in_token, ticket_email_sent_at, checked_in_at, internal_notes, created_at, updated_at, receipt_id',
      eq: { experience_id: experienceID },
      order: { column: 'created_at', ascending: false },
      limit: 1000,
    }).catch(() => [])) as Record<string, unknown>[]
    const priceRows = await rows<{ id: number; price: number | null; currency: string | null }>('experiences', {
      select: 'id, price, currency', eq: { id: experienceID }, limit: 1,
    }).catch(() => [] as { id: number; price: number | null; currency: string | null }[])
    return legacy.map((reg) => ({
      ...reg,
      amount: priceRows[0]?.price ?? null,
      currency: priceRows[0]?.currency ?? 'ETB',
      answers: {},
    }))
  })
  let mapped: ParticipantRow[] = participants.map((raw) => ({
    id: Number(raw.id),
    reference_code: raw.reference_code ? String(raw.reference_code) : null,
    full_name: String(raw.full_name ?? ''),
    email: String(raw.email ?? ''),
    phone: String(raw.phone ?? ''),
    ticket_type: String(raw.ticket_type ?? 'general'),
    created_at: String(raw.created_at ?? ''),
    amount: raw.amount === null || raw.amount === undefined ? null : Number(raw.amount),
    currency: String(raw.currency ?? 'ETB'),
    payment_status: String(raw.payment_status ?? 'pending'),
    verified_at: raw.verified_at ? String(raw.verified_at) : null,
    verified_by: raw.verified_by ? String(raw.verified_by) : null,
    verification_notes: raw.verification_notes ? String(raw.verification_notes) : null,
    check_in_token: String(raw.check_in_token ?? ''),
    checked_in_at: raw.checked_in_at ? String(raw.checked_in_at) : null,
    receipt_id: raw.receipt_id === null || raw.receipt_id === undefined ? null : Number(raw.receipt_id),
    internal_notes: raw.internal_notes ? String(raw.internal_notes) : null,
    answers: parseJSON(raw.answers, {}) as Record<string, unknown>,
  }))

  if (filters.search) {
    const q = filters.search.toLowerCase()
    mapped = mapped.filter((item) =>
      item.full_name.toLowerCase().includes(q) || item.email.toLowerCase().includes(q) || item.phone.includes(q))
  }
  if (filters.status && filters.status !== 'all') mapped = mapped.filter((item) => item.payment_status === filters.status)
  return mapped
}

export type DashboardStats = {
  opportunities: number
  participants: number
  pending: number
  verified: number
  rejected: number
  revenue: number
  checkInRate: number
  daily: { day: string; count: number }[]
  byStatus: { status: string; count: number }[]
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [opportunities, participantsRaw] = await Promise.all([
    rows<{ id: number }>('experiences', { select: 'id' }),
    rows<Record<string, unknown>>('registrations', {
      select: 'id, payment_status, amount, currency, checked_in_at, created_at, experience_id',
    }).catch(async (): Promise<Record<string, unknown>[]> => {
      // Legacy schema: the v2 columns (amount/currency) don't exist yet —
      // derive stats from legacy columns plus the experience price.
      const legacy = (await rows<Record<string, unknown>>('registrations', {
        select: 'id, payment_status, checked_in_at, created_at, experience_id',
      }).catch(() => [])) as Record<string, unknown>[]
      const prices = await rows<{ id: number; price: number | null; currency: string | null }>('experiences', {
        select: 'id, price, currency',
      }).catch(() => [] as { id: number; price: number | null; currency: string | null }[])
      const priceByExperience = new Map(prices.map((item) => [Number(item.id), item]))
      return legacy.map((reg) => {
        const source = priceByExperience.get(Number(reg.experience_id))
        return { ...reg, amount: source?.price ?? null, currency: source?.currency ?? 'ETB' }
      })
    }),
  ])

  const allPrices = await rows<{ id: number; price: number | null }>('experiences', {
    select: 'id, price',
  }).catch(() => [] as { id: number; price: number | null }[])
  const priceByExperience = new Map(allPrices.map((item) => [Number(item.id), Number(item.price ?? 0)]))
  const participants = participantsRaw

  let pending = 0
  let verified = 0
  let rejected = 0
  let checkedIn = 0
  let revenueETB = 0
  const daily = new Map<string, number>()
  const cutoff90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  for (const reg of participants) {
    switch (reg.payment_status) {
      case 'pending': pending += 1; break
      case 'verified': verified += 1; break
      case 'rejected': rejected += 1; break
    }
    if (reg.payment_status === 'verified' && reg.checked_in_at) checkedIn += 1
    if (reg.payment_status === 'verified') {
      const stored = reg.amount === undefined || reg.amount === null ? null : Number(reg.amount)
      const amount = stored ?? Number(priceByExperience.get(Number(reg.experience_id)) ?? 0)
      revenueETB += String(reg.currency ?? 'ETB') === 'ETB' ? amount : amount * 55 // approx. display normalization
    }
    const day = String(reg.created_at).slice(0, 10)
    if (day >= cutoff90) daily.set(day, (daily.get(day) ?? 0) + 1)
  }

  const days: { day: string; count: number }[] = []
  for (let i = 89; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    days.push({ day: date, count: daily.get(date) ?? 0 })
  }

  return {
    opportunities: opportunities.length,
    participants: participants.length,
    pending,
    verified,
    rejected,
    revenue: Math.round(revenueETB),
    checkInRate: verified ? Math.round((checkedIn / verified) * 100) : 0,
    daily: days,
    byStatus: [
      { status: 'verified', count: verified },
      { status: 'pending', count: pending },
      { status: 'rejected', count: rejected },
    ],
  }
}

// —— public (anon RLS) reads for the public registration page ——
export async function getPublicExperienceBySlug(slug: string) {
  const extended = await hasExtendedSchema()
  const data = await publicRows<Record<string, unknown>>('experiences', {
    select: extended ? EXTENDED_EXPERIENCE_SELECT : LEGACY_EXPERIENCE_SELECT,
    eq: { slug },
    limit: 1,
  })
  if (!data[0]) return null
  const experience = normalizeExperience(data[0])
  const parts = await attachStats([experience])
  return parts[0]
}

export function isOpenForRegistration(experience: {
  status: string
  reg_opens_at: string | null
  reg_closes_at: string | null
  allow_after_start: boolean
  start_date: string
}) {
  if (experience.status !== 'published') return { open: false, reason: 'closed' as const }
  const now = Date.now()
  if (experience.reg_opens_at && new Date(experience.reg_opens_at).getTime() > now) {
    return { open: false, reason: 'not-open-yet' as const }
  }
  if (experience.reg_closes_at && new Date(experience.reg_closes_at).getTime() < now) {
    return { open: false, reason: 'closed' as const }
  }
  if (!experience.allow_after_start && new Date(experience.start_date).getTime() < now) {
    return { open: false, reason: 'started' as const }
  }
  return { open: true, reason: null }
}

export function mediaURL(filename: string) {
  return publicMediaURL(filename)
}
