-- Setlog, second pass: a log you never had to name, and a clip that titles
-- itself after the fact.
--
-- What changed and why:
--
--  * Recording is now the act that creates a log. Asking someone to name a
--    room and invite people into it before they have recorded anything is
--    three decisions in front of a two-second video — the whole point of
--    which is that it costs no decisions. So a log can exist unnamed, and
--    `ensure_personal_setlog()` hands you yours, creating it the first time
--    you press the shutter.
--
--  * Joining is no longer on the way in. It still exists, but it is a
--    thing you do to somebody else's log, not a gate in front of your own.
--
--  * A clip carries a title, written over the video after it is recorded
--    rather than typed before. Two seconds, then a handful of words about
--    what they were — that ordering is what keeps it from being a caption
--    box you have to fill.

-- ── A log no longer needs a name ────────────────────────────────────────
-- The CHECK was written against a NOT NULL column; both go, and the length
-- bound is re-stated so a named log is still bounded.

ALTER TABLE public.setlogs DROP CONSTRAINT IF EXISTS setlogs_name_check;
ALTER TABLE public.setlogs ALTER COLUMN name DROP NOT NULL;
ALTER TABLE public.setlogs
  ADD CONSTRAINT setlogs_name_check
  CHECK (name IS NULL OR char_length(btrim(name)) BETWEEN 1 AND 40);

-- The log that is simply yours: created on your first recording, never
-- named, and the one a clip lands in when you record from the plus button
-- rather than from inside a group. One per person, which the partial index
-- enforces rather than trusting the RPC to.
ALTER TABLE public.setlogs
  ADD COLUMN IF NOT EXISTS is_personal BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS setlogs_one_personal_per_owner
  ON public.setlogs (owner_id) WHERE is_personal;

-- ── A clip carries its title ────────────────────────────────────────────
-- Stored as text, not burned into the pixels: the app has no video encoder
-- on device, and text kept as text stays legible at every size, can be
-- corrected, and can be read by anything that isn't a video player.
ALTER TABLE public.setlog_clips
  ADD COLUMN IF NOT EXISTS title TEXT
  CHECK (title IS NULL OR char_length(btrim(title)) <= 60);

-- The one thing a recorder may change after the fact. The clip itself
-- still cannot be re-cut — only what it is called.
DROP POLICY IF EXISTS "You can retitle your own clip" ON public.setlog_clips;
CREATE POLICY "You can retitle your own clip"
  ON public.setlog_clips FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Your own log, on demand ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_personal_setlog()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to record.';
  END IF;

  SELECT id INTO v_id FROM public.setlogs
  WHERE owner_id = auth.uid() AND is_personal
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.setlogs (name, owner_id, invite_code, is_personal)
  VALUES (NULL, auth.uid(), public.generate_setlog_code(), true)
  RETURNING id INTO v_id;

  INSERT INTO public.setlog_members (setlog_id, user_id, role)
  VALUES (v_id, auth.uid(), 'owner');

  RETURN v_id;
END;
$$;

-- Naming is optional now, so the argument is too.
CREATE OR REPLACE FUNCTION public.create_setlog(p_name TEXT DEFAULT NULL)
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
  VALUES (NULLIF(btrim(coalesce(p_name, '')), ''), auth.uid(),
          public.generate_setlog_code())
  RETURNING id INTO v_id;

  INSERT INTO public.setlog_members (setlog_id, user_id, role)
  VALUES (v_id, auth.uid(), 'owner');

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_personal_setlog() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_setlog(TEXT) TO authenticated;
