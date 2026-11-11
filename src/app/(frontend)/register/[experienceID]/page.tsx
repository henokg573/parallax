import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RegistrationForm } from '@/app/(frontend)/components/RegistrationForm'
import {
  getPublicExperienceByID,
  getPublicExperienceBySlug,
  isOpenForRegistration,
  CATEGORY_LABELS,
} from '@/lib/registrations'
import { rows } from '@/lib/db'

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

export async function generateMetadata({ params }: RegistrationPageProps): Promise<Metadata> {
  const { experienceID } = await params
  const experience = await findExperience(experienceID)
  return {
    title: `${experience?.title_en ?? 'Registration'} | Parallax`,
    description: experience?.summary_en || 'Register for a Parallax community experience.',
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
  const title = t(experience.title_en, experience.title_am)
  const description = t(experience.description_en, experience.description_am)
  const summary = t(experience.summary_en, experience.summary_am)
  const location = t(experience.location_en, experience.location_am)
  const terms = t(experience.terms_en, experience.terms_am)
  const ticketTypes = experience.ticket_types ?? []

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
            <img alt={title} className="aspect-[21/9] w-full object-cover" src={cover} />
          ) : (
            <div className="aspect-[21/9] w-full bg-gradient-to-br from-emerald-900 to-emerald-700" />
          )}
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">{CATEGORY_LABELS[experience.kind] ?? experience.kind}</span>
              {experience.pricing_mode === 'free' && <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-bold text-lime-800">{t('Free', 'ነጻ')}</span>}
              {capacityLeft !== null && <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-700">{capacityLeft} {t('spots left', 'ቦታዎች ቀሪ')}</span>}
            </div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">{title}</h1>
            <p className="mt-2 text-base text-zinc-600">{summary}</p>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <span className="text-lg">📅</span>
                <div>
                  <dt className="font-semibold text-zinc-900">{t('When', 'መቼ')}</dt>
                  <dd className="text-zinc-600">
                    {new Date(experience.start_date).toLocaleString(locale === 'am' ? 'am-ET' : undefined, { dateStyle: 'full', timeStyle: 'short' })}
                    {experience.end_date && <> — {new Date(experience.end_date).toLocaleTimeString(undefined, { timeStyle: 'short' })}</>}
                  </dd>
                  <dd className="text-xs text-zinc-400">{experience.timezone}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-lg">📍</span>
                <div>
                  <dt className="font-semibold text-zinc-900">{t('Where', 'የት')}</dt>
                  <dd className="text-zinc-600">{location}</dd>
                  {experience.address && <dd className="text-xs text-zinc-500">{experience.address}</dd>}
                  {experience.maps_url && <a className="text-xs font-semibold text-emerald-800 underline" href={experience.maps_url} target="_blank" rel="noreferrer">{t('Open in Google Maps ↗', 'በGoogle Maps ክፈት ↗')}</a>}
                </div>
              </div>
            </dl>

            {gate.open && new Date(experience.start_date).getTime() > Date.now() && (
              <div className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
                ⏱ {t('Starts in', 'ይጀምራል')} {Math.max(1, Math.ceil((new Date(experience.start_date).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))} {t('days', 'ቀናት')}
              </div>
            )}

            {!gate.open && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                {gate.reason === 'not-open-yet' && t('Registration has not opened yet.', 'ምዝገባው ገና አልተከፈተም።')}
                {gate.reason === 'closed' && t('Registration is closed for this experience.', 'ምዝገባው ለዚህ ዝግጅት ተዘግቷል።')}
                {gate.reason === 'started' && t('This experience has already started.', 'ይህ ዝግጅት ቀድሞ ተጀምሯል።')}
              </div>
            )}

            {ticketTypes.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-500">{t('Ticket types', 'የትኬት ዓይነቶች')}</h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {ticketTypes.map((ticket, index) => (
                    <li className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3" key={index}>
                      <p className="font-semibold text-zinc-900">{t(ticket.name_en, ticket.name_am)}</p>
                      <span className="font-bold tabular-nums text-emerald-800">{ticket.price > 0 ? `${ticket.price} ${experience.currency}` : t('Free', 'ነጻ')}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {experience.pricing_mode === 'paid' && experience.price !== null && (
              <p className="mt-4 text-lg font-bold text-emerald-900">{experience.price} {experience.currency}</p>
            )}
            {experience.payment_instructions && (
              <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm text-zinc-700">
                <p className="font-semibold">{t('Payment instructions', 'የክፍያ መመሪያ')}</p>
                <p className="mt-1">{experience.payment_instructions}</p>
                {experience.payment_methods && <p className="mt-1 text-xs text-zinc-500">{t('Accepted:', 'የሚቀበሉ:')} {experience.payment_methods}</p>}
              </div>
            )}

            {description && (
              <div
                className="mt-6 max-w-none text-sm text-zinc-700 [&_a]:text-emerald-800 [&_a]:underline [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-zinc-950 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-3"
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: description }}
              />
            )}

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
        <section className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8" id="register">
          <h2 className="text-xl font-bold text-zinc-950">{t('Register now', 'አሁን ይመዝገቡ')}</h2>
          {gate.open ? (
            <>
              <RegistrationForm experienceID={experience.id} locale={locale} />
              {experience.consent_notice && <p className="mt-4 text-xs text-zinc-500">{experience.consent_notice}</p>}
            </>
          ) : (
            <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">{t('This registration is not accepting submissions right now.', 'ይህ ምዝገባ አሁን አዲስ ምዝገባ አያስገባም።')}</p>
          )}
        </section>
      </div>
    </main>
  )
}

function publicMedia(filename: string) {
  const base = process.env.SUPABASE_URL
  return base ? `${base}/storage/v1/object/public/parallax-media/${filename}` : filename
}
