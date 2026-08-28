-- ─── Product Review Media: image/video attachments on product_reviews ──────
-- Same shape as comment_media (see add_comment_media_gallery_support.sql) —
-- one row per attached image/video, ordered by `position`, sharing the
-- parent review's own `text` as a single caption rather than per-item
-- captions. Voice notes are intentionally out of scope here (unlike
-- comments) — reviews are rating + comment + photos/videos of the product,
-- not a second voice-message surface.

CREATE TABLE IF NOT EXISTS public.product_review_media (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id      UUID        NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  media_url      TEXT        NOT NULL,
  media_type     TEXT        NOT NULL CHECK (media_type IN ('image', 'video')),
  media_duration INTEGER,
  position       INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_review_media_review_id ON public.product_review_media (review_id, position);

ALTER TABLE public.product_review_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_product_review_media"
  ON public.product_review_media FOR SELECT
  USING (true);

-- Insert/delete authorized by ownership of the parent review, not a
-- separate user_id column on this table itself (same pattern as
-- comment_media's ownership-via-parent policies).
CREATE POLICY "owner_can_insert_review_media"
  ON public.product_review_media FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_reviews r
      WHERE r.id = review_id AND r.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "owner_can_delete_review_media"
  ON public.product_review_media FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.product_reviews r
      WHERE r.id = review_id AND r.user_id = (SELECT auth.uid())
    )
  );

-- Storage buckets — separate from comment media's own buckets, same public
-- read / authenticated write shape.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('review-images', 'review-images', true),
  ('review-videos', 'review-videos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload review images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read review images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own review images" ON storage.objects;

CREATE POLICY "Users can upload review images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'review-images');

CREATE POLICY "Users can read review images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'review-images');

CREATE POLICY "Users can delete their own review images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'review-images');

DROP POLICY IF EXISTS "Users can upload review videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can read review videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own review videos" ON storage.objects;

CREATE POLICY "Users can upload review videos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'review-videos');

CREATE POLICY "Users can read review videos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'review-videos');

CREATE POLICY "Users can delete their own review videos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'review-videos');
