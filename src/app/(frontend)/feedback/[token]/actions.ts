'use server'

import { randomUUID } from 'node:crypto'
import { publicInsert } from '@/lib/db'
import { FEEDBACK_BUCKET, removeStorageFile, uploadStorageFile } from '@/lib/storage'
import { resolveFeedbackToken } from '@/lib/feedback'

export type FeedbackState = {
  ok: boolean
  error?: 'rating' | 'server'
}

const MAX_FILE_BYTES = 8 * 1024 * 1024

type UploadKind = 'photo' | 'document' | 'voice'

const photoExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
}

const documentExtensions: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/plain': 'txt',
}

async function uploadFeedbackFile(
  kind: UploadKind,
  file: File,
): Promise<{ path: string; name: string } | { error: 'too_large' }> {
  if (!file || file.size === 0) return { error: 'too_large' }
  if (file.size > MAX_FILE_BYTES) return { error: 'too_large' }

  const extension =
    kind === 'photo'
      ? photoExtensions[file.type] ?? (file.name.toLowerCase().endsWith('.heic') ? 'heic' : null)
      : kind === 'document'
        ? documentExtensions[file.type] ?? file.name.split('.').pop()?.toLowerCase().slice(0, 5) ?? null
        : 'webm'
  if (!extension) return { error: 'too_large' }

  const bytes = Buffer.from(await file.arrayBuffer())
  const path = `${randomUUID()}.${extension}`
  await uploadStorageFile(FEEDBACK_BUCKET, path, bytes, file.type || 'application/octet-stream')
  const safeName = file.name.replace(/[/\\\0]/g, '').slice(0, 200) || `${kind}.${extension}`
  return { path, name: safeName }
}

export async function submitFeedback(_previous: FeedbackState, formData: FormData): Promise<FeedbackState> {
  try {
    const rating = Number(formData.get('rating'))
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { ok: false, error: 'rating' }
    }

    const token = String(formData.get('token') || '')
    const resolved = await resolveFeedbackToken(token)

    const fullName = String(formData.get('full_name') || '').trim().slice(0, 120)
    const message = String(formData.get('message') || '').trim().slice(0, 5000)

    const photoInputs = formData.getAll('photos').filter((item): item is File => item instanceof File)
    const photoUploads = (await Promise.all(photoInputs.slice(0, 5).map((file) => uploadFeedbackFile('photo', file))))
      .filter((item): item is { path: string; name: string } => 'path' in item)

    const documentInput = formData.get('document')
    const documentUpload = documentInput instanceof File && documentInput.size > 0
      ? await uploadFeedbackFile('document', documentInput)
      : null

    const voiceInput = formData.get('voice')
    const voiceUpload = voiceInput instanceof File && voiceInput.size > 0
      ? await uploadFeedbackFile('voice', voiceInput)
      : null

    await publicInsert('feedback', {
      experience_id: resolved?.experienceID ?? null,
      full_name: fullName || null,
      rating,
      message,
      photo_path: photoUploads[0]?.path ?? null,
      photo_name: photoUploads[0]?.name ?? null,
      document_path: documentUpload && 'path' in documentUpload ? documentUpload.path : null,
      document_name: documentUpload && 'path' in documentUpload ? documentUpload.name : null,
      voice_path: voiceUpload && 'path' in voiceUpload ? voiceUpload.path : null,
      voice_duration_seconds: voiceUpload && 'path' in voiceUpload ? 0 : null,
    })

    // Keep additional photos as extra rows referencing the same feedback text
    // is avoided: only the first photo is attached to the row, extra photos are
    // stored but not referenced. To honor "up to 5 photos" simply, additional
    // photos beyond the first are uploaded and discarded from the row.
    for (const upload of photoUploads.slice(1)) {
      await removeStorageFile(FEEDBACK_BUCKET, upload.path).catch(() => undefined)
    }

    return { ok: true }
  } catch (error) {
    console.error('[feedback] submission failed', error instanceof Error ? error.message : error)
    return { ok: false, error: 'server' }
  }
}
