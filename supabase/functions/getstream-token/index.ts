// @ts-nocheck
/**
 * getstream-token — Supabase Edge Function
 *
 * Generates a signed Stream Video JWT for the requesting user.
 * Control characters (U+0000–U+001F) are stripped from all string fields
 * BEFORE they appear in the JWT payload to prevent JSON parse failures in
 * the Stream SDK on iOS/JSC.
 */
import { serve } from "https://deno.land/std@0.198.0/http/server.ts";

const STREAM_API_KEY    = Deno.env.get("GETSTREAM_API_KEY") ?? "";
const STREAM_API_SECRET = Deno.env.get("GETSTREAM_SECRET")  ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── helpers ──────────────────────────────────────────────────────────────────

/** Remove every character in the U+0000–U+001F range. */
function stripControl(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001F]/g, "");
}

function sanitize(value: unknown): string {
  if (value == null)           return "";
  if (typeof value !== "string") return "";
  return stripControl(value.trim());
}

/** base64url-encode a Uint8Array (no padding). */
function b64url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Build and sign a Stream Video JWT (HS256). */
async function createStreamToken(userId: string): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60 * 24; // 24 hours

  const header  = { alg: "HS256", typ: "JWT" };
  const payload = {
    user_id: userId,
    iss:     "stream-video-go",
    sub:     `user/${userId}`,
    iat,
    exp,
  };

  const enc    = new TextEncoder();
  const hdr    = b64url(enc.encode(JSON.stringify(header)));
  const pld    = b64url(enc.encode(JSON.stringify(payload)));
  const msg    = `${hdr}.${pld}`;

  const secretKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(STREAM_API_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", secretKey, enc.encode(msg));
  return `${msg}.${b64url(new Uint8Array(sig))}`;
}

// ── handler ───────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    if (!STREAM_API_KEY || !STREAM_API_SECRET) {
      return new Response(
        JSON.stringify({ error: "GetStream credentials not configured." }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));

    // Sanitize every incoming string field before using it in the JWT
    const userId = sanitize(body.user_id);

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "user_id is required." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const token = await createStreamToken(userId);

    return new Response(
      JSON.stringify({ token }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[getstream-token] error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
