-- User Interactions Analytics Table
-- Tracks button presses, screen views, and feature usage
-- to understand which parts of the app users engage with most.

CREATE TABLE public.user_interactions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id  TEXT        NOT NULL,          -- unique per app launch
  screen      TEXT        NOT NULL,          -- page/screen name (home, feed, marketplace, ...)
  feature     TEXT        NOT NULL,          -- feature area (post_like, search, live_stream, ...)
  element     TEXT,                          -- specific UI element (like_button, follow_button, ...)
  action      TEXT        NOT NULL,          -- what happened (tap, view, scroll, swipe, long_press)
  metadata    JSONB,                         -- extra context: { post_id, product_id, category, ... }
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for fast analytics queries
CREATE INDEX idx_user_interactions_user_id    ON public.user_interactions(user_id);
CREATE INDEX idx_user_interactions_screen     ON public.user_interactions(screen);
CREATE INDEX idx_user_interactions_feature    ON public.user_interactions(feature);
CREATE INDEX idx_user_interactions_action     ON public.user_interactions(action);
CREATE INDEX idx_user_interactions_created_at ON public.user_interactions(created_at DESC);
CREATE INDEX idx_user_interactions_session_id ON public.user_interactions(session_id);

-- Composite index for common "top features on a screen" queries
CREATE INDEX idx_user_interactions_screen_feature
  ON public.user_interactions(screen, feature, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only insert their own interactions
CREATE POLICY "users_insert_own_interactions"
  ON public.user_interactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view only their own interaction history
CREATE POLICY "users_read_own_interactions"
  ON public.user_interactions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role (admin/dashboard) can read all rows for analytics
-- (accessed via supabase service_role key, not the anon key)

-- ─── Useful analytics views ───────────────────────────────────────────────────

-- Top features across the entire app (admin-level view, use service_role)
CREATE VIEW public.analytics_top_features AS
SELECT
  screen,
  feature,
  element,
  action,
  COUNT(*)                                AS total_interactions,
  COUNT(DISTINCT user_id)                 AS unique_users,
  COUNT(DISTINCT session_id)              AS unique_sessions,
  DATE_TRUNC('day', created_at)           AS day
FROM public.user_interactions
GROUP BY screen, feature, element, action, DATE_TRUNC('day', created_at)
ORDER BY day DESC, total_interactions DESC;

-- Most visited screens
CREATE VIEW public.analytics_screen_visits AS
SELECT
  screen,
  COUNT(*)                                AS total_views,
  COUNT(DISTINCT user_id)                 AS unique_users,
  DATE_TRUNC('day', created_at)           AS day
FROM public.user_interactions
WHERE action = 'view'
GROUP BY screen, DATE_TRUNC('day', created_at)
ORDER BY day DESC, total_views DESC;
