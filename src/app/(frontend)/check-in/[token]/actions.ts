'use server'

import { redirect } from 'next/navigation'
import { rows, update } from '@/lib/db'
import { getAdminSession } from '@/lib/admin-auth'

export async function confirmCheckIn(token: string) {
  if (!(await getAdminSession())) {
    redirect(`/admin/login?next=${encodeURIComponent(`/check-in/${token}`)}`)
  }

  const tickets = await rows<{ id: number; payment_status: string; checked_in_at: string | null }>('registrations', {
    select: 'id, payment_status, checked_in_at',
    eq: { check_in_token: token },
    limit: 1,
  })
  const ticket = tickets[0]
  const validTicket = ticket?.payment_status === 'verified'
  if (validTicket && !ticket.checked_in_at) {
    await update('registrations', { checked_in_at: new Date().toISOString() }, { id: ticket.id })
  }

  if (!validTicket) redirect(`/check-in/${token}?error=invalid`)
  redirect(`/check-in/${token}?checked=1`)
}
