import Link from 'next/link'
import { requireAdmin } from '@/lib/admin-auth'
import { listRegistrations, getDashboardStats, CATEGORY_OPTIONS, CATEGORY_LABELS, isOpenForRegistration } from '@/lib/registrations'
import AdminShell from '../admin-shell'
import { Badge, StatCard, card, primaryButton, ghostButton, money, formatDate } from './shared'
import { bulkExperienceStatus, experienceRowAction } from './actions'

export const dynamic = 'force-dynamic'

const REGISTRATION_CATEGORIES = [...CATEGORY_OPTIONS]

function miniBars(series: { day: string; count: number }[]) {
  const max = Math.max(...series.map((point) => point.count), 1)
  return series.map((point) => (
    <div className="flex-1" key={point.day} title={`${point.day}: ${point.count}`}>
      <div className="w-full rounded-t bg-emerald-200" style={{ height: `${Math.max(4, (point.count / max) * 72)}px`, backgroundColor: point.count ? undefined : '#e4e4e7' }} />
    </div>
  ))
}

export default async function RegistrationsDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const admin = await requireAdmin('/admin/registrations')
  const query = await searchParams
  const search = query.q ?? ''
  const category = query.category ?? 'all'
  const status = query.status ?? 'all'
  const paymentMode = query.mode ?? 'all'
  const sort = (query.sort ?? 'newest') as 'newest' | 'oldest' | 'popularity' | 'revenue'
  const page = Math.max(1, Number(query.page ?? '1') || 1)
  const perPage = 10

  const [stats, allItems] = await Promise.all([
    getDashboardStats(),
    listRegistrations({ search, category, status, paymentMode, sort }),
  ])
  const totalPages = Math.max(1, Math.ceil(allItems.length / perPage))
  const items = allItems.slice((page - 1) * perPage, page * perPage)
  const last7 = stats.daily.slice(-7)
  const last30 = stats.daily.slice(-30)
  const total = stats.byStatus.reduce((sum, entry) => sum + entry.count, 0) || 1

  const listHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const merged = { q: search, category, status, mode: paymentMode, sort, ...overrides }
    for (const [key, val] of Object.entries(merged)) if (val && val !== 'all' && !(key === 'sort' && val === 'newest')) params.set(key, String(val))
    const qs = params.toString()
    return `/admin/registrations${qs ? `?${qs}` : ''}`
  }

  return (
    <AdminShell admin={admin} active="/admin/registrations" title="Registrations" subtitle="Create opportunities, manage participants, verify payments, and monitor attendance.">
      {query.saved && <Banner tone="green">Changes saved.</Banner>}
      {query.published && <Banner tone="green">Registration published successfully.</Banner>}
      {query.bulk && <Banner tone="green">Bulk update applied.</Banner>}
      {query.archived && <Banner tone="amber">Registration archived.</Banner>}
      {query.denied && <Banner tone="amber">Only a super admin can permanently delete registrations.</Banner>}

      {/* Analytics cards */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Registration statistics">
        <StatCard icon="🗂" label="Registration opportunities" value={stats.opportunities} hint="All statuses" accent="bg-violet-50 text-violet-700" href={listHref({})} />
        <StatCard icon="👥" label="Total participants" value={stats.participants} hint="Excl. rejected" accent="bg-sky-50 text-sky-700" />
        <StatCard icon="⏳" label="Pending payment verification" value={stats.pending} hint={stats.pending ? 'Needs review' : 'All clear'} accent="bg-amber-50 text-amber-700" />
        <StatCard icon="✅" label="Verified registrations" value={stats.verified} hint={`${stats.checkInRate}% checked in`} accent="bg-emerald-50 text-emerald-700" />
        <StatCard icon="🚫" label="Rejected registrations" value={stats.rejected} accent="bg-red-50 text-red-700" />
        <StatCard icon="💰" label="Total revenue (approx.)" value={money(stats.revenue)} hint="Verified payments" accent="bg-lime-50 text-lime-700" />
        <StatCard icon="🎟" label="Check-in rate" value={`${stats.checkInRate}%`} hint="Of verified" accent="bg-teal-50 text-teal-700" />
        <StatCard icon="📈" label="Daily registrations (avg)" value={(stats.participants / Math.max(1, stats.opportunities)).toFixed(1)} hint="Per opportunity" accent="bg-fuchsia-50 text-fuchsia-700" />
      </section>

      {/* Performance + distribution */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <section className={`${card} p-6 lg:col-span-2`} aria-label="Registration performance">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-zinc-950">Registrations over time</h2>
            <div className="flex rounded-lg border border-zinc-200 p-0.5 text-xs font-semibold">
              <span className="rounded-md bg-emerald-700 px-2.5 py-1 text-white">Last 90 days</span>
              <span className="px-2.5 py-1 text-zinc-500">7d peak: {Math.max(...last7.map((p) => p.count), 0)}</span>
              <span className="px-2.5 py-1 text-zinc-500">30d peak: {Math.max(...last30.map((p) => p.count), 0)}</span>
            </div>
          </div>
          <div className="mt-5 flex h-24 items-end gap-[2px]" role="img" aria-label="Daily registrations for the last 90 days">
            {miniBars(stats.daily)}
          </div>
          <p className="mt-3 text-xs text-zinc-500">Daily registration volume over the last 90 days.</p>
        </section>

        <section className={`${card} p-6`} aria-label="Payment status distribution">
          <h2 className="text-sm font-bold text-zinc-950">Payment status distribution</h2>
          <div className="mt-5 grid gap-4">
            {stats.byStatus.map((entry) => {
              const colors: Record<string, string> = { verified: 'bg-emerald-500', pending: 'bg-amber-500', rejected: 'bg-red-500' }
              return (
                <div key={entry.status}>
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-700">
                    <span className="capitalize">{entry.status}</span>
                    <span className="tabular-nums">{entry.count} · {Math.round((entry.count / total) * 100)}%</span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-zinc-100">
                    <div className={`h-full rounded-full ${colors[entry.status]}`} style={{ width: `${(entry.count / total) * 100}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>

      {/* Filters + view toggle */}
      <section className={`${card} mt-5 p-4`} aria-label="Filters">
        <form className="flex flex-wrap items-end gap-3" action="/admin/registrations" method="GET">
          <label className="min-w-48 flex-1">
            <span className="text-xs font-semibold text-zinc-600">Search title</span>
            <input className="mt-1 w-full rounded-xl border border-zinc-300 px-3.5 py-2 text-sm" defaultValue={search} name="q" placeholder="Search registrations…" />
          </label>
          <label>
            <span className="text-xs font-semibold text-zinc-600">Category</span>
            <select className="mt-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm capitalize" defaultValue={category} name="category">
              <option value="all">All categories</option>
              {REGISTRATION_CATEGORIES.map((item) => <option key={item} value={item}>{CATEGORY_LABELS[item]}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-zinc-600">Status</span>
            <select className="mt-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm capitalize" defaultValue={status} name="status">
              <option value="all">All statuses</option>
              {['draft', 'published', 'unpublished', 'archived'].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-zinc-600">Pricing</span>
            <select className="mt-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm" defaultValue={paymentMode} name="mode">
              <option value="all">Free & paid</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-semibold text-zinc-600">Sort</span>
            <select className="mt-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm" defaultValue={sort} name="sort">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="popularity">Popularity</option>
              <option value="revenue">Revenue</option>
            </select>
          </label>
          <button className={ghostButton} type="submit">Apply</button>
          <Link className="text-xs font-semibold text-emerald-800 hover:underline" href="/admin/registrations">Reset</Link>
        </form>
      </section>

      {/* Opportunities table */}
      <section className={`${card} mt-4 overflow-hidden`} aria-label="Registration opportunities">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
          <h2 className="text-sm font-bold text-zinc-950">Registration opportunities <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">{allItems.length}</span></h2>
          <div className="flex gap-2">
            <a className={`${ghostButton} px-3 py-1.5 text-xs`} href="/api/admin/registrations/export">Export CSV</a>
            <Link className={primaryButton} href="/admin/registrations/new">+ Create Registration</Link>
          </div>
        </div>

        {items.length ? (
          <>
            {/* Single bulk form containing table + bulk bar. Row menus submit to
                this same form via button submitters, so nothing nests. */}
            <form action={experienceRowAction} id="bulk-form">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-bold uppercase tracking-wider text-zinc-500">
                      <th className="w-10 px-3 py-3" />
                      <th className="px-4 py-3">Registration</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Event date</th>
                      <th className="px-4 py-3">Capacity</th>
                      <th className="px-4 py-3">Participants</th>
                      <th className="px-4 py-3">Revenue</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {items.map((item) => {
                      const open = isOpenForRegistration(item)
                      const capacityUsed = item.capacity ? Math.min(100, Math.round((item.participant_count / item.capacity) * 100)) : null
                      return (
                        <tr className="transition hover:bg-zinc-50" key={item.id}>
                          <td className="px-3">
                            <input className="h-4 w-4 accent-emerald-700" name="ids" type="checkbox" value={item.id} />
                          </td>
                          <td className="max-w-64 px-4 py-3.5">
                            <Link className="block truncate font-semibold text-zinc-950 hover:text-emerald-800" href={`/admin/registrations/${item.id}`}>{item.title_en || '(untitled)'}</Link>
                            <span className="block truncate text-xs text-zinc-500">/{item.slug} · created {formatDate(item.created_at).split(',')[0]}</span>
                          </td>
                          <td className="px-4 py-3.5"><span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-700">{CATEGORY_LABELS[item.kind] ?? item.kind}</span></td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-zinc-600">{formatDate(item.start_date)}</td>
                          <td className="px-4 py-3.5">
                            {item.unlimited_capacity || item.capacity === null ? (
                              <span className="text-xs font-semibold text-zinc-500">Unlimited</span>
                            ) : (
                              <div className="grid w-28 gap-1">
                                <span className="text-xs tabular-nums text-zinc-600">{item.participant_count}/{item.capacity}</span>
                                <div className="h-1.5 rounded-full bg-zinc-100"><div className={`h-full rounded-full ${capacityUsed! >= 100 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${capacityUsed}%` }} /></div>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3.5 tabular-nums text-zinc-700">{item.participant_count} <span className="text-xs text-emerald-700">({item.verified_count} ✓)</span></td>
                          <td className="px-4 py-3.5 tabular-nums text-zinc-700">{money(item.revenue, item.currency)}</td>
                          <td className="px-4 py-3.5"><Badge value={item.status} /> {!open.open && item.status === 'published' && <Badge value="closed" className="ml-1" />}</td>
                          <td className="px-4 py-3.5 text-right">
                            <details className="relative inline-block text-left">
                              <summary className="cursor-pointer rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:border-zinc-400">⋯</summary>
                              <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg">
                                <MenuItem href={`/admin/registrations/${item.id}`}>View details</MenuItem>
                                <MenuItem href={`/admin/registrations/${item.id}/edit`}>Edit</MenuItem>
                                <MenuItem href={`/register/${item.slug}`}>Preview public page</MenuItem>
                                <MenuItem href={`/admin/registrations/${item.id}?tab=participants`}>Manage participants</MenuItem>
                                <RowActionButton id={item.id} intent="duplicate">Duplicate</RowActionButton>
                                <RowActionButton id={item.id} intent={item.status === 'published' ? 'unpublish' : 'publish'}>
                                  {item.status === 'published' ? 'Unpublish' : 'Publish'}
                                </RowActionButton>
                                <RowActionButton id={item.id} intent="archive">Archive</RowActionButton>
                              </div>
                            </details>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bulk bar — inside the same form; each button declares its status. */}
              <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 bg-zinc-50 px-5 py-3" id="bulk-bar">
                <span className="text-xs font-semibold text-zinc-600">With selected:</span>
                <button className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50" name="status" type="submit" value="published">Publish</button>
                <button className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100" name="status" type="submit" value="unpublished">Unpublish</button>
                <button className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50" name="status" type="submit" value="archived">Archive</button>
              </div>
            </form>
          </>
        ) : (
          <div className="p-12 text-center">
            <p className="text-2xl">🗂️</p>
            <p className="mt-2 text-base font-semibold text-zinc-700">{search || category !== 'all' || status !== 'all' ? 'No registrations match your filters.' : 'No registration opportunities yet'}</p>
            <p className="mt-1 text-sm text-zinc-500">Create your first registration to start accepting participants.</p>
            <Link className={`${primaryButton} mt-4 inline-block`} href="/admin/registrations/new">+ Create Registration</Link>
          </div>
        )}
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 && <Link className={`${ghostButton} px-3 py-1.5 text-xs`} href={listHref({ page: String(page - 1) })}>← Previous</Link>}
          <span className="text-xs font-semibold text-zinc-600">Page {page} of {totalPages}</span>
          {page < totalPages && <Link className={`${ghostButton} px-3 py-1.5 text-xs`} href={listHref({ page: String(page + 1) })}>Next →</Link>}
        </nav>
      )}
    </AdminShell>
  )
}

function MenuItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100" href={href}>{children}</a>
  )
}
/** Submits to the surrounding bulk form, carrying intent:id via row_intent. */
function RowActionButton({ id, intent, children }: { id: number; intent: 'duplicate' | 'publish' | 'unpublish' | 'archive'; children: React.ReactNode }) {
  return (
    <button
      className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-100"
      name="row_intent"
      type="submit"
      value={`${intent}:${id}`}
    >
      {children}
    </button>
  )
}

function Banner({ tone, children }: { tone: 'green' | 'amber'; children: React.ReactNode }) {
  const styles = tone === 'green'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : 'border-amber-200 bg-amber-50 text-amber-900'
  return <p className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${styles}`}>{children}</p>
}


