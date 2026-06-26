-- Per-user "Safe View" preference. ON by default: mature (sensitive / 18+)
-- content is hidden from the feed and never recommended. Only verified adults
-- can turn it off (enforced in the app UI).
-- Safe to run multiple times.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS safe_view boolean DEFAULT true;

-- Backfill any existing rows that predate the column.
UPDATE public.profiles SET safe_view = true WHERE safe_view IS NULL;

-- NOTE: the content-rating / moderation columns (content_rating,
-- moderation_status, birth_date, age_verified, ...) used by this feature are
-- created by add_moderation_to_posts.sql — apply that migration too if it has
-- not already been run.
