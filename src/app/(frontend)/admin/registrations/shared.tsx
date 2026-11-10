export const statusStyles: Record<string, string> = {
  published: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  verified: 'bg-emerald-100 text-emerald-800 ring-emerald-600/20',
  draft: 'bg-zinc-100 text-zinc-600 ring-zinc-500/20',
  pending: 'bg-amber-100 text-amber-800 ring-amber-600/20',
  rejected: 'bg-red-100 text-red-800 ring-red-600/20',
  unpublished: 'bg-zinc-100 text-zinc-600 ring-zinc-500/20',
  archived: 'bg-orange-100 text-orange-800 ring-orange-600/20',
  checked: 'bg-sky-100 text-sky-800 ring-sky-600/20',
}

export function Badge({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${statusStyles[value] ?? statusStyles.draft} ${className}`}>
      {value.replace(/-/g, ' ')}
    </span>
  )
}

export const card = 'rounded-2xl border border-zinc-200 bg-white shadow-sm'
export const inputClass = 'mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15'
export const primaryButton = 'rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/40'
export const ghostButton = 'rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50'
export const dangerButton = 'rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50'
export const fieldLabel = 'grid gap-1 text-sm font-medium text-zinc-800'

export function StatCard({ icon, label, value, hint, accent, href }: {
  icon: string
  label: string
  value: string | number
  hint?: string
  accent: string
  href?: string
}) {
  const Wrapper = (href ? 'a' : 'div') as 'a'
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className={`group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${href ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm ${accent}`}>{icon}</span>
        {hint && <span className="text-[11px] font-medium text-zinc-400 group-hover:text-zinc-600">{hint}</span>}
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-zinc-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-zinc-500">{label}</p>
    </Wrapper>
  )
}

export function money(amount: number, currency = 'ETB') {
  return `${amount.toLocaleString()} ${currency}`
}

export function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
