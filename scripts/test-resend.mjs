// Quick Resend smoke test: sends one email and prints the result.

const apiKey = process.env.RESEND_API_KEY
const from = process.env.PARALLAX_FROM_EMAIL

if (!apiKey || apiKey.includes('xxxx')) {
  console.error('RESEND_API_KEY missing or still a placeholder in .env')
  process.exit(1)
}

const to = process.argv[2]
if (!to) {
  console.error('Usage: node scripts/test-resend.mjs <recipient@email.com>')
  process.exit(1)
}

const response = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    from,
    to: [to],
    subject: 'Parallax email test',
    html: '<p>If you can read this, Resend sending works.</p>',
  }),
})

const body = await response.json().catch(() => ({}))
console.log('HTTP status:', response.status)
console.log('Response:', JSON.stringify(body, null, 2))
process.exit(response.ok ? 0 : 1)
