-- ============================================================
-- Remember that a user declined the date-of-birth prompt
-- ============================================================
-- The login flow shows an optional date-of-birth prompt to anyone whose
-- profile has no `birth_date`. "Skip for now" was only ever recorded on the
-- in-memory user object, so the next login refetched the profile, found the
-- flag gone, and asked again — every single time.
--
-- Persisting it means declining is respected until the user sets a birthday
-- themselves (Edit Profile -> Birthday), which clears nothing: having a
-- birth_date is what stops the prompt from then on.
--
-- Run this once against your Supabase project (SQL Editor or CLI).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dob_prompt_skipped BOOLEAN NOT NULL DEFAULT false;
