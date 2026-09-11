-- ============================================================
-- Per-user notification preferences
-- ============================================================
-- One JSONB blob rather than a column per switch: the set of notification
-- types this app sends changes as features land, and adding a key to a blob
-- doesn't need a migration each time.
--
-- Shape (all optional, missing means "on"):
--   {
--     "enabled":       true,   -- master switch; false silences everything
--     "likes_saves":   true,
--     "followers":     true,
--     "comments":      true,
--     "messages":      true,
--     "shares":        true
--   }
--
-- Run this once against your Supabase project (SQL Editor or CLI).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
