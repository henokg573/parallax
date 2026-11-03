import { requireAdmin } from '@/lib/admin-auth'
import { QRScanner } from './QRScanner'

export const dynamic = 'force-dynamic'

export default async function AdminScanPage() {
  const admin = await requireAdmin('/admin/scan')

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8">
      <header className="border-b border-zinc-200 pb-5">
        <a className="text-sm font-semibold text-emerald-800" href="/admin">Parallax operations</a>
        <h1 className="mt-2 text-3xl font-semibold text-zinc-950">Scan ticket</h1>
        <p className="mt-1 text-sm text-zinc-600">Signed in as {admin.display_name}</p>
      </header>
      <QRScanner />
    </main>
  )
}