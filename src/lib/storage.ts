import { cookies } from 'next/headers'
import { createClient, createPublicClient } from '@/utils/supabase/server'

export const PUBLIC_MEDIA_BUCKET = 'parallax-media'
export const PRIVATE_RECEIPTS_BUCKET = 'parallax-receipts'

type StorageBucket = typeof PUBLIC_MEDIA_BUCKET | typeof PRIVATE_RECEIPTS_BUCKET

async function getStorage(publicAccess = false) {
  const cookieStore = await cookies()
  const supabase = publicAccess ? createPublicClient(cookieStore) : createClient(cookieStore)
  return supabase.storage
}

export async function uploadStorageFile(
  bucket: StorageBucket,
  path: string,
  data: Buffer,
  contentType: string,
  publicAccess = false,
) {
  const storage = await getStorage(publicAccess)
  const { error } = await storage.from(bucket).upload(path, data, {
    contentType,
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return path
}

export function publicMediaURL(path: string) {
  const baseURL = process.env.SUPABASE_URL
  if (!baseURL) throw new Error('SUPABASE_URL is not configured.')
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')
  return `${baseURL}/storage/v1/object/public/${PUBLIC_MEDIA_BUCKET}/${encodedPath}`
}

export async function downloadStorageFile(bucket: StorageBucket, path: string) {
  const storage = await getStorage()
  const { data, error } = await storage.from(bucket).download(path)
  if (error || !data) return null
  return Buffer.from(await data.arrayBuffer())
}

export async function removeStorageFile(bucket: StorageBucket, path: string, publicAccess = false) {
  const storage = await getStorage(publicAccess)
  const { error } = await storage.from(bucket).remove([path])
  if (error) throw new Error(error.message)
}
