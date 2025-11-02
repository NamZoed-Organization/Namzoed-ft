// @ts-nocheck
import { serve } from "https://deno.land/std@0.198.0/http/server.ts";

interface CreateLiveStreamRequest {
  host_id?: string;
  title?: string;
  description?: string;
  record?: boolean;
  playback_policy?: "public" | "authenticated";
}

interface StreamLiveStreamResponse {
  id: string;
  name: string | null;
  playback_ids?: Array<{ policy: string; id: string }>;
  playback_url?: string | null;
  hls_url?: string | null;
  dash_url?: string | null;
  stream_key?: string | null;
  rtmp_address?: string | null;
  broadcaster_host_id?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

const STREAM_API_KEY = Deno.env.get("GETSTREAM_API_KEY");
const STREAM_API_SECRET = Deno.env.get("GETSTREAM_SECRET");
const STREAM_VIDEO_BASE_URL =
  Deno.env.get("GETSTREAM_VIDEO_BASE_URL")?.replace(/\/$/, "") ??
  "https://video.stream-io-api.com";

if (!STREAM_API_KEY || !STREAM_API_SECRET) {
  console.error(
    "Missing GetStream credentials in Supabase environment. Set GETSTREAM_API_KEY and GETSTREAM_SECRET."
  );
}

const buildAuthHeader = () => {
  const credentials = `${STREAM_API_KEY}:${STREAM_API_SECRET}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
};

const createStreamLiveStream = async (
  payload: CreateLiveStreamRequest
): Promise<Response> => {
  if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    return new Response(
      JSON.stringify({ error: "GetStream credentials are not configured." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const response = await fetch(`${STREAM_VIDEO_BASE_URL}/live_streams`, {
    method: "POST",
    headers: {
      Authorization: buildAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: payload.title ?? null,
      broadcaster_host_id: payload.host_id ?? null,
      record: payload.record ?? false,
      playback_policy: payload.playback_policy ?? "public",
      description: payload.description ?? null,
    }),
  });

  const responseBody = (await response.json().catch(() => null)) ?? {};

  if (!response.ok) {
    console.error("Failed to create Stream Live Stream", responseBody);
    return new Response(
      JSON.stringify({
        error: "Failed to create Stream Live Stream",
        status: response.status,
        body: responseBody,
      }),
      {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const liveStream =
    (responseBody as Record<string, unknown>)?.data ?? responseBody ?? null;

  return new Response(JSON.stringify({ liveStream }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let payload: CreateLiveStreamRequest | null = null;

  try {
    const text = await req.text();
    if (text.trim().length === 0) {
      throw new Error("Missing request body");
    }
    payload = JSON.parse(text);
  } catch (error) {
    console.error("create-live-stream: invalid JSON payload", error);
    return new Response(JSON.stringify({ error: "Invalid JSON payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!payload?.host_id) {
    return new Response(JSON.stringify({ error: "host_id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  return await createStreamLiveStream(payload);
});
