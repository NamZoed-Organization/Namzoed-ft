-- ─── Product Review Voice Notes ─────────────────────────────────────────
-- Singular voice note directly on product_reviews (media_url/media_type/
-- media_duration), same shape as post_comments' own voice-note columns
-- (see add_comment_media_gallery_support.sql) — one optional voice note per
-- review, separate from the image/video gallery in product_review_media.

ALTER TABLE public.product_reviews
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT,
ADD COLUMN IF NOT EXISTS media_duration INTEGER;

ALTER TABLE public.product_reviews
DROP CONSTRAINT IF EXISTS product_reviews_media_type_check;
ALTER TABLE public.product_reviews
ADD CONSTRAINT product_reviews_media_type_check
CHECK (media_type IS NULL OR media_type = 'audio');

CREATE INDEX IF NOT EXISTS idx_product_reviews_media_url ON public.product_reviews (media_url) WHERE media_url IS NOT NULL;

-- Storage bucket for review voice notes.
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-audio', 'review-audio', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload review audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can read review audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own review audio" ON storage.objects;

CREATE POLICY "Users can upload review audio"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'review-audio');

CREATE POLICY "Users can read review audio"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'review-audio');

CREATE POLICY "Users can delete their own review audio"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'review-audio');
