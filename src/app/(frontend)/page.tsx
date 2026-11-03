import { ParallaxHome } from '@/app/(frontend)/components/ParallaxHome'
import { AnnouncementPopup, type SiteAnnouncement } from '@/app/(frontend)/components/AnnouncementPopup'
import { getPublicHomeContent } from '@/lib/public-content'
import { rows } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'

export const dynamic = 'force-dynamic'

async function getActiveAnnouncement(): Promise<SiteAnnouncement | null> {
  const result = await rows<RowDataPacket & {
    id: number; title: string; message: string; link_url: string | null;
    link_label: string | null; dismissible: number
  }>(
    "SELECT id, title, message, link_url, link_label, dismissible FROM announcements WHERE status = 'published' ORDER BY created_at DESC LIMIT 1",
  )
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
