-- Migration: Add 'mongoose_invite' to the messages message_type check constraint
-- Run this in your Supabase SQL Editor

-- 1. Drop the existing check constraints
ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_type_payload_check;

-- 2. Re-add message_type check that includes mongoose_invite
ALTER TABLE messages
ADD CONSTRAINT messages_message_type_check
CHECK (message_type IN ('text', 'image', 'audio', 'mongoose_invite'));

-- 3. Re-add the type/payload check — mongoose_invite only requires content
ALTER TABLE messages
ADD CONSTRAINT messages_type_payload_check
CHECK (
  (message_type = 'text'           AND content IS NOT NULL) OR
  (message_type = 'image'          AND image_url IS NOT NULL) OR
  (message_type = 'audio'          AND audio_url IS NOT NULL) OR
  (message_type = 'mongoose_invite' AND content IS NOT NULL) OR
  message_type IS NULL
);
