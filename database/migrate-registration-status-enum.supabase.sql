-- Run this separately in the Supabase SQL Editor and wait for it to commit
-- before running migrate-registrations-v2.supabase.sql.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'publish_status'
  ) THEN
    ALTER TYPE public.publish_status ADD VALUE IF NOT EXISTS 'unpublished';
  END IF;
END $$;
