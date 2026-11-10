import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import AdminShell from '../../admin-shell'
import BuilderClient from './BuilderClient'

export const dynamic = 'force-dynamic'

export default async function NewRegistrationPage() {
  const admin = await requireAdmin('/admin/registrations/new')
  if (admin.role === 'check-in') redirect('/admin/registrations')

  return (
    <AdminShell admin={admin} active="/admin/registrations" title="Create registration" subtitle="Build a new registration opportunity step by step.">
      <BuilderClient experience={null} />
    </AdminShell>
  )
}
