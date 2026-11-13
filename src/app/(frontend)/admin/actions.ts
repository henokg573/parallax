'use server'

import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import { redirect } from 'next/navigation'
import type { RowDataPacket } from 'mysql2/promise'
import {
  clearAdminSession,
  getAdminSession,
  hashPassword,
  setAdminSession,
  verifyPassword,
  type AdminAccount,
} from '@/lib/admin-auth'
import { insert, remove, rows, update } from '@/lib/db'
import { PUBLIC_MEDIA_BUCKET, removeStorageFile, uploadStorageFile } from '@/lib/storage'
import {
  isTelegramConfigured,
  sendRegistrationNotification,
  sendTelegramMessage,
  sendVerifiedRegistrationTicketEmail,
} from '@/lib/telegram'
import { registrationTitleText } from '@/lib/registration-title'

function value(formData: FormData, key: string, maxLength: number) {
  const field = formData.get(key)
  return typeof field === 'string' ? field.trim().slice(0, maxLength) : ''
}

function positiveID(value: string) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function optionalID(value: string) {
  if (!value) return null
  const id = positiveID(value)
  if (!id) throw new Error('Choose a valid media item.')
  return id
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180)
}

function sqlDate(value: string, optional = false) {
  if (!value && optional) return null
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) throw new Error('Enter a valid date.')
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function contentSection(value: string) {
  if (value === 'experience' || value === 'story' || value === 'social') return value
  throw new Error('Unsupported content section.')
}

function adminCanEditContent(role: string) {
  return role !== 'check-in'
}

async function archiveContentRow(section: 'experience' | 'story' | 'social', id: number) {
  const table = section === 'experience' ? 'experiences' : section === 'story' ? 'stories' : 'social_posts'
  await update(table, { status: 'archived' }, { id })
}

async function saveContentImage(formData: FormData, section: 'experience' | 'story' | 'social', currentID: number | null, allowEmpty = false) {
  const fileKey = section === 'social' ? 'thumbnail_file' : 'image_file'
  const file = formData.get(fileKey)
  if (!(file instanceof File) || file.size === 0) {
    if (section !== 'social' && !currentID && !allowEmpty) throw new Error('Choose an image file.')
    return currentID
  }

  if (file.size > 10 * 1024 * 1024) throw new Error('Image files must be 10 MB or smaller.')
  const extensionByMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  const extension = extensionByMime[file.type]
  if (!extension) throw new Error('Upload a JPEG, PNG, WebP, or GIF image.')

  const alt = value(formData, 'image_alt', 255)
    || value(formData, section === 'social' ? 'caption_en' : 'title_en', 255)
    || 'Parallax image'
  const { default: sharp } = await import('sharp')
  const buffer = Buffer.from(await file.arrayBuffer())
  const metadata = await sharp(buffer).metadata()
  if (!metadata.width || !metadata.height) throw new Error('The image could not be decoded.')

  const filename = `${randomUUID()}.${extension}`
  await uploadStorageFile(PUBLIC_MEDIA_BUCKET, filename, buffer, file.type)

  try {
    const result = await insert<{ id: number }>('media', {
      filename,
      original_filename: file.name.replace(/[/\\\0]/g, '').slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
      width: metadata.width,
      height: metadata.height,
      alt,
    })
    return result.id
  } catch (error) {
    await removeStorageFile(PUBLIC_MEDIA_BUCKET, filename).catch(() => undefined)
    throw error
  }
}

