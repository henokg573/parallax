import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { rows } from '@/lib/db'
import AdminShell from '../admin-shell'
import { saveSocialLinks } from '../actions'

const platforms = ['telegram', 'whatsapp', 'linkedin', 'tiktok', 'instagram', 'youtube', 'x', 'snapchat'] as const

type SocialLink = {
  platform: string
  url: string
  visible: boolean
}

const labels: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  x: 'X',
  snapchat: 'Snapchat',
}

export const dynamic = 'force-dynamic'

export default async function SocialLinksPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>
}) {
  const admin = await requireAdmin('/admin/social-links')
  if (admin.role !== 'super-admin') redirect('/admin')

  const records = await rows<SocialLink>('social_links', {
    select: 'platform, url, visible',
    order: { column: 'platform' },
  }).catch(() => [])
  const links = new Map(records.map((record) => [record.platform, record]))
  const query = await searchParams

  return (
    <AdminShell
      admin={admin}
      active="/admin/social-links"
      title="Social accounts"
      subtitle="Manage the account links shown in the public footer"
    >
      {query.saved && (
        <p className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          Social account links saved.
        </p>
      )}
      <form action={saveSocialLinks} className="grid gap-4">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-5">
            {platforms.map((platform) => {
              const record = links.get(platform)
              return (
                <label className="grid gap-2 sm:grid-cols-[150px_1fr_auto] sm:items-center" key={platform}>
                  <span className="text-sm font-semibold text-zinc-900">{labels[platform]}</span>
                  <input
                    className="rounded-xl border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                    defaultValue={record?.url || ''}
                    name={`url_${platform}`}
                    placeholder={`https://${platform}.com/your-account`}
                    type="url"
                  />
                  <span className="flex items-center gap-2 text-xs font-medium text-zinc-600">
                    <input defaultChecked={record?.visible ?? true} name={`visible_${platform}`} type="checkbox" />
                    Show
                  </span>
                </label>
              )
            })}
          </div>
        </section>
        <button className="w-fit rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800" type="submit">
          Save social links
        </button>
      </form>
    </AdminShell>
  )
}
