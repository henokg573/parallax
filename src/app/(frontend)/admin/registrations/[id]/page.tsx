import Link from 'next/link'
import QRCode from 'qrcode'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { requireAdmin } from '@/lib/admin-auth'
import { getExperienceFull, listParticipants, CATEGORY_LABELS } from '@/lib/registrations'
import AdminShell from '../../admin-shell'
import { Badge, card, primaryButton, ghostButton, dangerButton, inputClass, fieldLabel, money, formatDate } from '../shared'
import { setExperienceStatus, duplicateExperience, deleteExperience, verifyParticipant, bulkVerifyParticipants, updateParticipant, manualCheckIn } from '../actions'

export const dynamic = 'force-dynamic'

type Search = Promise<Record<string, string | undefined>>

export default async function RegistrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Search
}) {
  const { id } = await params
  const query = await searchParams
  const admin = await requireAdmin(`/admin/registrations/${id}`)
  const numericID = Number(id)
  if (!Number.isSafeInteger(numericID)) notFound()

  const experience = await getExperienceFull(numericID)
  if (!experience) notFound()

  const tab = ['overview', 'participants', 'payments', 'check-in', 'analytics'].includes(query.tab ?? '')
    ? query.tab!
    : 'overview'
  const search = query.q ?? ''
  const statusFilter = query.status ?? 'all'

  const participants = await listParticipants(numericID, { search, status: statusFilter })
  const verified = participants.filter((p) => p.payment_status === 'verified')
  const checkedIn = participants.filter((p) => p.checked_in_at)
  const pending = participants.filter((p) => p.payment_status === 'pending')
  const revenue = verified.reduce((sum, p) => sum + Number(p.amount ?? 0), 0)
  const ticketCounts = participants.reduce<Record<string, number>>((counts, p) => {
    counts[p.ticket_type] = (counts[p.ticket_type] ?? 0) + 1
    return counts
  }, {})

  const headersList = await headers().catch(() => null)
  const host = headersList?.get('x-forwarded-host') ?? headersList?.get('host') ?? 'localhost:3000'
  const proto = headersList?.get('x-forwarded-proto') ?? 'http'
  const publicURL = `${proto}://${host}/register/${experience.slug}`

  const ticketQRs = new Map<string, string>()
  if (tab === 'check-in' || tab === 'overview') {
    await Promise.all(verified.slice(0, 20).map(async (participant) => {
      try {
        ticketQRs.set(String(participant.id), await QRCode.toDataURL(`/check-in/${participant.check_in_token}`, { width: 140, margin: 1 }))
      } catch {
        // QR generation failure is non-fatal.
      }
    }))
  }

  let shareQR: string | null = null
  try {
    shareQR = await QRCode.toDataURL(publicURL, { width: 160, margin: 1 })
  } catch {
    shareQR = null
  }

  const activity = tab === 'overview' || tab === 'payments'
    ? await listActivity(numericID)
    : []

  return (
    <AdminShell admin={admin} active="/admin/registrations" title={experience.title_en || 'Registration'} subtitle={`${CATEGORY_LABELS[experience.kind] ?? experience.kind} · ${formatDate(experience.start_date)}`}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Link className="font-semibold text-emerald-800 hover:underline" href="/admin/registrations">← All registrations</Link>
        <Badge value={experience.status} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Link className={`${ghostButton} px-3 py-1.5 text-xs`} href={`/admin/registrations/${id}/edit`}>Edit</Link>
          <a className={`${ghostButton} px-3 py-1.5 text-xs`} href={`/register/${experience.slug}`} target="_blank" rel="noreferrer">Public page ↗</a>
          <form action={statusToggle(experience.id, experience.status)}>
            <button className={`${ghostButton} px-3 py-1.5 text-xs`} type="submit">{experience.status === 'published' ? 'Unpublish' : 'Publish'}</button>
          </form>
        </div>
      </div>

      {query.saved && <Banner tone="green">Changes saved.</Banner>}
      {query.bulk && <Banner tone="green">Bulk verification applied.</Banner>}
      {query.verified === 'verified' && <Banner tone="green">Payment verified and ticket emailed.</Banner>}
      {query.verified === 'rejected' && <Banner tone="amber">Payment rejected.</Banner>}
      {query.email === 'failed' && <Banner tone="amber">Verified, but the ticket email could not be sent. Configure Resend to enable automatic emails.</Banner>}
      {query.checkin === 'success' && <Banner tone="green">✓ Checked in: {query.who}</Banner>}
      {query.checkin === 'duplicate' && <Banner tone="amber">Already checked in: {query.who}. Duplicate check-ins are prevented.</Banner>}
      {query.checkin === 'unverified' && <Banner tone="amber">Payment is not verified for {query.who}. Only super admins can override.</Banner>}
      {query.checkin === 'notfound' && <Banner tone="amber">No participant matched that reference.</Banner>}

      {/* Tabs */}
      <nav className="flex flex-wrap gap-1 border-b border-zinc-200" aria-label="Registration sections">
        {(['overview', 'participants', 'payments', 'check-in', 'analytics'] as const).map((item) => (
          <Link
            className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${tab === item ? 'border-b-2 border-emerald-700 text-emerald-800' : 'text-zinc-500 hover:text-zinc-900'}`}
            href={`/admin/registrations/${id}?tab=${item}`}
            key={item}
          >
            {item === 'check-in' ? 'Check-in' : item[0].toUpperCase() + item.slice(1)}
            {item === 'participants' && <span className="ml-1.5 rounded-full bg-zinc-100 px-1.5 text-xs text-zinc-600">{participants.length}</span>}
            {item === 'payments' && pending.length > 0 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-xs text-amber-700">{pending.length}</span>}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <section className={`${card} p-6 lg:col-span-2`}>
            <h2 className="text-sm font-bold text-zinc-950">Registration summary</h2>
            <p className="mt-2 text-sm text-zinc-600">{experience.summary_en}</p>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Row label="Category" value={CATEGORY_LABELS[experience.kind] ?? experience.kind} />
              <Row label="Event date" value={formatDate(experience.start_date)} />
              <Row label="Ends" value={formatDate(experience.end_date)} />
              <Row label="Time zone" value={experience.timezone} />
              <Row label="Location type" value={experience.location_type} />
              <Row label="Location" value={experience.location_en || '—'} />
              <Row label="Registration opens" value={formatDate(experience.reg_opens_at)} />
              <Row label="Registration closes" value={formatDate(experience.reg_closes_at)} />
              <Row label="Capacity" value={experience.unlimited_capacity ? 'Unlimited' : String(experience.capacity ?? '—')} />
              <Row label="Waitlist" value={experience.waitlist_enabled ? 'Enabled' : 'Disabled'} />
              <Row label="Pricing" value={experience.pricing_mode === 'free' ? 'Free' : experience.pricing_mode === 'paid' ? `${experience.price ?? '—'} ${experience.currency}` : 'Multiple tickets'} />
              <Row label="Visibility" value={experience.visibility} />
            </dl>
            {shareQR && (
              <div className="mt-5 flex items-center gap-4 rounded-xl bg-emerald-50 p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Registration link QR code" className="h-24 w-24 rounded-lg border border-emerald-200 bg-white p-1.5" src={shareQR} />
                <div className="min-w-0 text-sm">
                  <p className="font-bold text-emerald-950">Public registration link</p>
                  <a className="break-all font-semibold text-emerald-800 underline" href={publicURL} target="_blank" rel="noreferrer">{publicURL}</a>
                </div>
              </div>
            )}
          </section>

          <section className={`${card} p-6`}>
            <h2 className="text-sm font-bold text-zinc-950">Statistics</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniStat label="Participants" value={String(participants.length)} />
              <MiniStat label="Verified" value={String(verified.length)} />
              <MiniStat label="Pending" value={String(pending.length)} />
              <MiniStat label="Checked in" value={String(checkedIn.length)} />
            </div>
            <div className="mt-4 rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Revenue</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900">{money(revenue, experience.currency)}</p>
              {experience.capacity !== null && !experience.unlimited_capacity && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs font-semibold text-emerald-800"><span>Capacity</span><span>{Math.min(100, Math.round((participants.length / experience.capacity) * 100))}%</span></div>
                  <div className="mt-1 h-2 rounded-full bg-emerald-200"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.min(100, (participants.length / experience.capacity) * 100)}%` }} /></div>
                </div>
              )}
            </div>
          </section>

          <section className={`${card} p-6 lg:col-span-3`}>
            <h2 className="text-sm font-bold text-zinc-950">Recent activity</h2>
            {activity.length ? (
              <ul className="mt-3 divide-y divide-zinc-100">
                {activity.map((entry) => (
                  <li className="flex items-center justify-between py-2.5 text-sm" key={String(entry.id)}>
                    <span className="text-zinc-700"><span className="font-semibold">{entry.admin_email || 'System'}</span> · {entry.action.replace(/-/g, ' ')} {entry.detail && <span className="text-zinc-500">— {entry.detail}</span>}</span>
                    <span className="text-xs text-zinc-400">{formatDate(String(entry.created_at))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">No activity recorded yet.</p>
            )}
          </section>
        </div>
      )}

      {tab === 'participants' && (
        <div className="mt-5 grid gap-4">
          <form className={`${card} flex flex-wrap items-end gap-3 p-4`} action={`/admin/registrations/${id}`}>
            <input type="hidden" name="tab" value="participants" />
            <label className="min-w-48 flex-1">
              <span className="text-xs font-semibold text-zinc-600">Search</span>
              <input className="mt-1 w-full rounded-xl border border-zinc-300 px-3.5 py-2 text-sm" defaultValue={search} name="q" placeholder="Name, email, or phone…" />
            </label>
            <label>
              <span className="text-xs font-semibold text-zinc-600">Payment status</span>
              <select className="mt-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm" defaultValue={statusFilter} name="status">
                {['all', 'pending', 'verified', 'rejected'].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <button className={ghostButton} type="submit">Apply</button>
            <a className={`${ghostButton} px-3 py-2 text-xs`} href={`/api/admin/registrations/export?id=${id}`}>Export participants</a>
          </form>

          <section className={`${card} overflow-hidden`}>
            {participants.length ? (
              <form action={bulkVerifyParticipants} className="overflow-x-auto">
                <input type="hidden" name="experience_id" value={id} />
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-bold uppercase tracking-wider text-zinc-500">
                      <th className="w-10 px-3 py-3" />
                      <th className="px-4 py-3">Ref</th>
                      <th className="px-4 py-3">Participant</th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Ticket</th>
                      <th className="px-4 py-3">Registered</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Payment</th>
                      <th className="px-4 py-3">Attendance</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {participants.map((participant) => (
                      <tr className="transition hover:bg-zinc-50" key={participant.id}>
                        <td className="px-3"><input className="h-4 w-4 accent-emerald-700" name="ids" type="checkbox" value={participant.id} /></td>
                        <td className="px-4 py-3 font-mono text-xs text-zinc-500">{participant.reference_code ?? `#${participant.id}`}</td>
                        <td className="px-4 py-3 font-semibold text-zinc-900">{participant.full_name}</td>
                        <td className="px-4 py-3 text-xs text-zinc-600">{participant.email}<br />{participant.phone}</td>
                        <td className="px-4 py-3 text-xs text-zinc-600">{participant.ticket_type}</td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{formatDate(participant.created_at)}</td>
                        <td className="px-4 py-3 tabular-nums text-zinc-700">{participant.amount === null ? '—' : money(participant.amount, participant.currency)}</td>
                        <td className="px-4 py-3"><Badge value={participant.payment_status} /></td>
                        <td className="px-4 py-3">{participant.checked_in_at ? <Badge value="checked" /> : <span className="text-xs text-zinc-400">Not yet</span>}</td>
                        <td className="px-4 py-3 text-right">
                          <details className="relative text-left">
                            <summary className="cursor-pointer rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-semibold text-zinc-600">Edit</summary>
                            <div className="absolute right-0 z-20 mt-1 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg">
                              <div className="grid gap-2">
                                <label className={fieldLabel}>Full name<input className={inputClass} defaultValue={participant.full_name} name="full_name" /></label>
                                <label className={fieldLabel}>Email<input className={inputClass} defaultValue={participant.email} name="email" type="email" /></label>
                                <label className={fieldLabel}>Phone<input className={inputClass} defaultValue={participant.phone} name="phone" /></label>
                                <label className={fieldLabel}>Ticket type<input className={inputClass} defaultValue={participant.ticket_type} name="ticket_type" /></label>
                                <label className={fieldLabel}>Amount<input className={inputClass} defaultValue={participant.amount ?? ''} name="amount" type="number" step="0.01" /></label>
                                <label className={fieldLabel}>Internal notes<textarea className={inputClass} defaultValue={participant.internal_notes ?? ''} name="internal_notes" rows={2} /></label>
                                <input type="hidden" name="id" value={participant.id} />
                                <button className={primaryButton} formAction={boundUpdateParticipant(id, participant.id)} type="submit">Save participant</button>
                              </div>
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 bg-zinc-50 px-5 py-3">
                  <span className="text-xs font-semibold text-zinc-600">With selected:</span>
                  <button className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50" name="decision" type="submit" value="verified">Verify</button>
                  <button className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50" name="decision" type="submit" value="rejected">Reject</button>
                </div>
              </form>
            ) : (
              <div className="p-12 text-center">
                <p className="text-2xl">👥</p>
                <p className="mt-2 font-semibold text-zinc-700">No participants yet</p>
                <p className="mt-1 text-sm text-zinc-500">Share the public registration link to start collecting sign-ups.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'payments' && (
        <div className="mt-5 grid gap-4">
          {pending.length === 0 && participants.length === 0 && (
            <div className={`${card} p-12 text-center`}>
              <p className="text-2xl">💳</p>
              <p className="mt-2 font-semibold text-zinc-700">No payments to verify yet</p>
            </div>
          )}
          {participants.filter((p) => p.payment_status === 'pending').map((participant) => (
            <section className={card} key={participant.id}>
              <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div>
                  <p className="font-bold text-zinc-950">{participant.full_name}</p>
                  <p className="text-sm text-zinc-600">{participant.email} · {participant.phone}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Submitted {formatDate(participant.created_at)} · Ticket: {participant.ticket_type} · Amount: {participant.amount === null ? '—' : money(participant.amount, participant.currency)}
                  </p>
                </div>
                <Badge value={participant.payment_status} />
              </div>
              {participant.receipt_id && (
                <div className="px-5">
                  <details className="group rounded-xl border border-zinc-200 bg-zinc-50">
                    <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-semibold text-emerald-800">
                      <span>Payment proof</span>
                      <span className="text-xs font-medium text-zinc-500 group-open:hidden">Show ▾</span>
                      <span className="hidden text-xs font-medium text-zinc-500 group-open:inline">Hide ▴</span>
                    </summary>
                    <div className="border-t border-zinc-200 p-4">
                      <ReceiptPreview receiptID={participant.receipt_id} />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <a className={`${ghostButton} text-xs`} href={`/api/admin/receipts/${participant.receipt_id}`} target="_blank" rel="noreferrer">
                          Open full size ↗
                        </a>
                        {participant.receipt_id && (
                          <a className={`${ghostButton} text-xs`} href={`/api/admin/receipts/${participant.receipt_id}?download=1`}>
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                  </details>
                </div>
              )}
              <form action={verifyParticipant} className="grid gap-3 border-t border-zinc-100 bg-zinc-50 p-5 sm:grid-cols-[1fr_auto]">
                <input type="hidden" name="id" value={participant.id} />
                <input type="hidden" name="experience_id" value={id} />
                <label className={fieldLabel}>Verification notes (audit trail)
                  <textarea className={inputClass} name="notes" rows={2} placeholder="Why this payment was approved or rejected…" />
                </label>
                <div className="flex items-end gap-2">
                  <button className={primaryButton} name="decision" type="submit" value="verified">✓ Approve</button>
                  <button className={dangerButton} name="decision" type="submit" value="rejected">✕ Reject</button>
                </div>
              </form>
            </section>
          ))}
          {participants.filter((p) => p.payment_status !== 'pending').length > 0 && (
            <section className={`${card} p-6`}>
              <h2 className="text-sm font-bold text-zinc-950">Decision history</h2>
              <ul className="mt-3 divide-y divide-zinc-100">
                {participants.filter((p) => p.payment_status !== 'pending').map((participant) => (
                  <li className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm" key={participant.id}>
                    <span className="font-semibold text-zinc-800">{participant.full_name}</span>
                    <span className="text-xs text-zinc-500">{participant.verified_by ?? '—'} · {formatDate(participant.verified_at)}</span>
                    <Badge value={participant.payment_status} />
                    {participant.verification_notes && <span className="basis-full text-xs text-zinc-500">📝 {participant.verification_notes}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {tab === 'check-in' && (
        <div className="mt-5 grid gap-4">
          <form action={manualCheckIn} className={`${card} grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-end`}>
            <input type="hidden" name="experience_id" value={id} />
            <label className={fieldLabel}>Manual check-in
              <input className={inputClass} name="reference" placeholder="Reference code, name, email, or phone" required />
            </label>
            <div className="flex items-end gap-2">
              {admin.role === 'super-admin' && (
                <label className="flex items-center gap-1.5 pb-2.5 text-xs font-semibold text-zinc-600">
                  <input className="h-4 w-4 accent-emerald-700" name="override" type="checkbox" value="on" /> Override verification rule
                </label>
              )}
              <button className={primaryButton} type="submit">Check in</button>
            </div>
          </form>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniStat label="Eligible (verified)" value={String(verified.length)} />
            <MiniStat label="Checked in" value={String(checkedIn.length)} />
            <MiniStat label="Attendance rate" value={`${verified.length ? Math.round((checkedIn.length / verified.length) * 100) : 0}%`} />
          </div>
          <section className={`${card} p-6`}>
            <h2 className="text-sm font-bold text-zinc-950">Verified ticket QR codes</h2>
            {verified.length ? (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {verified.map((participant) => (
                  <div className="rounded-xl border border-zinc-200 p-3 text-center" key={participant.id}>
                    {ticketQRs.get(String(participant.id)) ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img alt={`Ticket QR for ${participant.full_name}`} className="mx-auto h-28 w-28" src={ticketQRs.get(String(participant.id))!} />
                    ) : (
                      <div className="flex h-28 items-center justify-center text-xs text-zinc-400">QR unavailable</div>
                    )}
                    <p className="mt-1.5 truncate text-xs font-semibold text-zinc-800">{participant.full_name}</p>
                    <p className="text-[11px] text-zinc-500">{participant.checked_in_at ? `In at ${formatDate(participant.checked_in_at).split(',')[1] ?? ''}` : 'Not checked in'}</p>
                    <a className="mt-1 inline-block text-[11px] font-semibold text-emerald-800 underline" href={`/check-in/${participant.check_in_token}`}>Manual check-in ↗</a>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">QR codes appear here once payments are verified.</p>
            )}
            <a className={`${ghostButton} mt-4 inline-block text-xs`} href="/admin/scan">Open camera scanner →</a>
          </section>
        </div>
      )}

      {tab === 'analytics' && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MiniStat label="Total participants" value={String(participants.length)} wide />
          <MiniStat label="Payment completion" value={`${participants.length ? Math.round((verified.length / participants.length) * 100) : 0}%`} />
          <MiniStat label="Attendance rate" value={`${verified.length ? Math.round((checkedIn.length / verified.length) * 100) : 0}%`} />
          <MiniStat label="Revenue" value={money(revenue, experience.currency)} />
          <MiniStat label="Rejections" value={String(participants.filter((p) => p.payment_status === 'rejected').length)} />
          <MiniStat label="Avg. per day" value={(participants.length / Math.max(1, daysSince(experience.created_at))).toFixed(1)} />
          <section className={`${card} p-6 sm:col-span-2 lg:col-span-3`}>
            <h2 className="text-sm font-bold text-zinc-950">Participants by ticket type</h2>
            <div className="mt-4 grid gap-3">
              {Object.entries(ticketCounts).map(([ticket, count]) => (
                <div key={ticket}>
                  <div className="flex justify-between text-xs font-semibold text-zinc-700"><span>{ticket}</span><span>{count}</span></div>
                  <div className="mt-1 h-2.5 rounded-full bg-zinc-100"><div className="h-full rounded-full bg-emerald-600" style={{ width: `${(count / participants.length) * 100}%` }} /></div>
                </div>
              ))}
              {Object.keys(ticketCounts).length === 0 && <p className="text-sm text-zinc-500">No participants yet.</p>}
            </div>
            <a className={`${ghostButton} mt-5 inline-block text-xs`} href={`/api/admin/registrations/export?id=${id}`}>Export report (CSV)</a>
          </section>
        </div>
      )}

      {admin.role === 'super-admin' && (
        <section className={`${card} mt-6 border-red-200 p-6`}>
          <h2 className="text-sm font-bold text-red-800">Danger zone</h2>
          <p className="mt-1 text-xs text-zinc-600">Deleting archives this registration and detaches it from the public site. Existing participant records are preserved.</p>
          <form action={deleteExperience} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={id} />
            <label className={fieldLabel}>Type “{experience.slug}” to confirm
              <input className={inputClass} name="confirm" required />
            </label>
            <button className={dangerButton} type="submit">Archive registration permanently</button>
          </form>
        </section>
      )}
    </AdminShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="mt-0.5 font-medium capitalize text-zinc-800">{value}</dd>
    </div>
  )
}

async function ReceiptPreview({ receiptID }: { receiptID: number }) {
  let mimeType = ''
  try {
    const { rows } = await import('@/lib/db')
    const receipts = await rows<{ mime_type: string }>('payment_receipts', {
      select: 'mime_type', eq: { id: receiptID }, limit: 1,
    })
    mimeType = receipts[0]?.mime_type ?? ''
  } catch {
    mimeType = ''
  }

  if (!mimeType) {
    return <p className="text-sm text-zinc-500">Receipt file is not available.</p>
  }
  const src = `/api/admin/receipts/${receiptID}`
  if (mimeType === 'application/pdf') {
    return <iframe className="h-96 w-full rounded-lg border border-zinc-200 bg-white" src={src} title="Payment receipt (PDF)" />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="Payment receipt upload" className="max-h-96 w-full rounded-lg border border-zinc-200 object-contain" src={src} />
}
function MiniStat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm ${wide ? 'sm:col-span-1' : ''}`}>
      <p className="text-2xl font-bold tabular-nums text-zinc-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-zinc-500">{label}</p>
    </div>
  )
}
function Banner({ tone, children }: { tone: 'green' | 'amber'; children: React.ReactNode }) {
  const styles = tone === 'green' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'
  return <p className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${styles}`}>{children}</p>
}
function daysSince(value: string) {
  const diff = Date.now() - new Date(value).getTime()
  return Math.max(1, Math.floor(diff / (24 * 60 * 60 * 1000)))
}

async function listActivity(experienceID: number) {
  try {
    const { rows } = await import('@/lib/db')
    return await rows<{ id: number; admin_email: string | null; action: string; detail: string; created_at: string }>('registration_activity', {
      select: 'id, admin_email, action, detail, created_at',
      eq: { experience_id: experienceID },
      order: { column: 'created_at', ascending: false },
      limit: 15,
    })
  } catch {
    return []
  }
}

import { updateParticipant as updateParticipantAction } from '../actions'
function boundUpdateParticipant(experienceID: string, participantID: number) {
  return async function bound(formData: FormData) {
    'use server'
    formData.set('experience_id', experienceID)
    formData.set('id', String(participantID))
    await updateParticipantAction(formData)
  }
}
function statusToggle(id: number, current: string) {
  return async function bound(formData: FormData) {
    'use server'
    const { setExperienceStatus: setStatus } = await import('../actions')
    formData.set('id', String(id))
    formData.set('status', current === 'published' ? 'unpublished' : 'published')
    formData.set('return_to', `/admin/registrations/${id}`)
    await setStatus(formData)
  }
}
// suppress unused import warnings for actions referenced via bound wrappers
void duplicateExperience
