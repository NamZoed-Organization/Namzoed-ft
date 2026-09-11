-- ============================================================
-- Per-user view history ("History" on the profile)
-- ============================================================
-- What the user has actually looked at: posts they scrolled past, videos
-- they watched for more than a few seconds, and products, services and
-- marketplace listings they opened.
--
-- Deliberately NOT the same thing as `post_views` (which counts views for
-- the post's owner, deduplicated per day) or `user_interactions` (anonymous
-- product analytics). This is the viewer's own record, private to them, and
-- it holds exactly one row per item — re-viewing something moves it back to
-- the top rather than adding a duplicate, which is what a "recently viewed"
-- list should do.
--
-- Run this once against your Supabase project (SQL Editor or CLI).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.view_history (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content_type TEXT        NOT NULL CHECK (
                             content_type IN ('post', 'video', 'product', 'service', 'marketplace')
                           ),
  content_id   UUID        NOT NULL,
  viewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, content_type, content_id)
);

-- The only read pattern: this user's rows, newest first.
CREATE INDEX IF NOT EXISTS idx_view_history_user_viewed
  ON public.view_history(user_id, viewed_at DESC);

ALTER TABLE public.view_history ENABLE ROW LEVEL SECURITY;

-- Private to its owner, in every direction — nobody can read what someone
-- else has been looking at.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'view_history'
      AND policyname = 'users_read_own_view_history'
  ) THEN
    CREATE POLICY "users_read_own_view_history"
      ON public.view_history FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'view_history'
      AND policyname = 'users_insert_own_view_history'
  ) THEN
    CREATE POLICY "users_insert_own_view_history"
      ON public.view_history FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'view_history'
      AND policyname = 'users_update_own_view_history'
  ) THEN
    CREATE POLICY "users_update_own_view_history"
      ON public.view_history FOR UPDATE TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'view_history'
      AND policyname = 'users_delete_own_view_history'
  ) THEN
    CREATE POLICY "users_delete_own_view_history"
      ON public.view_history FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
