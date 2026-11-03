import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { RowDataPacket } from 'mysql2/promise'
import { rows } from '@/lib/db'

export type AdminRole = 'super-admin' | 'administrator' | 'editor' | 'check-in'

export type AdminAccount = RowDataPacket & {
  id: number
  email: string
  display_name: string
  role: AdminRole
  password_hash: string
  failed_login_attempts: number
  locked_until: string | null
}

export type SafeAdmin = Pick<AdminAccount, 'id' | 'email' | 'display_name' | 'role'>

const cookieName = 'parallax_admin_session'
const sessionLifetimeSeconds = 2 * 60 * 60

function sessionSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 characters.')
  }
  return secret
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const digest = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${digest}`
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, digest] = storedHash.split('$')
  if (algorithm !== 'scrypt' || !salt || !digest) return false

  const expected = Buffer.from(digest, 'hex')
  const actual = scryptSync(password, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function sign(value: string) {
  return createHmac('sha256', sessionSecret()).update(value).digest('base64url')
}

export function createSessionToken(adminID: number) {
  const payload = Buffer.from(
    JSON.stringify({ adminID, expiresAt: Date.now() + sessionLifetimeSeconds * 1000 }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

function parseSessionToken(token: string) {
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null

  const expected = Buffer.from(sign(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      adminID?: number
      expiresAt?: number
    }
    if (!Number.isSafeInteger(parsed.adminID) || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      return null
    }
    return parsed.adminID as number
  } catch {
    return null
  }
}

export async function setAdminSession(adminID: number) {
  const cookieStore = await cookies()
  cookieStore.set(cookieName, createSessionToken(adminID), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionLifetimeSeconds,
  })
}

export async function clearAdminSession() {
  const cookieStore = await cookies()
  cookieStore.delete(cookieName)
}

export async function getAdminSession(): Promise<SafeAdmin | null> {
  const token = (await cookies()).get(cookieName)?.value
  if (!token) return null

  const adminID = parseSessionToken(token)
  if (!adminID) return null

  const admins = await rows<AdminAccount>('admins', {
    select: 'id, email, display_name, role',
    eq: { id: adminID },
    limit: 1,
  })
  const admin = admins[0]
  if (!admin) return null

  return {
    id: admin.id,
    email: admin.email,
    display_name: admin.display_name,
    role: admin.role,
  }
}

export async function requireAdmin(nextPath = '/admin'): Promise<SafeAdmin> {
  const admin = await getAdminSession()
  if (!admin) redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`)
  return admin
}