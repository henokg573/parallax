import type { Metadata } from 'next'
import FeedbackForm from './FeedbackForm'
import { resolveFeedbackToken } from '@/lib/feedback'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Share your feedback | Parallax',
  description: 'Tell us about your Parallax experience — rate the program, share ideas, photos, documents, or a voice message.',
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
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-zinc-50 to-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between">
          <a className="text-sm font-semibold text-emerald-800 hover:underline" href="/">← {t('Back to Parallax', 'ወደ ፓራላክስ ተመለስ')}</a>
          <a className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-zinc-400" href={locale === 'en' ? '?lang=am' : '?lang=en'}>
            {locale === 'en' ? 'አማርኛ' : 'English'}
          </a>
        </div>

        <section className="mt-4 rounded-3xl border border-emerald-950/10 bg-white p-6 shadow-[0_20px_60px_rgba(16,46,38,0.08)] sm:p-9">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-700">PARALLAX · {t('Feedback', 'ግብረ-መልስ')}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">
            {t('How was your experience?', 'ልምድዎ እንዴት ነበር?')}
          </h1>
          {resolved && <p className="mt-2 text-sm font-bold text-emerald-800">{resolved.title}</p>}
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            {t(
              'Rate the program, share your ideas, upload photos or a document, or leave a voice message. Everything except the star rating is optional.',
              'ፕሮግራሙን ይገምግሙ፣ ሃሳብዎን ያጋሩ፣ ፎቶ ወይም ሰነድ ያስገቡ ወይም የድምፅ መልእክት ይተዉ። ከኮከብ ደረጃ በስተቀር ሁሉም አማራጭ ነው።',
            )}
          </p>

          <div className="mt-7">
            <FeedbackForm experienceID={resolved?.experienceID ?? null} locale={locale} />
          </div>
        </section>
      </div>
    </main>
  )
}
