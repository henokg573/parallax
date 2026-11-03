import type { RowDataPacket } from 'mysql2/promise'
import QRCode from 'qrcode'
import { redirect } from 'next/navigation'
import { deleteAnnouncement, saveAnnouncement } from '../actions'
import { requireAdmin } from '@/lib/admin-auth'
import { rows } from '@/lib/db'
import AdminShell from '../admin-shell'

export const dynamic = 'force-dynamic'

type AnnouncementRow = RowDataPacket & {
  id: number
  title: string
  message: string
  link_url: string | null
  link_label: string | null
  status: 'draft' | 'published'
  dismissible: number
  share_token: string
  created_at: string
}

const inputClass = 'mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15'
const primaryButton = 'rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800'
const ghostButton = 'rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50'

function AnnouncementForm({ record }: { record?: AnnouncementRow }) {
  const shareURL = record ? `/a/${record.share_token}` : ''
  return (
    <form action={saveAnnouncement} className="grid gap-x-5 gap-y-4 px-4 pb-6 pt-5 sm:grid-cols-2 sm:px-5">
      <input type="hidden" name="id" value={record?.id ?? ''} />
      <label className="grid gap-1 text-sm font-medium text-zinc-800 sm:col-span-2">
        Title
        <input className={inputClass} defaultValue={record?.title || ''} name="title" maxLength={200} required />
      </label>
      <label className="grid gap-1 text-sm font-medium text-zinc-800 sm:col-span-2">
        Message shown to visitors
        <textarea className={inputClass} defaultValue={record?.message || ''} name="message" rows={4} required />
      </label>
      <label className="grid gap-1 text-sm font-medium text-zinc-800">
        Button link (optional)
        <input className={inputClass} defaultValue={record?.link_url || ''} name="link_url" type="url" placeholder="https://…" />
      </label>
      <label className="grid gap-1 text-sm font-medium text-zinc-800">
        Button label (optional)
        <input className={inputClass} defaultValue={record?.link_label || ''} name="link_label" maxLength={120} placeholder="Learn more" />
      </label>
      <label className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm font-medium text-zinc-800">
        <input className="h-4 w-4 accent-emerald-700" defaultChecked={record ? Boolean(record.dismissible) : true} name="dismissible" type="checkbox" />
        Visitors can dismiss this popup
      </label>
      <label className="grid gap-1 text-sm font-medium text-zinc-800">
        Status
        <select className={inputClass} defaultValue={record?.status || 'draft'} name="status">
          <option value="draft">Draft</option>
          <option value="published">Published (live on site)</option>
        </select>
      </label>
      {record && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-800">Share link</p>
          <p className="mt-1 break-all font-mono text-sm text-emerald-950">{shareURL}</p>
          <p className="mt-1 text-xs text-emerald-800">Scan the QR code above or share this link — it shows this announcement directly.</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className={primaryButton} type="submit">{record ? 'Save changes' : 'Create announcement'}</button>
        <button className={ghostButton} type="reset">Reset</button>
      </div>
    </form>
  )
}

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string }>
}) {
  const admin = await requireAdmin('/admin/announcements')
  if (admin.role !== 'super-admin') redirect('/admin')

  const records = await rows<AnnouncementRow>('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100')
  const query = await searchParams
  const siteURL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const withQR = await Promise.all(
    records.map(async (record) => ({
      record,
      qr: await QRCode.toDataURL(`${siteURL}/a/${record.share_token}`, { width: 400, margin: 2, errorCorrectionLevel: 'M' }),
    })),
  )

  return (
    <AdminShell admin={admin} active="/admin/announcements" title="Announcements" subtitle="Popups shown to every visitor on the website — plus QR codes for sharing">
      {query.saved && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white">✓</span>
          Announcement saved.
        </p>
      )}
      {query.deleted && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] font-black text-white">×</span>
          Announcement deleted.
        </p>
      )}

      <div className="grid gap-5">
        <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <details>
            <summary className="flex cursor-pointer items-center justify-between px-4 py-4 sm:px-5">
              <span className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-sm font-bold text-emerald-700">＋</span>
                <span className="text-sm font-bold text-zinc-950">New announcement</span>
              </span>
              <span className="text-xs font-semibold text-zinc-400">Expand</span>
            </summary>
            <AnnouncementForm />
          </details>
        </section>

        {withQR.map(({ record, qr }) => (
          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm" key={record.id}>
            <details>
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
                <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-lg">📣</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-zinc-950">{record.title}</span>
                  <span className="block truncate text-xs text-zinc-500">{String(record.message).slice(0, 80)}</span>
                </span>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${record.status === 'published'
                      ? 'bg-emerald-100 text-emerald-800 ring-emerald-600/20'
                      : 'bg-zinc-100 text-zinc-600 ring-zinc-500/20'
                    }`}
                >
                  {record.status}
                </span>
                <span className="text-zinc-400">▾</span>
              </summary>

              <div className="grid gap-5 px-4 pb-6 sm:grid-cols-[auto_1fr] sm:px-5">
                <div className="grid justify-items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:w-56">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={`QR code for ${record.title}`} className="h-44 w-44 rounded-lg bg-white" src={qr} />
                  <a className={primaryButton + ' w-full text-center'} download={`parallax-${record.share_token}.png`} href={qr}>
                    Download QR
                  </a>
                  <a className="break-all text-center font-mono text-[11px] text-zinc-500" href={`/a/${record.share_token}`} target="_blank" rel="noreferrer">
                    {siteURL}/a/{record.share_token}
                  </a>
                </div>
                <div className="min-w-0">
                  <AnnouncementForm record={record} />
                  <form action={deleteAnnouncement} className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-1 pt-4">
                    <span className="text-xs text-zinc-500">Deleting is permanent and removes the popup and QR everywhere.</span>
                    <input type="hidden" name="id" value={record.id} />
                    <button className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50" type="submit">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </details>
          </section>
        ))}

        {records.length === 0 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-12 text-center">
            <p className="text-base font-semibold text-zinc-700">No announcements yet</p>
            <p className="mt-1 text-sm text-zinc-500">Create one above, publish it, and it will pop up on the website for every visitor.</p>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
