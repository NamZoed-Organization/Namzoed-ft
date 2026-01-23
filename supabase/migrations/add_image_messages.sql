-- Add image support to messages table
-- Run this in your Supabase SQL Editor

-- 1. Add new columns to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text';

-- 2. Add check constraint for message_type
ALTER TABLE messages 
ADD CONSTRAINT message_type_check 
CHECK (message_type IN ('text', 'image', 'location'));

-- 3. Create storage bucket for chat images (run this separately or via Supabase dashboard)
-- Note: You need to create the bucket 'chat-images' in Supabase Storage dashboard
-- with public access enabled for easier image loading

-- 4. Set up storage policies for chat-images bucket
-- Allow authenticated users to upload
INSERT INTO storage.policies (name, bucket_id, definition, check)
VALUES (
  'Allow authenticated users to upload chat images',
  'chat-images',
  '(bucket_id = ''chat-images'')',
  '(auth.role() = ''authenticated'')'
);

-- Allow public read access to chat images
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Allow public to view chat images',
  'chat-images',
  '(bucket_id = ''chat-images'')'
);

-- 5. Create index on message_type for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);

-- 6. Update existing location messages to have correct type
UPDATE messages 
SET message_type = 'location' 
WHERE content LIKE '%📍 My Location:%';
