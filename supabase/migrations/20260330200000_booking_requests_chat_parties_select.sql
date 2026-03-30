-- Let both chat parties (initiator + responder) read a booking created from chat,
-- so they can subscribe to status for the Mongoose invite card (pending → accepted → completed).
-- Existing policy still allows user_id (responder) and Mongoose.

DROP POLICY IF EXISTS "Chat booking parties may view shared booking" ON booking_requests;

CREATE POLICY "Chat booking parties may view shared booking"
ON booking_requests
FOR SELECT
TO authenticated
USING (
  message IS NOT NULL
  AND COALESCE((message::jsonb->>'initiatedFromChat')::boolean, false) = true
  AND (
    (NULLIF(trim(message::jsonb->>'initiatorId'), ''))::uuid = auth.uid()
    OR (NULLIF(trim(message::jsonb->>'responderId'), ''))::uuid = auth.uid()
  )
);
