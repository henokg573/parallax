import type { Metadata } from 'next'
import FeedbackForm from './FeedbackForm'
import { resolveFeedbackToken } from '@/lib/feedback'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Share your feedback | Parallax',
  description:
    'Tell us about your Parallax experience — rate the program, share ideas, photos, documents, or a voice message.',
}

type FeedbackPageProps = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ lang?: string }>
}

export default async function FeedbackPage({ params, searchParams }: FeedbackPageProps) {
  const { token } = await params
  const { lang } = await searchParams
  const locale: 'en' | 'am' = lang === 'am' ? 'am' : 'en'
  const resolved = await resolveFeedbackToken(token)
  const t = (en: string, am: string) => (locale === 'am' && am ? am : en)

  return (
    <main className="min-h-screen bg-[#f4f3ec] px-4 pb-12 pt-5 sm:px-7 sm:pb-16 sm:pt-8">
      <div className="mx-auto max-w-6xl">
        <nav
          aria-label={t('Page navigation', 'የገጽ አሰሳ')}
          className="mb-5 flex items-center justify-between"
        >
          <a
            className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#35594c] transition hover:text-[#102e26] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800"
            href="/"
          >
            <span aria-hidden="true">←</span> {t('Back to PARALLAX', 'ወደ PARALLAX ተመለስ')}
          </a>
          <a
            className="inline-flex min-h-10 items-center rounded-full border border-[#123c31]/15 bg-white/70 px-4 text-xs font-bold text-[#35594c] transition hover:border-[#123c31]/35 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
            href={locale === 'en' ? '?lang=am' : '?lang=en'}
          >
            {locale === 'en' ? 'አማርኛ' : 'English'}
          </a>
        </nav>

        <section className="feedback-enter relative isolate overflow-hidden rounded-[1.75rem] bg-[#0c3027] px-6 py-9 text-white shadow-[0_20px_55px_rgba(12,48,39,.2)] sm:rounded-[2.25rem] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-32 -z-10 h-96 w-96 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-5 -top-16 -z-10 h-64 w-64 rounded-full border border-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-8rem] right-[22%] -z-10 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(218,184,112,.14),transparent_68%)]"
          />
          <div className="grid items-center gap-9 lg:grid-cols-[1fr_auto] lg:gap-12">
            <div className="max-w-3xl">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.24em] text-[#e2c47f] sm:text-xs">
                <span className="h-px w-7 bg-[#e2c47f]/70" /> PARALLAX /{' '}
                {t('COMMUNITY FEEDBACK', 'የማህበረሰብ ግብረ-መልስ')}
              </p>
              <h1 className="mt-5 max-w-3xl text-[2.5rem] font-semibold leading-[1.04] tracking-[-.055em] sm:text-6xl lg:text-[4.5rem]">
                {t('Your experience', 'ተሞክሮዎ')}
                <br />
                <span className="font-serif italic font-medium text-[#e5c779]">
                  {t('matters.', 'ወሳኝ ነው።')}
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/75 sm:text-base sm:leading-8">
                {t(
                  'Every experience leaves a story. Tell us what inspired you, what you enjoyed, and what we could make even better.',
                  'እያንዳንዱ ተሞክሮ ታሪክ ይተዋል። ምን እንዳነሳሳዎ፣ ምን እንደወደዱና ምን ማሻሻል እንደምንችል ይንገሩን።',
                )}
              </p>
              {resolved && (
                <p className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/[.07] px-4 py-2 text-xs font-semibold text-white/90">
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#e5c779]" />
                  <span className="truncate">{resolved.title}</span>
                </p>
              )}
            </div>
            <div
              aria-hidden="true"
              className="hidden h-36 w-36 items-center justify-center rounded-full border border-white/15 bg-white/[.04] lg:flex"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-[#e5c779]/45 text-[#e5c779]">
                <svg
                  className="h-12 w-12"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.1"
                  viewBox="0 0 48 48"
                >
                  <path d="M24 7v34M7 24h34M12 12l24 24m0-24L12 36" />
                  <circle cx="24" cy="24" r="13" />
                  <circle cx="24" cy="24" r="20" />
                </svg>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto mt-5 max-w-4xl sm:mt-7">
          <FeedbackForm
            experienceID={resolved?.experienceID ?? null}
            locale={locale}
            token={token}
          />
        </div>
      </div>
    </main>
  )
}
