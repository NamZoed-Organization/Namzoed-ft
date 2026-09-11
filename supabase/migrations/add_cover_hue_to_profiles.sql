-- ============================================================
-- Add cover_hue column to profiles
-- ============================================================
-- The profile cover/header gradient and matte tint are all derived
-- from a single hue (see lib/coverTheme.ts). That hue used to be
-- recomputed on every render: a deterministic hash of the user id
-- first, then — a moment later, once react-native-image-colors had
-- fetched and decoded the cover photo — the photo's dominant hue.
-- The visible result was the profile loading in one color and then
-- swapping to another.
--
-- Storing the hue makes it a property of the profile instead:
--   - every profile gets a random hue from a curated list at signup
--     (trigger below), so profiles without a cover photo still differ
--     from each other,
--   - uploading a cover photo overwrites it with the hue extracted
--     from that photo, saved in the same update as cover_image_url,
--   - removing the cover photo rolls a fresh random hue.
-- The client reads it straight from the profile row, so the first
-- paint is already the final color.
--
-- Run this once against your Supabase project (SQL Editor or CLI).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_hue SMALLINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_cover_hue_range'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_cover_hue_range
      CHECK (cover_hue IS NULL OR (cover_hue >= 0 AND cover_hue < 360));
  END IF;
END $$;

-- ------------------------------------------------------------
-- Random hue picker — the same curated list as FALLBACK_HUES in
-- lib/coverTheme.ts. Saturation/lightness are re-applied by the
-- client's own formula, so any hue on the wheel stays dark and
-- matte; the list just keeps them spread out instead of clustered.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.random_cover_hue()
RETURNS SMALLINT AS $$
DECLARE
  hues SMALLINT[] := ARRAY[200, 260, 160, 20, 320, 40, 280, 140];
BEGIN
  RETURN hues[1 + floor(random() * array_length(hues, 1))::int];
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Backfill. Profiles that already have a cover photo are left NULL
-- on purpose: a random hue would clash with their photo, so the app
-- extracts the real hue the first time that profile's owner opens
-- their profile and saves it then.
-- ------------------------------------------------------------
UPDATE public.profiles
SET cover_hue = public.random_cover_hue()
WHERE cover_hue IS NULL
  AND (cover_image_url IS NULL OR cover_image_url = '');

-- ------------------------------------------------------------
-- Auto-assign a hue for every future signup.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_cover_hue()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cover_hue IS NULL AND NEW.cover_image_url IS NULL THEN
    NEW.cover_hue := public.random_cover_hue();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_cover_hue ON public.profiles;
CREATE TRIGGER trg_set_cover_hue
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cover_hue();
