import { logoutAdmin } from './actions'
import type { SafeAdmin } from '@/lib/admin-auth'

const navItems = [
  { href: '/admin', label: 'Home', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10' },
  { href: '/admin/registrations', label: 'Guests', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
  { href: '/admin/experiences', label: 'Trips', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/admin/stories', label: 'Stories', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.247m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.247v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.247' },
  { href: '/admin/media', label: 'Media', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
]

const sidebarGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10' },
      { href: '/admin/registrations', label: 'Registrations', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/experiences', label: 'Experiences', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { href: '/admin/stories', label: 'Stories', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.247m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.247v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.247' },
      { href: '/admin/social', label: 'Social wall', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
      { href: '/admin/media', label: 'Media library', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/admin/scan', label: 'Scan ticket', icon: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM15 13a3 3 0 11-6 0 3 3 0 016 0z' },
    ],
  },
]

export function roleLabel(role: string) {
  const labels: Record<string, string> = {
    'super-admin': 'Super admin',
    administrator: 'Administrator',
    editor: 'Editor',
    'check-in': 'Check-in staff',
  }
  return labels[role] ?? role
}

export default function AdminShell({
  admin,
  active,
  title,
  subtitle,
  children,
}: {
  admin: SafeAdmin
  active: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const mobileItems = admin.role === 'check-in'
    ? navItems.filter((item) => item.href === '/admin/registrations' || item.href === '/admin')
    : navItems

  return (
    <div className="min-h-screen bg-zinc-100 lg:flex">
      {/* ── Desktop sidebar ── */}
      <aside className="sticky top-0 z-30 hidden h-screen w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 px-5 py-7 lg:flex">
        <a className="flex items-center gap-2.5" href="/admin">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-sm font-black text-zinc-950">P</span>
          <span className="leading-tight">
            <span className="block text-sm font-bold text-white">Parallax</span>
            <span className="block text-[11px] font-medium uppercase tracking-widest text-zinc-500">Operations</span>
          </span>
        </a>

        <nav aria-label="Admin sections" className="mt-8 flex flex-1 flex-col gap-6 overflow-y-auto">
          {sidebarGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600">{group.label}</p>
              <div className="grid gap-1">
                {group.items.map((item) => {
                  const isActive = active === item.href
                  return (
                    <a
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive
                          ? 'bg-emerald-500/10 text-emerald-300'
                          : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                        }`}
                      href={item.href}
                      key={item.href}
                    >
                      <svg
                        className={`h-5 w-5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.8}
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item.label}
                      {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                    </a>
                  )
                })}
              </div>
            </div>
          ))}
          {admin.role === 'super-admin' && (
            <div>
              <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-widest text-zinc-600">Administration</p>
              <div className="grid gap-1">
                <a
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active === '/admin/announcements'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                    }`}
                  href="/admin/announcements"
                >
                  <svg
                    className={`h-5 w-5 shrink-0 ${active === '/admin/announcements' ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path d="M11 5.882V19.24a1.76 1.76 0 01-3.177 0c-.39-.977-.36-1.896-.36-2.224m0 0a6.723 6.723 0 003.537 1.042A6.72 6.72 0 0019 9.75a6.72 6.72 0 00-3.537-1.042 6.723 0 00-3.537-1.042m0 0V5.25a2.25 2.25 0 012.25-2.25h.09a2.25 2.25 0 012.25 2.25v.463" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Announcements
                  {active === '/admin/announcements' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                </a>
                <a
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active === '/admin/admins'
                      ? 'bg-emerald-500/10 text-emerald-300'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                    }`}
                  href="/admin/admins"
                >
                <svg
                  className={`h-5 w-5 shrink-0 ${active === '/admin/admins' ? 'text-emerald-400' : 'text-zinc-500 group-hover:text-zinc-300'}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Team accounts
                {active === '/admin/admins' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                </a>
              </div>
            </div>
          )}
        </nav>

        <div className="border-t border-zinc-800 pt-4">
          <div className="flex items-center gap-3 px-1">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-400">
              {admin.display_name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-white">{admin.display_name}</p>
              <p className="truncate text-xs text-zinc-500">{roleLabel(admin.role)}</p>
            </div>
          </div>
          <form action={logoutAdmin} className="mt-3 px-1">
            <button className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white/85 px-4 py-3 backdrop-blur sm:px-6 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-xs font-black text-white">P</span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold text-zinc-950">{title}</p>
            <p className="truncate text-[11px] text-zinc-500">{admin.display_name}</p>
          </div>
          <form action={logoutAdmin}>
            <button aria-label="Sign out" className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-semibold text-zinc-600" type="submit">
              Exit
            </button>
          </form>
        </header>

        {/* Desktop page header */}
        <header className="hidden border-b border-zinc-200 bg-white/80 px-5 py-4 backdrop-blur lg:block lg:sticky lg:top-0 lg:z-20">
          <div className="mx-auto max-w-6xl">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-950">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-5 pb-24 sm:px-6 sm:py-7 lg:px-8 lg:pb-10">{children}</main>
      </div>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        aria-label="Admin sections (mobile)"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-zinc-800 bg-zinc-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {mobileItems.map((item) => {
          const isActive = active === item.href
          return (
            <a
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 transition ${isActive ? 'text-emerald-400' : 'text-zinc-500 active:text-zinc-300'
                }`}
              href={item.href}
              key={item.href}
            >
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={isActive ? 2.2 : 1.8}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="max-w-full truncate text-[10px] font-semibold">{item.label}</span>
              {isActive && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-emerald-400" />}
            </a>
          )
        })}
      </nav>
    </div>
  )
}
