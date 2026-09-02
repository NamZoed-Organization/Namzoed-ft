-- ============================================================
-- Add namzoed_id column to profiles
-- ============================================================
-- A human-friendly, unique public identifier shown as "NamZoed ID:"
-- on the profile screen (replaces showing the raw UUID `id`).
--
-- Format: <4-letter word prefix><4-char suffix>
--   - The word prefix is chosen at random from a fixed word list.
--   - The suffix is 4 hex characters lifted from the user's own UUID
--     `id` (stripped of dashes, uppercased), which is what actually
--     keeps the id unique per user — the prefix alone repeats across
--     many users.
--   - If that particular 4-char window of the UUID is already taken
--     by someone else (rare, but possible), the generator slides
--     further along the same UUID's hex digits before falling back
--     to a random alnum suffix as a last resort.
--
-- Run this once against your Supabase project (SQL Editor or CLI).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS namzoed_id TEXT UNIQUE;

-- ------------------------------------------------------------
-- Shared generator function — used for both the one-off backfill
-- below and the trigger that assigns an id to every new signup.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_namzoed_id(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  prefixes TEXT[] := ARRAY[
    'ngam','shaw','shat','yakc','khad','seng','zhag','durd','shin','raks',
    'tung','drak','ging','tsho','atsa','pach','drom','tshe','phol','choe',
    'tshe','garc','lham','dhar','ngac','cham','dru2','tsan','lung','chue'
  ];
  hex_id TEXT := replace(user_id::text, '-', '');
  suffix TEXT;
  candidate TEXT;
  offset_pos INT := 1;
BEGIN
  LOOP
    suffix := upper(substring(hex_id FROM offset_pos FOR 4));
    IF length(suffix) < 4 THEN
      suffix := lpad(suffix, 4, '0');
    END IF;

    candidate := prefixes[1 + floor(random() * array_length(prefixes, 1))::int] || suffix;

    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE namzoed_id = candidate);

    offset_pos := offset_pos + 4;
    IF offset_pos > length(hex_id) - 3 THEN
      -- Exhausted the UUID's hex digits (astronomically unlikely) —
      -- fall back to a fully random alnum suffix.
      suffix := upper(substr(md5(random()::text || user_id::text), 1, 4));
      candidate := prefixes[1 + floor(random() * array_length(prefixes, 1))::int] || suffix;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE namzoed_id = candidate);
      offset_pos := 1; -- keep sliding/retrying with fresh random fallbacks
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Backfill existing users that don't have one yet.
-- ------------------------------------------------------------
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.profiles WHERE namzoed_id IS NULL LOOP
    UPDATE public.profiles
    SET namzoed_id = public.generate_namzoed_id(rec.id)
    WHERE id = rec.id;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- Auto-assign a namzoed_id for every future signup.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_namzoed_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.namzoed_id IS NULL THEN
    NEW.namzoed_id := public.generate_namzoed_id(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_namzoed_id ON public.profiles;
CREATE TRIGGER trg_set_namzoed_id
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_namzoed_id();
