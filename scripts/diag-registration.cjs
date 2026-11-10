// Temporary diagnostic: calls create_public_registration as an anonymous user
// against the live Supabase project and prints the exact Postgres error.
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
)

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY)

async function main() {
  const { data: experiences, error: expError } = await supabase
    .from('experiences')
    .select('id, title_en, status, capacity')
    .order('id', { ascending: false })
    .limit(5)
  console.log('published experiences check →', JSON.stringify({ experiences, expError }, null, 2))

  if (!experiences?.length) return

  const target = experiences[0]
  const { data, error } = await supabase.rpc('create_public_registration', {
    p_experience_id: target.id,
    p_filename: `diag-${Date.now()}.png`,
    p_original_filename: 'diag.png',
    p_mime_type: 'image/png',
    p_size_bytes: 100,
    p_full_name: 'Diagnostic User',
    p_email: 'diag@example.com',
    p_phone: '0911000000',
    p_preferred_channel: 'email',
    p_payment_reference: 'DIAG123',
    p_check_in_token: `diag-${Date.now()}`,
  })
  console.log('RPC result →', JSON.stringify({ data, error }, null, 2))
}

main().catch((error) => console.error('diag failed:', error.message))
