'use server'

import { redirect } from 'next/navigation'
import type { RowDataPacket } from 'mysql2/promise'
import { database } from '@/lib/db'
import { getAdminSession } from '@/lib/admin-auth'

export async function confirmCheckIn(token: string) {
  if (!(await getAdminSession())) {
    redirect(`/admin/login?next=${encodeURIComponent(`/check-in/${token}`)}`)
  }

  const connection = await database.getConnection()
  let validTicket = false
  try {
    await connection.beginTransaction()
    const [tickets] = await connection.execute<Array<RowDataPacket & { id: number; payment_status: string; checked_in_at: string | null }>>(
      'SELECT id, payment_status, checked_in_at FROM registrations WHERE check_in_token = ? LIMIT 1 FOR UPDATE',
      [token],
    )
    const ticket = tickets[0]
    validTicket = ticket?.payment_status === 'verified'
    if (validTicket && !ticket.checked_in_at) {
      await connection.execute('UPDATE registrations SET checked_in_at = NOW() WHERE id = ?', [ticket.id])
    }
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  if (!validTicket) redirect(`/check-in/${token}?error=invalid`)
  redirect(`/check-in/${token}?checked=1`)
}
