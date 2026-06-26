-- Migration: Add GIF and sticker chat message types
-- Run this in your Supabase SQL Editor.

ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_message_type_check;

ALTER TABLE messages
DROP CONSTRAINT IF EXISTS message_type_check;

ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_type_payload_check;

ALTER TABLE messages
ADD CONSTRAINT messages_message_type_check
CHECK (
  message_type IN (
    'text',
    'image',
    'audio',
    'video',
    'mongoose_invite',
    'gif',
    'sticker'
  )
);

ALTER TABLE messages
ADD CONSTRAINT messages_type_payload_check
CHECK (
  (message_type = 'text'            AND content IS NOT NULL) OR
  (message_type = 'image'           AND image_url IS NOT NULL) OR
  (message_type = 'audio'           AND audio_url IS NOT NULL) OR
  (message_type = 'video') OR
  (message_type = 'mongoose_invite' AND content IS NOT NULL) OR
  (message_type = 'gif'             AND content IS NOT NULL) OR
  (message_type = 'sticker'         AND content IS NOT NULL) OR
  message_type IS NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_gif_sticker_type
ON messages(message_type)
WHERE message_type IN ('gif', 'sticker');