async function saveContentVideo(formData: FormData, currentID: number | null) {
  const file = formData.get('video_file')
  if (!(file instanceof File) || file.size === 0) return currentID
  if (file.size > 100 * 1024 * 1024) throw new Error('Video files must be 100 MB or smaller.')

  const extensionByMime: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  }
  const extension = extensionByMime[file.type]
  if (!extension) throw new Error('Upload an MP4, WebM, or MOV video.')

  const alt = value(formData, 'video_alt', 255)
  if (!alt) throw new Error('Enter a description for the video.')
  const buffer = Buffer.from(await file.arrayBuffer())
  const isMP4 = file.type === 'video/mp4' || file.type === 'video/quicktime'
  const validSignature = isMP4
    ? buffer.subarray(4, 8).toString('ascii') === 'ftyp'
    : buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
  if (!validSignature) throw new Error('The video file content does not match its format.')

  const filename = `${randomUUID()}.${extension}`
  await uploadStorageFile(PUBLIC_MEDIA_BUCKET, filename, buffer, file.type)

  try {
    const result = await insert<{ id: number }>('media', {
      filename,
      original_filename: file.name.replace(/[/\\\0]/g, '').slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
      alt,
    })
    return result.id
  } catch (error) {
    await removeStorageFile(PUBLIC_MEDIA_BUCKET, filename).catch(() => undefined)
    throw error
  }
}

async function saveContentResource(formData: FormData, currentID: number | null) {
  const file = formData.get('resource_file')
  if (!(file instanceof File) || file.size === 0) return currentID
  if (file.size > 20 * 1024 * 1024) throw new Error('Resource files must be 20 MB or smaller.')

  const extensionByMime: Record<string, string> = {
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
  }
  const extension = extensionByMime[file.type]
  if (!extension) throw new Error('Upload a PDF, Word, PowerPoint, or text file.')

  const filename = `${randomUUID()}.${extension}`
  await uploadStorageFile(PUBLIC_MEDIA_BUCKET, filename, Buffer.from(await file.arrayBuffer()), file.type)
  try {
    const result = await insert<{ id: number }>('media', {
      filename,
      original_filename: file.name.replace(/[/\\\0]/g, '').slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
      alt: value(formData, 'resource_label', 255) || file.name,
    })
    return result.id
  } catch (error) {
    await removeStorageFile(PUBLIC_MEDIA_BUCKET, filename).catch(() => undefined)
    throw error
  }
}

export async function loginAdmin(formData: FormData) {
  const email = value(formData, 'email', 190).toLowerCase()
  const password = String(formData.get('password') || '')
  const nextPathValue = value(formData, 'next', 500)
  const nextPath = nextPathValue.startsWith('/') && !nextPathValue.startsWith('//')
    ? nextPathValue
    : '/admin'

  const admins = await rows<AdminAccount>('admins', {
    select: 'id, email, display_name, password_hash, role, failed_login_attempts, locked_until',
    eq: { email },
    limit: 1,
  })
  const admin = admins[0]
  const invalid = () => redirect('/admin/login?error=invalid')

  if (!admin) invalid()
  if (admin.locked_until && new Date(admin.locked_until).getTime() > Date.now()) {
    redirect('/admin/login?error=locked')
  }

  if (!verifyPassword(password, admin.password_hash)) {
    const attempts = admin.failed_login_attempts + 1
    if (attempts >= 5) {
      await update('admins', {
        failed_login_attempts: 0,
        locked_until: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }, { id: admin.id })
      redirect('/admin/login?error=locked')
    }
    await update('admins', { failed_login_attempts: attempts }, { id: admin.id })
    invalid()
  }

  await update('admins', { failed_login_attempts: 0, locked_until: null }, { id: admin.id })
  await setAdminSession(admin.id)
  redirect(nextPath)
}

export async function logoutAdmin() {
  await clearAdminSession()
  redirect('/admin/login')
}

export async function saveAdminProfile(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin) redirect('/admin/login')

  const currentPassword = String(formData.get('current_password') || '')
  const displayName = value(formData, 'display_name', 120)
  const email = value(formData, 'email', 190).toLowerCase()
  if (displayName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect('/admin/settings?error=profile-invalid')
  }

  const account = await rows<{ password_hash: string }>('admins', {
    select: 'password_hash',
    eq: { id: admin.id },
    limit: 1,
  })
  if (!account[0] || !verifyPassword(currentPassword, account[0].password_hash)) {
    redirect('/admin/settings?error=current-password')
  }

  const duplicate = await rows<{ id: number }>('admins', {
    select: 'id',
    eq: { email },
    neq: { id: admin.id },
    limit: 1,
  })
  if (duplicate.length) redirect('/admin/settings?error=email-taken')

  await update('admins', { display_name: displayName, email }, { id: admin.id })
  redirect('/admin/settings?profile=saved')
}

