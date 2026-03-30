-- Chat-originated bookings store responder in booking_requests.user_id; initiator is only in message JSON.
-- The old SELECT policy only allowed user_id = auth.uid(), so the other party could not read mongoose_locations
-- (Track modal stayed on "Waiting for mongoose…" and realtime never delivered).

DROP POLICY IF EXISTS "Chat parties can view mongoose locations for shared bookings" ON mongoose_locations;

CREATE POLICY "Chat parties can view mongoose locations for shared bookings"
ON mongoose_locations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM booking_requests br
    WHERE br.id = mongoose_locations.booking_id
      AND br.message IS NOT NULL
      AND COALESCE((br.message::jsonb->>'initiatedFromChat')::boolean, false) = true
      AND (
        (NULLIF(trim(br.message::jsonb->>'initiatorId'), ''))::uuid = auth.uid()
        OR (NULLIF(trim(br.message::jsonb->>'responderId'), ''))::uuid = auth.uid()
      )
  )
);
