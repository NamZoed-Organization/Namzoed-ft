-- ============================================================
-- Backfill all 4 early-access badges for specific users
-- ============================================================
-- Inserts founding, genesis, tester, waitlist badges for the
-- listed emails.  Uses INSERT ... ON CONFLICT DO NOTHING so
-- existing rows are never touched / duplicated.
-- ============================================================

INSERT INTO public.user_badges (user_id, badge_id, earned_at)
SELECT
  p.id,
  b.badge_id,
  NOW()
FROM public.profiles p
CROSS JOIN (
  VALUES
    ('founding'),
    ('genesis'),
    ('tester'),
    ('waitlist')
) AS b(badge_id)
WHERE LOWER(p.email) IN (
  'astupidlostpoet9@gmail.com',
  'daigakumobu@gmail.com',
  'sonamd5dorji@gmail.com',
  'dragonthunder0127@gmail.com',
  'sujal75.n@gmail.com'
)
ON CONFLICT (user_id, badge_id) DO NOTHING;

-- Also set active_badge_id to 'founding' (most exclusive) for any of these
-- users whose active_badge_id is still NULL after the insert above.
UPDATE public.profiles
SET    active_badge_id = 'founding'
WHERE  active_badge_id IS NULL
  AND  LOWER(email) IN (
         'astupidlostpoet9@gmail.com',
         'daigakumobu@gmail.com',
         'sonamd5dorji@gmail.com',
         'dragonthunder0127@gmail.com',
         'sujal75.n@gmail.com'
       );
