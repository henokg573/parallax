import { notFound, redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { getExperienceFull } from '@/lib/registrations'
import { registrationTitleText } from '@/lib/registration-title'
import AdminShell from '../../../admin-shell'
import BuilderClient from '../../new/BuilderClient'

export const dynamic = 'force-dynamic'

export default async function EditRegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await requireAdmin(`/admin/registrations/${id}/edit`)
  if (admin.role === 'check-in') redirect('/admin/registrations')

  const numericID = Number(id)
  if (!Number.isSafeInteger(numericID)) notFound()
  const experience = await getExperienceFull(numericID)
  if (!experience) notFound()

  return (
    <AdminShell admin={admin} active="/admin/registrations" title={`Edit: ${registrationTitleText(experience.title_en)}`} subtitle="Update this registration opportunity.">
      <BuilderClient experience={experience as unknown as Record<string, unknown>} />
    </AdminShell>
  )
}
