import { scryptSync, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const email = process.env.PARALLAX_ADMIN_EMAIL?.trim().toLowerCase()
const displayName = process.env.PARALLAX_ADMIN_DISPLAY_NAME?.trim()
const password = process.env.PARALLAX_ADMIN_PASSWORD

if (!email || !displayName || !password) {
  throw new Error('Run npm run db:admin to create the first super-admin.')
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
if (displayName.length < 2 || displayName.length > 120) {
  throw new Error('Display name must be between 2 and 120 characters.')
}
if (password.length < 12 || password.length > 200) {
  throw new Error('Password must be between 12 and 200 characters.')
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY must be configured.')
}

const salt = randomBytes(16).toString('hex')
const digest = scryptSync(password, salt, 64).toString('hex')
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)
const { error } = await supabase.from('admins').insert({
  email,
  display_name: displayName,
  password_hash: `scrypt$${salt}$${digest}`,
  role: 'super-admin',
})

if (error) throw new Error(error.message)
console.log(`Created super-admin ${email} in Supabase.`)