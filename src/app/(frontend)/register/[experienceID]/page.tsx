import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RegistrationForm } from '@/app/(frontend)/components/RegistrationForm'
import { ExperienceDescription } from '@/app/(frontend)/components/ExperienceDescription'
import {
  getPublicExperienceByID,
  getPublicExperienceBySlug,
  isOpenForRegistration,
  CATEGORY_LABELS,
} from '@/lib/registrations'
import { rows } from '@/lib/db'
import { registrationTitleText } from '@/lib/registration-title'

export const dynamic = 'force-dynamic'

type RegistrationPageProps = {
  params: Promise<{ experienceID: string }>
  searchParams: Promise<{ lang?: string }>
}

type TicketView = { name_en: string; name_am: string; price: number }
type ResourceView = { name: string; url: string | null }

type PublicExperienceView = {
  id: string
  title_en: string
  title_am: string
  kind: string
  summary_en: string
  summary_am: string
  description_en: string
  description_am: string
  location_en: string
  location_am: string
  address: string
  maps_url: string
  timezone: string
  start_date: string
  end_date: string | null
  capacity: number | null
  participant_count: number
  unlimited_capacity: boolean
  reg_opens_at: string | null
  reg_closes_at: string | null
  allow_after_start: boolean
  pricing_mode: string
  price: number | null
  currency: string
  payment_instructions: string
  payment_methods: string
  ticket_types: TicketView[]
  status: string
  image_url: string | null
  gallery_ids: number[]
  video_url: string | null
  resources: ResourceView[]
  consent_notice: string
  terms_en: string
  terms_am: string
}

async function findExperience(experienceID: string): Promise<PublicExperienceView | null> {
  const experience = /^\d+$/.test(experienceID)
    ? await getPublicExperienceByID(Number(experienceID))
    : await getPublicExperienceBySlug(experienceID)
  return experience as PublicExperienceView | null
}

function firstHeading(content: string) {
  const htmlHeading = content.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1]
  if (htmlHeading) return registrationTitleText(htmlHeading)

  const markdownHeading = content.match(/^\s*#{1,6}\s+(.+)$/m)?.[1]
  return markdownHeading ? registrationTitleText(markdownHeading) : ''
}

function displayTitle(title: string, description: string) {
  return firstHeading(title) || registrationTitleText(title) || firstHeading(description) || 'Registration'
}

export async function generateMetadata({ params }: RegistrationPageProps): Promise<Metadata> {
  const { experienceID } = await params
  const experience = await findExperience(experienceID)
  return {
    title: `${experience ? displayTitle(experience.title_en, experience.description_en) : 'Registration'} | Parallax`,
    description: registrationTitleText(experience?.summary_en ?? '').slice(0, 200) || 'Register for a Parallax community experience.',
  }
}

