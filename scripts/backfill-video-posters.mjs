#!/usr/bin/env node
/**
 * Backfill poster frames for post videos uploaded before posters existed.
 *
 * Grids draw a video's poster instead of mounting a player on it
 * (components/ui/GridThumbnail.tsx). New uploads get one from `uploadVideo`
 * (lib/postsService.ts); older videos have none, so their tiles fall back to
 * downloading the video to show its first frame. Run this once to give them
 * posters too. It is safe to run again: videos that already have a poster are
 * skipped.
 *
 * Usage:
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
 *     node scripts/backfill-video-posters.mjs [--dry-run] [--limit N]
 *
 * Needs ffmpeg on PATH. The service role key belongs on your machine only —
 * never in the app.
 */

import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

// Keep in step with lib/imagePreview.ts (VIDEO_POSTER_BUCKET, videoPosterPath).
const POSTER_BUCKET = "post-images";
const VIDEO_MARKER = "/storage/v1/object/public/post-videos/";
const posterPath = (videoFileName) =>
  `posters/${videoFileName.replace(/\.[^./]+$/, "")}.jpg`;
// Same as POSTER_MAX_WIDTH in lib/postsService.ts.
const POSTER_MAX_WIDTH = 720;
const PAGE_SIZE = 500;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitIndex = args.indexOf("--limit");
const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : Infinity;

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function collectVideoFileNames() {
  const names = new Set();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("posts")
      .select("images")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    for (const post of data ?? []) {
      for (const url of post.images ?? []) {
        if (typeof url !== "string" || !url.includes(VIDEO_MARKER)) continue;
        const fileName = url.split(VIDEO_MARKER)[1].split("?")[0];
        if (fileName) names.add(fileName);
      }
    }
    if (!data || data.length < PAGE_SIZE) break;
  }
  return [...names];
}

async function posterExists(path) {
  const { data } = supabase.storage.from(POSTER_BUCKET).getPublicUrl(path);
  const res = await fetch(data.publicUrl, { method: "HEAD" });
  return res.ok;
}

async function makePoster(videoFileName, dir) {
  const { data } = supabase.storage.from("post-videos").getPublicUrl(videoFileName);
  const out = join(dir, "poster.jpg");
  // First frame, capped at POSTER_MAX_WIDTH, never upscaled. ffmpeg applies
  // the video's rotation metadata itself, so portrait clips stay portrait.
  await run("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-y",
    "-i", data.publicUrl,
    "-frames:v", "1",
    "-vf", `scale='min(${POSTER_MAX_WIDTH},iw)':-2`,
    "-q:v", "4",
    out,
  ]);
  return readFile(out);
}

const videos = (await collectVideoFileNames()).slice(0, limit);
console.log(`${videos.length} post video(s) to check${dryRun ? " (dry run)" : ""}.`);

const dir = await mkdtemp(join(tmpdir(), "namzoed-posters-"));
let made = 0;
let skipped = 0;
let failed = 0;

try {
  for (const fileName of videos) {
    const path = posterPath(fileName);
    if (await posterExists(path)) {
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`would create ${POSTER_BUCKET}/${path}`);
      made++;
      continue;
    }
    try {
      const bytes = await makePoster(fileName, dir);
      const { error } = await supabase.storage
        .from(POSTER_BUCKET)
        .upload(path, bytes, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
          upsert: false,
        });
      if (error) throw error;
      made++;
      console.log(`created ${POSTER_BUCKET}/${path} (${Math.round(bytes.length / 1024)} KB)`);
    } catch (e) {
      failed++;
      console.warn(`failed ${fileName}: ${e.message ?? e}`);
    }
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log(
  `${dryRun ? "Would create" : "Created"} ${made}, already had one ${skipped}, failed ${failed}.`,
);
