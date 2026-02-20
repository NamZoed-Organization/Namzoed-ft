-- ============================================================
-- Add active_badge_id column to profiles
-- ============================================================
-- Allows users to choose which early-access badge is displayed
-- on their profile.  The value mirrors the badge_id values in
-- the user_badges table ('founding', 'waitlist', 'tester', 'genesis').
-- Run this once against your Supabase project (SQL Editor or CLI).
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_badge_id TEXT;

-- Back-fill: set active_badge_id to the user's most exclusive badge
-- for anyone who already has a badge but no explicit choice yet.
UPDATE public.profiles p
SET    active_badge_id = (
  SELECT ub.badge_id
    FROM public.user_badges ub
   WHERE ub.user_id = p.id
     AND ub.badge_id IN ('founding', 'waitlist', 'tester', 'genesis')
   ORDER BY
     CASE ub.badge_id
       WHEN 'founding' THEN 1
       WHEN 'genesis'  THEN 2
       WHEN 'waitlist' THEN 3
       WHEN 'tester'   THEN 4
       ELSE 5
     END
   LIMIT 1
)
WHERE p.active_badge_id IS NULL;
