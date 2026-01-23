-- SQL Migration: Create chat-audio storage bucket and update messages table
-- Run this in your Supabase SQL Editor

-- 1. Drop the old check constraints if they exist
ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE messages 
DROP CONSTRAINT IF EXISTS messages_type_payload_check;

-- 2. Add audio-related columns to messages table if they don't exist
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS audio_url TEXT,
ADD COLUMN IF NOT EXISTS audio_duration INTEGER;

-- 3. Add updated check constraints that include 'audio' type
ALTER TABLE messages
ADD CONSTRAINT messages_message_type_check 
CHECK (message_type IN ('text', 'image', 'audio'));

-- Add check constraint for type-specific fields
ALTER TABLE messages
ADD CONSTRAINT messages_type_payload_check 
CHECK (
  (message_type = 'text' AND content IS NOT NULL) OR
  (message_type = 'image' AND image_url IS NOT NULL) OR
  (message_type = 'audio' AND audio_url IS NOT NULL)
);

-- 4. Create chat-audio storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-audio', 'chat-audio', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Set up storage policies for chat-audio bucket
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload audio messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can read audio messages" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own audio" ON storage.objects;

-- Allow all authenticated users to upload audio
CREATE POLICY "Users can upload audio messages"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-audio');

-- Allow all authenticated users to read audio
CREATE POLICY "Users can read audio messages"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-audio');

-- Allow all authenticated users to delete audio
CREATE POLICY "Users can delete their own audio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-audio');

-- Optional: Allow public access to audio (if you want unauthenticated users to listen)
-- Uncomment the following if needed:
-- CREATE POLICY "Public can read audio messages"
-- ON storage.objects FOR SELECT
-- TO public
-- USING (bucket_id = 'chat-audio');

-- 6. Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_messages_audio_url ON messages(audio_url) WHERE audio_url IS NOT NULL;

-- Done! Your chat system now supports audio messages.
