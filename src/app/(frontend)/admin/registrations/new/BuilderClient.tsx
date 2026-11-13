'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { saveRegistrationDraft, type SaveRegistrationResult } from '../actions'
import { CATEGORY_OPTIONS, CATEGORY_LABELS, FIELD_TYPES } from '@/lib/registration-constants'
import { registrationTitleText } from '@/lib/registration-title'
import { ExperienceDescription } from '@/app/(frontend)/components/ExperienceDescription'
import { inputClass, primaryButton, ghostButton, fieldLabel } from '../shared'

type Ticket = {
  id: string
  name_en: string
  name_am: string
  description: string
  price: string
  quantity: string
  sale_starts: string
  sale_ends: string
  per_person_limit: string
}
type CustomField = {
  key: string
  label_en: string
  label_am: string
  type: string
  required: boolean
  options: string
}

const STEPS = ['Basic information', 'Date & location', 'Configuration', 'Participant info', 'Media & resources', 'Publication', 'Preview']

function slugify(input: string) {
  return input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 180)
}

function toLocalInput(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function RichText({ value, onChange, name, dir, maxLength }: { value: string; onChange: (next: string) => void; name: string; dir?: 'auto'; maxLength?: number }) {
  const wrap = (prefix: string, suffix = prefix) => {
    onChange(`${value}\n${prefix}text${suffix}`)
  }
  return (
    <div className="mt-1.5 rounded-xl border border-zinc-300 bg-white shadow-sm focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-600/15">
      <div className="flex flex-wrap gap-1 border-b border-zinc-100 px-2 py-1.5">
        {([
          ['H1', () => wrap('<h1>', '</h1>')],
          ['H2', () => wrap('<h2>', '</h2>')],
          ['¶', () => wrap('<p>', '</p>')],
          ['B', () => wrap('<strong>', '</strong>')],
          ['•', () => wrap('<li>', '</li>')],
          ['🔗', () => wrap('<a href="https://">', '</a>')],
        ] as [string, () => void][]).map(([label, handler]) => (
          <button className="rounded-md px-2 py-1 text-xs font-bold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" key={label} onClick={handler} type="button">
            {label}
          </button>
        ))}
      </div>
      <textarea className="min-h-36 w-full resize-y rounded-b-xl border-0 px-3 py-2.5 text-sm outline-none" dir={dir} maxLength={maxLength} name={name} onChange={(event) => onChange(event.target.value)} value={value} />
    </div>
  )
}

export default function BuilderClient({ experience }: { experience: Record<string, unknown> | null }) {
  const exp = (experience ?? {}) as Record<string, unknown>
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [titleEN, setTitleEN] = useState(String(exp.title_en ?? ''))
  const [slug, setSlug] = useState(String(exp.slug ?? ''))
  const [slugEdited, setSlugEdited] = useState(Boolean(exp.slug))
  const [pricingMode, setPricingMode] = useState(String(exp.pricing_mode ?? 'free'))
  const [locationType, setLocationType] = useState(String(exp.location_type ?? 'physical'))
  const [unlimited, setUnlimited] = useState(Boolean(exp.unlimited_capacity))
  const [tickets, setTickets] = useState<Ticket[]>(
    (Array.isArray(exp.ticket_types) ? exp.ticket_types : []).map((raw) => {
      const ticket = raw as Record<string, unknown>
      return {
        id: String(ticket.id ?? crypto.randomUUID()),
        name_en: String(ticket.name_en ?? ''),
        name_am: String(ticket.name_am ?? ''),
        description: String(ticket.description ?? ''),
        price: String(ticket.price ?? '0'),
        quantity: String(ticket.quantity ?? ''),
        sale_starts: String(ticket.sale_starts ?? ''),
        sale_ends: String(ticket.sale_ends ?? ''),
        per_person_limit: String(ticket.per_person_limit ?? '1'),
      }
    }),
  )
  const [fields, setFields] = useState<CustomField[]>(
    (Array.isArray(exp.participant_fields) ? exp.participant_fields : []).map((raw) => {
      const field = raw as Record<string, unknown>
      return {
        key: String(field.key ?? crypto.randomUUID()),
        label_en: String(field.label_en ?? ''),
        label_am: String(field.label_am ?? ''),
        type: String(field.type ?? 'text'),
        required: Boolean(field.required),
        options: Array.isArray(field.options) ? (field.options as string[]).join(', ') : '',
      }
    }),
  )
  const [descriptionEN, setDescriptionEN] = useState(String(exp.description_en ?? ''))
  const [descriptionAM, setDescriptionAM] = useState(String(exp.description_am ?? ''))
  const [errors, setErrors] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Tracks the server-assigned ID after the first save so re-saves become updates.
  const [savedID, setSavedID] = useState<number | null>(typeof exp.id === 'number' ? exp.id : null)

  // Every scalar input lives in this controlled record. Validation and the
  // submission payload therefore always read the CURRENT values, and nothing
  // is lost when switching steps (all steps stay mounted, just hidden).
  const [values, setValues] = useState<Record<string, string>>({
    title_am: String(exp.title_am ?? ''),
    kind: String(exp.kind ?? 'event'),
    summary_en: String(exp.summary_en ?? ''),
    summary_am: String(exp.summary_am ?? ''),
    start_date: toLocalInput(String(exp.start_date ?? '')),
    end_date: toLocalInput(String(exp.end_date ?? '')),
    timezone: String(exp.timezone ?? 'Africa/Addis_Ababa'),
    location_en: String(exp.location_en ?? ''),
    location_am: String(exp.location_am ?? ''),
    address: String(exp.address ?? ''),
    maps_url: String(exp.maps_url ?? ''),
    meeting_platform: String(exp.meeting_platform ?? ''),
    meeting_url: String(exp.meeting_url ?? ''),
    meeting_instructions: String(exp.meeting_instructions ?? ''),
    capacity: String(exp.capacity ?? ''),
    waitlist_enabled: exp.waitlist_enabled ? 'on' : '',
    reg_opens_at: toLocalInput(String(exp.reg_opens_at ?? '')),
    reg_closes_at: toLocalInput(String(exp.reg_closes_at ?? '')),
    allow_after_start: exp.allow_after_start !== false ? 'on' : '',
    price: String(exp.price ?? ''),
    currency: String(exp.currency ?? 'ETB'),
    payment_methods: String(exp.payment_methods ?? ''),
    payment_instructions: String(exp.payment_instructions ?? ''),
    payment_reference_required: exp.payment_reference_required !== false ? 'on' : '',
    consent_notice: String(exp.consent_notice ?? ''),
    video_url: String(exp.video_url ?? ''),
    image_url: String(exp.image_url ?? ''),
    visibility: String(exp.visibility ?? 'public'),
    reminder_days: String(exp.reminder_days ?? ''),
    seo_title: String(exp.seo_title ?? ''),
    seo_description: String(exp.seo_description ?? ''),
    confirmation_message_en: String(exp.confirmation_message_en ?? ''),
    confirmation_message_am: String(exp.confirmation_message_am ?? ''),
    confirmation_email_enabled: exp.confirmation_email_enabled !== false ? 'on' : '',
    terms_en: String(exp.terms_en ?? ''),
    terms_am: String(exp.terms_am ?? ''),
    cancellation_policy_en: String(exp.cancellation_policy_en ?? ''),
    cancellation_policy_am: String(exp.cancellation_policy_am ?? ''),
    featured: exp.featured ? 'on' : '',
  })
  const update = (key: string, next: string) => setValues((current) => ({ ...current, [key]: next }))
  const check = (key: string, label: string, help?: string) => (
    <label className="flex items-center gap-2 text-sm font-medium text-zinc-800">
      <input checked={values[key] === 'on'} className="h-4 w-4 accent-emerald-700" onChange={(event) => update(key, event.target.checked ? 'on' : '')} type="checkbox" />
      {label}{help && <span className="text-xs font-normal text-zinc-500">{help}</span>}
    </label>
  )

  const autoSlug = useMemo(() => (slugEdited ? slug : slugify(registrationTitleText(titleEN))), [slug, slugEdited, titleEN])
  const startDate = values.start_date

  function isoOrNull(localValue: string): string | null {
    if (!localValue) return null
    const parsed = new Date(localValue)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
  }

  function validate(): string[] {
    const problems: string[] = []
    if (!registrationTitleText(titleEN)) problems.push('Step 1: An English title is required.')
    if (!registrationTitleText(values.summary_en)) problems.push('Step 1: A short English description is required.')
    if (Array.from(values.summary_en).length > 10000) problems.push('Step 1: The English short description must be 10,000 characters or fewer.')
    if (!autoSlug) problems.push('Step 1: A URL slug is required.')
    if (!startDate) problems.push('Step 2: A start date is required.')
    if (locationType !== 'online' && !values.location_en.trim()) problems.push('Step 2: A location name is required for physical events.')
    if (locationType !== 'physical' && !values.meeting_url.trim()) problems.push('Step 2: A meeting URL is required for online events.')
    if (pricingMode === 'paid' && !values.price.trim()) problems.push('Step 3: Provide a price for paid registration.')
    if (pricingMode === 'tickets' && tickets.length === 0) problems.push('Step 3: Add at least one ticket type.')
    if (values.end_date && startDate && new Date(values.end_date) < new Date(startDate)) problems.push('Step 2: The end date must come after the start date.')
    return problems
  }

  async function submit(action: 'draft' | 'publish' | 'new') {
    const problems = validate()
    setErrors(problems)
    if (problems.length) {
      setStep(0)
      return
    }
    setSubmitting(true)
    setNotice('')
    try {
      const formData = new FormData()
      const payload: Record<string, unknown> = {
        ...(savedID ? { id: savedID } : {}),
        title_en: titleEN,
        title_am: values.title_am,
        kind: values.kind,
        slug: autoSlug,
        summary_en: values.summary_en,
        summary_am: values.summary_am,
        description_en: descriptionEN,
        description_am: descriptionAM,
        start_date: isoOrNull(startDate),
        end_date: isoOrNull(values.end_date),
        timezone: values.timezone,
        location_type: locationType,
        location_en: values.location_en,
        location_am: values.location_am,
        address: values.address,
        maps_url: values.maps_url,
        meeting_platform: values.meeting_platform,
        meeting_url: values.meeting_url,
        meeting_instructions: values.meeting_instructions,
        capacity: values.capacity ? Number(values.capacity) : null,
        unlimited_capacity: unlimited,
        waitlist_enabled: values.waitlist_enabled === 'on',
        reg_opens_at: isoOrNull(values.reg_opens_at),
        reg_closes_at: isoOrNull(values.reg_closes_at),
        allow_after_start: values.allow_after_start === 'on',
        pricing_mode: pricingMode,
        price: pricingMode === 'paid' && values.price ? Number(values.price) : null,
        currency: values.currency,
        payment_methods: values.payment_methods,
        payment_instructions: values.payment_instructions,
        payment_reference_required: values.payment_reference_required === 'on',
        ticket_types: tickets.map((ticket) => ({
          id: ticket.id,
          name_en: ticket.name_en,
          name_am: ticket.name_am,
          description: ticket.description,
          price: Number(ticket.price) || 0,
          quantity: ticket.quantity ? Number(ticket.quantity) : null,
          sale_starts: ticket.sale_starts || null,
          sale_ends: ticket.sale_ends || null,
          per_person_limit: Number(ticket.per_person_limit) || 0,
        })),
        participant_fields: fields.map((field) => ({
          key: field.key || slugify(field.label_en),
          label_en: field.label_en,
          label_am: field.label_am,
          type: field.type,
          required: field.required,
          options: field.options ? field.options.split(',').map((option) => option.trim()).filter(Boolean) : undefined,
        })),
        discount_codes: (Array.isArray(exp.discount_codes) ? exp.discount_codes : []),
        consent_notice: values.consent_notice,
        video_url: values.video_url,
        image_url: values.image_url || null,
        resources: (Array.isArray(exp.resources) ? exp.resources : []),
        visibility: values.visibility,
        seo_title: values.seo_title,
        seo_description: values.seo_description,
        confirmation_message_en: values.confirmation_message_en,
        confirmation_message_am: values.confirmation_message_am,
        confirmation_email_enabled: values.confirmation_email_enabled === 'on',
        reminder_days: values.reminder_days ? Number(values.reminder_days) : null,
        terms_en: values.terms_en,
        terms_am: values.terms_am,
        cancellation_policy_en: values.cancellation_policy_en,
        cancellation_policy_am: values.cancellation_policy_am,
        featured: values.featured === 'on',
        status: action === 'publish' ? 'published' : String(exp.status ?? 'draft'),
      }
      formData.set('payload', JSON.stringify(payload))
      formData.set('submit_action', action)
      // Collect file inputs from the always-mounted form.
      const realForm = document.getElementById('builder-form') as HTMLFormElement | null
      if (realForm) {
        for (const element of Array.from(realForm.elements)) {
          if (element instanceof HTMLInputElement && element.type === 'file' && element.files?.length) {
            formData.append(element.name, element.files[0])
          }
        }
      }
      const result = (await saveRegistrationDraft(formData)) as SaveRegistrationResult
      if (!result.ok) {
        setErrors(result.error === 'auth'
          ? ['Your session expired. Copy your work is safe in this tab — click “Sign in again”, log in, then save.']
          : [`Save failed: ${result.message ?? 'Unknown error'}`])
        setSubmitting(false)
        return
      }
      setSavedID(result.id ?? null)
      setSubmitting(false)
      if (action === 'publish') {
        router.push(`/admin/registrations/${result.id}?published=1`)
      } else if (action === 'new') {
        router.push(`/admin/registrations/${result.id}?saved=1`)
      } else {
        setNotice(result.partial
          ? 'Saved. Note: the database migration for advanced fields (tickets, custom fields, scheduling) has not been run yet, so only core fields were stored.'
          : 'Draft saved.')
      }
    } catch (error) {
      setErrors([`Save failed: ${error instanceof Error ? error.message : 'Network error — check your connection and try again.'}`])
      setSubmitting(false)
    }
  }

  function updateTicket(index: number, patch: Partial<Ticket>) {
    setTickets((current) => current.map((ticket, i) => (i === index ? { ...ticket, ...patch } : ticket)))
  }
  function updateField(index: number, patch: Partial<CustomField>) {
    setFields((current) => current.map((field, i) => (i === index ? { ...field, ...patch } : field)))
  }
  function moveField(index: number, direction: -1 | 1) {
    setFields((current) => {
      const next = [...current]
      const target = index + direction
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  function addTicket(name: string) {
    setTickets((current) => [...current, { id: crypto.randomUUID(), name_en: name, name_am: '', description: '', price: '0', quantity: '', sale_starts: '', sale_ends: '', per_person_limit: '1' }])
  }

  return (
    <div className="grid gap-5">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs font-semibold" aria-label="Builder steps">
        {STEPS.map((label, index) => (
          <li className="flex items-center gap-1.5" key={label}>
            <button
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${index === step ? 'bg-emerald-700 text-white shadow' : index < step ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
              onClick={() => setStep(index)} type="button"
            >
              <span className="tabular-nums">{index + 1}</span> {label}
            </button>
            {index < STEPS.length - 1 && <span className="text-zinc-300">›</span>}
          </li>
        ))}
      </ol>

      {notice && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">✓ {notice}</p>
      )}
      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-bold">{errors.some((entry) => entry.startsWith('Your session')) ? 'Session expired' : 'Please fix the following before publishing:'}</p>
          <ul className="mt-1 list-inside list-disc">{errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}

      {/* ONE form containing EVERY step, so no input is ever unmounted. */}
      <form id="builder-form" onSubmit={(event) => event.preventDefault()}>
        {/* Step 1 */}
        <div className={step !== 0 ? 'hidden' : ''}>
          <Section title="Basic information">
            <Grid>
              <Field label="Registration header (English)" help="Paste or write HTML with inline styles, or use the formatting buttons." required>
                <RichText maxLength={10000} name="title_en" onChange={setTitleEN} value={titleEN} />
              </Field>
              <Field label="Registration header (Amharic)" help="Paste or write HTML with inline styles, or use the formatting buttons.">
                <RichText dir="auto" maxLength={10000} name="title_am" onChange={(value) => update('title_am', value)} value={values.title_am} />
              </Field>
              <Field label="URL slug" help={`Public URL: /register/${autoSlug || 'your-title'}`}>
                <input className={inputClass} onChange={(event) => { setSlug(event.target.value); setSlugEdited(true) }} value={autoSlug} />
              </Field>
              <Field label="Registration category">
                <select className={`${inputClass} capitalize`} onChange={(event) => update('kind', event.target.value)} value={values.kind}>
                  {CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{CATEGORY_LABELS[option]}</option>)}
                </select>
              </Field>
            </Grid>
            <Grid className="mt-4">
              <Field label="Short description (English)" help="Paste or write HTML with inline styles, or use the formatting buttons." required>
                <RichText maxLength={10000} name="summary_en" onChange={(value) => update('summary_en', value)} value={values.summary_en} />
              </Field>
              <Field label="Short description (Amharic)">
                <textarea className={inputClass} dir="auto" onChange={(event) => update('summary_am', event.target.value)} rows={3} value={values.summary_am} />
              </Field>
            </Grid>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Full description (English)" help="Paste HTML or Markdown here for formatted headings, paragraphs, and lists.">
                <RichText name="description_en" onChange={setDescriptionEN} value={descriptionEN} />
              </Field>
              <Field label="Full description (Amharic)" help="Paste HTML or Markdown here for formatted headings, paragraphs, and lists.">
                <RichText name="description_am" onChange={setDescriptionAM} value={descriptionAM} />
              </Field>
            </div>
          </Section>
        </div>

        {/* Step 2 */}
        <div className={step !== 1 ? 'hidden' : ''}>
          <Section description="Give guests a clear picture of when and where this experience happens." title="Date, time and location">
            <Grid>
              <Field label="Start date & time" required><input className={inputClass} onChange={(event) => update('start_date', event.target.value)} required type="datetime-local" value={values.start_date} /></Field>
              <Field label="End date & time"><input className={inputClass} onChange={(event) => update('end_date', event.target.value)} type="datetime-local" value={values.end_date} /></Field>
              <Field label="Time zone">
                <select className={inputClass} onChange={(event) => update('timezone', event.target.value)} value={values.timezone}>
                  {['Africa/Addis_Ababa', 'UTC', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'Asia/Dubai'].map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </Field>
              <Field label="Location type">
                <select className={inputClass} onChange={(event) => setLocationType(event.target.value)} value={locationType}>
                  <option value="physical">Physical</option>
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </Field>
            </Grid>
            {locationType !== 'online' && (
              <Grid className="mt-4">
                <Field label="Location name (English)" help="Maximum 200 characters." required><input className={inputClass} maxLength={200} onChange={(event) => update('location_en', event.target.value)} value={values.location_en} /></Field>
                <Field label="Location name (Amharic)" help="Maximum 200 characters."><input className={inputClass} dir="auto" maxLength={200} onChange={(event) => update('location_am', event.target.value)} value={values.location_am} /></Field>
                <Field label="Full address"><input className={inputClass} onChange={(event) => update('address', event.target.value)} value={values.address} /></Field>
                <Field label="Google Maps URL"><input className={inputClass} onChange={(event) => update('maps_url', event.target.value)} type="url" value={values.maps_url} /></Field>
              </Grid>
            )}
            {locationType !== 'physical' && (
              <Grid className="mt-4">
                <Field label="Meeting platform"><input className={inputClass} onChange={(event) => update('meeting_platform', event.target.value)} placeholder="Zoom, Google Meet, Telegram…" value={values.meeting_platform} /></Field>
                <Field label="Meeting URL" required><input className={inputClass} onChange={(event) => update('meeting_url', event.target.value)} type="url" value={values.meeting_url} /></Field>
                <Field label="Meeting instructions"><textarea className={inputClass} onChange={(event) => update('meeting_instructions', event.target.value)} rows={2} value={values.meeting_instructions} /></Field>
              </Grid>
            )}
          </Section>
        </div>

        {/* Step 3 */}
        <div className={step !== 2 ? 'hidden' : ''}>
          <Section description="Set capacity, opening dates, and the way guests can register and pay." title="Registration configuration">
            <SubHeading>Capacity</SubHeading>
            <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${unlimited ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 to-white shadow-sm' : 'border-zinc-200 bg-zinc-50/70 hover:border-zinc-300'}`}>
              <input checked={unlimited} className="mt-1 h-4 w-4 accent-emerald-700" onChange={(event) => setUnlimited(event.target.checked)} type="checkbox" />
              <span>
                <span className="block text-sm font-bold text-zinc-900">Unlimited registration</span>
                <span className="mt-0.5 block text-xs text-zinc-500">Keep registration open without a participant cap.</span>
              </span>
            </label>
            {!unlimited && (
              <Grid className="mt-3">
                <Field label="Maximum participants"><input className={inputClass} min={1} onChange={(event) => update('capacity', event.target.value)} type="number" value={values.capacity} /></Field>
                {check('waitlist_enabled', 'Waitlist with automatic promotion')}
              </Grid>
            )}
            <SubHeading>Availability window</SubHeading>
            <Grid>
              <Field label="Registration opens"><input className={inputClass} onChange={(event) => update('reg_opens_at', event.target.value)} type="datetime-local" value={values.reg_opens_at} /></Field>
              <Field label="Registration closes"><input className={inputClass} onChange={(event) => update('reg_closes_at', event.target.value)} type="datetime-local" value={values.reg_closes_at} /></Field>
            </Grid>
            <div className="mt-2">{check('allow_after_start', 'Allow registration after the event starts')}</div>
            <SubHeading>Pricing</SubHeading>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                ['free', 'Free', 'No payment required', '✦'],
                ['paid', 'Single price', 'One price for everyone', '◈'],
                ['tickets', 'Ticket types', 'Offer multiple options', '▤'],
              ] as const).map(([mode, label, detail, icon]) => (
                <button
                  aria-pressed={pricingMode === mode}
                  className={`group flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 ${pricingMode === mode ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-white shadow-[0_10px_28px_rgba(16,46,38,0.10)] ring-2 ring-emerald-600/10' : 'border-zinc-200 bg-white hover:border-emerald-200 hover:shadow-md'}`}
                  key={mode}
                  onClick={() => setPricingMode(mode)}
                  type="button"
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${pricingMode === mode ? 'bg-emerald-700 text-white' : 'bg-zinc-100 text-zinc-500 group-hover:bg-emerald-50 group-hover:text-emerald-700'}`}>{icon}</span>
                  <span>
                    <span className="block text-sm font-bold text-zinc-900">{label}</span>
                    <span className="mt-1 block text-xs leading-5 text-zinc-500">{detail}</span>
                  </span>
                </button>
              ))}
            </div>
            {pricingMode === 'paid' && (
              <Grid className="mt-3">
                <Field label="Amount"><input className={inputClass} min={0} onChange={(event) => update('price', event.target.value)} step="0.01" type="number" value={values.price} /></Field>
                <Field label="Currency">
                  <select className={inputClass} onChange={(event) => update('currency', event.target.value)} value={values.currency}>
                    {['ETB', 'USD', 'EUR'].map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                  </select>
                </Field>
                <Field label="Payment methods (comma separated)"><input className={inputClass} onChange={(event) => update('payment_methods', event.target.value)} placeholder="Telebirr, CBE Birr, Bank transfer" value={values.payment_methods} /></Field>
                <Field label="Payment instructions"><textarea className={inputClass} onChange={(event) => update('payment_instructions', event.target.value)} rows={2} value={values.payment_instructions} /></Field>
                <div className="sm:col-span-2">{check('payment_reference_required', 'Require a payment reference number')}</div>
              </Grid>
            )}
            {pricingMode === 'tickets' && (
              <div className="mt-4 grid gap-3">
                {tickets.map((ticket, index) => (
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4" key={ticket.id}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-zinc-800">Ticket {index + 1}</p>
                      <button className="text-xs font-semibold text-red-600 hover:underline" onClick={() => setTickets((current) => current.filter((_, i) => i !== index))} type="button">Remove</button>
                    </div>
                    <Grid className="mt-3">
                      <Field label="Name (English)"><input className={inputClass} onChange={(event) => updateTicket(index, { name_en: event.target.value })} value={ticket.name_en} /></Field>
                      <Field label="Name (Amharic)"><input className={inputClass} dir="auto" onChange={(event) => updateTicket(index, { name_am: event.target.value })} value={ticket.name_am} /></Field>
                      <Field label="Description"><input className={inputClass} onChange={(event) => updateTicket(index, { description: event.target.value })} value={ticket.description} /></Field>
                      <Field label="Price"><input className={inputClass} min={0} onChange={(event) => updateTicket(index, { price: event.target.value })} step="0.01" type="number" value={ticket.price} /></Field>
                      <Field label="Available quantity"><input className={inputClass} min={1} onChange={(event) => updateTicket(index, { quantity: event.target.value })} type="number" value={ticket.quantity} /></Field>
                      <Field label="Per-person limit"><input className={inputClass} min={1} onChange={(event) => updateTicket(index, { per_person_limit: event.target.value })} type="number" value={ticket.per_person_limit} /></Field>
                      <Field label="Sale starts"><input className={inputClass} onChange={(event) => updateTicket(index, { sale_starts: event.target.value })} type="datetime-local" value={ticket.sale_starts} /></Field>
                      <Field label="Sale ends"><input className={inputClass} onChange={(event) => updateTicket(index, { sale_ends: event.target.value })} type="datetime-local" value={ticket.sale_ends} /></Field>
                    </Grid>
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <button className={ghostButton} onClick={() => addTicket('General Admission')} type="button">+ General admission</button>
                  {['Student', 'VIP', 'Early Bird', 'Group'].map((preset) => (
                    <button className={ghostButton} key={preset} onClick={() => addTicket(preset)} type="button">+ {preset}</button>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* Step 4 */}
        <div className={step !== 3 ? 'hidden' : ''}>
          <Section title="Participant information">
            <p className="text-sm text-zinc-600">Full name, email, and phone number are always collected. Add optional fields below.</p>
            <div className="mt-4 grid gap-3">
              {fields.map((field, index) => (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3" key={field.key}>
                  <Grid>
                    <Field label="Label (English)"><input className={inputClass} onChange={(event) => updateField(index, { label_en: event.target.value })} value={field.label_en} /></Field>
                    <Field label="Label (Amharic)"><input className={inputClass} dir="auto" onChange={(event) => updateField(index, { label_am: event.target.value })} value={field.label_am} /></Field>
                    <Field label="Type">
                      <select className={inputClass} onChange={(event) => updateField(index, { type: event.target.value })} value={field.type}>
                        {FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </Field>
                    <div className="flex items-end gap-2 pb-2">
                      <label className="flex items-center gap-1.5 text-sm font-medium text-zinc-800">
                        <input checked={field.required} className="h-4 w-4 accent-emerald-700" onChange={(event) => updateField(index, { required: event.target.checked })} type="checkbox" /> Required
                      </label>
                      <button aria-label="Move up" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900" onClick={() => moveField(index, -1)} type="button">↑</button>
                      <button aria-label="Move down" className="text-xs font-semibold text-zinc-500 hover:text-zinc-900" onClick={() => moveField(index, 1)} type="button">↓</button>
                      <button className="text-xs font-semibold text-red-600 hover:underline" onClick={() => setFields((current) => current.filter((_, i) => i !== index))} type="button">Remove</button>
                    </div>
                    {field.type === 'dropdown' && (
                      <Field label="Dropdown options (comma separated)"><input className={inputClass} onChange={(event) => updateField(index, { options: event.target.value })} value={field.options} /></Field>
                    )}
                  </Grid>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Gender', 'Age', 'Organization', 'Church / Institution', 'Address', 'Emergency Contact', 'Special Requirements', 'Dietary Requirements'].map((preset) => (
                <button className={ghostButton} key={preset} onClick={() => setFields((current) => [...current, { key: crypto.randomUUID(), label_en: preset, label_am: '', type: 'text', required: false, options: '' }])} type="button">+ {preset}</button>
              ))}
              <button className={primaryButton} onClick={() => setFields((current) => [...current, { key: crypto.randomUUID(), label_en: 'Custom field', label_am: '', type: 'text', required: false, options: '' }])} type="button">+ Custom field</button>
            </div>
            <div className="mt-4">
              <Field label="Consent & privacy notice"><textarea className={inputClass} onChange={(event) => update('consent_notice', event.target.value)} rows={3} value={values.consent_notice} /></Field>
            </div>
          </Section>
        </div>

        {/* Step 5 */}
        <div className={step !== 4 ? 'hidden' : ''}>
          <Section title="Media and resources">
            <Grid>
              <Field label="Cover image" help="JPEG, PNG, WebP, or GIF · max 10 MB">
                <input accept="image/jpeg,image/png,image/webp,image/gif" className={inputClass} name="image_file" type="file" />
              </Field>
              <Field label="Or cover image URL"><input className={inputClass} onChange={(event) => update('image_url', event.target.value)} type="url" value={values.image_url} /></Field>
              {values.image_url && (
                <div className="sm:col-span-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="Current cover" className="block h-auto max-h-[32rem] max-w-full rounded-xl border border-zinc-200 bg-zinc-50 object-contain" src={values.image_url} />
                </div>
              )}
              <Field label="Promotional video URL (YouTube/Vimeo)"><input className={inputClass} onChange={(event) => update('video_url', event.target.value)} type="url" value={values.video_url} /></Field>
            </Grid>
            <SubHeading>Downloadable documents</SubHeading>
            {(Array.isArray(exp.resources) ? exp.resources : []).map((raw) => {
              const resource = raw as { name: string; url: string }
              return <p className="text-xs text-emerald-700" key={resource.url}>📎 {resource.name}</p>
            })}
            {[0, 1, 2].map((index) => (
              <Grid className="mt-2" key={index}>
                <Field label={`Document label ${index + 1}`}><input className={inputClass} name={`resource_name_${index}`} /></Field>
                <Field label={`File ${index + 1}`} help="PDF, Word, PowerPoint, or text · max 20 MB">
                  <input accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,application/pdf,text/plain" className={inputClass} name={`resource_file_${index}`} type="file" />
                </Field>
              </Grid>
            ))}
          </Section>
        </div>

        {/* Step 6 */}
        <div className={step !== 5 ? 'hidden' : ''}>
          <Section title="Publication and advanced settings">
            <Grid>
              <Field label="Visibility">
                <select className={inputClass} onChange={(event) => update('visibility', event.target.value)} value={values.visibility}>
                  {['public', 'unlisted', 'private'].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Reminder notification (days before)"><input className={inputClass} min={1} onChange={(event) => update('reminder_days', event.target.value)} type="number" value={values.reminder_days} /></Field>
              <Field label="SEO title"><input className={inputClass} onChange={(event) => update('seo_title', event.target.value)} value={values.seo_title} /></Field>
              <Field label="SEO description"><input className={inputClass} onChange={(event) => update('seo_description', event.target.value)} value={values.seo_description} /></Field>
              <Field label="Custom confirmation message (English)"><textarea className={inputClass} onChange={(event) => update('confirmation_message_en', event.target.value)} rows={2} value={values.confirmation_message_en} /></Field>
              <Field label="Custom confirmation message (Amharic)"><textarea className={inputClass} dir="auto" onChange={(event) => update('confirmation_message_am', event.target.value)} rows={2} value={values.confirmation_message_am} /></Field>
            </Grid>
            <div className="mt-3">{check('confirmation_email_enabled', 'Send automatic confirmation emails')}</div>
            <Grid className="mt-4">
              <Field label="Terms & conditions (English)"><textarea className={inputClass} onChange={(event) => update('terms_en', event.target.value)} rows={4} value={values.terms_en} /></Field>
              <Field label="Terms & conditions (Amharic)"><textarea className={inputClass} dir="auto" onChange={(event) => update('terms_am', event.target.value)} rows={4} value={values.terms_am} /></Field>
              <Field label="Cancellation policy (English)"><textarea className={inputClass} onChange={(event) => update('cancellation_policy_en', event.target.value)} rows={2} value={values.cancellation_policy_en} /></Field>
              <Field label="Cancellation policy (Amharic)"><textarea className={inputClass} dir="auto" onChange={(event) => update('cancellation_policy_am', event.target.value)} rows={2} value={values.cancellation_policy_am} /></Field>
            </Grid>
            <div className="mt-3">{check('featured', 'Feature this registration on the homepage')}</div>
          </Section>
        </div>

        {/* Step 7 */}
        <div className={step !== 6 ? 'hidden' : ''}>
          <Section title="Preview">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Desktop preview</p>
                <div className="mt-3 rounded-xl border border-zinc-100 bg-zinc-50 p-5">
                  {titleEN
                    ? <ExperienceDescription content={titleEN} variant="title" />
                    : <h1 className="mt-3 text-2xl font-bold text-zinc-950">Untitled registration</h1>}
                  <ExperienceDescription content={values.summary_en} variant="summary" />
                  <p className="mt-2 text-xs text-zinc-400">{values.location_en || 'Location TBA'} · {startDate ? new Date(startDate).toLocaleString() : 'Date TBA'}</p>
                  <p className="mt-3 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                    {pricingMode === 'free' ? 'Free' : pricingMode === 'paid' ? `${values.price || '?'} ${values.currency}` : `${tickets.length} ticket types`}
                  </p>
                  {tickets.length > 0 && (
                    <ul className="mt-4 grid gap-2">
                      {tickets.map((ticket) => (
                        <li className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm" key={ticket.id}>
                          <span className="font-semibold text-zinc-800">{ticket.name_en || 'Ticket'}</span>
                          <span className="tabular-nums text-zinc-600">{ticket.price} {values.currency}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 space-y-3 text-sm text-zinc-700">
                    <p><strong>Name:</strong> ______________</p>
                    <p><strong>Email:</strong> ______________</p>
                    <p><strong>Phone:</strong> ______________</p>
                    {fields.slice(0, 4).map((field) => (
                      <p key={field.key}>{field.label_en}{field.required ? ' *' : ''}: ______________</p>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mx-auto w-72 rounded-[2rem] border-4 border-zinc-800 bg-white p-3 shadow-lg">
                <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Mobile preview · አማርኛ</p>
                <div className="mt-2 rounded-xl bg-zinc-50 p-4">
                  {(values.title_am || titleEN)
                    ? <ExperienceDescription content={values.title_am || titleEN} variant="title" />
                    : <h1 className="mt-3 text-lg font-bold text-zinc-950">Untitled registration</h1>}
                  {values.summary_am
                    ? <p className="mt-1 text-xs text-zinc-500" dir="auto">{values.summary_am}</p>
                    : <ExperienceDescription content={values.summary_en} variant="summary" />}
                  <button className="mt-3 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white" type="button">ምዝገባ (Register)</button>
                  <p className="mt-3 text-[11px] text-zinc-400">Amharic visitors see translated titles, summaries, and ticket names automatically.</p>
                </div>
              </div>
            </div>
          </Section>
        </div>
      </form>

      {/* Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4">
        <button className={ghostButton} disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))} type="button">← Back</button>
        <div className="flex flex-wrap gap-2">
          {step < STEPS.length - 1 && <button className={primaryButton} onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))} type="button">Continue →</button>}
          {step === STEPS.length - 1 && (
            <>
              <button className={ghostButton} disabled={submitting} onClick={() => submit('draft')} type="button">{submitting ? 'Saving…' : 'Save as Draft'}</button>
              <button className={ghostButton} disabled={submitting} onClick={() => submit('new')} type="button">Save & close</button>
              <button className={primaryButton} disabled={submitting} onClick={() => submit('publish')} type="button">{submitting ? 'Publishing…' : 'Publish Registration'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-emerald-950/10 bg-white shadow-[0_18px_55px_rgba(16,46,38,0.07)] ring-1 ring-white">
      <header className="flex items-start gap-4 border-b border-zinc-100 bg-gradient-to-r from-emerald-50/80 via-white to-amber-50/60 px-5 py-5 sm:px-7">
        <span className="mt-1 h-10 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-emerald-700 to-amber-400" />
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700">Registration builder</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl">{title}</h2>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-500">{description}</p>}
        </div>
      </header>
      <div className="p-5 sm:p-7">{children}</div>
    </section>
  )
}
function Grid({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>{children}</div>
}
function Field({ label, children, help, required }: { label: string; children: React.ReactNode; help?: string; required?: boolean }) {
  return (
    <label className={fieldLabel}>
      {label}{required && <span className="text-red-500"> *</span>}
      {children}
      {help && <span className="text-xs font-normal text-zinc-500">{help}</span>}
    </label>
  )
}
function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-7 mb-3 flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-900 first:mt-0">
      <span className="h-px w-5 rounded-full bg-amber-400" />
      {children}
      <span className="h-px flex-1 bg-zinc-100" />
    </h3>
  )
}
