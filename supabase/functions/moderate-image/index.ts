// @ts-nocheck
/**
 * moderate-image — Supabase Edge Function
 *
 * Scans an image with the Google Cloud Vision API and decides whether it can be
 * posted. Returns one of three decisions:
 *
 *   'block'        — illegal / disallowed content (nudity, explicit, drugs,
 *                    tobacco/cigarettes, sex / adult toys). Upload must be rejected.
 *   'age_restrict' — legal but mature / age-sensitive content (condoms, lubricants,
 *                    other sexual-wellness items, or borderline racy). Allowed but
 *                    tagged 18+ so only verified adults can view it.
 *   'allow'        — general-audience content.
 *
 * Authenticates as a Google service account: the full service-account JSON is
 * stored in the GOOGLE_SERVICE_ACCOUNT_JSON secret (paste it as-is). The
 * function signs a short-lived JWT, exchanges it for an OAuth access token
 * (cached across invocations), and calls Vision with a Bearer token. The
 * private key never leaves the server.
 *
 *   supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<paste full JSON>'
 *   supabase functions deploy moderate-image
 */
import { serve } from "https://deno.land/std@0.198.0/http/server.ts";

const SERVICE_ACCOUNT_JSON = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") ?? "";
const VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";
const VISION_SCOPE = "https://www.googleapis.com/auth/cloud-vision";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let serviceAccount: ServiceAccount | null = null;
try {
  if (SERVICE_ACCOUNT_JSON) serviceAccount = JSON.parse(SERVICE_ACCOUNT_JSON);
} catch (err) {
  console.error("Invalid GOOGLE_SERVICE_ACCOUNT_JSON:", err);
}

// Cache the OAuth access token across invocations (tokens last ~1h).
let cachedToken: { value: string; expiresAt: number } | null = null;

const base64UrlEncode = (input: string | Uint8Array): string => {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

// Decode the PEM PKCS#8 private key body to raw DER bytes.
const pemToBytes = (pem: string): Uint8Array => {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

// Mint (or reuse a cached) OAuth access token for the service account.
const getAccessToken = async (sa: ServiceAccount): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt - 60 > now) {
    return cachedToken.value;
  }

  const tokenUri = sa.token_uri || "https://oauth2.googleapis.com/token";
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: VISION_SCOPE,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload),
  )}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(unsigned),
    ),
  );
  const jwt = `${unsigned}.${base64UrlEncode(signature)}`;

  const res = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth token exchange failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600),
  };
  return cachedToken.value;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// ── Likelihood scale ──────────────────────────────────────────────────────────
// Vision returns: UNKNOWN | VERY_UNLIKELY | UNLIKELY | POSSIBLE | LIKELY | VERY_LIKELY
const LIKELIHOOD: Record<string, number> = {
  UNKNOWN: 0,
  VERY_UNLIKELY: 0,
  UNLIKELY: 1,
  POSSIBLE: 2,
  LIKELY: 3,
  VERY_LIKELY: 4,
};

// adult/racy at LIKELY (3) or above → hard block (nudity / explicit)
const BLOCK_LIKELIHOOD = 3;
// adult/racy at POSSIBLE (2) → age-gate as 18+
const GATE_LIKELIHOOD = 2;
// minimum Vision label confidence we trust
const LABEL_SCORE_MIN = 0.7;

// Labels that mean the image must be blocked outright.
const BLOCK_LABELS = [
  "drug",
  "narcotic",
  "cocaine",
  "heroin",
  "cannabis",
  "marijuana",
  "weed",
  "joint",
  "blunt",
  "bong",
  "syringe",
  "cigarette",
  "cigar",
  "tobacco",
  "smoking",
  "vape",
  "vaping",
  "e-cigarette",
  "hookah",
  "dildo",
  "vibrator",
  "sex toy",
  "adult toy",
  "buttplug",
  "butt plug",
];

// Legal-but-mature labels → age-gate (18+), not block.
const GATE_LABELS = [
  "condom",
  "lubricant",
  "contraceptive",
  "sexual wellness",
  "lingerie",
  "underwear",
];

function matchLabel(label: string, list: string[]): string | null {
  const l = label.toLowerCase();
  for (const term of list) {
    if (l.includes(term)) return term;
  }
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
      return new Response(
        JSON.stringify({ error: "Service account not configured" }),
        { status: 500, headers: CORS_HEADERS },
      );
    }

    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(
        JSON.stringify({ error: "imageBase64 is required" }),
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const accessToken = await getAccessToken(serviceAccount);

    const visionReq = {
      requests: [
        {
          image: { content: imageBase64 },
          features: [
            { type: "SAFE_SEARCH_DETECTION" },
            { type: "LABEL_DETECTION", maxResults: 25 },
          ],
        },
      ],
    };

    const visionRes = await fetch(VISION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(visionReq),
    });

    if (!visionRes.ok) {
      const text = await visionRes.text();
      console.error("Vision API error:", visionRes.status, text);
      return new Response(
        JSON.stringify({ error: "Vision API request failed" }),
        { status: 502, headers: CORS_HEADERS },
      );
    }

    const visionData = await visionRes.json();
    const result = visionData?.responses?.[0] ?? {};
    const safe = result.safeSearchAnnotation ?? {};
    const labels: Array<{ description?: string; score?: number }> =
      result.labelAnnotations ?? [];

    const adult = LIKELIHOOD[safe.adult] ?? 0;
    const racy = LIKELIHOOD[safe.racy] ?? 0;

    const categories: string[] = [];
    let decision: "block" | "age_restrict" | "allow" = "allow";

    // 1. Hard block: explicit nudity via SafeSearch.
    if (adult >= BLOCK_LIKELIHOOD) {
      decision = "block";
      categories.push("nudity");
    } else if (racy >= BLOCK_LIKELIHOOD) {
      decision = "block";
      categories.push("explicit");
    }

    // 2. Hard block: disallowed objects via labels (drugs, tobacco, toys).
    for (const l of labels) {
      if ((l.score ?? 0) < LABEL_SCORE_MIN) continue;
      const hit = matchLabel(l.description ?? "", BLOCK_LABELS);
      if (hit) {
        decision = "block";
        if (!categories.includes(hit)) categories.push(hit);
      }
    }

    // 3. Age-gate (only if not already blocked): borderline racy or legal-mature labels.
    if (decision !== "block") {
      if (adult >= GATE_LIKELIHOOD || racy >= GATE_LIKELIHOOD) {
        decision = "age_restrict";
        categories.push("suggestive");
      }
      for (const l of labels) {
        if ((l.score ?? 0) < LABEL_SCORE_MIN) continue;
        const hit = matchLabel(l.description ?? "", GATE_LABELS);
        if (hit) {
          decision = "age_restrict";
          if (!categories.includes(hit)) categories.push(hit);
        }
      }
    }

    const rating =
      decision === "block"
        ? "review_required"
        : decision === "age_restrict"
          ? "18_plus"
          : "general";

    const reason =
      decision === "block"
        ? `This image can't be posted: it appears to contain ${categories.join(", ") || "disallowed content"}.`
        : undefined;

    return new Response(
      JSON.stringify({
        decision,
        rating,
        categories,
        reason,
        safeSearch: { adult: safe.adult, racy: safe.racy },
      }),
      { status: 200, headers: CORS_HEADERS },
    );
  } catch (err) {
    console.error("moderate-image error:", err);
    return new Response(
      JSON.stringify({ error: String(err?.message ?? err) }),
      { status: 500, headers: CORS_HEADERS },
    );
  }
});
