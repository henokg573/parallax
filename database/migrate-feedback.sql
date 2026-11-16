-- Post-event feedback collection
-- Run in the Supabase SQL editor (or psql).

CREATE TABLE IF NOT EXISTS public.feedback (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  experience_id BIGINT REFERENCES public.experiences (id) ON DELETE SET NULL,
  full_name TEXT,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message TEXT NOT NULL DEFAULT '',
  photo_path TEXT,
  photo_name TEXT,
  document_path TEXT,
  document_name TEXT,
  voice_path TEXT,
  voice_duration_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_created_idx ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_experience_idx ON public.feedback (experience_id);

-- Allow anonymous submissions from the public feedback page (RLS).
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_public_insert" ON public.feedback;
CREATE POLICY "feedback_public_insert" ON public.feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (rating BETWEEN 1 AND 5);

-- Only the service-role client (admin pages) should read feedback.
DROP POLICY IF EXISTS "feedback_public_read" ON public.feedback;
CREATE POLICY "feedback_public_read" ON public.feedback
  FOR SELECT TO authenticated
  USING (true);

-- Private storage bucket for feedback uploads (photos, documents, voice).
INSERT INTO storage.buckets (id, name, public)
VALUES ('parallax-feedback', 'parallax-feedback', false)
ON CONFLICT (id) DO NOTHING;

-- Anyone can upload a file to the feedback bucket (anonymous submissions).
DROP POLICY IF EXISTS "feedback_public_upload" ON storage.objects;
CREATE POLICY "feedback_public_upload" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'parallax-feedback');

-- Admins read via the service-role key, which bypasses RLS; no read policy needed.
