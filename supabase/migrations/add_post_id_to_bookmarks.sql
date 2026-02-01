-- Add post_id column to user_bookmarks table
ALTER TABLE user_bookmarks
ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES posts(id) ON DELETE CASCADE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_post_id ON user_bookmarks(post_id);
CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user_post ON user_bookmarks(user_id, post_id);
