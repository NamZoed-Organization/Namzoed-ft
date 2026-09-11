-- Setlog's hourly prompt: the sender's half.
--
-- `add_setlog_notification_prefs.sql` created the opt-in and the recipients
-- view; this connects them to something that actually fires.
--
-- Two things it adds:
--
--   1. The recorder's IANA time zone on the view. The window is in *local*
--      hours ("8am to 10pm") and the cron runs in UTC, so without the zone
--      the sender cannot tell whether 3pm has arrived for a given person.
--      An offset would drift through DST; the zone name does not.
--
--   2. An hourly job. It runs every hour and the function decides, per
--      person, whether it is currently their hour — one schedule for every
--      time zone, rather than a job per offset.

-- ── The view gains the zone ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.setlog_prompt_recipients AS
  SELECT
    p.id AS user_id,
    (p.setlog_prefs ->> 'from_hour')::INT AS from_hour,
    (p.setlog_prefs ->> 'to_hour')::INT AS to_hour,
    p.setlog_prefs ->> 'app_version' AS app_version,
    p.setlog_prefs ->> 'timezone' AS timezone
  FROM public.profiles p
  WHERE COALESCE((p.setlog_prefs ->> 'enabled')::BOOLEAN, false)
    AND p.setlog_prefs ->> 'app_version' IS NOT NULL;

-- ── The prompt is one per person per hour ───────────────────────────────
-- `reference_id` is '<day>-<hour>', so a cron that fires twice — a retry, a
-- redeploy, an overlapping run — cannot notify the same person twice for
-- the same hour. The function checks this before sending; the index is what
-- makes that check cheap.
CREATE INDEX IF NOT EXISTS notifications_setlog_prompt_idx
  ON public.notifications (user_id, reference_id)
  WHERE type = 'setlog_prompt';

-- ── The schedule ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Every hour, on the hour. The function skips everyone whose local hour is
-- outside their own window, so this single job serves every time zone.
SELECT cron.unschedule('send-setlog-prompt')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-setlog-prompt');

SELECT cron.schedule(
  'send-setlog-prompt',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := current_setting('supabase.functions.url') || '/send-setlog-prompt',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key'),
      'Content-Type',  'application/json'
    ),
    body    := '{}'::jsonb
  );
  $$
);
