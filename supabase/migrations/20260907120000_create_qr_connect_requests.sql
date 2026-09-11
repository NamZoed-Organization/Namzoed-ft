-- ============================================================
-- QR connect requests — "scan my code and we follow each other"
-- ============================================================
-- The QR code on a profile encodes that profile's `namzoed_id`
-- (see supabase/migrations/add_namzoed_id_to_profiles.sql), never
-- its raw UUID: the id is already printed on the profile screen, so
-- a code that carries it leaks nothing that isn't on screen anyway,
-- and it stays short enough to render at a low QR version.
--
-- Both sides have to agree before anybody follows anybody:
--
--   1. A scans B's code and taps Add  -> a `pending` row here.
--      NOTHING is written to `follows` yet.
--   2. B accepts from Add Friends     -> accept_qr_connect_request()
--      writes BOTH follow rows in one transaction.
--
-- Doing the requester's follow at step 1 is the obvious shortcut and
-- it is wrong: it makes a scan a unilateral follow, so anyone who
-- glances at a code has followed that person whether or not the
-- connection is ever accepted. The follows are the *result* of the
-- handshake, which is why they're created together by the function
-- below rather than one at each end.
--
-- Run once against the Supabase project (SQL Editor or `supabase db push`).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.qr_connect_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  responded_at  timestamptz,
  CONSTRAINT qr_connect_requests_not_self CHECK (requester_id <> recipient_id),
  -- One live row per direction. A re-scan after a decline updates this
  -- row back to 'pending' (see send_qr_connect_request below) rather
  -- than piling up a row per attempt.
  CONSTRAINT qr_connect_requests_unique_pair UNIQUE (requester_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS qr_connect_requests_recipient_idx
  ON public.qr_connect_requests (recipient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS qr_connect_requests_requester_idx
  ON public.qr_connect_requests (requester_id, status, created_at DESC);

ALTER TABLE public.qr_connect_requests ENABLE ROW LEVEL SECURITY;

-- Only the two people involved can see a request.
DROP POLICY IF EXISTS "Parties can read their connect requests" ON public.qr_connect_requests;
CREATE POLICY "Parties can read their connect requests"
  ON public.qr_connect_requests
  FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- You can only ever ask on your own behalf.
DROP POLICY IF EXISTS "Requester can create a connect request" ON public.qr_connect_requests;
CREATE POLICY "Requester can create a connect request"
  ON public.qr_connect_requests
  FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Re-asking after a decline is an UPDATE of the same row; accepting and
-- declining go through the functions below, which check the caller
-- themselves, but the recipient is allowed here too so a decline works
-- even against an older client.
DROP POLICY IF EXISTS "Parties can update their connect request" ON public.qr_connect_requests;
CREATE POLICY "Parties can update their connect request"
  ON public.qr_connect_requests
  FOR UPDATE
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = recipient_id);

-- Cancelling is the requester's to do.
DROP POLICY IF EXISTS "Requester can cancel a connect request" ON public.qr_connect_requests;
CREATE POLICY "Requester can cancel a connect request"
  ON public.qr_connect_requests
  FOR DELETE
  USING (auth.uid() = requester_id);

-- ------------------------------------------------------------
-- Send / re-send. Returns the row so the client can tell an
-- "already pending" from a fresh one without a second round trip.
--
-- If the other person has already asked *us*, this is the second
-- confirmation, not a new request: accept theirs instead, so two
-- people scanning each other's codes end up connected rather than
-- sitting on a pending request each.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_qr_connect_request(p_recipient_id uuid)
RETURNS public.qr_connect_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me       uuid := auth.uid();
  v_existing public.qr_connect_requests;
  v_row      public.qr_connect_requests;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF p_recipient_id IS NULL OR p_recipient_id = v_me THEN
    RAISE EXCEPTION 'That is your own code';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_recipient_id) THEN
    RAISE EXCEPTION 'No such profile';
  END IF;

  -- Their pending request to us outranks a new one from us.
  SELECT * INTO v_existing
  FROM public.qr_connect_requests
  WHERE requester_id = p_recipient_id
    AND recipient_id = v_me
    AND status = 'pending';

  IF v_existing.id IS NOT NULL THEN
    RETURN public.accept_qr_connect_request(v_existing.id);
  END IF;

  INSERT INTO public.qr_connect_requests (requester_id, recipient_id)
  VALUES (v_me, p_recipient_id)
  ON CONFLICT ON CONSTRAINT qr_connect_requests_unique_pair DO UPDATE
    SET status       = CASE
                         -- An accepted connection stays accepted; re-scanning
                         -- a friend's code must not un-follow anybody.
                         WHEN qr_connect_requests.status = 'accepted' THEN 'accepted'
                         ELSE 'pending'
                       END,
        created_at   = CASE
                         WHEN qr_connect_requests.status = 'accepted'
                           THEN qr_connect_requests.created_at
                         ELSE now()
                       END,
        responded_at = CASE
                         WHEN qr_connect_requests.status = 'accepted'
                           THEN qr_connect_requests.responded_at
                         ELSE NULL
                       END
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ------------------------------------------------------------
-- Accept — the second confirmation. Writes both follow rows.
--
-- SECURITY DEFINER because one of those rows has the *requester* as
-- follower_id, and the follows INSERT policy is auth.uid() =
-- follower_id: the accepting user cannot write it as themselves. The
-- caller check below is what replaces that policy.
--
-- The inserts are guarded with NOT EXISTS rather than ON CONFLICT so
-- this doesn't depend on `follows` carrying a unique constraint on the
-- pair, which not every deployment of this schema has.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accept_qr_connect_request(p_request_id uuid)
RETURNS public.qr_connect_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me  uuid := auth.uid();
  v_row public.qr_connect_requests;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT * INTO v_row
  FROM public.qr_connect_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_row.recipient_id <> v_me THEN
    RAISE EXCEPTION 'Only the person who was scanned can accept this';
  END IF;
  IF v_row.status = 'accepted' THEN
    RETURN v_row;
  END IF;

  INSERT INTO public.follows (follower_id, following_id, created_at)
  SELECT v_row.requester_id, v_row.recipient_id, now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = v_row.requester_id AND following_id = v_row.recipient_id
  );

  INSERT INTO public.follows (follower_id, following_id, created_at)
  SELECT v_row.recipient_id, v_row.requester_id, now()
  WHERE NOT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = v_row.recipient_id AND following_id = v_row.requester_id
  );

  UPDATE public.qr_connect_requests
  SET status = 'accepted', responded_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ------------------------------------------------------------
