-- Setlog, fourth pass: capture moves to the system camera.
--
-- The app no longer draws its own mode row, flash, timer or zoom — the
-- device's camera UI does all of that, which means the app no longer knows
-- which "mode" a clip was taken in. It knows two facts: whether a photo or
-- a video came back, and how long the video was.
--
-- So `capture_mode` gains 'native', meaning exactly that: whatever the
-- system camera produced. The older values stay valid because rows written
-- before this migration carry them, and their playback rates still apply.
-- Nothing infers a mode from a duration — a thirty-second video and a
-- thirty-second timelapse are the same length, and guessing between them
-- would silently play somebody's ordinary video at 6×.

ALTER TABLE public.setlog_clips DROP CONSTRAINT IF EXISTS setlog_clips_capture_mode_check;
ALTER TABLE public.setlog_clips
  ADD CONSTRAINT setlog_clips_capture_mode_check
  CHECK (capture_mode IN ('photo', 'native', '2s', '5s', 'jumpcut', 'timelapse'));

-- The pairing rule is unchanged in spirit: a photo has no duration, a video
-- has one. 'native' is simply another video mode.
ALTER TABLE public.setlog_clips DROP CONSTRAINT IF EXISTS setlog_clips_media_mode_check;
ALTER TABLE public.setlog_clips
  ADD CONSTRAINT setlog_clips_media_mode_check
  CHECK (
    (media_type = 'photo' AND capture_mode = 'photo')
    OR (media_type = 'video' AND capture_mode <> 'photo' AND duration_ms > 0)
  );

-- Resolution is the system camera's business now, so nothing writes this
-- any more. The column stays for the rows that already have it.
COMMENT ON COLUMN public.setlog_clips.video_quality IS
  'Historical: the resolution the in-app camera was asked for, before capture moved to the system camera. Null on every clip taken since.';
