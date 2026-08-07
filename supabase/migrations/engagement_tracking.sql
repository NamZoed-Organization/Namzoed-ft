-- ─── Engagement Tracking: View counts, profile views, and milestone notifications ───────
-- Adds:
--   post_views             — one row per viewer per post per day (deduplicated)
--   profile_views          — one row per visitor per profile per day (deduplicated)
--   posts.view_count       — denormalized, maintained by trigger
--   posts.traction_notif_sent_at — prevents duplicate post-traction notifications
--   follower_milestone_notifications — dedup table for milestone push sends
--   New notification types in the CHECK constraint
--   Two aggregate RPC functions for the weekly edge function
--   pg_cron jobs for weekly digest and daily traction check

-- ─── 1. Extend notifications type CHECK constraint ──────────────────────────────────────

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'new_follower',
      'post_liked',
      'post_commented',
      'user_went_live',
      'new_post',
      'mongoose_booking_request',
      'follower_milestone',
      'post_traction',
      'weekly_engagement'
    ));

-- ─── 2. post_views table ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.post_views (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID        NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  viewer_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_views_unique_daily UNIQUE (post_id, viewer_id, viewed_date)
);

CREATE INDEX IF NOT EXISTS idx_post_views_post_id      ON public.post_views (post_id);
CREATE INDEX IF NOT EXISTS idx_post_views_post_date    ON public.post_views (post_id, viewed_date DESC);
CREATE INDEX IF NOT EXISTS idx_post_views_viewer_id    ON public.post_views (viewer_id);

ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;

-- Post owner can read view records for their own posts
CREATE POLICY "post_owner_can_read_views"
  ON public.post_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_id AND p.user_id = (SELECT auth.uid())
    )
  );

-- Any authenticated user can insert their own view (self-view guard is in the service layer)
CREATE POLICY "authenticated_can_insert_post_view"
  ON public.post_views FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = viewer_id);

-- ─── 3. profile_views table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profile_views (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewer_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profile_views_unique_daily UNIQUE (profile_id, viewer_id, viewed_date)
);

CREATE INDEX IF NOT EXISTS idx_profile_views_profile_id   ON public.profile_views (profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_profile_date ON public.profile_views (profile_id, viewed_date DESC);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

-- Profile owner can read their own view stats
CREATE POLICY "profile_owner_can_read_views"
  ON public.profile_views FOR SELECT
  USING (profile_id = (SELECT auth.uid()));

-- Any authenticated user can insert their own view
CREATE POLICY "authenticated_can_insert_profile_view"
  ON public.profile_views FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = viewer_id);

-- ─── 4. Denormalized view_count on posts ────────────────────────────────────────────────

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS traction_notif_sent_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_view_count ON public.posts (view_count DESC);

-- ─── 5. Auto-increment trigger on post_views ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_post_view_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.posts
  SET view_count = view_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_post_view_count ON public.post_views;
CREATE TRIGGER trg_increment_post_view_count
  AFTER INSERT ON public.post_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_post_view_count();

-- ─── 6. Follower milestone dedup table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.follower_milestone_notifications (
  user_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  milestone INTEGER     NOT NULL,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, milestone)
);

ALTER TABLE public.follower_milestone_notifications ENABLE ROW LEVEL SECURITY;
-- No client-side policies — accessed only via service role in the notification builders

-- ─── 7. Aggregate RPC functions for the weekly edge function ───────────────────────────
-- Both are SECURITY DEFINER so the edge function (service role) can call them via rpc()

CREATE OR REPLACE FUNCTION public.get_weekly_post_view_summary(since_date DATE)
RETURNS TABLE(post_owner_id UUID, total_views BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT p.user_id AS post_owner_id, COUNT(pv.id) AS total_views
  FROM public.post_views pv
  JOIN public.posts p ON p.id = pv.post_id
  WHERE pv.viewed_date >= since_date
  GROUP BY p.user_id
  HAVING COUNT(pv.id) > 0;
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_profile_view_summary(since_date DATE)
RETURNS TABLE(profile_id UUID, total_views BIGINT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT prv.profile_id, COUNT(prv.id) AS total_views
  FROM public.profile_views prv
  WHERE prv.viewed_date >= since_date
  GROUP BY prv.profile_id
  HAVING COUNT(prv.id) > 0;
$$;

-- ─── 8. pg_cron scheduled jobs ──────────────────────────────────────────────────────────
-- Requires pg_cron and pg_net extensions (both available on Supabase)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Job 1: Weekly engagement digest — every Monday at 9:00 AM UTC
SELECT cron.schedule(
  'send-weekly-engagement-summary',
  '0 9 * * 1',
  $$
  SELECT net.http_post(
    url     := current_setting('supabase.functions.url') || '/send-engagement-summary',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type',  'application/json'
    ),
    body    := '{"mode":"weekly_engagement"}'::jsonb
  );
  $$
);

-- Job 2: Post traction check — every day at 10:00 AM UTC
SELECT cron.schedule(
  'send-post-traction-notifications',
  '0 10 * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('supabase.functions.url') || '/send-engagement-summary',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type',  'application/json'
    ),
    body    := '{"mode":"post_traction"}'::jsonb
  );
  $$
);
