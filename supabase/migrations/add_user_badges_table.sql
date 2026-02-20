-- ============================================================
-- user_badges Table
-- ============================================================
-- Explicitly stores every badge a user has earned, together
-- with the skin (appearance) they have chosen for that badge.
--
-- badge_id values (no enum — adding new badges = no schema change):
--   'founding'        — waitlisted + early signup  (most exclusive)
--   'waitlist'        — on the waitlist
--   'tester'          — signed up before Feb 28 2026
--   'fire_horse_2026' — (future) Fire Horse Year celebration badge
--   'genesis'          — on waitlist OR signed up early (union of both)
--
-- Natural badge counts per user:
--   4 rows — founding members (waited + early signup):
--            founding + waitlist + tester + genesis
--   2 rows — waitlist-only: waitlist + genesis
--   2 rows — early-signup only: tester + genesis
--   Admins can manually INSERT extra rows to grant additional badges.
--
-- Each badge renders with its own fixed appearance — no skin switching.
-- The user's chosen profile badge is tracked in profiles.active_badge_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id  TEXT        NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);

-- ── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read any user's badges (needed for profile display)
CREATE POLICY "Authenticated users can view badges"
  ON public.user_badges FOR SELECT TO authenticated USING (true);

-- Anon can read too (for public profile pages)
CREATE POLICY "Anon users can view badges"
  ON public.user_badges FOR SELECT TO anon USING (true);

-- Only the service role can INSERT / DELETE rows (badge grants)
CREATE POLICY "Service role can manage badges"
  ON public.user_badges FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Backfill existing users ──────────────────────────────────────────────────
-- Founding members (on waitlist AND early signup) receive three badge rows:
--   founding, waitlist, tester
-- Waitlist-only members receive: waitlist
-- Early-signup-only members receive: tester
-- Safe to re-run (ON CONFLICT DO NOTHING).

-- 1. founding badge  — waitlisted + signed up before Feb 28 2026
INSERT INTO public.user_badges (user_id, badge_id, earned_at)
SELECT p.id, 'founding', p.created_at
FROM   public.profiles p
WHERE  p.created_at < '2026-02-28 00:00:00+00'::timestamptz
  AND  EXISTS (
         SELECT 1 FROM public.waitlist w
         WHERE LOWER(w.email) = LOWER(p.email)
       )
ON CONFLICT DO NOTHING;

-- 2. waitlist badge  — everyone on the waitlist (including founding members)
INSERT INTO public.user_badges (user_id, badge_id, earned_at)
SELECT p.id, 'waitlist', p.created_at
FROM   public.profiles p
WHERE  EXISTS (
         SELECT 1 FROM public.waitlist w
         WHERE LOWER(w.email) = LOWER(p.email)
       )
ON CONFLICT DO NOTHING;

-- 3. tester badge  — everyone who signed up before Feb 28 2026 (including founding members)
INSERT INTO public.user_badges (user_id, badge_id, earned_at)
SELECT p.id, 'tester', p.created_at
FROM   public.profiles p
WHERE  p.created_at < '2026-02-28 00:00:00+00'::timestamptz
ON CONFLICT DO NOTHING;

-- 4. genesis badge  — waitlisted OR signed up before Feb 28 2026 (union of both groups)
INSERT INTO public.user_badges (user_id, badge_id, earned_at)
SELECT p.id, 'genesis', p.created_at
FROM   public.profiles p
WHERE  p.created_at < '2026-02-28 00:00:00+00'::timestamptz
   OR  EXISTS (
         SELECT 1 FROM public.waitlist w
         WHERE LOWER(w.email) = LOWER(p.email)
       )
ON CONFLICT DO NOTHING;

-- ── Active badge for profile display ────────────────────────────────────────
-- Adds active_badge_id to profiles so users can choose which badge to display.
-- Backfills to the highest-priority badge each user already owns.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_badge_id TEXT;

UPDATE public.profiles p
SET    active_badge_id = (
  SELECT ub.badge_id
  FROM   public.user_badges ub
  WHERE  ub.user_id = p.id
    AND  ub.badge_id IN ('founding','waitlist','tester','genesis')
  ORDER BY
    CASE ub.badge_id
      WHEN 'founding' THEN 1
      WHEN 'waitlist' THEN 2
      WHEN 'tester'   THEN 3
      WHEN 'genesis'  THEN 4
    END
  LIMIT 1
)
WHERE active_badge_id IS NULL;

