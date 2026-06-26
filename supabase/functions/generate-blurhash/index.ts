// @ts-nocheck
/**
 * generate-blurhash — Supabase Edge Function
 *
 * Computes a BlurHash for each image on a post and stores them in
 * `posts.blur_hashes` (a JSON array aligned by index with `posts.images`).
 * Powers the Instagram-style progressive image loader on the client:
 * a blurred preview paints instantly, then crossfades to the sharp image.
 *
 * Modes (POST JSON body):
 *   { "postId": "<uuid>" }              → (re)generate hashes for one post
 *   { "backfill": true, "limit": 200 }  → process posts where blur_hashes IS NULL
 *
 * Video URLs are skipped (null entry). Generation is best-effort: a failed
 * image yields null and the client falls back to a solid placeholder.
 *
 * Deploy:
 *   supabase functions deploy generate-blurhash
 * (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
 */
import { serve } from "https://deno.land/std@0.198.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode } from "https://esm.sh/blurhash@2.0.5";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const VIDEO_EXTS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
const isVideoUrl = (url: string) => {
  const u = url.toLowerCase();
  return VIDEO_EXTS.some((e) => u.includes(e)) || u.includes("post-videos");
};

// Encode a single remote image into a BlurHash, or null on any failure.
async function blurHashForUrl(url: string): Promise<string | null> {
  try {
    if (isVideoUrl(url)) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    const image = await Image.decode(buf);

    // Downscale for speed — blurhash only needs a tiny source.
    const MAX = 32;
    const scale = Math.min(1, MAX / Math.max(image.width, image.height));
    const small =
      scale < 1
        ? image.resize(
            Math.max(1, Math.round(image.width * scale)),
            Math.max(1, Math.round(image.height * scale)),
          )
        : image;

    // ImageScript bitmap is RGBA; blurhash wants a Uint8ClampedArray.
    const pixels = new Uint8ClampedArray(small.bitmap);
    return encode(pixels, small.width, small.height, 4, 3);
  } catch (_err) {
    return null;
  }
}

async function processPost(
  supabase: any,
  post: { id: string; images: string[] | null },
): Promise<{ id: string; count: number }> {
  const images = Array.isArray(post.images) ? post.images : [];
  const hashes = await Promise.all(images.map((u) => blurHashForUrl(u)));
  await supabase.from("posts").update({ blur_hashes: hashes }).eq("id", post.id);
  return { id: post.id, count: hashes.filter(Boolean).length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  try {
    const body = await req.json().catch(() => ({}));

    // ── Backfill mode ──────────────────────────────────────────────────────
    if (body.backfill) {
      const limit = Math.min(Number(body.limit) || 200, 500);
      const { data: posts, error } = await supabase
        .from("posts")
        .select("id, images")
        .is("blur_hashes", null)
        .not("images", "is", null)
        .limit(limit);
      if (error) throw error;

      const results = [];
      // Sequential to keep memory/CPU bounded on the edge runtime.
      for (const p of posts ?? []) {
        results.push(await processPost(supabase, p));
      }
      return new Response(
        JSON.stringify({ processed: results.length, results }),
        { headers: CORS_HEADERS },
      );
    }

    // ── Single-post mode ───────────────────────────────────────────────────
    const postId = body.postId;
    if (!postId) {
      return new Response(
        JSON.stringify({ error: "postId or backfill required" }),
        { status: 400, headers: CORS_HEADERS },
      );
    }
    const { data: post, error } = await supabase
      .from("posts")
      .select("id, images")
      .eq("id", postId)
      .maybeSingle();
    if (error) throw error;
    if (!post) {
      return new Response(JSON.stringify({ error: "post not found" }), {
        status: 404,
        headers: CORS_HEADERS,
      });
    }

    const result = await processPost(supabase, post);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: CORS_HEADERS,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
});
