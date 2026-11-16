import { getAdminSession } from '@/lib/admin-auth'
import { FEEDBACK_BUCKET, downloadStorageFile } from '@/lib/storage'

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  webm: 'audio/webm',
  mp4: 'audio/mp4',
  ogg: 'audio/ogg',
}

export async function GET(request: Request) {
  if (!(await getAdminSession())) {
    return new Response('Unauthorized', { status: 401 })
  }

  const path = new URL(request.url).searchParams.get('path')
  if (!path || !/^[\w-]+\.[\w]{1,5}$/.test(path)) {
    return new Response('Invalid path', { status: 400 })
  }

  const bytes = await downloadStorageFile(FEEDBACK_BUCKET, path).catch(() => null)
  if (!bytes) return new Response('Not found', { status: 404 })

  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  const contentType = MIME_BY_EXTENSION[extension] ?? 'application/octet-stream'
  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${path}"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