export async function changeAdminPassword(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin) redirect('/admin/login')

  const currentPassword = String(formData.get('current_password') || '')
  const newPassword = String(formData.get('new_password') || '')
  const confirmPassword = String(formData.get('confirm_password') || '')
  if (newPassword.length < 12 || newPassword.length > 200) {
    redirect('/admin/settings?error=password-length')
  }
  if (newPassword !== confirmPassword) redirect('/admin/settings?error=password-mismatch')
  if (newPassword === currentPassword) redirect('/admin/settings?error=password-unchanged')

  const account = await rows<{ password_hash: string }>('admins', {
    select: 'password_hash',
    eq: { id: admin.id },
    limit: 1,
  })
  if (!account[0] || !verifyPassword(currentPassword, account[0].password_hash)) {
    redirect('/admin/settings?error=current-password')
  }

  await update('admins', { password_hash: hashPassword(newPassword) }, { id: admin.id })
  await setAdminSession(admin.id)
  redirect('/admin/settings?password=saved')
}

export async function testTelegramConnection() {
  const admin = await getAdminSession()
  if (!admin || admin.role !== 'super-admin') redirect('/admin/login')
  if (!isTelegramConfigured()) redirect('/admin/settings?telegram=not-configured')

  const result = await sendTelegramMessage('<b>Parallax Telegram test</b>\nThe registration notification bot is connected.')
  redirect(`/admin/settings?telegram=${result.ok ? 'sent' : 'failed'}`)
}

