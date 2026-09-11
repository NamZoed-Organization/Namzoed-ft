-- ============================================================
-- Add birthday display preferences to profiles
-- ============================================================
-- `birth_date` already exists (collected at signup / by the age prompt) but
-- it is private: it drives age-gating, and is never shown to anyone.
--
-- These two columns let a user opt into showing *something* about their
-- birthday on their profile without ever exposing the date itself:
--
--   show_birthday      false by default — nothing is shown unless the user
--                      turns it on for themselves.
--   birthday_display   what is shown when it's on:
--                        'age'    -> whole-years age, e.g. "24"
--                        'animal' -> Bhutanese/Tibetan animal year, e.g.
--                                    "Dragon" (leaks only the birth year)
--                        'sun'    -> Western sun sign, e.g. "Gemini"
--
-- The choice is stored separately from the on/off switch so turning the
-- toggle off and back on remembers what the user had picked.
--
-- Run this once against your Supabase project (SQL Editor or CLI).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_birthday BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birthday_display TEXT NOT NULL DEFAULT 'age';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_birthday_display_valid'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_birthday_display_valid
      CHECK (birthday_display IN ('age', 'animal', 'sun'));
  END IF;
END $$;
