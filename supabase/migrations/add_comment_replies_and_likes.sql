-- ============================================================
-- Comment replies + likes for comments and replies
-- Run in Supabase SQL Editor
-- ============================================================

-- ── 1. comment_likes ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  uuid        NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes (comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id    ON public.comment_likes (user_id);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read comment likes"
  ON public.comment_likes FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own comment likes"
  ON public.comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comment likes"
  ON public.comment_likes FOR DELETE USING (auth.uid() = user_id);

-- ── 2. comment_replies ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comment_replies (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  uuid        NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)      ON DELETE CASCADE,
  text        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_replies_comment_id ON public.comment_replies (comment_id, created_at ASC);

ALTER TABLE public.comment_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read replies"
  ON public.comment_replies FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own replies"
  ON public.comment_replies FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own replies"
  ON public.comment_replies FOR DELETE USING (auth.uid() = user_id);

-- ── 3. reply_likes ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reply_likes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id    uuid        NOT NULL REFERENCES public.comment_replies(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.profiles(id)        ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reply_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reply_likes_reply_id ON public.reply_likes (reply_id);
CREATE INDEX IF NOT EXISTS idx_reply_likes_user_id  ON public.reply_likes (user_id);

ALTER TABLE public.reply_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read reply likes"
  ON public.reply_likes FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own reply likes"
  ON public.reply_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reply likes"
  ON public.reply_likes FOR DELETE USING (auth.uid() = user_id);
