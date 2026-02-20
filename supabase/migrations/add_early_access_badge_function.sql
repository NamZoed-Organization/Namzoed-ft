-- ============================================================
-- Early Access Badge Function
-- ============================================================
-- Determines the badge tier for a user based on:
--   1. Whether their email appears in the `waitlist` table.
--   2. Whether their profile was created before Feb 28 2026 (early tester cutoff).
--
-- Badge tiers (most → least exclusive):
--   "founding"  — waitlisted AND an early tester (both conditions met)
--   "waitlist"  — waitlisted only
--   "tester"    — early tester only (profile created_at < 2026-02-28)
--   NULL        — no badge

CREATE OR REPLACE FUNCTION public.get_early_access_badge(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email       TEXT;
  v_on_waitlist BOOLEAN := FALSE;
  v_is_tester   BOOLEAN := FALSE;
BEGIN
  -- 1. Retrieve email from the profiles table
  SELECT email
    INTO v_email
    FROM profiles
   WHERE id = p_user_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN NULL;
  END IF;

  -- 2. Check waitlist (case-insensitive; ignore if table doesn't exist)
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM waitlist WHERE LOWER(email) = LOWER(v_email)
    ) INTO v_on_waitlist;
  EXCEPTION WHEN OTHERS THEN
    v_on_waitlist := FALSE;
  END;

  -- 3. Check early-tester cutoff (profiles created before Feb 28 2026)
  SELECT EXISTS (
    SELECT 1
      FROM profiles
     WHERE id = p_user_id
       AND created_at < '2026-02-28 00:00:00+00'::timestamptz
  ) INTO v_is_tester;

  -- 4. Return the correct badge tier
  IF v_on_waitlist AND v_is_tester THEN
    RETURN 'founding';
  ELSIF v_on_waitlist THEN
    RETURN 'waitlist';
  ELSIF v_is_tester THEN
    RETURN 'tester';
  ELSE
    RETURN NULL;
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- Grant call permission to both authenticated users and anon role
GRANT EXECUTE ON FUNCTION public.get_early_access_badge(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_early_access_badge(UUID) TO anon;
