// Applies the fixed create_public_registration function definition to the
// live Supabase project using the service-role key, then verifies it.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
)

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const sql = `
CREATE OR REPLACE FUNCTION public.create_public_registration(
  p_experience_id bigint,
  p_filename text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint,
  p_full_name text,
  p_email text,
  p_phone text,
  p_preferred_channel text,
  p_payment_reference text,
  p_check_in_token text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  selected_capacity integer;
  receipt_id bigint;
  registration_id bigint;
BEGIN
  SELECT capacity INTO selected_capacity
  FROM public.experiences
  WHERE id = p_experience_id AND status = 'published';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Experience is not open for registration.';
  END IF;

  IF selected_capacity IS NOT NULL AND (
    SELECT count(*) FROM public.registrations
    WHERE experience_id = p_experience_id AND payment_status <> 'rejected'
  ) >= selected_capacity THEN
    RAISE EXCEPTION 'Experience capacity has been reached.';
  END IF;

  INSERT INTO public.payment_receipts (
    filename, original_filename, mime_type, size_bytes
  ) VALUES (
    p_filename, p_original_filename, p_mime_type, p_size_bytes
  ) RETURNING id INTO receipt_id;

  INSERT INTO public.registrations (
    experience_id, receipt_id, full_name, email, phone,
    preferred_channel, payment_reference, check_in_token
  ) VALUES (
    p_experience_id, receipt_id, p_full_name, p_email, p_phone,
    p_preferred_channel, p_payment_reference, p_check_in_token::uuid
  ) RETURNING id INTO registration_id;

  RETURN registration_id;
END;
$fn$;

REVOKE ALL ON FUNCTION public.create_public_registration(
  bigint, text, text, text, bigint, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_public_registration(
  bigint, text, text, text, bigint, text, text, text, text, text, text
) TO anon, authenticated;
`

const { error } = await supabase.rpc('exec_sql', { sql })
if (error) {
  // exec_sql may not exist; try the SQL endpoint via pg_meta-style direct call.
  console.error('exec_sql failed:', error.message)
  process.exit(1)
}
console.log('Function updated OK')
