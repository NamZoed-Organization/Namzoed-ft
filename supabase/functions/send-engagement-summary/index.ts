// @ts-nocheck
import { serve } from "https://deno.land/std@0.198.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * send-engagement-summary
 *
 * Scheduled edge function called by two pg_cron jobs:
 *
 *   mode: "weekly_engagement"  — every Monday 9 AM UTC
 *     Sends each user a weekly digest: "Your posts got X views and Y people
 *     visited your profile this week."
 *
 *   mode: "post_traction"  — every day 10 AM UTC
 *     Finds posts created in the last 24h with ≥10 views and no traction
 *     notification yet, then sends the owner a push.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

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

// ─── OneSignal helper ─────────────────────────────────────────────────────────

async function sendOneSignalPush(payload: {
  recipientId: string;
  heading: string;
  content: string;
  type: string;
  data?: Record<string, unknown>;
  collapseId?: string;
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
      data: { type: payload.type, ...(payload.data ?? {}) },
      target_channel: "push",
      include_aliases: { external_id: [payload.recipientId] },
      ...(payload.collapseId
        ? { collapse_id: payload.collapseId }
        : {}),
    }),
  }).catch(() => {}); // fire-and-forget per recipient
}

// ─── Mode: weekly_engagement ─────────────────────────────────────────────────

async function handleWeeklyEngagement(
  admin: ReturnType<typeof createClient>,
): Promise<Response> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().split("T")[0]; // "YYYY-MM-DD"

  // Aggregate post views per post owner over the past 7 days
  const { data: postViewRows, error: pvError } = await admin.rpc(
    "get_weekly_post_view_summary",
    { since_date: cutoff },
  );

  // Aggregate profile views per profile over the past 7 days
  const { data: profileViewRows, error: prError } = await admin.rpc(
    "get_weekly_profile_view_summary",
    { since_date: cutoff },
  );

  if (pvError || prError) {
    console.error("RPC errors:", pvError, prError);
    return jsonResponse({ error: "rpc_failed" }, 500);
  }

  // Merge both result sets by user ID
  const userMap = new Map<string, { postViews: number; profileViews: number }>();

  for (const row of postViewRows ?? []) {
    userMap.set(row.post_owner_id, {
      postViews: Number(row.total_views),
      profileViews: 0,
    });
  }
  for (const row of profileViewRows ?? []) {
    const existing = userMap.get(row.profile_id) ?? {
      postViews: 0,
      profileViews: 0,
    };
    existing.profileViews = Number(row.total_views);
    userMap.set(row.profile_id, existing);
  }

  let sent = 0;
  for (const [userId, stats] of userMap) {
    if (stats.postViews === 0 && stats.profileViews === 0) continue;

    const parts: string[] = [];
    if (stats.postViews > 0) {
      parts.push(
        `your posts got ${stats.postViews} ${stats.postViews === 1 ? "view" : "views"}`,
      );
    }
    if (stats.profileViews > 0) {
      parts.push(
        `${stats.profileViews} ${stats.profileViews === 1 ? "person" : "people"} visited your profile`,
      );
    }

    const title = "Your Weekly Engagement";
    const body = `This week: ${parts.join(" and ")}.`;

    // Insert into notifications table (service role bypasses RLS)
    await admin.from("notifications").insert({
      user_id: userId,
      type: "weekly_engagement",
      actor_id: userId, // self-notification
      title,
      body,
      is_read: false,
    });

    await sendOneSignalPush({
      recipientId: userId,
      heading: title,
      content: body,
      type: "weekly_engagement",
      data: { post_views: stats.postViews, profile_views: stats.profileViews },
      collapseId: `weekly_engagement_${userId}`,
    });

    sent++;
  }

  return jsonResponse({ success: true, sent });
}

// ─── Mode: post_traction ─────────────────────────────────────────────────────

async function handlePostTraction(
  admin: ReturnType<typeof createClient>,
): Promise<Response> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const cutoff = oneDayAgo.toISOString();

  // Find posts created in the last 24h with ≥10 views and no traction notif yet
  const { data: tractionPosts, error } = await admin
    .from("posts")
    .select("id, user_id, view_count")
    .gte("created_at", cutoff)
    .gte("view_count", 10)
    .is("traction_notif_sent_at", null);

  if (error) {
    console.error("traction query error:", error);
    return jsonResponse({ error: "query_failed" }, 500);
  }

  let sent = 0;
  for (const post of tractionPosts ?? []) {
    // Optimistic mark-as-sent first to prevent race conditions between
    // concurrent runs (the .is("traction_notif_sent_at", null) filter is
    // not atomic with the update, so we rely on update row count instead)
    const { count: updated } = await admin
      .from("posts")
      .update({ traction_notif_sent_at: new Date().toISOString() })
      .eq("id", post.id)
      .is("traction_notif_sent_at", null)
      .select("id", { count: "exact", head: true });

    if (!updated || updated === 0) continue; // another run already processed it

    const title = "Your post is gaining momentum!";
    const body = `Your post has been viewed ${post.view_count} times in its first 24 hours.`;

    await admin.from("notifications").insert({
      user_id: post.user_id,
      type: "post_traction",
      actor_id: post.user_id,
      reference_id: post.id,
      title,
      body,
      is_read: false,
    });

    await sendOneSignalPush({
      recipientId: post.user_id,
      heading: title,
      content: body,
      type: "post_traction",
      data: { reference_id: post.id, view_count: post.view_count },
    });

    sent++;
  }

  return jsonResponse({ success: true, sent });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  let body: { mode?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = { mode: "weekly_engagement" };
  }

  const mode = body.mode ?? "weekly_engagement";

  if (mode === "weekly_engagement") {
    return await handleWeeklyEngagement(admin);
  }

  if (mode === "post_traction") {
    return await handlePostTraction(admin);
  }

  return jsonResponse({ error: `Unknown mode: ${mode}` }, 400);
});
