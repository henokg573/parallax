import Link from 'next/link'
import { redirect } from 'next/navigation'
import { logoutAdmin } from './actions'
import { requireAdmin } from '@/lib/admin-auth'
import { rows } from '@/lib/db'
import AdminShell, { roleLabel } from './admin-shell'

export const dynamic = 'force-dynamic'

type UpcomingRow = { id: number; title_en: string; start_date: string; kind: string; capacity: number | null; price: number | null; currency: string | null }
type StoryRow = { id: number; title_en: string; published_at: string | null; status: string }
type PendingRegistration = {
  id: number
  full_name: string
  experience_id: number
  created_at: string
}
type PendingRow = PendingRegistration & { experience_title: string }

export default async function AdminHomePage() {
  const admin = await requireAdmin()
  if (admin.role === 'check-in') redirect('/admin/registrations')

  const [pending, verified, checkedIn, draftExperiences, experienceCount, storyCount, upcoming, recentStories, pendingRegistrations] = await Promise.all([
    rows<{ id: number }>('registrations', { select: 'id', eq: { payment_status: 'pending' } }),
    rows<{ id: number }>('registrations', { select: 'id', eq: { payment_status: 'verified' } }),
    rows<{ id: number }>('registrations', { select: 'id', notNull: ['checked_in_at'] }),
    rows<{ id: number }>('experiences', { select: 'id', eq: { status: 'draft' } }),
    rows<{ id: number }>('experiences', { select: 'id', eq: { status: 'published' } }),
    rows<{ id: number }>('stories', { select: 'id', eq: { status: 'published' } }),
    rows<UpcomingRow>('experiences', {
      select: 'id, title_en, start_date, kind, capacity, price, currency',
      eq: { status: 'published' },
      gte: { start_date: new Date().toISOString() },
      order: { column: 'start_date' },
      limit: 1,
    }),
    rows<StoryRow>('stories', {
      select: 'id, title_en, published_at, status',
      order: { column: 'published_at', ascending: false },
      limit: 4,
    }),
    rows<PendingRegistration>('registrations', {
      select: 'id, full_name, experience_id, created_at',
      eq: { payment_status: 'pending' },
      order: { column: 'created_at', ascending: false },
      limit: 5,
    }),
  ])
  const pendingExperienceIDs = pendingRegistrations.map((item) => item.experience_id)
  const pendingExperiences = pendingExperienceIDs.length
    ? await rows<{ id: number; title_en: string }>('experiences', {
        select: 'id, title_en',
        in: { id: pendingExperienceIDs },
      })
    : []
  const experienceTitles = new Map(pendingExperiences.map((item) => [item.id, item.title_en]))
  const recentPending: PendingRow[] = pendingRegistrations.map((item) => ({
    ...item,
    experience_title: experienceTitles.get(item.experience_id) || 'Parallax experience',
  }))

  const totals = [
    { label: 'Pending payments', value: pending.length, href: '/admin/registrations', accent: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-500' },
    { label: 'Verified tickets', value: verified.length, href: '/admin/registrations', accent: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-500' },
    { label: 'Guests checked in', value: checkedIn.length, href: '/admin/scan', accent: 'text-sky-600', bg: 'bg-sky-50', dot: 'bg-sky-500' },
    { label: 'Live experiences', value: experienceCount.length, href: '/admin/experiences', accent: 'text-violet-600', bg: 'bg-violet-50', dot: 'bg-violet-500' },
    { label: 'Draft experiences', value: draftExperiences.length, href: '/admin/experiences', accent: 'text-zinc-600', bg: 'bg-zinc-100', dot: 'bg-zinc-400' },
    { label: 'Published stories', value: storyCount.length, href: '/admin/stories', accent: 'text-rose-600', bg: 'bg-rose-50', dot: 'bg-rose-500' },
  ]
  const upcomingExperience = upcoming[0]

  return (
    <AdminShell admin={admin} active="/admin" title={`Welcome, ${admin.display_name.split(' ')[0]}`} subtitle={`${roleLabel(admin.role)} · ${admin.email}`}>
      {/* Metric cards */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Parallax overview">
        {totals.map((metric) => (
          <Link
            className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            href={metric.href}
            key={metric.label}
          >
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold ${metric.bg} ${metric.accent}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${metric.dot}`} />
                {metric.label}
              </span>
              <span className="text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500">→</span>
            </div>
            <p className="mt-4 text-4xl font-bold tabular-nums tracking-tight text-zinc-950">{metric.value}</p>
          </Link>
        ))}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        {/* Next experience */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-3" aria-label="Next experience">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 text-[10px] font-black text-emerald-700">▲</span>
            Next published experience
          </h2>
          {upcomingExperience ? (
            <div className="mt-4">
              <p className="text-xl font-bold text-zinc-950">{upcomingExperience.title_en}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold capitalize text-zinc-700">{upcomingExperience.kind}</span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-700">
                  {new Date(upcomingExperience.start_date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
                {upcomingExperience.capacity && (
                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-semibold text-zinc-700">{upcomingExperience.capacity} seats</span>
                )}
                {upcomingExperience.price !== null && upcomingExperience.price !== undefined && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800">
                    {upcomingExperience.price} {upcomingExperience.currency}
                  </span>
                )}
              </div>
              <div className="mt-5 flex gap-2">
                <Link className="rounded-xl bg-emerald-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800" href="/admin/experiences">
                  Manage experiences
                </Link>
                <Link className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-400" href="/admin/registrations">
                  View registrations
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-zinc-300 p-6 text-center">
              <p className="text-sm text-zinc-500">No upcoming published experiences.</p>
              <Link className="mt-3 inline-block rounded-xl bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800" href="/admin/experiences">
                Create one now
              </Link>
            </div>
          )}
        </section>

        {/* Pending queue */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:col-span-2" aria-label="Pending payments">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-100 text-[10px] font-black text-amber-700">!</span>
            Awaiting payment review
          </h2>
          {recentPending.length > 0 ? (
            <ul className="mt-4 divide-y divide-zinc-100">
              {recentPending.map((registration) => (
                <li className="flex items-center justify-between gap-3 py-3" key={registration.id}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-900">{registration.full_name}</p>
                    <p className="truncate text-xs text-zinc-500">{registration.experience_title}</p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-400">{new Date(registration.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">All caught up — no pending payments.</p>
          )}
          {pending.length > 0 && (
            <Link className="mt-4 block rounded-xl bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold text-amber-900 transition hover:bg-amber-100" href="/admin/registrations">
              Review {pending.length} pending payment{pending.length === 1 ? '' : 's'} →
            </Link>
          )}
        </section>
      </div>

      {/* Recent stories */}
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm" aria-label="Recent stories">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-100 text-[10px] font-black text-rose-700">✦</span>
            Latest stories
          </h2>
          <Link className="text-xs font-semibold text-emerald-800 hover:underline" href="/admin/stories">Manage all →</Link>
        </div>
        {recentStories.length > 0 ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {recentStories.map((story) => (
              <li className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 px-4 py-3" key={story.id}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">{story.title_en}</p>
                  <p className="text-xs text-zinc-500">
                    {story.published_at ? new Date(story.published_at).toLocaleDateString() : 'Not scheduled'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${story.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600'
                    }`}
                >
                  {story.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">No stories yet.</p>
        )}
      </section>
    </AdminShell>
  )
}
