// @ts-nocheck
import { serve } from "https://deno.land/std@0.198.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * Generic push notification edge function.
 *
 * Sends push notifications via OneSignal for any notification type:
 * new_follower, post_liked, post_commented, user_went_live, new_post.
 *
 * Payload:
 *   recipient_ids  string[]   OneSignal external_ids of recipients
 *   heading        string     Notification title
 *   content        string     Notification body
 *   type           string     Notification type (for routing on click)
 *   data           object     Additional data payload
 *   actor_avatar_url string?  Sender/actor avatar URL
 */

type PushPayload = {
  recipient_ids?: string[];
  heading?: string;
  content?: string;
  type?: string;
  data?: Record<string, unknown>;
  actor_avatar_url?: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** OneSignal allows max 2000 aliases per request */
const BATCH_SIZE = 2000;

const sendOneSignalBatch = async (
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; recipients: number; id: string | null }> => {
  const response = await fetch(
    "https://api.onesignal.com/notifications?c=push",
    {
      method: "POST",
      headers: {
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const result = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  const recipients = Number(result?.recipients ?? 0);

  return {
    ok: response.ok,
    recipients: Number.isFinite(recipients) ? recipients : 0,
    id: (result?.id as string) ?? null,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method Not Allowed" }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    return jsonResponse(
      { success: false, error: "Missing required environment variables." },
      500,
    );
  }

  // Authenticate the caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ success: false, error: "Missing auth header." }, 401);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ success: false, error: "Unauthorized." }, 401);
  }

  let payload: PushPayload;
  try {
    payload = (await req.json()) as PushPayload;
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON payload." }, 400);
  }

  const recipientIds = payload.recipient_ids ?? [];
  const heading = String(payload.heading ?? "Namzoed");
  const content = String(payload.content ?? "");
  const type = String(payload.type ?? "");
  const data = payload.data ?? {};
  const actorAvatarUrl = payload.actor_avatar_url ?? null;

  if (recipientIds.length === 0 || !content) {
    return jsonResponse(
      { success: false, error: "recipient_ids and content are required." },
      400,
    );
  }

  // Filter out the sender from recipients (don't notify yourself)
  const filteredIds = recipientIds.filter((id) => id !== user.id);
  if (filteredIds.length === 0) {
    return jsonResponse({ success: true, recipients: 0, delivered: false });
  }

  // Build the base OneSignal payload
  const basePayload: Record<string, unknown> = {
    app_id: ONESIGNAL_APP_ID,
    headings: { en: heading },
    contents: { en: content },
    data: { type, ...data },
    target_channel: "push",
    // Actor avatar as large icon (Android) and attachment (iOS)
    ...(actorAvatarUrl
      ? {
          large_icon: actorAvatarUrl,
          big_picture: actorAvatarUrl,
          ios_attachments: { avatar: actorAvatarUrl },
        }
      : {}),
    // Group by notification type
    android_group: type,
    thread_id: type,
  };

  // Send in batches of BATCH_SIZE
  let totalRecipients = 0;
  let totalBatches = 0;
  let failures = 0;

  for (let i = 0; i < filteredIds.length; i += BATCH_SIZE) {
    const batch = filteredIds.slice(i, i + BATCH_SIZE);
    const batchPayload = {
      ...basePayload,
      include_aliases: { external_id: batch },
    };

    const result = await sendOneSignalBatch(batchPayload);
    totalBatches++;

    if (result.ok) {
      totalRecipients += result.recipients;
    } else {
      failures++;
      console.error("OneSignal batch failed:", { batch: totalBatches, type });
    }
  }

  console.info("send-push-notification summary", {
    type,
    senderId: user.id,
    totalRecipientIds: filteredIds.length,
    totalBatches,
    totalDelivered: totalRecipients,
    failures,
  });

  return jsonResponse({
    success: true,
    recipients: totalRecipients,
    delivered: totalRecipients > 0,
    batches: totalBatches,
  });
});
