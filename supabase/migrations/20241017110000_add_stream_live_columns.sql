-- Add additional columns for Stream Live Streams integration
ALTER TABLE public.live_streams
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS stream_provider_id text,
  ADD COLUMN IF NOT EXISTS playback_id text,
  ADD COLUMN IF NOT EXISTS playback_policy text DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS hls_url text,
  ADD COLUMN IF NOT EXISTS dash_url text,
  ADD COLUMN IF NOT EXISTS rtmp_address text,
  ADD COLUMN IF NOT EXISTS stream_key text,
  ADD COLUMN IF NOT EXISTS recording_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_metadata jsonb;

CREATE INDEX IF NOT EXISTS live_streams_stream_provider_idx
  ON public.live_streams (stream_provider_id);