export async function saveContent(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || !adminCanEditContent(admin.role)) redirect('/admin/login')

  const section = contentSection(value(formData, 'section', 20))
  const id = value(formData, 'id', 20) ? positiveID(value(formData, 'id', 20)) : null
  if (value(formData, 'id', 20) && !id) throw new Error('Invalid content ID.')
  const statusValue = value(formData, 'status', 20)
  const status = statusValue === 'published' ? 'published' : statusValue === 'archived' ? 'archived' : 'draft'
  const currentImageID = optionalID(
    value(formData, section === 'social' ? 'thumbnail_id' : 'image_id', 20),
  )
  const currentVideoID = optionalID(value(formData, 'video_id', 20))

  if (section === 'experience') {
    const rawTitle = formData.get('title_en')
    const rawTitleAM = formData.get('title_am')
    if (
      (typeof rawTitle === 'string' && Array.from(rawTitle.trim()).length > 10000) ||
      (typeof rawTitleAM === 'string' && Array.from(rawTitleAM.trim()).length > 10000)
    ) {
      throw new Error('Registration headers must be 10,000 characters or fewer.')
    }
    const title = value(formData, 'title_en', 10000)
    const titleAM = value(formData, 'title_am', 10000)
    const rawSummary = formData.get('summary_en')
    if (typeof rawSummary === 'string' && Array.from(rawSummary.trim()).length > 10000) {
      throw new Error('The English short description must be 10,000 characters or fewer.')
    }
    const summary = value(formData, 'summary_en', 10000)
    const location = value(formData, 'location_en', 200)
    const kind = value(formData, 'kind', 20)
    const currency = value(formData, 'currency', 3).toUpperCase()
    const priceValue = value(formData, 'price', 30)
    const capacityValue = value(formData, 'capacity', 20)
    const imageURL = value(formData, 'image_url', 1000)
    const resourceURL = value(formData, 'resource_url', 1000)
    const imageFile = formData.get('image_file')
    if (!registrationTitleText(title) || !registrationTitleText(summary) || !location || !['trip', 'event', 'faith', 'workshop', 'other'].includes(kind)) {
      throw new Error('Complete the required experience fields.')
    }
    if (imageURL && !/^https?:\/\//i.test(imageURL)) throw new Error('Enter a valid image URL.')
    if (resourceURL && !/^https?:\/\//i.test(resourceURL)) throw new Error('Enter a valid resource URL.')
    if (!currentImageID && !(imageFile instanceof File && imageFile.size > 0) && !imageURL) {
      throw new Error('Upload an image or add an image URL.')
    }
    if (!['ETB', 'USD'].includes(currency)) throw new Error('Choose a valid currency.')
    const price = priceValue ? Number(priceValue) : null
    const capacity = capacityValue ? Number(capacityValue) : null
    if (price !== null && (!Number.isFinite(price) || price < 0)) throw new Error('Enter a valid price.')
    if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1)) {
      throw new Error('Capacity must be a positive whole number.')
    }
    const imageID = await saveContentImage(formData, section, currentImageID, Boolean(imageURL))
    const videoID = await saveContentVideo(formData, currentVideoID)
    const resourceID = await saveContentResource(formData, optionalID(value(formData, 'resource_id', 20)))
    const values = {
      slug: slugify(value(formData, 'slug', 190) || registrationTitleText(title)),
      title_en: title,
      title_am: titleAM,
      kind,
      summary_en: summary,
      summary_am: value(formData, 'summary_am', 5000),
      location_en: value(formData, 'location_en', 200),
      location_am: value(formData, 'location_am', 200),
      start_date: sqlDate(value(formData, 'start_date', 40)),
      end_date: sqlDate(value(formData, 'end_date', 40), true),
      capacity,
      price,
      currency,
      registration_url: value(formData, 'registration_url', 1000) || null,
      image_url: imageURL || null,
      resource_url: resourceURL || null,
      resource_id: resourceID,
      image_id: imageID,
      video_id: videoID,
      featured: formData.get('featured') === 'on',
      status,
    }
    try {
      if (id) {
        await update('experiences', values, { id })
      } else {
        await insert('experiences', values)
      }
    } catch (error) {
      const message = String(error)
      const missingRegistrationColumn = message.includes('image_url') || message.includes('resource_url') || message.includes('resource_id')
      if (!missingRegistrationColumn) throw error
      if (imageURL || resourceURL || resourceID) redirect('/admin/registrations?error=schema')

      const { image_url: unusedImageURL, resource_url: unusedResourceURL, resource_id: unusedResourceID, ...legacyValues } = values
      if (id) {
        await update('experiences', legacyValues, { id })
      } else {
        await insert('experiences', legacyValues)
      }
    }
  }

  if (section === 'story') {
    const title = value(formData, 'title_en', 200)
    const excerpt = value(formData, 'excerpt_en', 5000)
    const body = value(formData, 'body_en', 50000)
    if (!title || !excerpt || !body) throw new Error('Enter the English title, excerpt, and story.')
    const publishedAtValue = value(formData, 'published_at', 40)
    const publishedAt = publishedAtValue ? sqlDate(publishedAtValue) : status === 'published' ? new Date() : null
    const imageID = await saveContentImage(formData, section, currentImageID)
    const videoID = await saveContentVideo(formData, currentVideoID)
    const values = {
      slug: slugify(value(formData, 'slug', 190) || title),
      title_en: title,
      title_am: value(formData, 'title_am', 200),
      excerpt_en: value(formData, 'excerpt_en', 5000),
      excerpt_am: value(formData, 'excerpt_am', 5000),
      body_en: value(formData, 'body_en', 50000),
      body_am: value(formData, 'body_am', 50000),
      author_name_en: value(formData, 'author_name_en', 160),
      author_name_am: value(formData, 'author_name_am', 160),
      image_id: imageID,
      video_id: videoID,
      published_at: publishedAt,
      featured: formData.get('featured') === 'on',
      status,
    }
    if (id) {
      await update('stories', values, { id })
    } else {
      await insert('stories', values)
    }
  }

  if (section === 'social') {
    const platform = value(formData, 'platform', 20)
    const caption = value(formData, 'caption_en', 5000)
    const postURL = value(formData, 'post_url', 1000)
    if (!['telegram', 'tiktok', 'instagram', 'youtube', 'facebook'].includes(platform)) {
      throw new Error('Choose a valid platform.')
    }
    if (!caption || !/^https?:\/\//i.test(postURL)) throw new Error('Enter a caption and valid post URL.')
    const imageID = await saveContentImage(formData, section, currentImageID)
    const videoID = await saveContentVideo(formData, currentVideoID)
    const values = {
      platform,
      caption_en: value(formData, 'caption_en', 5000),
      caption_am: value(formData, 'caption_am', 5000),
      post_url: postURL,
      thumbnail_id: imageID,
      video_id: videoID,
      posted_at: sqlDate(value(formData, 'posted_at', 40)),
      visible: formData.get('visible') === 'on',
      status,
    }
    if (id) {
      await update('social_posts', values, { id })
    } else {
      await insert('social_posts', values)
    }
  }

  redirect(`/admin/${section === 'experience' ? 'experiences' : section === 'story' ? 'stories' : 'social'}?saved=1`)
}

