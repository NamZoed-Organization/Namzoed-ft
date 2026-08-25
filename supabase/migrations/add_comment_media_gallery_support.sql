-- SQL Migration: comment_media gallery support (follow-up to
-- add_comment_media_support.sql)
-- Run this in your Supabase SQL Editor
--
-- Every statement here is idempotent (IF NOT EXISTS / DROP ... IF EXISTS /
-- ON CONFLICT DO NOTHING), so it's safe to run this even if you already ran
-- an earlier version of add_comment_media_support.sql — it just fills in
-- whatever's missing, in particular the comment_media table that backs the
-- multi-image/video carousel + shared caption feature.
--
-- Voice notes are singular (media_url/media_type/media_duration directly on
-- post_comments/comment_replies), but images/videos can be a multi-item
-- carousel with one shared caption, so those live in their own comment_media
-- table (one row per attached image/video) instead.

-- 1. Voice-note columns on post_comments
ALTER TABLE post_comments
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT,
ADD COLUMN IF NOT EXISTS media_duration INTEGER;

ALTER TABLE post_comments
DROP CONSTRAINT IF EXISTS post_comments_media_type_check;
ALTER TABLE post_comments
ADD CONSTRAINT post_comments_media_type_check
CHECK (media_type IS NULL OR media_type = 'audio');

-- Older runs of add_comment_media_support.sql may have left this
-- "text or media" constraint in place — it now blocks a caption-less,
-- media-only comment whose row was inserted with empty text before its
-- comment_media rows exist, so drop it if present.
ALTER TABLE post_comments
DROP CONSTRAINT IF EXISTS post_comments_text_or_media_check;

-- 2. Voice-note columns on comment_replies
ALTER TABLE comment_replies
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT,
ADD COLUMN IF NOT EXISTS media_duration INTEGER;

ALTER TABLE comment_replies
DROP CONSTRAINT IF EXISTS comment_replies_media_type_check;
ALTER TABLE comment_replies
ADD CONSTRAINT comment_replies_media_type_check
CHECK (media_type IS NULL OR media_type = 'audio');

ALTER TABLE comment_replies
DROP CONSTRAINT IF EXISTS comment_replies_text_or_media_check;

-- 3. Image/video attachments — one row per item, ordered by `position`, so a
-- single comment/reply can carry a multi-image carousel plus one caption
-- (the comment/reply's own `text`).
CREATE TABLE IF NOT EXISTS comment_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  reply_id UUID REFERENCES comment_replies(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  media_duration INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT comment_media_target_check CHECK (
    (comment_id IS NOT NULL AND reply_id IS NULL) OR
    (comment_id IS NULL AND reply_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_comment_media_comment_id ON comment_media(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comment_media_reply_id ON comment_media(reply_id) WHERE reply_id IS NOT NULL;

ALTER TABLE comment_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read comment media" ON comment_media;
CREATE POLICY "Anyone can read comment media"
ON comment_media FOR SELECT
TO authenticated
USING (true);

-- Insert is authorized by ownership of the parent comment/reply, not a
-- separate user_id column on comment_media itself.
DROP POLICY IF EXISTS "Users can attach media to their own comments" ON comment_media;
CREATE POLICY "Users can attach media to their own comments"
ON comment_media FOR INSERT
TO authenticated
WITH CHECK (
  (comment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM post_comments c WHERE c.id = comment_id AND c.user_id = auth.uid()
  )) OR
  (reply_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM comment_replies r WHERE r.id = reply_id AND r.user_id = auth.uid()
  ))
);

DROP POLICY IF EXISTS "Users can delete media on their own comments" ON comment_media;
CREATE POLICY "Users can delete media on their own comments"
ON comment_media FOR DELETE
TO authenticated
USING (
  (comment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM post_comments c WHERE c.id = comment_id AND c.user_id = auth.uid()
  )) OR
  (reply_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM comment_replies r WHERE r.id = reply_id AND r.user_id = auth.uid()
  ))
);

-- 4. Storage buckets for comment media (separate from chat's buckets) —
-- harmless no-op if these already exist from an earlier run.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('comment-images', 'comment-images', true),
  ('comment-videos', 'comment-videos', true),
  ('comment-audio', 'comment-audio', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies — authenticated users can upload/read/delete; bucket is
-- public so getPublicUrl() works the same way it does for chat media.
DROP POLICY IF EXISTS "Users can upload comment images" ON storage.objects;
DROP POLICY IF EXISTS "Users can read comment images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own comment images" ON storage.objects;

CREATE POLICY "Users can upload comment images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comment-images');

CREATE POLICY "Users can read comment images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'comment-images');

CREATE POLICY "Users can delete their own comment images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'comment-images');

DROP POLICY IF EXISTS "Users can upload comment videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can read comment videos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own comment videos" ON storage.objects;

CREATE POLICY "Users can upload comment videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comment-videos');

CREATE POLICY "Users can read comment videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'comment-videos');

CREATE POLICY "Users can delete their own comment videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'comment-videos');

DROP POLICY IF EXISTS "Users can upload comment audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can read comment audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own comment audio" ON storage.objects;

CREATE POLICY "Users can upload comment audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comment-audio');

CREATE POLICY "Users can read comment audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'comment-audio');

CREATE POLICY "Users can delete their own comment audio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'comment-audio');

-- 6. Indexes for the voice-note columns
CREATE INDEX IF NOT EXISTS idx_post_comments_media_url ON post_comments(media_url) WHERE media_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comment_replies_media_url ON comment_replies(media_url) WHERE media_url IS NOT NULL;

-- Done! post_comments/comment_replies support voice notes directly, and
-- comment_media supports multi-image/video carousels with a shared caption.
