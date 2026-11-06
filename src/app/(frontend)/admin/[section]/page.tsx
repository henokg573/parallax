import QRCode from 'qrcode'
import { redirect } from 'next/navigation'
import { createAdmin, archiveContent, deleteAdmin, deleteContent, deleteMedia, restoreContent, saveContent, updateRegistration, uploadMedia } from '../actions'
import { requireAdmin } from '@/lib/admin-auth'
import { rows } from '@/lib/db'
import { publicMediaURL } from '@/lib/storage'
import AdminShell, { roleLabel } from '../admin-shell'

export const dynamic = 'force-dynamic'

type AdminRecord = Record<string, string | number | null>
type Field = {
  name: string
  label: string
  type?: 'text' | 'url' | 'number' | 'datetime-local' | 'textarea' | 'select' | 'checkbox'
  options?: string[]
  required?: boolean
}

const sections = {
  experiences: {
    title: 'Experiences',
    subtitle: 'Trips, events, and faith gatherings guests can register for',
    singular: 'experience',
    kind: 'experience',
    query: `SELECT e.*, m.filename AS image_filename, m.alt AS image_alt,
        vm.filename AS video_filename, vm.alt AS video_alt
      FROM experiences e LEFT JOIN media m ON m.id = e.image_id
      LEFT JOIN media vm ON vm.id = e.video_id
      ORDER BY e.start_date DESC LIMIT 200`,
    fields: [
      { name: 'title_en', label: 'Title (English)', required: true },
      { name: 'title_am', label: 'Title (Amharic)' },
      { name: 'slug', label: 'URL slug' },
      { name: 'kind', label: 'Registration type', type: 'select', options: ['event', 'trip', 'faith', 'workshop', 'other'] },
      { name: 'summary_en', label: 'Summary (English)', type: 'textarea', required: true },
      { name: 'summary_am', label: 'Summary (Amharic)', type: 'textarea' },
      { name: 'location_en', label: 'Location (English)', required: true },
      { name: 'location_am', label: 'Location (Amharic)' },
      { name: 'start_date', label: 'Start date', type: 'datetime-local', required: true },
      { name: 'end_date', label: 'End date', type: 'datetime-local' },
      { name: 'capacity', label: 'Capacity', type: 'number' },
      { name: 'price', label: 'Price', type: 'number' },
      { name: 'currency', label: 'Currency', type: 'select', options: ['ETB', 'USD'] },
      { name: 'registration_url', label: 'External registration URL', type: 'url' },
      { name: 'resource_url', label: 'Optional information or file URL', type: 'url' },
      { name: 'featured', label: 'Featured', type: 'checkbox' },
      { name: 'status', label: 'Status', type: 'select', options: ['draft', 'published', 'archived'] },
    ] satisfies Field[],
  },
  stories: {
    title: 'Stories',
    subtitle: 'Community stories and trip recaps published to the blog',
    singular: 'story',
    kind: 'story',
    query: `SELECT s.*, m.filename AS image_filename, m.alt AS image_alt,
        vm.filename AS video_filename, vm.alt AS video_alt
      FROM stories s LEFT JOIN media m ON m.id = s.image_id
      LEFT JOIN media vm ON vm.id = s.video_id
      ORDER BY COALESCE(s.published_at, s.created_at) DESC LIMIT 200`,
    fields: [
      { name: 'title_en', label: 'Title (English)', required: true },
      { name: 'title_am', label: 'Title (Amharic)' },
      { name: 'slug', label: 'URL slug' },
      { name: 'excerpt_en', label: 'Excerpt (English)', type: 'textarea', required: true },
      { name: 'excerpt_am', label: 'Excerpt (Amharic)', type: 'textarea' },
      { name: 'body_en', label: 'Story (English)', type: 'textarea', required: true },
      { name: 'body_am', label: 'Story (Amharic)', type: 'textarea' },
      { name: 'author_name_en', label: 'Author (English)' },
      { name: 'author_name_am', label: 'Author (Amharic)' },
      { name: 'published_at', label: 'Publish date', type: 'datetime-local' },
      { name: 'featured', label: 'Featured', type: 'checkbox' },
      { name: 'status', label: 'Status', type: 'select', options: ['draft', 'published', 'archived'] },
    ] satisfies Field[],
  },
  social: {
    title: 'Social wall',
    subtitle: 'Embedded posts from Telegram, TikTok, Instagram, YouTube, and Facebook',
    singular: 'post',
    kind: 'social',
    query: `SELECT p.*, m.filename AS image_filename, m.alt AS image_alt,
        vm.filename AS video_filename, vm.alt AS video_alt
      FROM social_posts p LEFT JOIN media m ON m.id = p.thumbnail_id
      LEFT JOIN media vm ON vm.id = p.video_id
      ORDER BY p.posted_at DESC LIMIT 200`,
    fields: [
      { name: 'platform', label: 'Platform', type: 'select', options: ['telegram', 'tiktok', 'instagram', 'youtube', 'facebook'] },
      { name: 'caption_en', label: 'Caption (English)', type: 'textarea', required: true },
      { name: 'caption_am', label: 'Caption (Amharic)', type: 'textarea' },
      { name: 'post_url', label: 'Post URL', type: 'url', required: true },
      { name: 'posted_at', label: 'Post date', type: 'datetime-local', required: true },
      { name: 'visible', label: 'Visible on site', type: 'checkbox' },
      { name: 'status', label: 'Status', type: 'select', options: ['draft', 'published', 'archived'] },
    ] satisfies Field[],
  },
  registrations: {
    title: 'Registrations',
    subtitle: 'Review payments, verify tickets, and track check-ins',
    singular: 'registration',
    kind: 'registrations',
    query: `SELECT r.*, e.title_en AS experience_title, p.original_filename AS receipt_name
      FROM registrations r JOIN experiences e ON e.id = r.experience_id
      JOIN payment_receipts p ON p.id = r.receipt_id ORDER BY r.created_at DESC LIMIT 300`,
    fields: [] satisfies Field[],
  },
  media: {
    title: 'Media library',
    subtitle: 'Images and videos available across the site',
    singular: 'media item',
    kind: 'media',
    query: 'SELECT * FROM media ORDER BY created_at DESC LIMIT 300',
    fields: [] satisfies Field[],
  },
  admins: {
    title: 'Team accounts',
    subtitle: 'People who can sign in to this dashboard',
    singular: 'account',
    kind: 'admins',
    query: 'SELECT id, email, display_name, role, created_at FROM admins ORDER BY email',
    fields: [] satisfies Field[],
  },
} as const

