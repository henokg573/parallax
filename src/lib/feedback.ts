import { rows } from '@/lib/db'

export type ResolvedFeedbackToken = {
  experienceID: number
  title: string
} | null

/**
 * The QR code points at /feedback/<token>. The token is the experience ID for
 * a specific event, or "general" for overall program feedback.
 */
export async function resolveFeedbackToken(token: string): Promise<ResolvedFeedbackToken> {
  const cleaned = token.trim()
  if (!cleaned || cleaned === 'general') return null
  if (!/^\d{1,9}$/.test(cleaned)) return null

  const found = await rows<{ id: number; title_en: string; title_am: string }>('experiences', {
    select: 'id, title_en, title_am',
    eq: { id: Number(cleaned) },
    limit: 1,
  }).catch(() => [])
  const experience = found[0]
  if (!experience) return null
  return { experienceID: experience.id, title: experience.title_en || experience.title_am || 'Parallax experience' }
}
