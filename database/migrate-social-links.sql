CREATE TABLE IF NOT EXISTS public.social_links (
  platform TEXT PRIMARY KEY CHECK (platform IN ('telegram', 'whatsapp', 'linkedin', 'tiktok', 'instagram', 'youtube', 'x', 'snapchat')),
  url TEXT NOT NULL DEFAULT '',
  visible BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.social_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read visible social links" ON public.social_links;
CREATE POLICY "Public can read visible social links"
  ON public.social_links FOR SELECT
  USING (visible = TRUE);

DROP POLICY IF EXISTS "Server manages social links" ON public.social_links;
CREATE POLICY "Server manages social links"
  ON public.social_links FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

INSERT INTO public.social_links (platform)
VALUES ('telegram'), ('whatsapp'), ('linkedin'), ('tiktok'), ('instagram'), ('youtube'), ('x'), ('snapchat')
ON CONFLICT (platform) DO NOTHING;
