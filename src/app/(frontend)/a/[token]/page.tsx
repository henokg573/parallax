import type { RowDataPacket } from 'mysql2/promise'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { rows } from '@/lib/db'

export const dynamic = 'force-dynamic'

type AnnouncementRow = RowDataPacket & {
  id: number
  title: string
  message: string
  link_url: string | null
  link_label: string | null
  status: 'draft' | 'published'
}

export default async function AnnouncementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound()

  const result = await rows<AnnouncementRow>(
    "SELECT id, title, message, link_url, link_label, status FROM announcements WHERE share_token = ? AND status = 'published' LIMIT 1",
    [token],
  )
  const announcement = result[0]
  if (!announcement) notFound()

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-emerald-950 to-zinc-950 px-5 py-14">
      <article className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-emerald-700 via-emerald-800 to-zinc-950 px-7 pb-9 pt-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            Announcement
          </span>
          <h1 className="mt-3 text-3xl font-black leading-tight text-white">{announcement.title}</h1>
        </div>
        <div className="px-7 py-7">
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-700">{announcement.message}</p>
          <div className="mt-7 grid gap-3">
            {announcement.link_url && (
              <a
                className="block rounded-xl bg-emerald-700 px-4 py-3.5 text-center text-sm font-bold text-white transition hover:bg-emerald-800"
                href={announcement.link_url}
                target="_blank"
                rel="noreferrer"
              >
                {announcement.link_label || 'Learn more'} →
              </a>
            )}
            <Link className="block rounded-xl border border-zinc-300 px-4 py-3 text-center text-sm font-bold text-zinc-700 transition hover:bg-zinc-50" href="/">
              Visit Parallax
            </Link>
          </div>
        </div>
        <p className="border-t border-zinc-100 px-7 py-4 text-center text-xs text-zinc-400">PARALLAX · ETHIOPIA</p>
      </article>
    </main>
  )
}