export async function deleteContent(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin) redirect('/admin/login')

  const section = contentSection(value(formData, 'section', 20))
  const id = positiveID(value(formData, 'id', 20))
  if (!id) throw new Error('Invalid content ID.')

  if (admin.role !== 'super-admin') {
    // Non super-admins can only archive content: it is hidden from the site but never deleted.
    await archiveContentRow(section, id)
    const listSlug = section === 'experience' ? 'experiences' : section === 'story' ? 'stories' : 'social'
    redirect(`/admin/${listSlug}?archived=1`)
  }

  const table = section === 'experience' ? 'experiences' : section === 'story' ? 'stories' : 'social_posts'
  await remove(table, { id })

  const listSlug = section === 'experience' ? 'experiences' : section === 'story' ? 'stories' : 'social'
  redirect(`/admin/${listSlug}?deleted=1`)
}

export async function archiveContent(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || !adminCanEditContent(admin.role)) redirect('/admin/login')

  const section = contentSection(value(formData, 'section', 20))
  const id = positiveID(value(formData, 'id', 20))
  if (!id) throw new Error('Invalid content ID.')

  await archiveContentRow(section, id)

  const listSlug = section === 'experience' ? 'experiences' : section === 'story' ? 'stories' : 'social'
  redirect(`/admin/${listSlug}?archived=1`)
}

export async function restoreContent(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || !adminCanEditContent(admin.role)) redirect('/admin/login')

  const section = contentSection(value(formData, 'section', 20))
  const id = positiveID(value(formData, 'id', 20))
  if (!id) throw new Error('Invalid content ID.')

  const table = section === 'experience' ? 'experiences' : section === 'story' ? 'stories' : 'social_posts'
  await update(table, { status: 'draft' }, { id })

  const listSlug = section === 'experience' ? 'experiences' : section === 'story' ? 'stories' : 'social'
  redirect(`/admin/${listSlug}?restored=1`)
}

export async function deleteMedia(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || !adminCanEditContent(admin.role)) redirect('/admin/login')

  const id = positiveID(value(formData, 'id', 20))
  if (!id) throw new Error('Invalid media ID.')

  const media = await rows<{ filename: string }>('media', {
    select: 'filename',
    eq: { id },
    limit: 1,
  })
  const record = media[0]
  if (!record) redirect('/admin/media?deleted=1')

  await remove('media', { id })
  await removeStorageFile(PUBLIC_MEDIA_BUCKET, record.filename).catch(() => undefined)
  redirect('/admin/media?deleted=1')
}

export async function deleteAdmin(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || admin.role !== 'super-admin') redirect('/admin')

  const id = positiveID(value(formData, 'id', 20))
  if (!id) throw new Error('Invalid admin ID.')
  if (id === admin.id) throw new Error('You cannot delete your own account.')

  await remove('admins', { id })
  redirect('/admin/admins?deleted=1')
}

