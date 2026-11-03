'use server'

import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
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
import { database, insert, remove, rows, update } from '@/lib/db'

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

async function saveContentImage(formData: FormData, section: 'experience' | 'story' | 'social', currentID: number | null) {
  const fileKey = section === 'social' ? 'thumbnail_file' : 'image_file'
  const file = formData.get(fileKey)
  if (!(file instanceof File) || file.size === 0) {
    if (section !== 'social' && !currentID) throw new Error('Choose an image file.')
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
  if (!alt) throw new Error('Enter alternative text for the image.')
  const { default: sharp } = await import('sharp')
  const buffer = Buffer.from(await file.arrayBuffer())
  const metadata = await sharp(buffer).metadata()
  if (!metadata.width || !metadata.height) throw new Error('The image could not be decoded.')

  const filename = `${randomUUID()}.${extension}`
  const directory = path.join(process.cwd(), 'public', 'uploads', 'media')
  await mkdir(directory, { recursive: true })
  const filePath = path.join(directory, filename)
  await writeFile(filePath, buffer, { flag: 'wx' })

  try {
    const [result] = await database.execute(
      `INSERT INTO media (filename, original_filename, mime_type, size_bytes, width, height, alt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [filename, file.name.replace(/[/\\\0]/g, '').slice(0, 255), file.type, file.size, metadata.width, metadata.height, alt],
    )
    return (result as { insertId: number }).insertId
  } catch (error) {
    await unlink(filePath).catch(() => undefined)
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
  const directory = path.join(process.cwd(), 'public', 'uploads', 'media')
  await mkdir(directory, { recursive: true })
  const filePath = path.join(directory, filename)
  await writeFile(filePath, buffer, { flag: 'wx' })

  try {
    const [result] = await database.execute(
      `INSERT INTO media (filename, original_filename, mime_type, size_bytes, alt)
       VALUES (?, ?, ?, ?, ?)`,
      [filename, file.name.replace(/[/\\\0]/g, '').slice(0, 255), file.type, file.size, alt],
    )
    return (result as { insertId: number }).insertId
  } catch (error) {
    await unlink(filePath).catch(() => undefined)
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
    const title = value(formData, 'title_en', 200)
    const summary = value(formData, 'summary_en', 5000)
    const location = value(formData, 'location_en', 200)
    const kind = value(formData, 'kind', 20)
    const currency = value(formData, 'currency', 3).toUpperCase()
    const priceValue = value(formData, 'price', 30)
    const capacityValue = value(formData, 'capacity', 20)
    if (!title || !summary || !location || !['trip', 'event', 'faith'].includes(kind)) {
      throw new Error('Complete the required experience fields.')
    }
    if (!['ETB', 'USD'].includes(currency)) throw new Error('Choose a valid currency.')
    const price = priceValue ? Number(priceValue) : null
    const capacity = capacityValue ? Number(capacityValue) : null
    if (price !== null && (!Number.isFinite(price) || price < 0)) throw new Error('Enter a valid price.')
    if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 1)) {
      throw new Error('Capacity must be a positive whole number.')
    }
    const imageID = await saveContentImage(formData, section, currentImageID)
    const videoID = await saveContentVideo(formData, currentVideoID)
    const values = [
      slugify(value(formData, 'slug', 190) || title),
      title,
      value(formData, 'title_am', 200),
      kind,
      value(formData, 'summary_en', 5000),
      value(formData, 'summary_am', 5000),
      value(formData, 'location_en', 200),
      value(formData, 'location_am', 200),
      sqlDate(value(formData, 'start_date', 40)),
      sqlDate(value(formData, 'end_date', 40), true),
      capacity,
      price,
      currency,
      value(formData, 'registration_url', 1000) || null,
      imageID,
      videoID,
      formData.get('featured') === 'on' ? 1 : 0,
      status,
    ]
    if (id) {
      await database.execute(
        `UPDATE experiences SET slug=?, title_en=?, title_am=?, kind=?, summary_en=?, summary_am=?,
          location_en=?, location_am=?, start_date=?, end_date=?, capacity=?, price=?, currency=?,
          registration_url=?, image_id=?, video_id=?, featured=?, status=? WHERE id=?`,
        [...values, id],
      )
    } else {
      await database.execute(
        `INSERT INTO experiences
          (slug, title_en, title_am, kind, summary_en, summary_am, location_en, location_am,
           start_date, end_date, capacity, price, currency, registration_url, image_id, video_id, featured, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values,
      )
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
    const values = [
      slugify(value(formData, 'slug', 190) || title),
      title,
      value(formData, 'title_am', 200),
      value(formData, 'excerpt_en', 5000),
      value(formData, 'excerpt_am', 5000),
      value(formData, 'body_en', 50000),
      value(formData, 'body_am', 50000),
      value(formData, 'author_name_en', 160),
      value(formData, 'author_name_am', 160),
      imageID,
      videoID,
      publishedAt,
      formData.get('featured') === 'on' ? 1 : 0,
      status,
    ]
    if (id) {
      await database.execute(
        `UPDATE stories SET slug=?, title_en=?, title_am=?, excerpt_en=?, excerpt_am=?, body_en=?,
          body_am=?, author_name_en=?, author_name_am=?, image_id=?, video_id=?, published_at=?, featured=?, status=?
         WHERE id=?`,
        [...values, id],
      )
    } else {
      await database.execute(
        `INSERT INTO stories
          (slug, title_en, title_am, excerpt_en, excerpt_am, body_en, body_am, author_name_en,
           author_name_am, image_id, video_id, published_at, featured, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values,
      )
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
  await database.execute(`UPDATE ${table} SET status = 'draft' WHERE id = ?`, [id])

  const listSlug = section === 'experience' ? 'experiences' : section === 'story' ? 'stories' : 'social'
  redirect(`/admin/${listSlug}?restored=1`)
}

export async function deleteMedia(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || !adminCanEditContent(admin.role)) redirect('/admin/login')

  const id = positiveID(value(formData, 'id', 20))
  if (!id) throw new Error('Invalid media ID.')

  const media = await rows<{ filename: string } & RowDataPacket>(
    'SELECT filename FROM media WHERE id = ? LIMIT 1',
    [id],
  )
  const record = media[0]
  if (!record) redirect('/admin/media?deleted=1')

  await database.execute('DELETE FROM media WHERE id = ?', [id])
  await unlink(path.join(process.cwd(), 'public', 'uploads', 'media', record.filename)).catch(() => undefined)
  redirect('/admin/media?deleted=1')
}

export async function deleteAdmin(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || admin.role !== 'super-admin') redirect('/admin')

  const id = positiveID(value(formData, 'id', 20))
  if (!id) throw new Error('Invalid admin ID.')
  if (id === admin.id) throw new Error('You cannot delete your own account.')

  await database.execute('DELETE FROM admins WHERE id = ?', [id])
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
  const directory = path.join(process.cwd(), 'public', 'uploads', 'media')
  await mkdir(directory, { recursive: true })
  const filePath = path.join(directory, filename)
  await writeFile(filePath, buffer, { flag: 'wx' })

  try {
    await database.execute(
      `INSERT INTO media (filename, original_filename, mime_type, size_bytes, width, height, alt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [filename, file.name.replace(/[/\\\0]/g, '').slice(0, 255), file.type, file.size, width, height, alt],
    )
  } catch (error) {
    await unlink(filePath).catch(() => undefined)
    throw error
  }

  redirect('/admin/media?saved=1')
}

type RegistrationMailRow = RowDataPacket & {
  id: number
  email: string
  full_name: string
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

  const connection = await database.getConnection()
  let registration: RegistrationMailRow | undefined
  try {
    await connection.beginTransaction()
    const [existingRows] = await connection.execute<RegistrationMailRow[]>(
      `SELECT id, email, full_name, check_in_token, payment_status, ticket_email_sent_at
       FROM registrations WHERE id = ? FOR UPDATE`,
      [id],
    )
    registration = existingRows[0]
    if (!registration) throw new Error('Registration not found.')

    await connection.execute(
      'UPDATE registrations SET payment_status = ?, internal_notes = ? WHERE id = ?',
      [status, internalNotes, id],
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }

  let emailFailed = false
  if (status === 'verified' && registration && !registration.ticket_email_sent_at) {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.PARALLAX_FROM_EMAIL
    if (!apiKey || !from) {
      emailFailed = true
    } else {
      const checkInURL = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/check-in/${registration.check_in_token}`
      const qrDataURL = await QRCode.toDataURL(checkInURL, { errorCorrectionLevel: 'H', margin: 2, width: 720 })
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            to: [registration.email],
            subject: 'Your Parallax entry QR code',
            html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#102e26"><p style="font-size:12px;color:#9a6b20">PARALLAX · PAYMENT VERIFIED</p><h1>You are on the list, ${registration.full_name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')}.</h1><p>Your payment has been verified. Your entry QR code is attached. Keep it ready when you arrive.</p></div>`,
            attachments: [{ filename: 'parallax-entry-qr.png', content: qrDataURL.split(',')[1] }],
          }),
        })
        if (response.ok) {
          await database.execute(
            'UPDATE registrations SET ticket_email_sent_at = NOW() WHERE id = ? AND ticket_email_sent_at IS NULL',
            [id],
          )
        } else {
          emailFailed = true
        }
      } catch {
        emailFailed = true
      }
    }
  }

  redirect(`/admin/registrations?saved=1${emailFailed ? '&email=failed' : ''}`)
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

  const linkValues = [linkURLRaw || null, value(formData, 'link_label', 120) || null, status, dismissible, title, message]
  if (id) {
    await database.execute(
      'UPDATE announcements SET link_url=?, link_label=?, status=?, dismissible=?, title=?, message=? WHERE id=?',
      [...linkValues, id],
    )
  } else {
    await database.execute(
      `INSERT INTO announcements (share_token, link_url, link_label, status, dismissible, title, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), ...linkValues],
    )
  }
  redirect('/admin/announcements?saved=1')
}

export async function deleteAnnouncement(formData: FormData) {
  const admin = await getAdminSession()
  if (!admin || admin.role !== 'super-admin') redirect('/admin/login')

  const id = positiveID(value(formData, 'id', 20))
  if (!id) throw new Error('Invalid announcement ID.')
  await database.execute('DELETE FROM announcements WHERE id = ?', [id])
  redirect('/admin/announcements?deleted=1')
}
