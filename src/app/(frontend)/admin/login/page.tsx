import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import { loginAdmin } from '../actions'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const admin = await getAdminSession()
  const query = await searchParams
  if (admin) redirect(query.next?.startsWith('/') && !query.next.startsWith('//') ? query.next : '/admin')

  return (
    <main className="mx-auto grid min-h-[70vh] max-w-md content-center px-6 py-12">
      <a className="text-sm font-semibold text-emerald-800" href="/">
        Parallax
      </a>
      <h1 className="mt-3 text-3xl font-semibold text-zinc-950">Team sign in</h1>
      <p className="mt-2 text-sm text-zinc-600">Sign in to manage experiences and registrations.</p>
      {query.error && (
        <p className="mt-5 border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-900" role="alert">
          {query.error === 'locked'
            ? 'Too many attempts. Wait 15 minutes before trying again.'
            : 'Email or password is incorrect.'}
        </p>
      )}
      <form action={loginAdmin} className="mt-7 grid gap-5">
        <input type="hidden" name="next" value={query.next || '/admin'} />
        <label className="grid gap-2 text-sm font-medium text-zinc-800">
          Email
          <input className="rounded border border-zinc-300 px-3 py-2.5" name="email" type="email" autoComplete="username" required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-zinc-800">
          Password
          <input className="rounded border border-zinc-300 px-3 py-2.5" name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="rounded bg-emerald-900 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800" type="submit">
          Sign in
        </button>
      </form>
    </main>
  )
}