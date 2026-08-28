-- ─── Product Reviews: star rating + comment, one per user per product ──────
-- Adds:
--   product_reviews              — one row per (product, reviewer), editable
--   products.average_rating      — denormalized, trigger-maintained
--   products.review_count        — denormalized, trigger-maintained
--   'product_reviewed' notification type

-- ─── 1. product_reviews table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_reviews_unique_per_user UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id    ON public.product_reviews (user_id);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Reviews are public read (same as comments) — anyone can see what's been
-- said about a product, no auth required.
CREATE POLICY "anyone_can_read_product_reviews"
  ON public.product_reviews FOR SELECT
  USING (true);

CREATE POLICY "authenticated_can_insert_own_review"
  ON public.product_reviews FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_can_update_own_review"
  ON public.product_reviews FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_can_delete_own_review"
  ON public.product_reviews FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- ─── 2. Denormalized average_rating/review_count on products ───────────
-- Mirrors the posts.view_count pattern in engagement_tracking.sql — kept in
-- sync by trigger so list/grid screens can show a star badge without a join.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS average_rating NUMERIC(2,1) NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_count   INTEGER     NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.recalc_product_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_product_id UUID := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE public.products p SET
    average_rating = COALESCE(
      (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.product_reviews WHERE product_id = target_product_id),
      0
    ),
    review_count = (SELECT COUNT(*) FROM public.product_reviews WHERE product_id = target_product_id)
  WHERE p.id = target_product_id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS product_reviews_recalc_rating ON public.product_reviews;
CREATE TRIGGER product_reviews_recalc_rating
  AFTER INSERT OR UPDATE OF rating OR DELETE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.recalc_product_rating();

-- ─── 3. 'product_reviewed' notification type ────────────────────────────
-- Full value list carried forward from the latest prior edit
-- (20260806130000_create_stories.sql), plus this new one.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'new_follower',
      'post_liked',
      'post_commented',
      'user_went_live',
      'new_post',
      'mongoose_booking_request',
      'follower_milestone',
      'post_traction',
      'weekly_engagement',
      'new_story',
      'product_reviewed'
    ));
