-- Setlog: closed-group hourly mini-vlogs
--
-- A "log" is a room a small group of friends share. Every hour a prompt
-- fires and each member records one ~2s clip; the hour's clips sit side by
-- side, and the day's clips make the day's vlog. There are no likes, no
-- followers and no public feed — a log is only ever visible to its members,
-- which is what every policy below enforces.
--
-- Slots are keyed by (day, slot_hour) in the recorder's own local time
-- rather than by a timestamp, so "3pm" means 3pm to everyone in the log
-- even when a member is in another time zone, and the unique constraint can
-- do the work of "one clip per person per hour".

-- ── Tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.setlogs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 40),
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code  TEXT NOT NULL UNIQUE,
  -- Setlog itself went 3 → 4 → 12 → 20. 12 is the Phase 1 cap; the column
  -- exists so raising it is a data change, not a migration.
  member_cap   SMALLINT NOT NULL DEFAULT 12 CHECK (member_cap BETWEEN 2 AND 20),
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.setlog_members (
  setlog_id  UUID NOT NULL REFERENCES public.setlogs(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at  TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  PRIMARY KEY (setlog_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.setlog_clips (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setlog_id     UUID NOT NULL REFERENCES public.setlogs(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day           DATE NOT NULL,
  slot_hour     SMALLINT NOT NULL CHECK (slot_hour BETWEEN 0 AND 23),
  storage_path  TEXT NOT NULL,
  -- The cap is the feature: too short to perform, so there is nothing to
  -- edit. 4s leaves room for the recorder overshooting its own stop.
  duration_ms   INT NOT NULL CHECK (duration_ms > 0 AND duration_ms <= 4000),
  -- Recorded after its hour had passed. Shown, never punished (BeReal's
  -- "posted late" marker), so a quiet member doesn't break the day.
  is_late       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (setlog_id, user_id, day, slot_hour)
);

CREATE INDEX IF NOT EXISTS setlog_clips_day_idx
  ON public.setlog_clips (setlog_id, day, slot_hour);
CREATE INDEX IF NOT EXISTS setlog_members_user_idx
  ON public.setlog_members (user_id);

-- ── Membership test ─────────────────────────────────────────────────────
-- SECURITY DEFINER because setlog_members' own SELECT policy calls it: a
-- policy that reads the table it guards recurses.

CREATE OR REPLACE FUNCTION public.is_setlog_member(p_setlog UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.setlog_members m
    WHERE m.setlog_id = p_setlog AND m.user_id = auth.uid()
  );
$$;

-- ── Member cap ──────────────────────────────────────────────────────────
-- RLS can't count siblings, so the cap is a trigger.

CREATE OR REPLACE FUNCTION public.enforce_setlog_member_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cap SMALLINT;
  v_count INT;
BEGIN
  SELECT member_cap INTO v_cap FROM public.setlogs WHERE id = NEW.setlog_id;
  SELECT count(*) INTO v_count FROM public.setlog_members WHERE setlog_id = NEW.setlog_id;
  IF v_count >= v_cap THEN
    RAISE EXCEPTION 'This log is full (% members).', v_cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS setlog_member_cap ON public.setlog_members;
CREATE TRIGGER setlog_member_cap
  BEFORE INSERT ON public.setlog_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_setlog_member_cap();

-- ── RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.setlogs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlog_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlog_clips   ENABLE ROW LEVEL SECURITY;

-- A log is readable only from the inside. Joining by code goes through
-- join_setlog() below rather than a read policy, so an invite code can be
-- redeemed without making every log readable to anyone holding one.
CREATE POLICY "Members can read their logs"
  ON public.setlogs FOR SELECT
  USING (public.is_setlog_member(id) OR owner_id = auth.uid());

CREATE POLICY "Owner can create a log"
  ON public.setlogs FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can rename their log"
  ON public.setlogs FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can delete their log"
  ON public.setlogs FOR DELETE
  USING (owner_id = auth.uid());

CREATE POLICY "Members can see who else is in the log"
  ON public.setlog_members FOR SELECT
  USING (public.is_setlog_member(setlog_id));

-- Only the owner's own first row. Everyone else arrives through join_setlog().
CREATE POLICY "Owner joins their own log"
  ON public.setlog_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.setlogs s
      WHERE s.id = setlog_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "You can leave a log"
  ON public.setlog_members FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Members can read the log's clips"
  ON public.setlog_clips FOR SELECT
  USING (public.is_setlog_member(setlog_id));

CREATE POLICY "Members can add their own clips"
  ON public.setlog_clips FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_setlog_member(setlog_id));

-- No UPDATE policy on purpose: a clip is a record of a moment, so it can be
-- removed but never re-cut.
CREATE POLICY "You can delete your own clip"
  ON public.setlog_clips FOR DELETE
  USING (user_id = auth.uid());

-- ── Create / join ───────────────────────────────────────────────────────

-- Ambiguity-free alphabet: no O/0, I/1, so a code read aloud or off a
-- screenshot lands on the right log.
CREATE OR REPLACE FUNCTION public.generate_setlog_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  i INT;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::INT, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.setlogs WHERE invite_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- The log and its first membership row are one act: a log with no owner in
-- it is unreachable by every policy above, including the owner's.
CREATE OR REPLACE FUNCTION public.create_setlog(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to create a log.';
  END IF;

  INSERT INTO public.setlogs (name, owner_id, invite_code)
  VALUES (btrim(p_name), auth.uid(), public.generate_setlog_code())
  RETURNING id INTO v_id;

  INSERT INTO public.setlog_members (setlog_id, user_id, role)
  VALUES (v_id, auth.uid(), 'owner');

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_setlog(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to join a log.';
  END IF;

  SELECT id INTO v_id FROM public.setlogs
  WHERE upper(invite_code) = upper(btrim(p_code));

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No log has that code.';
  END IF;

  INSERT INTO public.setlog_members (setlog_id, user_id)
  VALUES (v_id, auth.uid())
  ON CONFLICT (setlog_id, user_id) DO NOTHING;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_setlog(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_setlog(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_setlog_member(UUID) TO authenticated;

-- ── Clip storage ────────────────────────────────────────────────────────
-- Private, unlike every other bucket in this app: a log is a closed group,
-- so clips are read through short-lived signed URLs rather than by anyone
-- who has ever seen the path. Paths are `<setlog_id>/<user_id>/<file>`, and
-- both policies read the log id off the first folder.

INSERT INTO storage.buckets (id, name, public)
VALUES ('setlog-clips', 'setlog-clips', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Members can read a log's clips"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'setlog-clips'
  AND public.is_setlog_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Members can upload their own clips"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'setlog-clips'
  AND public.is_setlog_member(((storage.foldername(name))[1])::uuid)
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Members can delete their own clips"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'setlog-clips'
  AND (storage.foldername(name))[2] = auth.uid()::text
);
