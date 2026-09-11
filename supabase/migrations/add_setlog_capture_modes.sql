-- Setlog, third pass: the camera stops being a two-second shutter.
--
-- A clip can now be a photo or a video of 2s, 5s, 10s ("jumpcut") or 30s
-- ("timelapse"), so two assumptions baked into the first migration have to
-- go: that a clip is always a video, and that it is always about two
-- seconds long.
--
-- `capture_mode` is stored rather than inferred from `duration_ms`, because
-- the two are not the same fact — a 30s timelapse and a 30s video are the
-- same length and are meant to be played back differently. Playback speed
-- is a property of the mode, so the mode is what gets recorded.

-- ── A clip is no longer necessarily two seconds ─────────────────────────
ALTER TABLE public.setlog_clips DROP CONSTRAINT IF EXISTS setlog_clips_duration_ms_check;
ALTER TABLE public.setlog_clips
  ADD CONSTRAINT setlog_clips_duration_ms_check
  -- 0 for a photo; 60s of headroom over the longest mode, so a recorder
  -- overshooting its own stop never loses the take.
  CHECK (duration_ms >= 0 AND duration_ms <= 60000);

-- ── …nor necessarily a video ────────────────────────────────────────────
ALTER TABLE public.setlog_clips
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'video'
  CHECK (media_type IN ('video', 'photo'));

ALTER TABLE public.setlog_clips
  ADD COLUMN IF NOT EXISTS capture_mode TEXT NOT NULL DEFAULT '2s'
  CHECK (capture_mode IN ('photo', '2s', '5s', 'jumpcut', 'timelapse'));

-- Belt and braces on the pair: a photo has no duration and a video does.
ALTER TABLE public.setlog_clips DROP CONSTRAINT IF EXISTS setlog_clips_media_mode_check;
ALTER TABLE public.setlog_clips
  ADD CONSTRAINT setlog_clips_media_mode_check
  CHECK (
    (media_type = 'photo' AND capture_mode = 'photo')
    OR (media_type = 'video' AND capture_mode <> 'photo' AND duration_ms > 0)
  );

-- The recorder's chosen resolution, kept for the record rather than
-- enforced: `videoQuality` is honoured on Android and quietly ignored on
-- iOS, so this says what was asked for, not what the file necessarily is.
ALTER TABLE public.setlog_clips
  ADD COLUMN IF NOT EXISTS video_quality TEXT
  CHECK (video_quality IS NULL OR video_quality IN ('480p', '720p', '1080p'));
