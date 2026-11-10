import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-auth'
import { listRegistrations, listParticipants } from '@/lib/registrations'

function csvEscape(value: unknown) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function toCSV(headers: string[], records: unknown[][]) {
  return `\ufeff${headers.join(',')}\n${records.map((row) => row.map(csvEscape).join(',')).join('\n')}`
}

export async function GET(request: Request) {
  const admin = await getAdminSession()
  if (!admin || admin.role === 'check-in') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const experienceID = url.searchParams.get('id')

  if (experienceID && Number.isSafeInteger(Number(experienceID))) {
    const experience = await listRegistrations()
    const current = experience.find((item) => item.id === Number(experienceID))
    const participants = await listParticipants(Number(experienceID))
    const csv = toCSV(
      ['ID', 'Reference', 'Full name', 'Email', 'Phone', 'Ticket type', 'Registered at', 'Amount', 'Currency', 'Payment status', 'Verified by', 'Verified at', 'Checked in at'],
      participants.map((p) => [
        p.id, p.reference_code ?? `#${p.id}`, p.full_name, p.email, p.phone, p.ticket_type,
        p.created_at, p.amount ?? '', p.currency, p.payment_status, p.verified_by ?? '', p.verified_at ?? '', p.checked_in_at ?? '',
      ]),
    )
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="participants-${current?.slug ?? experienceID}.csv"`,
      },
    })
  }

  const registrations = await listRegistrations({ sort: 'newest' })
  const csv = toCSV(
    ['ID', 'Title (EN)', 'Title (AM)', 'Slug', 'Category', 'Event date', 'Capacity', 'Participants', 'Verified', 'Revenue', 'Currency', 'Pricing', 'Status', 'Created at'],
    registrations.map((item) => [
      item.id, item.title_en, item.title_am, item.slug, item.kind, item.start_date,
      item.unlimited_capacity ? 'unlimited' : item.capacity ?? '', item.participant_count, item.verified_count,
      item.revenue, item.currency, item.pricing_mode, item.status, item.created_at,
    ]),
  )
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="registrations-overview.csv"',
    },
  })
}