export async function uploadMedia(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || !adminCanEditContent(admin.role)) redirect('/admin/login')

  const file = formData.get('file')
  const alt = value(formData, 'alt', 255)
  if (!(file instanceof File) || file.size === 0) throw new Error('Choose a media file.')
  const isVideo = file.type.startsWith('video/')
  const sizeLimit = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024
  if (file.size > sizeLimit) throw new Error(isVideo ? 'Videos must be 100 MB or smaller.' : 'Images must be 10 MB or smaller.')
  const extensionByMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  }
  const extension = extensionByMime[file.type]
  if (!extension) throw new Error('Upload a JPEG, PNG, WebP, GIF, MP4, WebM, or MOV file.')

  const buffer = Buffer.from(await file.arrayBuffer())
  let width: number | null = null
  let height: number | null = null
  if (isVideo) {
    const isMP4 = file.type === 'video/mp4' || file.type === 'video/quicktime'
    const validSignature = isMP4
      ? buffer.subarray(4, 8).toString('ascii') === 'ftyp'
      : buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    if (!validSignature) throw new Error('The video file content does not match its format.')
  } else {
    const { default: sharp } = await import('sharp')
    const metadata = await sharp(buffer).metadata()
    if (!metadata.width || !metadata.height) throw new Error('The image could not be decoded.')
    width = metadata.width
    height = metadata.height
  }

  const filename = `${randomUUID()}.${extension}`
  await uploadStorageFile(PUBLIC_MEDIA_BUCKET, filename, buffer, file.type)

  try {
    await insert('media', {
      filename,
      original_filename: file.name.replace(/[/\\\0]/g, '').slice(0, 255),
      mime_type: file.type,
      size_bytes: file.size,
      width,
      height,
      alt,
    })
  } catch (error) {
    await removeStorageFile(PUBLIC_MEDIA_BUCKET, filename).catch(() => undefined)
    throw error
  }

  redirect('/admin/media?saved=1')
}

type RegistrationMailRow = RowDataPacket & {
  id: number
  experience_id: number
  email: string
  full_name: string
  phone: string
  preferred_channel: string
  payment_reference: string
  check_in_token: string
  payment_status: string
  ticket_email_sent_at: string | null
}

export async function updateRegistration(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin) redirect('/admin/login')
  if (admin.role === 'check-in') redirect('/admin')

  const id = positiveID(value(formData, 'id', 20))
  const status = value(formData, 'payment_status', 20)
  if (!id || !['pending', 'verified', 'rejected'].includes(status)) {
    throw new Error('Invalid registration update.')
  }
  const internalNotes = value(formData, 'internal_notes', 5000)

  const existingRows = await rows<RegistrationMailRow>('registrations', {
    select: 'id, experience_id, email, full_name, phone, preferred_channel, payment_reference, check_in_token, payment_status, ticket_email_sent_at',
    eq: { id },
    limit: 1,
  })
  const registration = existingRows[0]
  if (!registration) throw new Error('Registration not found.')
  const experienceRows = status !== registration.payment_status && status !== 'pending'
    ? await rows<{ title_en: string }>('experiences', {
        select: 'title_en',
        eq: { id: registration.experience_id },
        limit: 1,
      })
    : []
  await update('registrations', { payment_status: status, internal_notes: internalNotes }, { id })

  let telegramFailure: 'not_configured' | 'request_failed' | 'rejected' | null = null
  if (status !== registration.payment_status && status !== 'pending') {
    const notification = await sendRegistrationNotification({
      id: registration.id,
      experienceTitle: registrationTitleText(experienceRows[0]?.title_en || '') || `Experience ${registration.experience_id}`,
      fullName: registration.full_name,
      email: registration.email,
      phone: registration.phone,
      preferredChannel: registration.preferred_channel,
      paymentReference: registration.payment_reference,
    }, status as 'verified' | 'rejected')
    telegramFailure = notification.ok ? null : notification.reason
  }

  let emailFailure: 'not_configured' | 'request_failed' | 'rejected' | null = null
  if (status === 'verified' && registration && !registration.ticket_email_sent_at) {
    const result = await sendVerifiedRegistrationTicketEmail({
      to: registration.email,
      fullName: registration.full_name,
      experienceTitle: registrationTitleText(experienceRows[0]?.title_en || '') || `Experience ${registration.experience_id}`,
      registrationID: registration.id,
      checkInToken: registration.check_in_token,
    })
    if (result.ok) {
      await update('registrations', { ticket_email_sent_at: new Date().toISOString() }, { id, ticket_email_sent_at: null })
    } else {
      emailFailure = result.reason
    }
  }

  redirect(`/admin/registrations?saved=1${emailFailure ? `&email=${emailFailure}` : ''}${telegramFailure ? `&telegram=${telegramFailure}` : ''}`)
}

