-- Setlog: as many clips an hour as you like.
--
-- The first migration put a UNIQUE on (setlog_id, user_id, day, slot_hour),
-- which read the hour as a quota. It is not one. The hour is what the
-- *prompt* runs on and what a clip is filed under — it was never meant to
-- be a limit on how often somebody can record, and being told "you've
-- already recorded this hour" is the app refusing to accept a moment for no
-- reason at all.
--
-- Two things follow from dropping it:
--
--   1. A clip's storage path can no longer be `<day>_<hour>`, because two
--      clips in one hour would land on the same object. The client now
--      appends the capture time, so every clip owns its own path (see
--      `uploadClip` in lib/setlogService.ts).
--
--   2. That in turn means no upload is ever an overwrite — which is just as
--      well, because there was no UPDATE policy on the bucket, so the
--      `upsert` that the old per-hour path relied on failed with "new row
--      violates row-level security policy" the second time anyone recorded
--      in the same hour. Photos hit it first, being the easiest thing to
--      take twice in a row.
--
-- The UPDATE policy is added anyway: an upload that replaces its own object
-- should be allowed to, and its absence should not be what enforces this.

ALTER TABLE public.setlog_clips
  DROP CONSTRAINT IF EXISTS setlog_clips_setlog_id_user_id_day_slot_hour_key;

-- The index that constraint provided is still worth having on its own: the
-- day grid and the prompt's "have they recorded this hour" check both read
-- exactly this shape.
CREATE INDEX IF NOT EXISTS setlog_clips_user_slot_idx
  ON public.setlog_clips (setlog_id, user_id, day, slot_hour);

DROP POLICY IF EXISTS "Members can replace their own clips" ON storage.objects;
CREATE POLICY "Members can replace their own clips"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'setlog-clips'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'setlog-clips'
  AND public.is_setlog_member(((storage.foldername(name))[1])::uuid)
  AND (storage.foldername(name))[2] = auth.uid()::text
);
