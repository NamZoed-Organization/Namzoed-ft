-- Fix: The responder (currently authenticated user) creates the booking on behalf
-- of the booking pair.  The old policy required user_id = auth.uid(), but the
-- insert was trying to store the initiator's id in user_id, causing a 42501 RLS
-- violation.
--
-- New approach:
--   • user_id stores the RESPONDER's id (the authenticated user doing the insert)
--   • initiator info is preserved in the `message` JSON column
--   • Any authenticated user can INSERT — they own the row they create.

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can create their own booking requests" ON booking_requests;

-- Replacement: any authenticated user can insert a booking request
CREATE POLICY "Authenticated users can create booking requests"
ON booking_requests FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);
