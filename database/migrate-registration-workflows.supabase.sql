-- Run this migration in the Supabase SQL editor for an existing project.
-- It is intentionally separate from migrate-registration-workflows.sql, which
-- targets the legacy MySQL/MariaDB schema used by the local db:init script.

ALTER TABLE public.experiences
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS resource_url text,
  ADD COLUMN IF NOT EXISTS resource_id bigint REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS preferred_channel text NOT NULL DEFAULT 'email';

ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_preferred_channel_check;

ALTER TABLE public.registrations
  ADD CONSTRAINT registrations_preferred_channel_check
  CHECK (preferred_channel IN ('email', 'phone', 'whatsapp', 'telegram'));

INSERT INTO storage.buckets (id, name, public)
VALUES ('parallax-receipts', 'parallax-receipts', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Public registration receipt uploads" ON storage.objects;

CREATE POLICY "Public registration receipt uploads"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'parallax-receipts');

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
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.create_public_registration(
  bigint, text, text, text, bigint, text, text, text, text, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_public_registration(
  bigint, text, text, text, bigint, text, text, text, text, text, text
) TO anon, authenticated;