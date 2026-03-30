-- SELECT on mongoose_locations used EXISTS (subquery on booking_requests), which is still
-- subject to booking_requests RLS. In edge cases initiators saw no rows even when the chat
-- booking policy should allow it. This helper runs as definer, bypasses RLS on the inner
-- read, and enforces the same party + accepted rules explicitly.

CREATE OR REPLACE FUNCTION public.user_can_read_mongoose_location(p_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM booking_requests br
    WHERE br.id = p_booking_id
      AND lower(trim(coalesce(br.status, ''))) = 'accepted'
      AND (
        br.user_id = (SELECT auth.uid())
        OR EXISTS (
          SELECT 1
          FROM auth.users u
          WHERE u.id = (SELECT auth.uid())
            AND lower(u.email) = 'mongoose@gmail.com'
        )
        OR (
          br.message IS NOT NULL
          AND coalesce((br.message::jsonb->>'initiatedFromChat')::boolean, false) = true
          AND (
            lower(nullif(trim(br.message::jsonb->>'initiatorId'), ''))
              = lower((SELECT auth.uid())::text)
            OR lower(nullif(trim(br.message::jsonb->>'responderId'), ''))
              = lower((SELECT auth.uid())::text)
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_read_mongoose_location(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_read_mongoose_location(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_read_mongoose_location(uuid) TO service_role;

DROP POLICY IF EXISTS "Users can view mongoose locations for their bookings" ON mongoose_locations;
DROP POLICY IF EXISTS "Chat parties can view mongoose locations for shared bookings" ON mongoose_locations;

CREATE POLICY "Participants can select mongoose locations for accepted bookings"
ON mongoose_locations
FOR SELECT
TO authenticated
USING (public.user_can_read_mongoose_location(booking_id));

-- FOR ALL also applied to SELECT and used EXISTS under booking_requests RLS; split so SELECT
-- only uses the definer function above (writes unchanged for accepted bookings).
DROP POLICY IF EXISTS "Mongoose can update locations for accepted bookings" ON mongoose_locations;

CREATE POLICY "mongoose_locations_insert_when_accepted"
ON mongoose_locations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM booking_requests br
    WHERE br.id = booking_id
      AND lower(trim(coalesce(br.status, ''))) = 'accepted'
  )
);

CREATE POLICY "mongoose_locations_update_when_accepted"
ON mongoose_locations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM booking_requests br
    WHERE br.id = mongoose_locations.booking_id
      AND lower(trim(coalesce(br.status, ''))) = 'accepted'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM booking_requests br
    WHERE br.id = mongoose_locations.booking_id
      AND lower(trim(coalesce(br.status, ''))) = 'accepted'
  )
);