export async function createAdmin(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || admin.role !== 'super-admin') redirect('/admin')
  const email = value(formData, 'email', 190).toLowerCase()
  const displayName = value(formData, 'display_name', 120)
  const password = String(formData.get('password') || '')
  const role = value(formData, 'role', 20)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || displayName.length < 2) {
    throw new Error('Enter a valid email address and display name.')
  }
  if (password.length < 12 || password.length > 200) throw new Error('Password must be 12-200 characters.')
  if (!['super-admin', 'administrator', 'editor', 'check-in'].includes(role)) {
    throw new Error('Choose a valid role.')
  }
  await insert('admins', {
    email,
    display_name: displayName,
    password_hash: hashPassword(password),
    role,
  })
  redirect('/admin/admins?saved=1')
}

export async function saveSocialLinks(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || admin.role !== 'super-admin') redirect('/admin')

  const platforms = ['telegram', 'whatsapp', 'linkedin', 'tiktok', 'instagram', 'youtube', 'x', 'snapchat']
  try {
    await Promise.all(platforms.map((platform) => update('social_links', {
      url: value(formData, `url_${platform}`, 1000),
      visible: formData.get(`visible_${platform}`) === 'on',
      updated_at: new Date().toISOString(),
    }, { platform })))
  } catch (error) {
    if (error instanceof Error && error.message.includes('social_links')) {
      redirect('/admin/social-links?error=missing-table')
    }
    throw error
  }
  redirect('/admin/social-links?saved=1')
}

export async function saveAnnouncement(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || admin.role !== 'super-admin') redirect('/admin/login')

  const id = value(formData, 'id', 20) ? positiveID(value(formData, 'id', 20)) : null
  if (value(formData, 'id', 20) && !id) throw new Error('Invalid announcement ID.')
  const title = value(formData, 'title', 200)
  const message = String(formData.get('message') || '').slice(0, 2000)
  if (!title || !message) throw new Error('Enter a title and message.')
  const linkURLRaw = value(formData, 'link_url', 1000)
  if (linkURLRaw && !/^https?:\/\//i.test(linkURLRaw)) throw new Error('The link must start with http:// or https://.')
  const statusValue = value(formData, 'status', 20)
  const status = statusValue === 'published' ? 'published' : statusValue === 'archived' ? 'archived' : 'draft'
  const dismissible = formData.get('dismissible') === 'on' ? 1 : 0

  const announcement = {
    link_url: linkURLRaw || null,
    link_label: value(formData, 'link_label', 120) || null,
    status,
    dismissible: Boolean(dismissible),
    title,
    message,
  }
  if (id) {
    await update('announcements', announcement, { id })
  } else {
    await insert('announcements', { share_token: randomUUID(), ...announcement })
  }
  redirect('/admin/announcements?saved=1')
}

export async function deleteAnnouncement(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || admin.role !== 'super-admin') redirect('/admin/login')

  const id = positiveID(value(formData, 'id', 20))
  if (!id) throw new Error('Invalid announcement ID.')
  await remove('announcements', { id })
  redirect('/admin/announcements?deleted=1')
}
