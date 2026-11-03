import { scryptSync, randomBytes } from 'node:crypto'
import mysql from 'mysql2/promise'

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

const salt = randomBytes(16).toString('hex')
const digest = scryptSync(password, salt, 64).toString('hex')
const connection = await mysql.createConnection({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'parallax',
})

try {
  await connection.execute(
    'INSERT INTO admins (email, display_name, password_hash, role) VALUES (?, ?, ?, ?)',
    [email, displayName, `scrypt$${salt}$${digest}`, 'super-admin'],
  )
  console.log(`Created super-admin ${email}.`)
} finally {
  await connection.end()
}