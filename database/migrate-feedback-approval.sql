-- Feedback moderation: admins approve feedback to feature it on the public site.
-- Run in the Supabase SQL editor (or psql).

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by BIGINT REFERENCES public.admins (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS feedback_approved_idx ON public.feedback (approved, created_at DESC);

-- Public readers (anon) may read only approved feedback for the homepage wall.
DROP POLICY IF EXISTS "feedback_public_read_approved" ON public.feedback;
CREATE POLICY "feedback_public_read_approved" ON public.feedback
  FOR SELECT TO anon
  USING (approved = TRUE);

-- Existing policy for authenticated admin reads stays in place.
