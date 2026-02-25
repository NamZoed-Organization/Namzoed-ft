-- Message Requests table
-- Tracks conversations where the recipient hasn't accepted yet.
-- A request exists when the sender does NOT mutually follow the receiver.
-- Once the receiver accepts, the conversation moves to their main inbox.

CREATE TABLE IF NOT EXISTS message_requests (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (sender_id, receiver_id)
);

ALTER TABLE message_requests ENABLE ROW LEVEL SECURITY;

-- Sender can insert their own requests
CREATE POLICY "Sender can create message requests"
  ON message_requests FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Receiver can also insert (needed when accepting/declining a request that has no row yet)
CREATE POLICY "Receiver can insert message request response"
  ON message_requests FOR INSERT
  WITH CHECK (auth.uid() = receiver_id);

-- Both parties can read
CREATE POLICY "Both parties can read message requests"
  ON message_requests FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Only receiver can update status (accept / decline)
CREATE POLICY "Receiver can update message request status"
  ON message_requests FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);
