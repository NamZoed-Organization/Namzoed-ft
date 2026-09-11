-- Setlog reel renders: the job table between the app and ffmpeg.
--
-- The phone can play a day but it cannot encode one — `expo-video` plays,
-- `expo-camera` records, and neither concatenates. So stitching a day into
-- one video is somebody else's work, and this is the queue that asks for
-- it: the app inserts a row, a worker picks it up, and the app watches the
-- row until a file appears.
--
-- A row rather than a request-and-wait, because a render outlives the
-- screen that asked for it. Somebody can back out of the editor, lock their
-- phone, come back, and the reel is either still going or already there.

CREATE TABLE IF NOT EXISTS public.setlog_renders (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setlog_id    UUID NOT NULL REFERENCES public.setlogs(id) ON DELETE CASCADE,
  day          DATE NOT NULL,

  -- Everything the editor decided, exactly as it was on screen. Stored as
  -- one blob because it is the worker's input and nothing else queries it:
  -- {split, sound, watermark, stamp, background, clips:[{path,title,at}]}.
  params       JSONB NOT NULL,

  status       TEXT NOT NULL DEFAULT 'queued'
                 CHECK (status IN ('queued', 'rendering', 'done', 'failed')),
  -- Where the finished file landed, under the same bucket and the same
  -- `<setlog>/<user>/…` shape everything else uses.
  output_path  TEXT,
  -- A sentence worth showing, not a stack trace.
  error        TEXT,
  progress     SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),

  created_at   TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- The worker's own query: the oldest thing still waiting.
CREATE INDEX IF NOT EXISTS setlog_renders_queue_idx
  ON public.setlog_renders (status, created_at)
  WHERE status = 'queued';

-- The app's: "is the reel I asked for ready yet".
CREATE INDEX IF NOT EXISTS setlog_renders_user_idx
  ON public.setlog_renders (user_id, day, created_at DESC);

ALTER TABLE public.setlog_renders ENABLE ROW LEVEL SECURITY;

-- Your own renders, and only yours. The worker uses the service role and is
-- not subject to any of this.
CREATE POLICY "You can read your own renders"
  ON public.setlog_renders FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "You can ask for a render of a log you are in"
  ON public.setlog_renders FOR INSERT
  WITH CHECK (user_id = auth.uid() AND public.is_setlog_member(setlog_id));

CREATE POLICY "You can cancel your own render"
  ON public.setlog_renders FOR DELETE
  USING (user_id = auth.uid());

-- No UPDATE policy: status is the worker's to move, never the client's.

CREATE OR REPLACE FUNCTION public.touch_setlog_render()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS setlog_renders_touch ON public.setlog_renders;
CREATE TRIGGER setlog_renders_touch
  BEFORE UPDATE ON public.setlog_renders
  FOR EACH ROW EXECUTE FUNCTION public.touch_setlog_render();
