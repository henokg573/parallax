import { rows } from '@/lib/db'
import { FEEDBACK_BUCKET, downloadStorageFile } from '@/lib/storage'

const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
}

const AUDIO_MIME: Record<string, string> = {
  webm: 'audio/webm',
  mp4: 'audio/mp4',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  wav: 'audio/wav',
}

// Serves photos AND voice messages from approved feedback to the public site.
// The path must match the photo_path or voice_path of an approved feedback row,
// so private uploads stay private.
export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get('path')
  if (!path || !/^[\w-]+\.[\w]{1,5}$/.test(path)) {
    return new Response('Invalid path', { status: 400 })
  }

  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  const isAudio = Boolean(AUDIO_MIME[extension])

  const matches = await rows<{ id: number }>('feedback', {
    select: 'id',
    eq: isAudio ? { voice_path: path, approved: true } : { photo_path: path, approved: true },
    limit: 1,
  }).catch(() => [] as { id: number }[])
  if (!matches.length) return new Response('Not found', { status: 404 })

  const bytes = await downloadStorageFile(FEEDBACK_BUCKET, path).catch(() => null)
  if (!bytes) return new Response('Not found', { status: 404 })

  const contentType = isAudio ? AUDIO_MIME[extension] : IMAGE_MIME[extension] ?? 'image/jpeg'
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${path}"`,
      // Audio shouldn't be cached long: an admin may unpublish feedback.
      'Cache-Control': isAudio ? 'public, max-age=300' : 'public, max-age=3600',
      ...(isAudio ? { 'Accept-Ranges': 'none' } : {}),
    },
  })
}
