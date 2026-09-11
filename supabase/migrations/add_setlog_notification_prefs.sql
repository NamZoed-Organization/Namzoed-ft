-- Setlog's hourly prompt: who wants it, when, and on which build.
--
-- The prompt is the loop — a log without one is a camera you have to
-- remember — but it is also the single most intrusive thing this app could
-- do, so it starts **off** and stays off until somebody turns it on.
--
-- `app_version` is the load-bearing column. Setlog ships in 2.0.0, which is
-- not released yet — the build people are running today is older and has no
-- Setlog tab, so a push about it would send them to a screen that does not
-- exist for them. Every sender must filter on this; the client writes the
-- version it was actually running when the switch was turned on, and
-- refuses to write an opt-in from a build without the feature at all.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS setlog_prefs JSONB;

COMMENT ON COLUMN public.profiles.setlog_prefs IS
  'Setlog hourly prompt: {enabled, from_hour, to_hour, app_version, updated_at}. '
  'Absent or enabled=false means send nothing. Senders MUST also require '
  'app_version >= the version Setlog shipped in — see SETLOG_FEATURE_VERSION '
  'in lib/setlogSettings.ts — because older installs have no Setlog tab to '
  'open.';

-- Whoever ends up sending the hourly prompt reads this: everyone opted in,
-- on a build that has the feature, whose window is open at a given local
-- hour. A view rather than a rule in the sender, so the version gate cannot
-- be forgotten by the next thing that sends one of these.
CREATE OR REPLACE VIEW public.setlog_prompt_recipients AS
  SELECT
    p.id AS user_id,
    (p.setlog_prefs ->> 'from_hour')::INT AS from_hour,
    (p.setlog_prefs ->> 'to_hour')::INT AS to_hour,
    p.setlog_prefs ->> 'app_version' AS app_version
  FROM public.profiles p
  WHERE COALESCE((p.setlog_prefs ->> 'enabled')::BOOLEAN, false)
    AND p.setlog_prefs ->> 'app_version' IS NOT NULL;

-- The in-app half of the same prompt. Both halves go out together, so the
-- type has to exist before either can.
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
      'qr_connect_accepted',
      -- "It's 3pm — two seconds?"
      'setlog_prompt'
    ));
