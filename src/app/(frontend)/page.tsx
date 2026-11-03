import { ParallaxHome } from '@/app/(frontend)/components/ParallaxHome'
import { AnnouncementPopup, type SiteAnnouncement } from '@/app/(frontend)/components/AnnouncementPopup'
import { getPublicHomeContent } from '@/lib/public-content'
import { rows } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getActiveAnnouncement(): Promise<SiteAnnouncement | null> {
  const result = await rows<{
    id: number; title: string; message: string; link_url: string | null;
    link_label: string | null; dismissible: number
  }> ('announcements', {
    select: 'id, title, message, link_url, link_label, dismissible',
    eq: { status: 'published' },
    order: { column: 'created_at', ascending: false },
    limit: 1,
  })
  const record = result[0]
  if (!record) return null
  return {
    id: record.id,
    title: record.title,
    message: record.message,
    linkURL: record.link_url,
    linkLabel: record.link_label,
    dismissible: Boolean(record.dismissible),
  }
}

export default async function HomePage() {
  const [english, amharic, announcement] = await Promise.all([
    getPublicHomeContent('en'),
    getPublicHomeContent('am'),
    getActiveAnnouncement(),
  ])
  return (
    <>
      <AnnouncementPopup announcement={announcement} />
      <ParallaxHome content={{ en: english, am: amharic }} />
    </>
  )
}
