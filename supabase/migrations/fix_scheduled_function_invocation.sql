-- Why nothing scheduled has ever fired.
--
-- Every cron job in this project calls its edge function like this:
--
--     url := current_setting('supabase.functions.url') || '/send-setlog-prompt'
--
-- `supabase.functions.url` and `supabase.service_role_key` are **not**
-- settings Supabase defines. Unless somebody has run ALTER DATABASE ... SET
-- for them by hand, `current_setting()` raises
--
--     unrecognized configuration parameter "supabase.functions.url"
--
-- which aborts the whole cron statement *before* `net.http_post` is
-- reached. The job runs every hour, fails every hour, and says so only in
-- `cron.job_run_details` — nothing surfaces in the app, in the function's
-- logs (it is never called), or in OneSignal. The switch reads "on" and
-- nothing ever arrives, which is exactly the symptom being chased.
--
-- This replaces the guesswork with a row you can see. Run it, fill in the
-- two values, and the job resolves them at run time or fails loudly.
--
-- The same pattern is used by `20260806130000_create_stories.sql`
-- (`purge-expired-story-media`, every 10 minutes) and `engagement_tracking.sql`
-- (`send-engagement-summary`). If the setting was never defined, those two
-- have never fired either — the block at the bottom moves them over too and
-- is commented out on purpose, so this migration changes only what it says
-- it changes.

-- ── Where the sender's credentials live ─────────────────────────────────
-- A private table, not a GUC: a value in a table can be read back, checked
-- and corrected by whoever is debugging at 2am. `service_role_key` is a
-- secret, so nothing but the postgres/service role may read it, and RLS is
-- on with no policies at all — which denies every anon and authenticated
-- request outright.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE private.app_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.app_config FROM anon, authenticated;

COMMENT ON TABLE private.app_config IS
  'Values the database itself needs to call out to edge functions. '
  'functions_url: https://<project-ref>.functions.supabase.co (no trailing slash). '
  'service_role_key: the project service role key. Never readable by clients.';

-- ── FILL THESE IN ───────────────────────────────────────────────────────
-- Both are on the Supabase dashboard: Settings → API. The URL is the
-- project ref with `.functions.supabase.co`; the key is the service_role
-- key, *not* the anon key.
--
-- INSERT INTO private.app_config (key, value) VALUES
--   ('functions_url',    'https://ixpyigcoimuusmahbsyq.functions.supabase.co'),
--   ('service_role_key', 'PASTE_THE_SERVICE_ROLE_KEY_HERE')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- ── Calling a function, once, properly ──────────────────────────────────
-- One helper every schedule can use, so the next job added cannot invent a
-- fifth way of doing this. It raises a readable error when the config is
-- missing rather than the parameter-name error that started all of this.

CREATE OR REPLACE FUNCTION private.invoke_edge_function(
  function_name TEXT,
  payload JSONB DEFAULT '{}'::JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE
  base_url TEXT;
  service_key TEXT;
BEGIN
  SELECT value INTO base_url FROM private.app_config WHERE key = 'functions_url';
  SELECT value INTO service_key FROM private.app_config WHERE key = 'service_role_key';

  IF base_url IS NULL OR service_key IS NULL THEN
    RAISE EXCEPTION
      'private.app_config is missing functions_url or service_role_key — the % job cannot call anything until both are set',
      function_name;
  END IF;

  RETURN net.http_post(
    url     := base_url || '/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || service_key,
      'Content-Type',  'application/json'
    ),
    body    := payload
  );
END;
$$;

-- ── The hourly prompt, rescheduled ──────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('send-setlog-prompt')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-setlog-prompt');

-- Every hour, on the hour. The function decides per person whether it is
-- currently their hour, so one schedule serves every time zone.
SELECT cron.schedule(
  'send-setlog-prompt',
  '0 * * * *',
  $$ SELECT private.invoke_edge_function('send-setlog-prompt'); $$
);

-- ── Did it work? ────────────────────────────────────────────────────────
-- Run these after the next hour turns over.
--
--   -- Is the job there, and when did it last run?
--   SELECT jobid, jobname, schedule, active FROM cron.job;
--
--   -- The last few runs, and what they returned. `status = 'failed'` with
--   -- return_message is where the old parameter error was hiding.
--   SELECT start_time, status, return_message
--     FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'send-setlog-prompt')
--    ORDER BY start_time DESC
--    LIMIT 10;
--
--   -- What the function actually answered (pg_net keeps the response).
--   SELECT created, status_code, content
--     FROM net._http_response
--    ORDER BY created DESC
--    LIMIT 10;
--
--   -- Is this account visible to the sender at all? A row here with a NULL
--   -- timezone or an app_version below 2.0.0 is skipped in silence.
--   SELECT * FROM public.setlog_prompt_recipients;
--
--   -- And has anything been written for it?
--   SELECT created_at, title, reference_id
--     FROM public.notifications
--    WHERE type = 'setlog_prompt'
--    ORDER BY created_at DESC
--    LIMIT 10;

-- ── The other two schedules ─────────────────────────────────────────────
-- Same failure, same fix. Uncomment to move them over as well.
--
-- SELECT cron.unschedule('purge-expired-story-media')
-- WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-story-media');
-- SELECT cron.schedule(
--   'purge-expired-story-media', '*/10 * * * *',
--   $$ SELECT private.invoke_edge_function('purge-expired-stories'); $$
-- );
--
-- SELECT cron.unschedule('send-engagement-summary')
-- WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-engagement-summary');
-- -- (keep whatever schedule engagement_tracking.sql set; only the body changes)
