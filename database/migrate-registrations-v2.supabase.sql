-- Registrations v2 migration — additive only. Safe for existing data.
-- Run in the Supabase SQL Editor. Re-runnable (idempotent).

-- The app now supports 12 registration categories. The legacy `kind` column is
-- a restricted enum (experience_kind) that lacks the new values, so widen it to
-- plain text first. Existing values are preserved.
-- Also extend the publish-status enum so 'unpublished' is a legal value.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'publish_status'
  ) THEN
    ALTER TYPE public.publish_status ADD VALUE IF NOT EXISTS 'unpublished';
  END IF;
END $$;

-- Some deployments ship an 'unpublish' enum value variant; normalize those rows.
UPDATE public.experiences SET status = 'unpublished' WHERE status::text = 'unpublish';
ALTER TABLE public.experiences
  ALTER COLUMN kind DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    JOIN pg_type t ON a.atttypid = t.oid
    WHERE a.attrelid = 'public.experiences'::regclass
      AND a.attname = 'kind'
      AND t.typname = 'experience_kind'
  ) THEN
    ALTER TABLE public.experiences
      ALTER COLUMN kind TYPE text USING kind::text;
  END IF;
END $$;

-- Remap legacy enum values into the new category set (idempotent).
UPDATE public.experiences
SET kind = CASE kind
  WHEN 'trip' THEN 'mission-trip'
  WHEN 'faith' THEN 'worship-program'
  ELSE kind
END
WHERE kind IN ('trip', 'faith');

ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS description_en text DEFAULT '',
  ADD COLUMN IF NOT EXISTS description_am text DEFAULT '',
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Addis_Ababa',
  ADD COLUMN IF NOT EXISTS location_type text NOT NULL DEFAULT 'physical',
  ADD COLUMN IF NOT EXISTS address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS maps_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS map_lat double precision,
  ADD COLUMN IF NOT EXISTS map_lng double precision,
  ADD COLUMN IF NOT EXISTS meeting_platform text DEFAULT '',
  ADD COLUMN IF NOT EXISTS meeting_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS meeting_instructions text DEFAULT '',
  ADD COLUMN IF NOT EXISTS unlimited_capacity boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reg_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS reg_closes_at timestamptz,
  ADD COLUMN IF NOT EXISTS allow_after_start boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS payment_instructions text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_methods text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_reference_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ticket_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS discount_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS participant_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS consent_notice text DEFAULT '',
  ADD COLUMN IF NOT EXISTS gallery_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS seo_title text DEFAULT '',
  ADD COLUMN IF NOT EXISTS seo_description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS confirmation_message_en text DEFAULT '',
  ADD COLUMN IF NOT EXISTS confirmation_message_am text DEFAULT '',
  ADD COLUMN IF NOT EXISTS confirmation_email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminder_days integer,
  ADD COLUMN IF NOT EXISTS terms_en text DEFAULT '',
  ADD COLUMN IF NOT EXISTS terms_am text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancellation_policy_en text DEFAULT '',
  ADD COLUMN IF NOT EXISTS cancellation_policy_am text DEFAULT '';

-- Clean up the temporary column from earlier attempts of this migration.
ALTER TABLE public.experiences DROP COLUMN IF EXISTS kind_new;

-- registrations: add optional extended columns (legacy NOT NULL receipt_id stays untouched)
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS ticket_type text DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'ETB',
  ADD COLUMN IF NOT EXISTS answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS checked_in_by text,
  ADD COLUMN IF NOT EXISTS reference_code text,
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS status text;

CREATE UNIQUE INDEX IF NOT EXISTS registrations_reference_code_idx
  ON public.registrations (reference_code)
  WHERE reference_code IS NOT NULL;

-- Backfill human-readable reference codes for existing rows.
UPDATE public.registrations
SET reference_code = 'PLX-' || upper(substring(md5(random()::text) from 1 for 6))
WHERE reference_code IS NULL;

-- Audit log
CREATE TABLE IF NOT EXISTS public.registration_activity (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  registration_id bigint REFERENCES public.registrations(id) ON DELETE CASCADE,
  experience_id bigint,
  admin_email text,
  action text NOT NULL,
  detail text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registration_activity_reg_idx
  ON public.registration_activity (registration_id);
-- Store the price as the registration amount so dashboard revenue is accurate.
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
  registration_price numeric(10,2);
  registration_currency text;
BEGIN
  SELECT capacity, price, currency INTO selected_capacity, registration_price, registration_currency
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
    preferred_channel, payment_reference, check_in_token,
    amount, currency
  ) VALUES (
    p_experience_id, receipt_id, p_full_name, p_email, p_phone,
    p_preferred_channel, p_payment_reference, p_check_in_token::uuid,
    COALESCE(registration_price, 0), COALESCE(registration_currency, 'ETB')
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
