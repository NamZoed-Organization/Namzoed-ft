-- ─── Stories: 24h ephemeral posts, visible to followers ─────────────────────
-- Adds:
--   stories           — one row per story, hard-deleted ~24h after posting
--   stories_active     — real-time-computed view (mirrors products_with_discounts)
--   story_views        — one row per viewer per story (dedup by unique constraint)
--   stories.view_count — denormalized, maintained by trigger
--   stories storage bucket + RLS
--   pg_cron jobs: trigger Storage purge, then hard-delete purged rows
--   New 'new_story' notification type in the CHECK constraint

-- ─── 1. stories table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stories (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url          TEXT        NOT NULL,
  width              INTEGER,
  height             INTEGER,
  tagged_product_id  UUID        REFERENCES public.products(id) ON DELETE SET NULL,
  tagged_account_id  UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  content_rating     TEXT        NOT NULL DEFAULT 'general'
                        CHECK (content_rating IN ('general', 'sensitive', '18_plus', 'review_required')),
  moderation_status  TEXT        NOT NULL DEFAULT 'approved'
                        CHECK (moderation_status IN ('approved', 'pending_review', 'rejected')),
  moderation_notes   TEXT,
  view_count         INTEGER     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Set by the Storage-purge edge function once the media object has been
  -- removed. NULL means the media (if any) hasn't been purged yet — the
  -- hard-delete cron job waits for this so it never orphans a Storage file.
  purged_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_stories_user_created   ON public.stories (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_created_at     ON public.stories (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_tagged_product ON public.stories (tagged_product_id) WHERE tagged_product_id IS NOT NULL;

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read approved, non-expired stories (the
-- stories_active view + hard-delete cron also enforce expiry — this is
-- belt-and-braces in case the view is bypassed).
CREATE POLICY "authenticated_can_read_active_stories"
  ON public.stories FOR SELECT
  TO authenticated
  USING (
    moderation_status = 'approved'
    AND NOW() < created_at + INTERVAL '24 hours'
  );

-- Owner can always read their own stories (including pending_review/rejected).
CREATE POLICY "owner_can_read_own_stories"
  ON public.stories FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "user_can_insert_own_story"
  ON public.stories FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "user_can_delete_own_story"
  ON public.stories FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- ─── 2. stories_active view (real-time expiry calculation) ──────────────

CREATE OR REPLACE VIEW public.stories_active AS
SELECT
  s.*,
  (NOW() > s.created_at + INTERVAL '24 hours') AS is_expired,
  (s.created_at + INTERVAL '24 hours')          AS expires_at
FROM public.stories s
WHERE s.moderation_status = 'approved'
  AND NOW() < s.created_at + INTERVAL '24 hours';

COMMENT ON VIEW public.stories_active IS
  'Non-expired, approved stories with real-time computed expiry. Use this view for all story feed queries.';

GRANT SELECT ON public.stories_active TO authenticated;

-- ─── 3. story_views table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.story_views (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id    UUID        NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A story only lives 24h, so one view record per viewer per story (no
  -- daily dedup component, unlike post_views) is the correct "seen" semantics.
  CONSTRAINT story_views_unique UNIQUE (story_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_story_views_story_id  ON public.story_views (story_id);
CREATE INDEX IF NOT EXISTS idx_story_views_viewer_id ON public.story_views (viewer_id);

ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Story owner can read who viewed their story
CREATE POLICY "owner_can_read_story_views"
  ON public.story_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_id AND s.user_id = (SELECT auth.uid())
    )
  );

-- Viewer can read their own view rows (used to hydrate "already seen" state
-- across sessions).
CREATE POLICY "viewer_can_read_own_story_views"
  ON public.story_views FOR SELECT
  USING (viewer_id = (SELECT auth.uid()));

-- Any authenticated user can insert their own view (self-view guard is in
-- the service layer, matching post_views' convention).
CREATE POLICY "authenticated_can_insert_story_view"
  ON public.story_views FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (SELECT auth.uid()) = viewer_id);

CREATE OR REPLACE FUNCTION increment_story_view_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.stories
  SET view_count = view_count + 1
  WHERE id = NEW.story_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_increment_story_view_count ON public.story_views;
CREATE TRIGGER trg_increment_story_view_count
  AFTER INSERT ON public.story_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_story_view_count();

-- ─── 4. stories storage bucket + RLS ──────────────────────────────────────
-- Path convention: ${userId}/${Date.now()}_${rand}.jpg

INSERT INTO storage.buckets (id, name, public)
VALUES ('stories', 'stories', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own story images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'stories' AND
  (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

CREATE POLICY "Users can delete their own story images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'stories' AND
  (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

-- The purge edge function runs as the service role, which bypasses RLS, so
-- no separate service-role delete policy is needed here.

CREATE POLICY "Public can view story images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'stories');

-- ─── 5. Expiry cleanup: hard-delete rows once media has been purged ──────

CREATE OR REPLACE FUNCTION cleanup_expired_stories()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.stories
  WHERE created_at + INTERVAL '24 hours' < NOW()
    AND purged_at IS NOT NULL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_stories() IS
  'Hard-deletes expired story rows whose Storage media has already been purged. Returns count of deleted stories.';

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Job 1: trigger the Storage-purge edge function every 10 minutes
SELECT cron.schedule(
  'purge-expired-story-media',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('supabase.functions.url') || '/purge-expired-stories',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Job 2: hard-delete rows whose media has already been purged, offset 2min
-- after job 1 so the purge has a head start each cycle.
SELECT cron.schedule(
  'cleanup-expired-stories',
  '2-59/10 * * * *',
  $$SELECT cleanup_expired_stories();$$
);

-- ─── 6. Extend notifications type CHECK constraint ───────────────────────

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
      'weekly_engagement',
      'new_story'
    ));