type SectionName = keyof typeof sections

async function getSectionRecords(sectionName: SectionName): Promise<AdminRecord[]> {
  if (sectionName === 'media') {
    return rows<AdminRecord>('media', { select: '*', order: { column: 'created_at', ascending: false }, limit: 300 })
  }

  if (sectionName === 'admins') {
    return rows<AdminRecord>('admins', {
      select: 'id, email, display_name, role, created_at',
      order: { column: 'email' },
    })
  }

  if (sectionName === 'registrations') {
    const [registrations, experiences, receipts] = await Promise.all([
      rows<AdminRecord>('registrations', { select: '*', order: { column: 'created_at', ascending: false }, limit: 300 }),
      rows<{ id: number; title_en: string }>('experiences', { select: 'id, title_en' }),
      rows<{ id: number; original_filename: string }>('payment_receipts', { select: 'id, original_filename' }),
    ])
    const experienceTitles = new Map(experiences.map((item) => [item.id, item.title_en]))
    const receiptNames = new Map(receipts.map((item) => [item.id, item.original_filename]))
    return registrations.map((record) => ({
      ...record,
      experience_title: experienceTitles.get(Number(record.experience_id)) || 'Parallax experience',
      receipt_name: receiptNames.get(Number(record.receipt_id)) || 'Receipt',
    })) as AdminRecord[]
  }

  const table = sectionName === 'experiences' ? 'experiences' : sectionName === 'stories' ? 'stories' : 'social_posts'
  const records = await rows<AdminRecord>(table, {
    select: '*',
    order: { column: sectionName === 'experiences' ? 'start_date' : sectionName === 'stories' ? 'published_at' : 'posted_at', ascending: false },
    limit: 200,
  })
  const mediaIDs = records.flatMap((record) => [
    record.image_id,
    record.video_id,
    record.resource_id,
    record.thumbnail_id,
  ]).filter((id): id is number => typeof id === 'number')
  const media = mediaIDs.length
    ? await rows<AdminRecord>('media', { select: 'id, filename, alt', in: { id: mediaIDs } })
    : []
  const mediaByID = new Map(media.map((item) => [Number(item.id), item]))

  return records.map((record) => {
    const image = mediaByID.get(Number(sectionName === 'social' ? record.thumbnail_id : record.image_id))
    const video = mediaByID.get(Number(record.video_id))
    return {
      ...record,
      image_filename: image?.filename || null,
      image_alt: image?.alt || null,
      video_filename: video?.filename || null,
      video_alt: video?.alt || null,
      resource_filename: mediaByID.get(Number(record.resource_id))?.filename || null,
    }
  }) as AdminRecord[]
}