export default async function RegistrationPage({ params, searchParams }: RegistrationPageProps) {
  const { experienceID } = await params
  const { lang } = await searchParams
  const locale: 'en' | 'am' = lang === 'am' ? 'am' : 'en'
  const experience = await findExperience(experienceID)
  if (!experience) notFound()

  const gate = isOpenForRegistration({
    status: experience.status,
    reg_opens_at: experience.reg_opens_at,
    reg_closes_at: experience.reg_closes_at,
    allow_after_start: experience.allow_after_start,
    start_date: experience.start_date,
  })
  const capacityLeft = experience.unlimited_capacity || experience.capacity === null
    ? null
    : Math.max(0, experience.capacity - experience.participant_count)
  const t = (en: string, am: string) => (locale === 'am' && am ? am : en)

  let gallery: { url: string; alt: string }[] = []
  if (experience.gallery_ids.length) {
    try {
      const galleryRows = await rows<{ id: number; filename: string; alt: string }>('media', {
        select: 'id, filename, alt',
      }).catch(() => [])
      gallery = galleryRows
        .filter((item) => experience.gallery_ids.includes(Number(item.id)))
        .map((item) => ({ url: publicMedia(item.filename), alt: item.alt || '' }))
        .slice(0, 6)
    } catch {
      gallery = []
    }
  }

  const cover = experience.image_url
  const description = t(experience.description_en, experience.description_am)
  const title = displayTitle(t(experience.title_en, experience.title_am), description)
  const summary = t(experience.summary_en, experience.summary_am)
  const location = t(experience.location_en, experience.location_am)
  const terms = t(experience.terms_en, experience.terms_am)
  const ticketTypes = experience.ticket_types ?? []
  const gateMessage = gate.open
    ? t('Registration is open. We would love to have you with us.', 'ምዝገባ ክፍት ነው። ከእኛ ጋር ቢሆኑ ደስ ይለናል።')
    : gate.reason === 'not-open-yet'
      ? t('Registration has not opened yet.', 'ምዝገባው ገና አልተከፈተም።')
      : gate.reason === 'closed'
        ? t('Registration is closed for this experience.', 'ምዝገባው ለዚህ ዝግጅት ተዘግቷል።')
        : t('This experience has already started.', 'ይህ ዝግጅት ቀድሞ ተጀምሯል።')

  return (
    <main className="min-h-screen bg-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <a className="text-sm font-semibold text-emerald-800 hover:underline" href="/">← {t('Back to Parallax', 'ወደ ፓራላክስ ተመለስ')}</a>
          <a className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400" href={locale === 'en' ? '?lang=am' : '?lang=en'}>
            {locale === 'en' ? 'አማርኛ' : 'English'}
          </a>
        </div>

        {/* Hero */}
        <section className="mt-4 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={title} className="block h-auto w-full" src={cover} />
          ) : (
            <div className="aspect-[21/9] w-full bg-gradient-to-br from-emerald-900 to-emerald-700" />
          )}
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{CATEGORY_LABELS[experience.kind] ?? experience.kind}</span>
              {experience.pricing_mode === 'free' && <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-bold text-lime-800">{t('Free', 'ነጻ')}</span>}
              {capacityLeft !== null && <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">{capacityLeft} {t('spots left', 'ቦታዎች ቀሪ')}</span>}
            </div>
            <ExperienceDescription content={t(experience.title_en, experience.title_am) || title} variant="title" />
            <ExperienceDescription content={summary} variant="summary" />
            <dl className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/70 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <dt className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-800 text-white shadow-sm shadow-emerald-900/20">
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
                      <rect height="16" rx="2.5" width="17" x="3.5" y="5" />
                      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9.5h17M8 13h2m4 0h2m-8 4h2m4 0h2" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-700">{t('The schedule', 'የጊዜ ሰሌዳ')}</span>
                    <span className="mt-0.5 block text-sm font-bold text-zinc-900">{t('When', 'መቼ')}</span>
                  </span>
                </dt>
                <dd className="mt-4 text-sm font-semibold leading-6 text-zinc-800">
                  <time dateTime={experience.start_date}>
                    {new Date(experience.start_date).toLocaleString(locale === 'am' ? 'am-ET' : undefined, { dateStyle: 'full', timeStyle: 'short' })}
                  </time>
                  {experience.end_date && <> — {new Date(experience.end_date).toLocaleTimeString(undefined, { timeStyle: 'short' })}</>}
                </dd>
                <dd className="mt-1.5 flex items-center gap-2 text-xs font-medium text-zinc-500">
                  <svg aria-hidden="true" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  {experience.timezone}
                </dd>
              </div>
              <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/70 p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <dt className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-900">
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
                      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                  </span>
                  <span>
                    <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-amber-800">{t('The venue', 'ቦታው')}</span>
                    <span className="mt-0.5 block text-sm font-bold text-zinc-900">{t('Where', 'የት')}</span>
                  </span>
                </dt>
                <dd className="mt-4 text-sm font-semibold leading-6 text-zinc-800">{location}</dd>
                {experience.address && <dd className="mt-1 text-xs leading-5 text-zinc-500">{experience.address}</dd>}
                {experience.maps_url && (
                  <dd className="mt-3">
                    <a className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50" href={experience.maps_url} target="_blank" rel="noreferrer">
                      {t('Open in Google Maps', 'በGoogle Maps ክፈት')}
                      <span aria-hidden="true">↗</span>
                    </a>
                  </dd>
                )}
              </div>
            </dl>

            {gate.open && new Date(experience.start_date).getTime() > Date.now() && (
              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-3.5 text-sm font-semibold text-emerald-950 shadow-sm">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-emerald-800 shadow-sm">⏱</span>
                <span>{t('Starts in', 'ይጀምራል')} {Math.max(1, Math.ceil((new Date(experience.start_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))} {t('days', 'ቀናት')}</span>
              </div>
            )}

            <div className={`mt-5 flex items-center gap-3 rounded-2xl border px-4 py-4 shadow-sm ${gate.open ? 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-white text-emerald-950' : 'border-amber-200 bg-gradient-to-r from-amber-50 to-white text-amber-950'}`} role="status">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${gate.open ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
                  {gate.open ? <path d="m5 12 4 4L19 6" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></>}
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] opacity-70">{t('Registration status', 'የምዝገባ ሁኔታ')}</span>
                <span className="mt-0.5 block text-sm font-bold leading-6">{gateMessage}</span>
              </span>
              <span className={`hidden rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider sm:inline-flex ${gate.open ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                {gate.open ? t('Open', 'ክፍት') : t('Closed', 'ዝግ')}
              </span>
            </div>

            {ticketTypes.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">{t('Ticket types', 'የትኬት ዓይነቶች')}</h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ticketTypes.map((ticket, index) => (
                    <li className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm" key={index}>
                      <p className="font-semibold text-zinc-900">{t(ticket.name_en, ticket.name_am)}</p>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-extrabold tabular-nums text-emerald-800">{ticket.price > 0 ? `${ticket.price.toLocaleString()} ${experience.currency}` : t('Free', 'ነጻ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {experience.pricing_mode === 'paid' && experience.price !== null && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-900/10 bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-800 px-5 py-4 text-white shadow-lg shadow-emerald-950/10">
                <span>
                  <span className="block text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-100/80">{t('Registration fee', 'የምዝገባ ክፍያ')}</span>
                  <span className="mt-1 block text-2xl font-extrabold tracking-tight">{experience.price.toLocaleString()} <span className="text-sm font-bold text-emerald-100">{experience.currency}</span></span>
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-50">{t('Your place awaits', 'ቦታዎ ይጠብቃል')}</span>
              </div>
            )}
            {experience.payment_instructions && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-emerald-950/10 bg-gradient-to-br from-emerald-950 to-emerald-800 text-white shadow-lg shadow-emerald-950/10">
                <div className="flex items-start gap-3 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-300">
                    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
                      <rect height="14" rx="2" width="20" x="2" y="5" />
                      <path d="M2 10h20m-15 5h4" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-100/75">{t('Payment details', 'የክፍያ ዝርዝሮች')}</p>
                    <p className="mt-1 text-base font-bold">{t('Payment instructions', 'የክፍያ መመሪያ')}</p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/90">{experience.payment_instructions}</p>
                    {experience.payment_methods && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-emerald-100/70">{t('Accepted', 'የሚቀበሉ')}</span>
                        {experience.payment_methods.split(',').map((method) => method.trim()).filter(Boolean).map((method) => (
                          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white" key={method}>{method}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {description && <ExperienceDescription content={description} />}

            {experience.video_url && (
              <div className="mt-6 aspect-video w-full overflow-hidden rounded-2xl">
                <iframe allowFullScreen className="h-full w-full" src={experience.video_url.replace('watch?v=', 'embed/')} title={title} />
              </div>
            )}

            {gallery.length > 0 && (
              <div className="mt-6 grid grid-cols-3 gap-2">
                {gallery.map((image) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={image.alt} className="aspect-square w-full rounded-xl object-cover" key={image.url} src={image.url} />
                ))}
              </div>
            )}

            {experience.resources.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">{t('Resources', 'መረጃዎች')}</h2>
                <ul className="mt-2 grid gap-1.5">
                  {experience.resources.map((resource) => (
                    <li key={resource.url ?? resource.name}>
                      <a className="text-sm font-semibold text-emerald-800 underline" href={resource.url ?? '#'} rel="noreferrer" target="_blank">📎 {resource.name}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {terms && (
              <details className="mt-6 rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600">
                <summary className="cursor-pointer font-semibold text-zinc-800">{t('Terms & conditions', 'ውሎችና መመሪያዎች')}</summary>
                <p className="mt-2 whitespace-pre-line">{terms}</p>
              </details>
            )}
          </div>
        </section>

        {/* Registration form */}
        <section className="mt-8 overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white shadow-[0_24px_70px_rgba(16,46,38,0.10)]" id="register">
          <div className="border-b border-zinc-100 bg-gradient-to-r from-emerald-50 via-white to-amber-50/70 px-6 py-6 sm:px-9">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-700">{t('Your next step', 'ቀጣዩ እርምጃ')}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-extrabold tracking-tight text-zinc-950">{t('Register now', 'አሁን ይመዝገቡ')}</h2>
              <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-bold text-emerald-800">{gate.open ? t('Registration is open', 'ምዝገባ ክፍት ነው') : t('Stay tuned', 'ይጠብቁ')}</span>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-600">{t('A few details are all we need to save your place.', 'ቦታዎን ለማስያዝ ጥቂት መረጃዎች ብቻ ያስፈልጋሉ።')}</p>
          </div>
          <div className="p-5 sm:p-8">
            {gate.open ? (
              <>
                <RegistrationForm experienceID={experience.id} locale={locale} />
                {experience.consent_notice && <p className="mt-5 rounded-xl bg-zinc-50 px-4 py-3 text-xs leading-5 text-zinc-500">{experience.consent_notice}</p>}
              </>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-950">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">✦</span>
                <span className="leading-6">{t('This registration is not accepting submissions right now.', 'ይህ ምዝገባ አሁን አዲስ ምዝገባ አያስገባም።')}</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}

function publicMedia(filename: string) {
  const base = process.env.SUPABASE_URL
  return base ? `${base}/storage/v1/object/public/parallax-media/${filename}` : filename
}
