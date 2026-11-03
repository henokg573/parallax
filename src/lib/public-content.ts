import type { RowDataPacket } from 'mysql2/promise'
import { rows } from '@/lib/db'

export type PublicMedia = {
  url: string
  alt: string
  width: number
  height: number
}

export type PublicVideo = {
  url: string
  alt: string
  mimeType: string
}

export type PublicExperience = {
  id: string | number
  title: string
  kind: string
  summary: string
  location: string
  startDate: string
  endDate?: string | null
  capacity?: number | null
  price?: number | null
  currency?: string | null
  registrationURL?: string | null
  image: PublicMedia | null
  video: PublicVideo | null
}

export type PublicStory = {
  id: string | number
  title: string
  excerpt: string
  body: string
  authorName?: string | null
  image: PublicMedia | null
  video: PublicVideo | null
}

export type PublicSocialPost = {
  id: string | number
  platform: string
  caption: string
  postURL: string
  postedAt: string
  thumbnail: PublicMedia | null
  video: PublicVideo | null
}

export type PublicHomeContent = {
  experiences: PublicExperience[]
  stories: PublicStory[]
  socialPosts: PublicSocialPost[]
}

type ExperienceRow = RowDataPacket & {
  id: number
  title: string
  kind: string
  summary: string
  location: string
  start_date: string
  end_date: string | null
  capacity: number | null
  price: string | number | null
  currency: string | null
  registration_url: string | null
  image_url: string | null
  image_alt: string | null
  image_width: number | null
  image_height: number | null
  image_mime_type: string | null
  video_filename: string | null
  video_alt: string | null
  video_mime_type: string | null
}

type StoryRow = RowDataPacket & {
  id: number
  title: string
  excerpt: string
  body: string
  author_name: string | null
  image_url: string | null
  image_alt: string | null
  image_width: number | null
  image_height: number | null
  image_mime_type: string | null
  video_filename: string | null
  video_alt: string | null
  video_mime_type: string | null
}

type SocialPostRow = RowDataPacket & {
  id: number
  platform: string
  caption: string
  post_url: string
  posted_at: string
  image_url: string | null
  image_alt: string | null
  image_width: number | null
  image_height: number | null
  image_mime_type: string | null
  video_filename: string | null
  video_alt: string | null
  video_mime_type: string | null
}

function mediaValue(row: {
  image_url: string | null
  image_alt: string | null
  image_width: number | null
  image_height: number | null
}): PublicMedia | null {
  if (!row.image_url) return null
  return {
    url: row.image_url,
    alt: row.image_alt || '',
    width: row.image_width || 1600,
    height: row.image_height || 1000,
  }
}

function videoValue(filename: string | null, alt: string | null, mimeType: string | null): PublicVideo | null {
  if (!filename || !mimeType) return null
  return {
    url: `/uploads/media/${encodeURIComponent(filename)}`,
    alt: alt || '',
    mimeType,
  }
}

export async function getPublicHomeContent(locale: 'en' | 'am'): Promise<PublicHomeContent> {
  const suffix = locale === 'am' ? 'am' : 'en'
  const [experiences, stories, socialPosts] = await Promise.all([
    rows<ExperienceRow>(
      `SELECT e.id, COALESCE(NULLIF(e.title_${suffix}, ''), e.title_en) AS title,
        e.kind, COALESCE(NULLIF(e.summary_${suffix}, ''), e.summary_en) AS summary,
        COALESCE(NULLIF(e.location_${suffix}, ''), e.location_en) AS location,
        e.start_date, e.end_date, e.capacity, e.price, e.currency,
        e.registration_url, m.filename AS media_filename, m.alt AS image_alt,
        m.width AS image_width, m.height AS image_height, m.mime_type AS image_mime_type,
        vm.filename AS video_filename, vm.alt AS video_alt, vm.mime_type AS video_mime_type
      FROM experiences e
      LEFT JOIN media m ON m.id = e.image_id
      LEFT JOIN media vm ON vm.id = e.video_id
      WHERE e.status = 'published'
      ORDER BY e.start_date ASC LIMIT 6`,
    ),
    rows<StoryRow>(
      `SELECT s.id, COALESCE(NULLIF(s.title_${suffix}, ''), s.title_en) AS title,
        COALESCE(NULLIF(s.excerpt_${suffix}, ''), s.excerpt_en) AS excerpt,
        COALESCE(NULLIF(s.body_${suffix}, ''), s.body_en) AS body,
        COALESCE(NULLIF(s.author_name_${suffix}, ''), s.author_name_en) AS author_name,
        m.filename AS media_filename, m.alt AS image_alt,
        m.width AS image_width, m.height AS image_height, m.mime_type AS image_mime_type,
        vm.filename AS video_filename, vm.alt AS video_alt, vm.mime_type AS video_mime_type
      FROM stories s
      LEFT JOIN media m ON m.id = s.image_id
      LEFT JOIN media vm ON vm.id = s.video_id
      WHERE s.status = 'published'
      ORDER BY s.published_at DESC LIMIT 3`,
    ),
    rows<SocialPostRow>(
      `SELECT p.id, p.platform,
        COALESCE(NULLIF(p.caption_${suffix}, ''), p.caption_en) AS caption,
        p.post_url, p.posted_at, m.filename AS media_filename, m.alt AS image_alt,
        m.width AS image_width, m.height AS image_height, m.mime_type AS image_mime_type,
        vm.filename AS video_filename, vm.alt AS video_alt, vm.mime_type AS video_mime_type
      FROM social_posts p
      LEFT JOIN media m ON m.id = p.thumbnail_id
      LEFT JOIN media vm ON vm.id = p.video_id
      WHERE p.status = 'published' AND p.visible = 1
      ORDER BY p.posted_at DESC LIMIT 5`,
    ),
  ])

  const imageURL = (filename: string | null) =>
    filename ? `/uploads/media/${encodeURIComponent(filename)}` : null

  return {
    experiences: experiences.map((item) => ({
      id: item.id,
      title: item.title,
      kind: item.kind,
      summary: item.summary,
      location: item.location,
      startDate: item.start_date,
      endDate: item.end_date,
      capacity: item.capacity,
      price: item.price === null ? null : Number(item.price),
      currency: item.currency,
      registrationURL: item.registration_url,
      image: mediaValue({ ...item, image_url: imageURL(item.media_filename) }),
      video: videoValue(item.video_filename, item.video_alt, item.video_mime_type),
    })),
    stories: stories.map((item) => ({
      id: item.id,
      title: item.title,
      excerpt: item.excerpt,
      body: item.body,
      authorName: item.author_name,
      image: mediaValue({ ...item, image_url: imageURL(item.media_filename) }),
      video: videoValue(item.video_filename, item.video_alt, item.video_mime_type),
    })),
    socialPosts: socialPosts.map((item) => ({
      id: item.id,
      platform: item.platform,
      caption: item.caption,
      postURL: item.post_url,
      postedAt: item.posted_at,
      thumbnail: mediaValue({ ...item, image_url: imageURL(item.media_filename) }),
      video: videoValue(item.video_filename, item.video_alt, item.video_mime_type),
    })),
  }
}