-- Decline. Keeps the row (so the same person re-scanning updates it
-- rather than inserting a second one) and follows nobody.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decline_qr_connect_request(p_request_id uuid)
RETURNS public.qr_connect_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me  uuid := auth.uid();
  v_row public.qr_connect_requests;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT * INTO v_row FROM public.qr_connect_requests WHERE id = p_request_id FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_row.recipient_id <> v_me THEN
    RAISE EXCEPTION 'Only the person who was scanned can decline this';
  END IF;

  UPDATE public.qr_connect_requests
  SET status = 'declined', responded_at = now()
  WHERE id = p_request_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.send_qr_connect_request(uuid)    FROM public;
REVOKE ALL ON FUNCTION public.accept_qr_connect_request(uuid)  FROM public;
REVOKE ALL ON FUNCTION public.decline_qr_connect_request(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.send_qr_connect_request(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_qr_connect_request(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_qr_connect_request(uuid) TO authenticated;

-- ------------------------------------------------------------
-- Notification types for the two ends of the handshake.
--
-- The constraint is rewritten in full because the last migration to
-- touch it (add_mongoose_booking_request_notification_type.sql) listed
-- six types while the app has since grown several more — inserting one
-- of those fails the CHECK. This is the complete set as of
-- types/notification.ts.
-- ------------------------------------------------------------
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'new_follower',
      'post_liked',
      'post_commented',
      'user_went_live',
      'new_post',
      'mongoose_booking_request',
      'follower_milestone',
      'post_traction',
      'weekly_engagement',
      'new_story',
      'product_reviewed',
      'qr_connect_request',
      'qr_connect_accepted'
    ));
