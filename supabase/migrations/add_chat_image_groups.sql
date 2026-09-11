-- Several pictures, one message.
--
-- Sending four photographs used to insert four rows, so the thread filled
-- with four full-width bubbles and whatever was said about them arrived
-- underneath, detached from any of them. A set of pictures sent together is
-- one thing somebody sent, and it should be one message: one bubble, one
-- caption, one timestamp.
--
-- `image_urls` holds the whole set. `image_url` keeps the **first** of them:
--   - the existing `messages_type_payload_check` requires it for an image
--     message and this migration does not relax that, so a row is still
--     valid by the old rules;
--   - every older client, every notification preview and every "last
--     message" summary already reads `image_url` and keeps working, showing
--     the first picture instead of nothing.
-- A client that knows about groups reads `image_urls` and falls back to
-- `[image_url]` when it is null, which is what every row written before
-- today looks like.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS image_urls JSONB;

COMMENT ON COLUMN public.messages.image_urls IS
  'All pictures in an image message, in the order they were sent. NULL on '
  'rows written before groups existed — read it as [image_url] then. '
  'image_url is always the first entry, so older clients and the '
  'message_type payload constraint still work.';

-- A caption is the message's own `content`. Nothing needed for that: the
-- payload constraint only requires image_url for an image row, and has
-- never said anything about content being empty.
