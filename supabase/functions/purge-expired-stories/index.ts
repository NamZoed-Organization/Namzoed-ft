// @ts-nocheck
import { serve } from "https://deno.land/std@0.198.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/**
 * purge-expired-stories
 *
 * Scheduled edge function called every 10 minutes by pg_cron
 * ('purge-expired-story-media'). Removes the Storage object for any story
 * older than 24h that hasn't been purged yet, then stamps `purged_at` so the
 * separate `cleanup_expired_stories()` SQL function (run 2 minutes later)
 * knows it's safe to hard-delete the row without orphaning a Storage file.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

// Public URLs look like:
//   https://<project-ref>.supabase.co/storage/v1/object/public/stories/<userId>/<file>
// Extract the "<userId>/<file>" path relative to the bucket.
function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(url.slice(idx + marker.length));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: expired, error } = await admin
    .from("stories")
    .select("id, image_url")
    .lt("created_at", cutoff)
    .is("purged_at", null);

  if (error) {
    console.error("[purge-expired-stories] query error:", error);
    return jsonResponse({ error: "query_failed" }, 500);
  }

  let purged = 0;
  let failed = 0;

  for (const story of expired ?? []) {
    const path = storagePathFromPublicUrl(story.image_url, "stories");

    if (path) {
      const { error: removeError } = await admin.storage
        .from("stories")
        .remove([path]);

      if (removeError) {
        console.error(
          `[purge-expired-stories] failed to remove ${path}:`,
          removeError,
        );
        failed++;
        continue; // retry this row next run
      }
    }
    // If the URL didn't match the expected shape, still stamp purged_at —
    // there's nothing more we can do with a malformed path, and leaving it
    // stuck forever would block the hard-delete cleanup indefinitely.

    const { error: updateError } = await admin
      .from("stories")
      .update({ purged_at: new Date().toISOString() })
      .eq("id", story.id);

    if (updateError) {
      console.error(
        `[purge-expired-stories] failed to stamp purged_at for ${story.id}:`,
        updateError,
      );
      failed++;
      continue;
    }

    purged++;
  }

  return jsonResponse({ success: true, purged, failed });
});
