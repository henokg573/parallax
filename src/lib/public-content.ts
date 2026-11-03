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

type ExperienceRow = {
  id: number
  title_en: string
  title_am: string
  kind: string
  summary_en: string
  summary_am: string
  location_en: string
  location_am: string
  start_date: string
  end_date: string | null
  capacity: number | null
  price: string | number | null
  currency: string | null
  registration_url: string | null
  image_id: number | null
  video_id: number | null
}

type StoryRow = {
  id: number
  title_en: string
  title_am: string
  excerpt_en: string
  excerpt_am: string
  body_en: string
  body_am: string
  author_name_en: string | null
  author_name_am: string | null
  image_id: number | null
  video_id: number | null
}

type SocialPostRow = {
  id: number
  platform: string
  caption_en: string
  caption_am: string
  post_url: string
  posted_at: string
  thumbnail_id: number | null
  video_id: number | null
}

type MediaRow = {
  id: number
  filename: string
  alt: string
  width: number | null
  height: number | null
  mime_type: string
}

function mediaValue(media: MediaRow | undefined): PublicMedia | null {
  if (!media) return null
  return {
    url: `/uploads/media/${encodeURIComponent(media.filename)}`,
    alt: media.alt || '',
    width: media.width || 1600,
    height: media.height || 1000,
  }
}

function videoValue(media: MediaRow | undefined): PublicVideo | null {
  if (!media) return null
  return {
    url: `/uploads/media/${encodeURIComponent(media.filename)}`,
    alt: media.alt || '',
    mimeType: media.mime_type,
  }
}

export async function getPublicHomeContent(locale: 'en' | 'am'): Promise<PublicHomeContent> {
  const [experiences, stories, socialPosts] = await Promise.all([
    rows<ExperienceRow>('experiences', {
      select: 'id, title_en, title_am, kind, summary_en, summary_am, location_en, location_am, start_date, end_date, capacity, price, currency, registration_url, image_id, video_id',
      eq: { status: 'published' }, order: { column: 'start_date' }, limit: 6,
    }),
    rows<StoryRow>('stories', {
      select: 'id, title_en, title_am, excerpt_en, excerpt_am, body_en, body_am, author_name_en, author_name_am, image_id, video_id',
      eq: { status: 'published' }, order: { column: 'published_at', ascending: false }, limit: 3,
    }),
    rows<SocialPostRow>('social_posts', {
      select: 'id, platform, caption_en, caption_am, post_url, posted_at, thumbnail_id, video_id',
      eq: { status: 'published', visible: true }, order: { column: 'posted_at', ascending: false }, limit: 5,
    }),
  ])

  const mediaIDs = [...experiences.flatMap((item) => [item.image_id, item.video_id]), ...stories.flatMap((item) => [item.image_id, item.video_id]), ...socialPosts.flatMap((item) => [item.thumbnail_id, item.video_id])]
    .filter((id): id is number => id !== null)
  const media = mediaIDs.length
    ? await rows<MediaRow>('media', { select: 'id, filename, alt, width, height, mime_type', in: { id: mediaIDs } })
    : []
  const mediaByID = new Map(media.map((item) => [item.id, item]))
  const title = (en: string, am: string) => (locale === 'am' && am ? am : en)

  return {
    experiences: experiences.map((item) => ({
      id: item.id,
      title: title(item.title_en, item.title_am),
      kind: item.kind,
      summary: title(item.summary_en, item.summary_am),
      location: title(item.location_en, item.location_am),
      startDate: item.start_date,
      endDate: item.end_date,
      capacity: item.capacity,
      price: item.price === null ? null : Number(item.price),
      currency: item.currency,
      registrationURL: item.registration_url,
      image: mediaValue(mediaByID.get(item.image_id ?? -1)),
      video: videoValue(mediaByID.get(item.video_id ?? -1)),
    })),
    stories: stories.map((item) => ({
      id: item.id,
      title: title(item.title_en, item.title_am),
      excerpt: title(item.excerpt_en, item.excerpt_am),
      body: title(item.body_en, item.body_am),
      authorName: title(item.author_name_en || '', item.author_name_am || ''),
      image: mediaValue(mediaByID.get(item.image_id ?? -1)),
      video: videoValue(mediaByID.get(item.video_id ?? -1)),
    })),
    socialPosts: socialPosts.map((item) => ({
      id: item.id,
      platform: item.platform,
      caption: title(item.caption_en, item.caption_am),
      postURL: item.post_url,
      postedAt: item.posted_at,
      thumbnail: mediaValue(mediaByID.get(item.thumbnail_id ?? -1)),
      video: videoValue(mediaByID.get(item.video_id ?? -1)),
    })),
  }
}
