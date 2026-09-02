-- ============================================================
-- Add bio and cover_image_url columns to profiles
-- ============================================================
-- Optional profile-revamp fields: a short user bio and a
-- background/cover image shown behind the avatar. Both are nullable —
-- the UI falls back to a default gradient when cover_image_url is unset.
-- Run this once against your Supabase project (SQL Editor or CLI).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