const inputClass = 'mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15'
const primaryButton = 'rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600/40'
const ghostButton = 'rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 shadow-sm transition hover:border-zinc-400 hover:bg-zinc-50'
const dangerButton = 'rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50'

function formattedValue(value: string | number | null, type?: Field['type']) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return type === 'datetime-local' ? text.replace(' ', 'T').slice(0, 16) : text
}

function statusBadge(status: string | number | null) {
  const value = String(status || 'draft')
  const styles = value === 'published' || value === 'verified'
    ? 'bg-emerald-100 text-emerald-800 ring-emerald-600/20'
    : value === 'pending'
      ? 'bg-amber-100 text-amber-800 ring-amber-600/20'
      : value === 'rejected'
        ? 'bg-red-100 text-red-800 ring-red-600/20'
        : 'bg-zinc-100 text-zinc-600 ring-zinc-500/20'
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${styles}`}>
      {value}
    </span>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-zinc-200 bg-white shadow-sm ${className}`}>{children}</section>
}

function ContentForm({
  section,
  fields,
  record,
}: {
  section: 'experience' | 'story' | 'social'
  fields: readonly Field[]
  record?: AdminRecord
}) {
  return (
    <form action={saveContent} className="grid gap-x-5 gap-y-4 px-4 pb-6 pt-5 sm:grid-cols-2 sm:px-5">
      <input type="hidden" name="section" value={section} />
      <input type="hidden" name="id" value={record?.id ?? ''} />
      {fields.map((field) => {
        const value = record?.[field.name] ?? ''
        if (field.type === 'checkbox') {
          return (
            <label className="flex items-center gap-2.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-3 text-sm font-medium text-zinc-800" key={field.name}>
              <input className="h-4 w-4 accent-emerald-700" defaultChecked={Boolean(value)} name={field.name} type="checkbox" />
              {field.label}
            </label>
          )
        }
        return (
          <label className={`grid gap-1 text-sm font-medium text-zinc-800 ${field.type === 'textarea' ? 'sm:col-span-2' : ''}`} key={field.name}>
            {field.label}
            {field.type === 'textarea' ? (
              <textarea className={inputClass} defaultValue={String(value)} name={field.name} rows={field.name.startsWith('body_') ? 10 : 3} required={field.required} />
            ) : field.type === 'select' ? (
              <select className={`${inputClass} capitalize`} defaultValue={formattedValue(value) || field.options?.[0]} name={field.name} required={field.required}>
                {field.options?.map((option) => <option className="capitalize" key={option} value={option}>{option}</option>)}
              </select>
            ) : (
              <input className={inputClass} defaultValue={formattedValue(value, field.type)} name={field.name} type={field.type || 'text'} required={field.required} />
            )}
          </label>
        )
      })}
      <div className="grid gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:col-span-2">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Media</p>
        <input
          name={section === 'social' ? 'thumbnail_id' : 'image_id'}
          type="hidden"
          value={record?.[section === 'social' ? 'thumbnail_id' : 'image_id'] ?? ''}
        />
        {record?.image_filename && (
          <div className="flex items-center gap-3">
            <img
              className="h-16 w-24 rounded-lg border border-zinc-200 object-cover"
              src={publicMediaURL(String(record.image_filename))}
              alt={String(record.image_alt || '')}
            />
            <span className="text-xs text-zinc-600">Current image · media {section === 'social' ? record.thumbnail_id : record.image_id}</span>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium text-zinc-800">
            {record?.image_filename ? 'Replace image' : 'Image file'}
            <input
              className="mt-1.5 w-full cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              name={section === 'social' ? 'thumbnail_file' : 'image_file'}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              required={section !== 'social' && !record?.image_id && !record?.image_url}
            />
            <span className="text-xs font-normal text-zinc-500">JPEG, PNG, WebP, or GIF; maximum 10 MB.</span>
          </label>
          <label className="grid gap-1 text-sm font-medium text-zinc-800">
            Image alternative text
            <input className={inputClass} defaultValue={String(record?.image_alt || '')} name="image_alt" maxLength={255} />
          </label>
          <label className="grid gap-1 text-sm font-medium text-zinc-800 sm:col-span-2">
            Or use an image URL
            <input className={inputClass} defaultValue={String(record?.image_url || '')} name="image_url" type="url" placeholder="https://…" />
            <span className="text-xs font-normal text-zinc-500">Provide an upload or a public image URL.</span>
          </label>
          <label className="grid gap-1 text-sm font-medium text-zinc-800 sm:col-span-2">
            Information file (optional)
            <input className="mt-1.5 w-full cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white" name="resource_file" type="file" accept="application/pdf,.pdf,.doc,.docx,.ppt,.pptx,.txt,text/plain" />
            <span className="text-xs font-normal text-zinc-500">Optional PDF, Word, PowerPoint, or text file; maximum 20 MB.</span>
            {record?.resource_filename && <span className="text-xs font-normal text-emerald-700">Current file: {String(record.resource_filename)}</span>}
          </label>
          <label className="grid gap-1 text-sm font-medium text-zinc-800">
            {record?.video_filename ? 'Replace video' : 'Add video (optional)'}
            <input
              className="mt-1.5 w-full cursor-pointer rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              name="video_file"
              type="file"
              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
            />
            <span className="text-xs font-normal text-zinc-500">MP4, WebM, or MOV; maximum 100 MB.</span>
          </label>
          <label className="grid gap-1 text-sm font-medium text-zinc-800">
            Video description
            <input className={inputClass} defaultValue={String(record?.video_alt || '')} name="video_alt" maxLength={255} />
          </label>
        </div>
        <input name="resource_id" type="hidden" value={record?.resource_id ?? ''} />
        <input name="video_id" type="hidden" value={record?.video_id ?? ''} />
        {record?.video_filename && (
          <div className="grid gap-2">
            <video
              className="aspect-video w-full max-w-xl rounded-xl border border-zinc-200 bg-black"
              controls
              preload="metadata"
              src={publicMediaURL(String(record.video_filename))}
            />
            <span className="text-xs text-zinc-600">Current video · media {record.video_id}</span>
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button className={primaryButton} type="submit">{record ? 'Save changes' : `Create ${section}`}</button>
        <button className={ghostButton} type="reset">Reset</button>
      </div>
    </form>
  )
}

function EmptyState({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 p-12 text-center">
      <p className="text-base font-semibold text-zinc-700">No {label} yet</p>
      {hint && <p className="mt-1 text-sm text-zinc-500">{hint}</p>}
    </div>
  )
}

export default async function AdminSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>
  searchParams: Promise<{ saved?: string; deleted?: string; archived?: string; restored?: string; email?: string; new?: string; error?: string }>
}) {
  const { section: sectionName } = await params
  const section = sections[sectionName as keyof typeof sections]
  if (!section) redirect('/admin')

  const admin = await requireAdmin(`/admin/${sectionName}`)
  if (admin.role === 'check-in' && sectionName !== 'registrations') redirect('/admin/registrations')
  if (sectionName === 'admins' && admin.role !== 'super-admin') redirect('/admin')

  const records = await getSectionRecords(sectionName as SectionName)
  if (sectionName === 'registrations') {
    await Promise.all(records.map(async (record) => {
      record.ticket_qr = record.payment_status === 'verified'
        ? await QRCode.toDataURL(String(record.check_in_token), { width: 180, margin: 1 })
        : null
    }))
  }
  const query = await searchParams
  const paymentSummary = sectionName === 'registrations'
    ? {
      pending: records.filter((record) => record.payment_status === 'pending').length,
      verified: records.filter((record) => record.payment_status === 'verified').length,
      rejected: records.filter((record) => record.payment_status === 'rejected').length,
    }
    : null

  return (
    <AdminShell admin={admin} active={`/admin${sectionName === 'experiences' ? '/experiences' : sectionName === 'stories' ? '/stories' : sectionName === 'social' ? '/social' : `/${sectionName}`}`} title={section.title} subtitle={section.subtitle}>
      {query.saved && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white">✓</span>
          Changes saved.
        </p>
      )}
      {query.archived && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-black text-white">▸</span>
          Item archived. It is hidden from the site but kept in the archive — use “Restore” to bring it back.
        </p>
      )}
      {query.restored && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white">✓</span>
          Item restored as a draft. Publish it again when it is ready.
        </p>
      )}
      {query.email === 'failed' && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          Payment was approved, but the ticket email was not sent. The QR below is ready to scan; configure Resend to send tickets by email.
        </p>
      )}
      {query.error === 'schema' && (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          The registration was not saved because the database migration is missing. Run <span className="font-semibold">database/migrate-registration-workflows.supabase.sql</span> in the Supabase SQL Editor, then try again.
        </p>
      )}

      {sectionName === 'registrations' ? (
        <div className="grid gap-4">
          <a className={`${primaryButton} inline-flex w-fit`} href="/admin/registrations?new=1">
            + Create new registration
          </a>
          <Card>
            <details open={query.new === '1'}>
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4">
                <span>
                  <span className="block text-sm font-bold text-zinc-950">Create a registration opportunity</span>
                  <span className="mt-0.5 block text-xs font-normal text-zinc-500">Publish an event, trip, faith gathering, workshop, or other registration.</span>
                </span>
                <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">New</span>
              </summary>
              <ContentForm fields={sections.experiences.fields} section="experience" />
            </details>
          </Card>
          <a className="text-sm font-semibold text-emerald-800 underline underline-offset-4" href="/admin/experiences">
            Manage existing registration opportunities
          </a>
          <div className="flex flex-wrap gap-3">
            {(['pending', 'verified', 'rejected'] as const).map((key) => (
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm" key={key}>
                <span className={`h-2 w-2 rounded-full ${key === 'pending' ? 'bg-amber-500' : key === 'verified' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {paymentSummary?.[key]} {key}
              </span>
            ))}
          </div>
          {records.map((record) => (
            <Card key={record.id}>
              <article className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h2 className="text-base font-bold text-zinc-950">{record.full_name}</h2>
                      {statusBadge(record.payment_status)}
                      {record.checked_in_at && statusBadge('checked in')}
                    </div>
                    <p className="mt-1 text-sm font-medium text-emerald-800">{record.experience_title}</p>
                    <p className="mt-1 text-sm text-zinc-600">{record.email} · {record.phone} · {String(record.preferred_channel || 'email')} · Ref <span className="font-mono text-xs">{record.payment_reference}</span></p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Submitted {String(record.created_at)} · Ticket {record.ticket_email_sent_at ? 'sent' : 'not sent'} · Check-in {record.checked_in_at || 'not checked in'}
                    </p>
                  </div>
                  <a className={ghostButton + ' text-emerald-800'} href={`/api/admin/receipts/${record.receipt_id}`}>
                    Receipt ↗
                  </a>
                </div>
                {record.payment_status === 'verified' && typeof record.ticket_qr === 'string' && (
                  <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl bg-emerald-50 p-4">
                    <img className="h-28 w-28 rounded-lg border border-emerald-200 bg-white p-1.5" src={record.ticket_qr} alt={`Check-in QR for ${record.full_name}`} />
                    <div className="grid gap-1.5 text-sm">
                      <span className="font-bold text-emerald-900">Verified ticket QR</span>
                      <a className="font-semibold text-emerald-800 underline" href={`/check-in/${record.check_in_token}`}>Open check-in manually</a>
                      <a className="font-semibold text-emerald-800 underline" href="/admin/scan">Open camera scanner</a>
                    </div>
                  </div>
                )}
                {admin.role === 'check-in' ? (
                  <a className={`mt-4 inline-block ${primaryButton}`} href={`/check-in/${record.check_in_token}`}>Open check-in</a>
                ) : (
                  <form action={updateRegistration} className="mt-4 grid gap-3 rounded-xl bg-zinc-50 p-4 sm:grid-cols-[180px_1fr_auto] sm:items-end">
                    <input type="hidden" name="id" value={record.id ?? ''} />
                    <label className="grid gap-1 text-sm font-medium text-zinc-800">Payment status
                      <select className={inputClass} defaultValue={String(record.payment_status)} name="payment_status">
                        <option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-zinc-800">Internal notes
                      <input className={inputClass} defaultValue={String(record.internal_notes || '')} name="internal_notes" />
                    </label>
                    <button className={primaryButton} type="submit">Save review</button>
                  </form>
                )}
              </article>
            </Card>
          ))}
          {records.length === 0 && <EmptyState hint="Guest registrations will appear here once people sign up." label="registrations" />}
        </div>
      ) : sectionName === 'media' ? (
        <div className="grid gap-5">
          <Card className="p-5">
            <form action={uploadMedia} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="grid gap-1 text-sm font-medium text-zinc-800">Image or video
                <input className={inputClass + ' cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white'} name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" required />
              </label>
              <label className="grid gap-1 text-sm font-medium text-zinc-800">Alternative text or video description
                <input className={inputClass} name="alt" maxLength={255} required />
              </label>
              <button className={primaryButton} type="submit">Upload</button>
            </form>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {records.map((record) => (
              <Card className="overflow-hidden" key={record.id}>
                {String(record.mime_type).startsWith('video/') ? (
                  <video className="aspect-[4/3] w-full bg-black object-cover" controls preload="metadata" src={publicMediaURL(String(record.filename))} />
                ) : (
                  <img className="aspect-[4/3] w-full object-cover" src={publicMediaURL(String(record.filename))} alt={String(record.alt || '')} />
                )}
                <div className="p-3.5">
                  <p className="truncate text-xs font-semibold text-zinc-800">{String(record.alt || record.original_filename || record.filename)}</p>
                  <p className="break-all text-xs text-zinc-500">{record.filename}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-400">ID {record.id}</span>
                    <form action={deleteMedia}>
                      <input type="hidden" name="id" value={String(record.id)} />
                      <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50" type="submit">Delete</button>
                    </form>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {records.length === 0 && <EmptyState hint="Upload images and videos to use across experiences, stories, and posts." label="media" />}
        </div>
      ) : sectionName === 'admins' ? (
        <div className="grid gap-5">
          <Card className="p-5">
            <h2 className="text-sm font-bold text-zinc-950">Invite a teammate</h2>
            <p className="mt-0.5 text-xs text-zinc-500">They can change their password after first sign-in.</p>
            <form action={createAdmin} className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium text-zinc-800">Display name<input className={inputClass} name="display_name" minLength={2} maxLength={120} required /></label>
              <label className="grid gap-1 text-sm font-medium text-zinc-800">Email<input className={inputClass} name="email" type="email" required /></label>
              <label className="grid gap-1 text-sm font-medium text-zinc-800">Temporary password<input className={inputClass} name="password" type="password" minLength={12} required /></label>
              <label className="grid gap-1 text-sm font-medium text-zinc-800">Role
                <select className={inputClass} name="role"><option value="editor">Editor</option><option value="administrator">Administrator</option><option value="check-in">Check-in staff</option><option value="super-admin">Super admin</option></select>
              </label>
              <div className="sm:col-span-2"><button className={primaryButton} type="submit">Create account</button></div>
            </form>
          </Card>
          <Card className="overflow-hidden">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-bold uppercase tracking-wider text-zinc-500">
                  <th className="px-5 py-3">Name</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {records.map((record) => (
                  <tr className="transition hover:bg-zinc-50" key={record.id}>
                    <td className="px-5 py-3.5 font-semibold text-zinc-900">{record.display_name}</td>
                    <td className="px-5 py-3.5 text-zinc-600">{record.email}</td>
                    <td className="px-5 py-3.5">{statusBadge(record.role)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <form action={deleteAdmin}>
                        <input type="hidden" name="id" value={String(record.id)} />
                        <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50" type="submit">Delete</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ) : (
        <div className="grid gap-5">
          {/* Create panel */}
          <Card>
            <details>
              <summary className="flex cursor-pointer items-center justify-between px-5 py-4">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-sm font-bold text-emerald-700">+</span>
                  <span className="text-sm font-bold text-zinc-950">New {section.singular}</span>
                </span>
                <span className="text-xs font-semibold text-zinc-400 group-open:hidden">Expand</span>
              </summary>
              <ContentForm fields={section.fields} section={section.kind as 'experience' | 'story' | 'social'} />
            </details>
          </Card>

          {/* Records */}
          {records.map((record) => {
            const label = String(record.title_en || record.caption_en || record.platform || `Record ${record.id}`)
            return (
              <Card key={record.id}>
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
                    {record.image_filename ? (
                      <img className="h-10 w-14 shrink-0 rounded-lg border border-zinc-200 object-cover" src={publicMediaURL(String(record.image_filename))} alt="" />
                    ) : (
                      <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs text-zinc-400">{section.kind === 'social' ? '🔗' : '📄'}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-zinc-950">{label}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {record.location_en || record.author_name_en || `Posted ${record.posted_at ? String(record.posted_at).slice(0, 10) : ''}`}
                        {record.start_date ? ` · ${String(record.start_date).slice(0, 16).replace('T', ' ')}` : ''}
                      </span>
                    </span>
                    {Boolean(record.featured) && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Featured</span>}
                    {section.kind === 'social' && !record.visible && <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">Hidden</span>}
                    {String(record.status) === 'archived' && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">Archived</span>}
                    {statusBadge(record.status)}
                    <span className="text-zinc-400">▾</span>
                  </summary>
                  <ContentForm fields={section.fields} record={record} section={section.kind as 'experience' | 'story' | 'social'} />
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-5 py-4">
                    {String(record.status) === 'archived' ? (
                      <span className="text-xs text-zinc-500">Archived — hidden from the site but kept here. Restore it to bring it back.</span>
                    ) : (
                      <span className="text-xs text-zinc-500">{admin.role === 'super-admin' ? 'Deleting is permanent and cannot be undone.' : 'Archiving hides the item from the site without deleting it. Only a super admin can delete permanently.'}</span>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                      {String(record.status) === 'archived' && (
                        <form action={restoreContent}>
                          <input type="hidden" name="section" value={section.kind} />
                          <input type="hidden" name="id" value={String(record.id)} />
                          <button className={ghostButton} type="submit">Restore</button>
                        </form>
                      )}
                      {String(record.status) !== 'archived' && (
                        <form action={archiveContent}>
                          <input type="hidden" name="section" value={section.kind} />
                          <input type="hidden" name="id" value={String(record.id)} />
                          <button className={ghostButton} type="submit">Archive</button>
                        </form>
                      )}
                      {admin.role === 'super-admin' && (
                        <form action={deleteContent}>
                          <input type="hidden" name="section" value={section.kind} />
                          <input type="hidden" name="id" value={String(record.id)} />
                          <button className={dangerButton} type="submit">Delete {section.singular}</button>
                        </form>
                      )}
                    </div>
                  </div>
                </details>
              </Card>
            )
          })}
          {records.length === 0 && <EmptyState hint={`Use “New ${section.singular}” above to add the first one.`} label={section.singular === 'post' ? 'posts' : `${section.singular}s`} />}
        </div>
      )}
    </AdminShell>
  )
}
