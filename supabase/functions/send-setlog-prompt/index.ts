// @ts-nocheck
import { serve } from "https://deno.land/std@0.198.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * send-setlog-prompt
 *
 * Scheduled edge function, called by a pg_cron job **every hour on the
 * hour**. It is the other half of Setlog: the prompt is the loop, and a log
 * without one is a camera you have to remember.
 *
 * For each opted-in person it asks four questions, and every "no" is a
 * deliberate silence rather than an oversight:
 *
 *   1. **Is it inside their window?** The window is in *local* hours and
 *      this runs in UTC, so each person's zone (`timezone`, IANA) decides
 *      what hour it is for them. Runs hourly and skips everyone it is not
 *      currently the right hour for.
 *
 *   2. **Is their build one that has Setlog?** `app_version` must be at or
 *      past MIN_APP_VERSION. Notifying an older install would open a tab
 *      that does not exist there — the whole reason that column exists.
 *
 *   3. **Have they already recorded this hour?** Nobody should be nudged to
 *      do the thing they have just done.
 *
 *   4. **Have they already been prompted for this hour?** `reference_id` is
 *      `<day>-<hour>`, so a cron that fires twice cannot notify twice.
 *
 * Both halves go out together: a row in `notifications` (the in-app one)
 * and a OneSignal push, with a `collapse_id` per person so the 4pm prompt
 * replaces the 3pm one on the lock screen instead of stacking.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

/**
 * The app version Setlog shipped in. Must match SETLOG_FEATURE_VERSION in
 * `lib/setlogSettings.ts` — the client refuses to record an opt-in below
 * it, and this refuses to act on one.
 */
const MIN_APP_VERSION = "2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Numeric compare, not string: "2.10.0" is newer than "2.9.0". */
const versionAtLeast = (version: string, minimum: string): boolean => {
  const a = version.split(".").map((n) => parseInt(n, 10) || 0);
  const b = minimum.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
};

/**
 * What time it is for someone, in their own zone.
 *
 * `en-CA` because it formats as `YYYY-MM-DD`, which is exactly the shape of
 * the `day` column — the alternative is assembling the date by hand and
 * getting the padding wrong.
 */
const localNow = (
  timezone: string,
): { day: string; hour: number } | null => {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const year = get("year");
    const month = get("month");
    const dayOfMonth = get("day");
    const hour = get("hour");
    if (!year || !month || !dayOfMonth || hour == null) return null;

    return {
      day: `${year}-${month}-${dayOfMonth}`,
      // "24" is midnight in some locales' 24-hour formatting.
      hour: Number(hour) % 24,
    };
  } catch {
    // An unrecognised zone is not worth guessing about.
    return null;
  }
};

