import { notFound, redirect } from 'next/navigation'
import type { RowDataPacket } from 'mysql2/promise'
import { getAdminSession } from '@/lib/admin-auth'
import { rows } from '@/lib/db'
import { confirmCheckIn } from './actions'
import { registrationTitleText } from '@/lib/registration-title'

type CheckInRow = RowDataPacket & {
  id: number
  full_name: string
  experience_title: string
  payment_status: 'pending' | 'verified' | 'rejected'
  ticket_email_sent_at: string | null
  checked_in_at: string | null
}

export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ checked?: string; error?: string }>
}) {
  const { token } = await params
  const query = await searchParams
  if (!(await getAdminSession())) {
    redirect(`/admin/login?next=${encodeURIComponent(`/check-in/${token}`)}`)
  }

  const found = await rows<CheckInRow & { experience_id: number }>('registrations', {
    select: 'id, full_name, payment_status, ticket_email_sent_at, checked_in_at, experience_id',
    eq: { check_in_token: token },
    limit: 1,
  })
  const registration = found[0]
  if (!registration) notFound()
  const experiences = await rows<{ title_en: string }>('experiences', {
    select: 'title_en',
    eq: { id: registration.experience_id },
    limit: 1,
  })
  registration.experience_title = registrationTitleText(experiences[0]?.title_en || '') || 'Parallax experience'

  const verified = registration.payment_status === 'verified'
  const checkedIn = Boolean(registration.checked_in_at || query.checked === '1')

  return (
    <main className="check-in-page">
      <section className="check-in-card">
        <p className="check-in-kicker">PARALLAX · ARRIVAL DESK</p>
        <h1>{checkedIn ? 'Check-in complete' : 'Confirm arrival'}</h1>
        <dl>
          <div>
            <dt>Guest</dt>
            <dd>{registration.full_name}</dd>
          </div>
          <div>
            <dt>Experience</dt>
            <dd>{registration.experience_title}</dd>
          </div>
          <div>
            <dt>Payment</dt>
            <dd className={verified ? 'verified' : 'unverified'}>
              {verified ? 'Verified' : 'Not verified'}
            </dd>
          </div>
          <div>
            <dt>Ticket email</dt>
            <dd>{registration.ticket_email_sent_at ? 'Sent' : 'Not sent'}</dd>
          </div>
        </dl>
        {checkedIn ? (
          <div className="check-in-success">This guest has been checked in.</div>
        ) : verified ? (
          <form action={confirmCheckIn.bind(null, token)}>
            <button type="submit">Confirm check-in</button>
          </form>
        ) : (
          <div className="check-in-warning">Do not admit this guest until payment is verified.</div>
        )}
        {query.error && <p className="check-in-error">This ticket cannot be checked in.</p>}
        <a href="/admin/registrations">Open registrations</a>
      </section>
    </main>
  )
}
