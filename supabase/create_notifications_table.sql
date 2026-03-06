-- ============================================================
-- notifications table  —  run this in Supabase SQL Editor
-- ============================================================

-- If re-running, drop existing policies first (uncomment to drop table too):
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Actor can read for aggregation" ON public.notifications;
DROP POLICY IF EXISTS "Actor can update for aggregation" ON public.notifications;
-- DROP TABLE IF EXISTS public.notifications;

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.notifications (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type           text        NOT NULL CHECK (type IN ('new_follower','post_liked','post_commented','user_went_live','new_post')),
  actor_id       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  extra_actor_ids uuid[]     DEFAULT NULL,
  reference_id   uuid        DEFAULT NULL,
  title          text        NOT NULL,
  body           text        NOT NULL,
  is_read        boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unseen
  ON public.notifications (user_id)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_aggregation
  ON public.notifications (user_id, type, reference_id, is_read, created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
-- Drop again to be extra-safe in case the earlier drops ran before the table existed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Users can read own notifications'
  ) THEN
    EXECUTE 'DROP POLICY "Users can read own notifications" ON public.notifications';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Actor can read for aggregation'
  ) THEN
    EXECUTE 'DROP POLICY "Actor can read for aggregation" ON public.notifications';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Users can update own notifications'
  ) THEN
    EXECUTE 'DROP POLICY "Users can update own notifications" ON public.notifications';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Actor can update for aggregation'
  ) THEN
    EXECUTE 'DROP POLICY "Actor can update for aggregation" ON public.notifications';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Authenticated users can insert notifications'
  ) THEN
    EXECUTE 'DROP POLICY "Authenticated users can insert notifications" ON public.notifications';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Users can delete own notifications'
  ) THEN
    EXECUTE 'DROP POLICY "Users can delete own notifications" ON public.notifications';
  END IF;
END $$;

-- Now create policies

--    Recipients can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.notifications
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

--    Actors can read notifications they created (needed for like-aggregation lookups)
CREATE POLICY "Actor can read for aggregation"
  ON public.notifications
  FOR SELECT
  USING ((SELECT auth.uid()) = actor_id);

--    Recipients can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

--    Actors can update notifications they created (needed for like-aggregation)
CREATE POLICY "Actor can update for aggregation"
  ON public.notifications
  FOR UPDATE
  USING ((SELECT auth.uid()) = actor_id);

--    Any authenticated user can insert notifications.
CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

--    Recipients can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- 5. Enable Realtime for the table (needed for subscribeToNotifications)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;