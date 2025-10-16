-- Create posts table
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0
);

-- Add indexes for faster queries
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to read posts
CREATE POLICY "Posts are viewable by everyone" ON posts
  FOR SELECT USING (true);

-- Policy to allow anyone to create posts (you can add auth later)
CREATE POLICY "Anyone can create posts" ON posts
  FOR INSERT WITH CHECK (true);

-- Policy to allow anyone to update posts (you can restrict this later)
CREATE POLICY "Anyone can update posts" ON posts
  FOR UPDATE USING (true);

-- Policy to allow anyone to delete posts (you can restrict this later)
CREATE POLICY "Anyone can delete posts" ON posts
  FOR DELETE USING (true);

-- Migration: Remove redundant columns if they exist (run this if you already have the table)
-- ALTER TABLE posts DROP COLUMN IF EXISTS username;
-- ALTER TABLE posts DROP COLUMN IF EXISTS profile_pic;
