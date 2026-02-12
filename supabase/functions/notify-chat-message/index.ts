// @ts-nocheck
import { serve } from "https://deno.land/std@0.198.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type NotifyChatMessageRequest = {
  sender_id?: string;
  receiver_id?: string;
  message_type?: "text" | "image" | "audio";
  preview?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (
  body: Record<string, unknown>,
  status = 200,
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const buildPreview = (
  messageType: string | undefined,
  preview: string | undefined,
): string => {
  const cleaned = (preview ?? "").trim();
  if (cleaned.length > 0) {
    return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
  }

  if (messageType === "image") return "Sent an image";
  if (messageType === "audio") return "Sent a voice message";
  return "Sent a message";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method Not Allowed" }, 405);
  }

  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    !SUPABASE_SERVICE_ROLE_KEY ||
    !ONESIGNAL_APP_ID ||
    !ONESIGNAL_REST_API_KEY
  ) {
    return jsonResponse(
      {
        success: false,
        error:
          "Missing required environment variables. Set SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, ONESIGNAL_APP_ID, and ONESIGNAL_REST_API_KEY.",
      },
      500,
    );
  }

  let payload: NotifyChatMessageRequest;
  try {
    payload = (await req.json()) as NotifyChatMessageRequest;
  } catch (_error) {
    return jsonResponse({ success: false, error: "Invalid JSON payload" }, 400);
  }

  const requestedSenderId = String(payload.sender_id ?? "");
  const receiverId = String(payload.receiver_id ?? "");
  const messageType = String(payload.message_type ?? "text");
  const preview = String(payload.preview ?? "");

  if (!receiverId) {
    return jsonResponse(
      { success: false, error: "receiver_id is required." },
      400,
    );
  }

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
    return jsonResponse({ success: false, error: "Unauthorized request." }, 401);
  }

  const senderId = user.id;

  if (requestedSenderId && requestedSenderId !== senderId) {
    console.warn("notify-chat-message sender mismatch; using authenticated user.", {
      requestedSenderId,
      authenticatedSenderId: senderId,
    });
  }

  if (senderId === receiverId) {
    return jsonResponse({ success: false, error: "Self message ignored." }, 200);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: senderProfile } = await admin
    .from("profiles")
    .select("name")
    .eq("id", senderId)
    .maybeSingle();

  const senderName = String(senderProfile?.name || "New message");
  const textPreview = buildPreview(messageType, preview);

  const oneSignalResponse = await fetch(
    "https://api.onesignal.com/notifications?c=push",
    {
      method: "POST",
      headers: {
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        target_channel: "push",
        include_aliases: {
          external_id: [receiverId],
        },
        headings: {
          en: senderName,
        },
        contents: {
          en: textPreview,
        },
        data: {
          type: "chat_message",
          sender_id: senderId,
          receiver_id: receiverId,
          chat_partner_id: senderId,
          message_type: messageType,
          route: `/chat/${senderId}`,
        },
      }),
    },
  );

  const oneSignalPayload =
    (await oneSignalResponse.json().catch(() => null)) ?? null;

  if (!oneSignalResponse.ok) {
    console.error("OneSignal API error:", oneSignalPayload);
    return jsonResponse(
      {
        success: false,
        error: "Failed to send notification via OneSignal.",
        status: oneSignalResponse.status,
      },
      502,
    );
  }

  return jsonResponse({
    success: true,
    id: (oneSignalPayload as Record<string, unknown> | null)?.id ?? null,
  });
});
