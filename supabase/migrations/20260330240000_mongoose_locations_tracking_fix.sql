-- 1) Writes: INSERT/UPDATE used EXISTS(subquery on booking_requests) under invoker RLS — if anything
--    blocks that subquery for the mongoose user, rows never appear (buyer/seller stay on "waiting").
--    Use SECURITY DEFINER + explicit mongoose email check so only the driver can write, and
--    accepted status is read without RLS fighting the policy.
-- 2) Reads: Allow initiator/responder when their UUID appears in message JSON (no longer require
--    initiatedFromChat), so older rows or JSON quirks still work.

CREATE OR REPLACE FUNCTION public.mongoose_may_write_location(p_booking_id uuid)
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
  )
  AND EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = (SELECT auth.uid())
      AND lower(coalesce(u.email, '')) = 'mongoose@gmail.com'
  );
$$;

REVOKE ALL ON FUNCTION public.mongoose_may_write_location(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mongoose_may_write_location(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mongoose_may_write_location(uuid) TO service_role;

DROP POLICY IF EXISTS "mongoose_locations_insert_when_accepted" ON mongoose_locations;
DROP POLICY IF EXISTS "mongoose_locations_update_when_accepted" ON mongoose_locations;
DROP POLICY IF EXISTS "Mongoose can update locations for accepted bookings" ON mongoose_locations;

CREATE POLICY "mongoose_locations_insert_driver_accepted"
ON mongoose_locations
FOR INSERT
TO authenticated
WITH CHECK (public.mongoose_may_write_location(booking_id));

CREATE POLICY "mongoose_locations_update_driver_accepted"
ON mongoose_locations
FOR UPDATE
TO authenticated
USING (public.mongoose_may_write_location(booking_id))
WITH CHECK (public.mongoose_may_write_location(booking_id));

-- Relaxed read: match chat parties by initiatorId / responderId in message JSON only.
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
            AND lower(coalesce(u.email, '')) = 'mongoose@gmail.com'
        )
        OR (
          br.message IS NOT NULL
          AND length(trim(br.message)) > 0
          AND (
            lower(nullif(trim((br.message::jsonb->>'initiatorId')), ''))
              = lower((SELECT auth.uid())::text)
            OR lower(nullif(trim((br.message::jsonb->>'responderId')), ''))
              = lower((SELECT auth.uid())::text)
          )
        )
      )
  );
$$;