/** "3pm" — the hour as a person says it. Matches `formatHour` in the app. */
const formatHour = (hour: number): string => {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "am" : "pm"}`;
};

async function sendOneSignalPush(payload: {
  recipientId: string;
  heading: string;
  content: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  await fetch("https://api.onesignal.com/notifications?c=push", {
    method: "POST",
    headers: {
      Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      headings: { en: payload.heading },
      contents: { en: payload.content },
      data: { type: "setlog_prompt", ...(payload.data ?? {}) },
      target_channel: "push",
      include_aliases: { external_id: [payload.recipientId] },
      // One live prompt per person: 4pm replaces 3pm rather than stacking
      // an unread hour on the lock screen every hour of the day.
      collapse_id: `setlog_prompt_${payload.recipientId}`,
      android_group: "setlog_prompt",
      thread_id: "setlog_prompt",
    }),
  }).catch(() => {}); // fire-and-forget per recipient
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !ONESIGNAL_APP_ID ||
    !ONESIGNAL_REST_API_KEY
  ) {
    return jsonResponse({ error: "missing_env" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: recipients, error } = await admin
    .from("setlog_prompt_recipients")
    .select("user_id, from_hour, to_hour, app_version, timezone");

  if (error) {
    console.error("send-setlog-prompt: recipients query failed", error);
    return jsonResponse({ error: "query_failed" }, 500);
  }

  // ── Whose hour is it right now? ─────────────────────────────────────
  const due: { userId: string; day: string; hour: number }[] = [];
  let skippedVersion = 0;
  let skippedWindow = 0;

  for (const row of recipients ?? []) {
    if (!row.app_version || !versionAtLeast(row.app_version, MIN_APP_VERSION)) {
      skippedVersion++;
      continue;
    }
    // No zone means no way to know what hour it is for them. Silence is the
    // right failure: a prompt at the wrong hour is worse than none.
    if (!row.timezone) {
      skippedWindow++;
      continue;
    }

    const now = localNow(row.timezone);
    if (!now) {
      skippedWindow++;
      continue;
    }

    const from = Number(row.from_hour);
    const to = Number(row.to_hour);
    // A window that wraps past midnight (22 → 6) is read as two ranges
    // rather than treated as empty.
    const inWindow =
      from <= to ? now.hour >= from && now.hour < to : now.hour >= from || now.hour < to;
    if (!inWindow) {
      skippedWindow++;
      continue;
    }

    due.push({ userId: row.user_id, day: now.day, hour: now.hour });
  }

  if (due.length === 0) {
    return jsonResponse({
      sent: 0,
      considered: recipients?.length ?? 0,
      skippedVersion,
      skippedWindow,
    });
  }

  const userIds = due.map((d) => d.userId);
  const days = [...new Set(due.map((d) => d.day))];

  // ── Two queries, not two per person ─────────────────────────────────
  const [{ data: clips }, { data: alreadySent }] = await Promise.all([
    admin
      .from("setlog_clips")
      .select("user_id, day, slot_hour")
      .in("user_id", userIds)
      .in("day", days),
    admin
      .from("notifications")
      .select("user_id, reference_id")
      .eq("type", "setlog_prompt")
      .in("user_id", userIds)
      .in("reference_id", due.map((d) => `${d.day}-${d.hour}`)),
  ]);

  const recorded = new Set(
    (clips ?? []).map((c) => `${c.user_id}:${c.day}:${c.slot_hour}`),
  );
  const prompted = new Set(
    (alreadySent ?? []).map((n) => `${n.user_id}:${n.reference_id}`),
  );

  let sent = 0;
  let skippedRecorded = 0;
  let skippedDuplicate = 0;

  for (const person of due) {
    const referenceId = `${person.day}-${person.hour}`;

    if (recorded.has(`${person.userId}:${person.day}:${person.hour}`)) {
      skippedRecorded++;
      continue;
    }
    if (prompted.has(`${person.userId}:${referenceId}`)) {
      skippedDuplicate++;
      continue;
    }

    const title = `It's ${formatHour(person.hour)}`;
    const body = "Two seconds of it?";

    // In-app first: if the push fails, the prompt is still waiting in the
    // app rather than lost entirely.
    const { error: insertError } = await admin.from("notifications").insert({
      user_id: person.userId,
      type: "setlog_prompt",
      actor_id: person.userId, // self-notification
      reference_id: referenceId,
      title,
      body,
      is_read: false,
    });

    if (insertError) {
      console.error("send-setlog-prompt: insert failed", {
        userId: person.userId,
        referenceId,
        message: insertError.message,
      });
      continue;
    }

    await sendOneSignalPush({
      recipientId: person.userId,
      heading: title,
      content: body,
      data: { day: person.day, hour: person.hour },
    });

    sent++;
  }

  console.info("send-setlog-prompt summary", {
    considered: recipients?.length ?? 0,
    due: due.length,
    sent,
    skippedVersion,
    skippedWindow,
    skippedRecorded,
    skippedDuplicate,
  });

  return jsonResponse({
    sent,
    considered: recipients?.length ?? 0,
    skippedVersion,
    skippedWindow,
    skippedRecorded,
    skippedDuplicate,
  });
});
