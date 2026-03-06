-- Migration: Add context column to message_requests
-- Differentiates personal social messages from commerce/product-inquiry messages.
-- Commerce-context messages bypass the "Message Requests" tray and go straight
-- to the recipient's main inbox, because they are legitimate buyer→seller interactions.

ALTER TABLE message_requests
  ADD COLUMN IF NOT EXISTS context TEXT NOT NULL DEFAULT 'personal'
    CHECK (context IN ('personal', 'commerce'));

-- Index for fast filtering in the inbox classification query
CREATE INDEX IF NOT EXISTS idx_message_requests_context
  ON message_requests (context);

COMMENT ON COLUMN message_requests.context IS
  'personal = social DM (goes to Message Requests tray if not mutual follow); '
  'commerce = initiated from a product/marketplace page (always in main inbox)';
