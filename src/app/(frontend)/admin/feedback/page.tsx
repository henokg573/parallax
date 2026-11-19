import Link from 'next/link'
import { headers } from 'next/headers'
import QRCode from 'qrcode'
import { requireAdmin } from '@/lib/admin-auth'
import { rows } from '@/lib/db'
import { registrationTitleText } from '@/lib/registration-title'
import AdminShell from '../admin-shell'
import { formatDate } from '../registrations/shared'
import { FEEDBACK_BUCKET, downloadStorageFile } from '@/lib/storage'
import { setFeedbackApproval } from '../actions'

export const dynamic = 'force-dynamic'

const FEEDBACK_BUCKET_ID = FEEDBACK_BUCKET

type FeedbackRow = {
  id: number
  experience_id: number | null
  full_name: string | null
  rating: number
  message: string
  photo_path: string | null
  photo_name: string | null
  document_path: string | null
  document_name: string | null
  voice_path: string | null
  created_at: string
  approved: boolean
  approved_at: string | null
}

export default async function FeedbackAdminPage() {
  const admin = await requireAdmin('/admin/feedback')

  const feedback = await rows<FeedbackRow>('feedback', {
    select: '*',
    order: { column: 'created_at', ascending: false },
    limit: 200,
  }).catch(() => [] as FeedbackRow[])

  const experienceTitles = new Map<number, string>()
  const experienceIDs = [...new Set(feedback.map((item) => item.experience_id).filter((id): id is number => id !== null))]
  if (experienceIDs.length) {
    const titles = await rows<{ id: number; title_en: string }>('experiences', {
      select: 'id, title_en',
      in: { id: experienceIDs },
    }).catch(() => [] as { id: number; title_en: string }[])
    titles.forEach((item) => experienceTitles.set(item.id, registrationTitleText(item.title_en)))
  }

  const photoPreviews = new Map<number, string | null>()
  for (const item of feedback.filter((entry) => entry.photo_path).slice(0, 24)) {
    const bytes = await downloadStorageFile(FEEDBACK_BUCKET_ID, item.photo_path!).catch(() => null)
    if (bytes) photoPreviews.set(item.id, `data:image/*;base64,${bytes.toString('base64')}`)
  }

  const approvedFeedback = feedback.filter((item) => item.approved)
  const average = approvedFeedback.length
    ? (approvedFeedback.reduce((sum, item) => sum + item.rating, 0) / approvedFeedback.length).toFixed(1)
    : '—'

  // Prefer the origin the admin is actually browsing (works in local dev and
  // production alike); fall back to NEXT_PUBLIC_SITE_URL.
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') ?? headersList.get('host')
  const forwardedProto = headersList.get('x-forwarded-proto')?.split(',')[0].trim()
  const siteURL = host
    ? `${forwardedProto || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')}://${host}`.replace(/\/+$/, '')
    : (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')
  const qrTarget = `${siteURL}/feedback/general`
  const qrDataUrl = siteURL
    ? await QRCode.toDataURL(qrTarget, { width: 480, margin: 2, errorCorrectionLevel: 'H' })
    : null

  return (
    <AdminShell admin={admin} active="/admin/feedback" title="Feedback" subtitle="Post-event responses collected via QR code.">
      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Responses</p>
          <p className="mt-1 text-3xl font-black text-zinc-950">{feedback.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Average rating</p>
          <p className="mt-1 text-3xl font-black text-amber-500">{average} ★</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Approved</p>
          <p className="mt-1 text-3xl font-black text-zinc-950">{approvedFeedback.length}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Average rating (approved)</p>
          <p className="mt-1 text-3xl font-black text-amber-500">{average} ★</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">With uploads</p>
          <p className="mt-1 text-3xl font-black text-zinc-950">{feedback.filter((item) => item.photo_path || item.document_path || item.voice_path).length}</p>
        </div>
      </section>

      {feedback.length === 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
          No feedback yet. Show the QR code below at your event so attendees can open the feedback page.
        </div>
      )}

      {qrDataUrl ? (
        <section className="mb-6 flex flex-col items-center gap-4 rounded-2xl border border-emerald-950/10 bg-gradient-to-br from-emerald-950 to-emerald-800 p-6 text-white sm:flex-row sm:gap-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="QR code to the feedback page" className="h-44 w-44 shrink-0 rounded-xl bg-white p-2" src={qrDataUrl} />
          <div className="text-center sm:text-left">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-100/75">Feedback QR poster</p>
            <p className="mt-1 text-lg font-extrabold">Scan to share your experience</p>
            <p className="mt-1 text-sm text-emerald-50/90">Point your event screen, flyer, or table card at this code. It opens <code className="rounded bg-white/10 px-1">/feedback/general</code>.</p>
            <p className="mt-2 break-all text-xs text-emerald-100/70">{qrTarget}</p>
          </div>
        </section>
      ) : (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Set <code>NEXT_PUBLIC_SITE_URL</code> in the environment to generate a printable QR poster for the feedback page.
        </div>
      )}

      <div className="grid gap-4">
        {feedback.map((item) => (
          <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm" key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-zinc-950">
              {item.full_name || <span className="italic text-zinc-400">Anonymous</span>}
              {item.approved && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                  ✓ On site
                </span>
              )}
            </p>
                <p className="text-xs font-semibold text-zinc-500">
                  {item.experience_id ? experienceTitles.get(item.experience_id) ?? `Experience #${item.experience_id}` : 'General'} · {formatDate(item.created_at)}
                </p>
              </div>
              <p className="text-xl" aria-label={`${item.rating} out of 5 stars`}>
                {'★'.repeat(item.rating)}<span className="text-zinc-300">{'★'.repeat(5 - item.rating)}</span>
              </p>
            </div>

            {item.message && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-800">{item.message}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {item.photo_path && photoPreviews.has(item.id) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={item.photo_name ?? 'Participant photo'} className="h-24 w-24 rounded-xl border border-zinc-200 object-cover" src={photoPreviews.get(item.id)!} />
              )}
              {item.document_path && (
                <a
                  className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-bold text-zinc-800 hover:bg-zinc-50"
                  href={`/api/feedback-file?path=${encodeURIComponent(item.document_path)}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  📄 {item.document_name ?? 'Document'}
                </a>
              )}
              {item.voice_path && (
                <audio controls src={`/api/feedback-file?path=${encodeURIComponent(item.voice_path)}`} />
              )}
            </div>

            <form action={setFeedbackApproval} className="mt-4 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
              <input name="id" type="hidden" value={item.id} />
              {item.approved ? (
                <>
                  <button
                    className="rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50"
                    name="approve"
                    type="submit"
                    value="false"
                  >
                    Unpublish from site
                  </button>
                  {item.photo_path && (
                    <a
                      className="rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-50"
                      href={`/api/feedback-photo?path=${encodeURIComponent(item.photo_path)}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View public photo
                    </a>
                  )}
                </>
              ) : (
                <button
                  className="rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-800"
                  name="approve"
                  type="submit"
                  value="true"
                >
                  Approve &amp; repost to site
                </button>
              )}
            </form>
          </article>
        ))}
      </div>

      <p className="mt-6 text-xs text-zinc-400">
        Need the QR poster? Link it to <code>/feedback/general</code>. <Link className="underline" href="/admin">Back to dashboard</Link>
      </p>
    </AdminShell>
  )
}
