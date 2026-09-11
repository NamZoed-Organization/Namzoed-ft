/**
 * Setlog reel renderer.
 *
 * The one piece of Setlog that cannot live on the phone. It takes a row
 * from `setlog_renders`, downloads that day's clips, stitches them into a
 * single vertical video with ffmpeg, and puts the file back in the same
 * bucket the clips came from.
 *
 * It is deliberately dumb: it polls a table, it does one job at a time, and
 * it writes its result back to the row. No queue broker, no autoscaling, no
 * state of its own — a container that dies mid-job leaves the row in
 * `rendering`, and the reaper below puts it back on the queue.
 *
 * See README.md for deployment and the environment it needs.
 */

const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const run = promisify(execFile);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "setlog-clips";
const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 3000);

/** Stories/Reels. Every pane is fitted into a slice of this. */
const OUT_W = 1080;
const OUT_H = 1920;
/** A group holds the frame for as long as its longest clip, and never less
 *  than this — a 300ms clip flashing past is not a moment anyone sees. */
const MIN_SEGMENT_S = 1.2;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ── helpers ────────────────────────────────────────────────────────────

const hexToFfmpeg = (hex) => {
  const clean = String(hex || "#000000").replace("#", "");
  return `0x${clean.length === 6 ? clean : "000000"}`;
};

/** "3:47pm" — the same clock the app stamps, rebuilt here because the
 *  worker has the timestamp and not the app's formatter. */
const clockOf = (iso) => {
  const d = new Date(iso);
  const h24 = d.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}${h24 < 12 ? "am" : "pm"}`;
};

/** ffmpeg's drawtext takes a colon-and-backslash-hostile string. */
const escapeText = (text) =>
  String(text || "")
    .replace(/\\/g, "\\\\\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "’")
    .replace(/%/g, "\\%");

const updateJob = async (id, patch) => {
  const { error } = await supabase
    .from("setlog_renders")
    .update(patch)
    .eq("id", id);
  if (error) console.error("job update failed", id, error.message);
};

// ── the render ─────────────────────────────────────────────────────────

/**
 * Build one segment: `split` clips stacked, padded onto the output frame.
 *
 * Each pane is scaled to fit its slice and padded rather than cropped —
 * cropping a two-second clip to a third of a portrait frame throws away
 * most of what was recorded. The letterbox is the chosen background, which
 * is why that setting exists at all.
 *
 * Shorter clips in a group freeze on their last frame (`tpad`) so the group
 * holds together instead of a pane going black while its neighbours run on.
 */
const buildSegment = async (clips, params, workDir, index) => {
  const split = Math.max(1, Math.min(3, Number(params.split) || 1));
  const paneH = Math.floor(OUT_H / split);
  const bg = hexToFfmpeg(params.background);
  const seconds = Math.max(
    MIN_SEGMENT_S,
    ...clips.map((c) => (Number(c.duration_ms) || 2000) / 1000),
  );

  const args = ["-y"];
  clips.forEach((clip) => {
    if (clip.media_type === "photo") {
      args.push("-loop", "1", "-t", String(seconds), "-i", clip.file);
    } else {
      args.push("-i", clip.file);
    }
  });

  const filters = [];
  clips.forEach((clip, i) => {
    const label = `p${i}`;
    const stamp = [];
    if (params.stamp) {
      // Centred on the pane, the same place the camera put it.
      stamp.push(
        `drawtext=text='${escapeText(clockOf(clip.at))}':fontcolor=white:fontsize=${Math.round(paneH * 0.11)}:x=(w-text_w)/2:y=(h-text_h)/2-${Math.round(paneH * 0.03)}:shadowcolor=black@0.45:shadowx=2:shadowy=2`,
      );
      if (clip.title) {
        stamp.push(
          `drawtext=text='${escapeText(clip.title)}':fontcolor=white:fontsize=${Math.round(paneH * 0.055)}:x=(w-text_w)/2:y=(h-text_h)/2+${Math.round(paneH * 0.06)}:shadowcolor=black@0.45:shadowx=2:shadowy=2`,
        );
      }
    }

    filters.push(
      [
        `[${i}:v]`,
        `scale=${OUT_W}:${paneH}:force_original_aspect_ratio=decrease`,
        `pad=${OUT_W}:${paneH}:(ow-iw)/2:(oh-ih)/2:color=${bg}`,
        "setsar=1",
        `fps=30`,
        `tpad=stop_mode=clone:stop_duration=${seconds}`,
        `trim=duration=${seconds}`,
        "setpts=PTS-STARTPTS",
        ...stamp,
        `[${label}]`,
      ].join(","),
    );
  });

  const stackIn = clips.map((_, i) => `[p${i}]`).join("");
  if (split > 1) {
    filters.push(`${stackIn}vstack=inputs=${clips.length}[stacked]`);
  } else {
    filters.push(`[p0]copy[stacked]`);
  }
  // A group of fewer clips than the split (the last one, usually) still has
  // to fill the frame, so it is padded to the full height rather than left
  // sitting at the top.
  filters.push(
    `[stacked]pad=${OUT_W}:${OUT_H}:(ow-iw)/2:(oh-ih)/2:color=${bg}[v]`,
  );

  const out = path.join(workDir, `seg${index}.mp4`);
  args.push("-filter_complex", filters.join(";"), "-map", "[v]");

  // Audio: the first pane's, when sound is on. Mixing two or three
  // simultaneous two-second clips is noise, not a soundtrack.
  const firstVideo = clips.findIndex((c) => c.media_type !== "photo");
  if (params.sound && firstVideo >= 0) {
    args.push("-map", `${firstVideo}:a?`, "-c:a", "aac", "-b:a", "128k");
  } else {
    args.push("-an");
  }

  args.push(
    "-t",
    String(seconds),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-pix_fmt",
    "yuv420p",
    out,
  );

  await run("ffmpeg", args, { maxBuffer: 1024 * 1024 * 32 });
  return out;
};

const renderJob = async (job) => {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `setlog-${job.id}-`));
  try {
    const params = job.params || {};
    const clips = Array.isArray(params.clips) ? params.clips : [];
    if (clips.length === 0) throw new Error("That day has no clips to render.");

    // ── download ──
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .download(clip.path);
      if (error) throw new Error(`Couldn't read a clip: ${error.message}`);
      const file = path.join(
        workDir,
        `in${i}.${clip.media_type === "photo" ? "jpg" : "mp4"}`,
      );
      await fs.writeFile(file, Buffer.from(await data.arrayBuffer()));
      clip.file = file;
      await updateJob(job.id, {
        progress: Math.round((i / clips.length) * 40),
      });
    }

    // ── segments ──
    const split = Math.max(1, Math.min(3, Number(params.split) || 1));
    const groups = [];
    for (let i = 0; i < clips.length; i += split) {
      groups.push(clips.slice(i, i + split));
    }

    const segments = [];
    for (let i = 0; i < groups.length; i++) {
      segments.push(await buildSegment(groups[i], params, workDir, i));
      await updateJob(job.id, {
        progress: 40 + Math.round(((i + 1) / groups.length) * 45),
      });
    }

    // ── concat ──
    // The demuxer, not the filter: every segment was just encoded here with
    // identical settings, so they concatenate without re-encoding — which
    // is most of the reason this finishes in seconds rather than minutes.
    const listFile = path.join(workDir, "segments.txt");
    await fs.writeFile(
      listFile,
      segments.map((s) => `file '${s}'`).join("\n"),
    );

    let output = path.join(workDir, "reel.mp4");
    await run(
      "ffmpeg",
      [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", listFile,
        "-c", "copy",
        // Playback can start before the whole file has arrived.
        "-movflags", "+faststart",
        output,
      ],
      { maxBuffer: 1024 * 1024 * 32 },
    );

    // ── watermark ──
    if (params.watermark) {
      const marked = path.join(workDir, "reel-marked.mp4");
      const logo = path.join(__dirname, "assets", "logo.png");
      if (await fs.stat(logo).then(() => true).catch(() => false)) {
        await run(
          "ffmpeg",
          [
            "-y",
            "-i", output,
            "-i", logo,
            "-filter_complex",
            "[1:v]scale=96:-1[wm];[0:v][wm]overlay=W-w-40:H-h-64:format=auto",
            "-c:a", "copy",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "22",
            "-movflags", "+faststart",
            marked,
          ],
          { maxBuffer: 1024 * 1024 * 32 },
        );
        output = marked;
      }
    }

    await updateJob(job.id, { progress: 92 });

    // ── upload ──
    // The same `<setlog>/<user>/…` shape everything else uses, so the
    // bucket's existing policies cover reading it back.
    const outPath = `${job.setlog_id}/${job.user_id}/exports/${job.day}-reel-${job.id}.mp4`;
    const bytes = await fs.readFile(output);
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(outPath, bytes, {
        contentType: "video/mp4",
        upsert: true,
        cacheControl: "31536000",
      });
    if (upErr) throw new Error(`Couldn't save the reel: ${upErr.message}`);

    await updateJob(job.id, {
      status: "done",
      progress: 100,
      output_path: outPath,
      error: null,
    });
    console.info("rendered", job.id, outPath);
  } catch (e) {
    console.error("render failed", job.id, e);
    await updateJob(job.id, {
      status: "failed",
      error: String(e?.message || e).slice(0, 300),
    });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
};

// ── the loop ───────────────────────────────────────────────────────────

/** A container that died mid-job left a row claimed and unfinished. After
 *  ten minutes it is not being worked on by anybody. */
const requeueStale = async () => {
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  await supabase
    .from("setlog_renders")
    .update({ status: "queued", progress: 0 })
    .eq("status", "rendering")
    .lt("updated_at", cutoff);
};

const claimNext = async () => {
  const { data } = await supabase
    .from("setlog_renders")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  const job = data?.[0];
  if (!job) return null;

  // One worker wins: the update only matches while the row is still queued.
  const { data: claimed } = await supabase
    .from("setlog_renders")
    .update({ status: "rendering", progress: 1 })
    .eq("id", job.id)
    .eq("status", "queued")
    .select();

  return claimed?.[0] ?? null;
};

const loop = async () => {
  for (;;) {
    try {
      await requeueStale();
      const job = await claimNext();
      if (job) {
        await renderJob(job);
        continue; // straight on to the next, without waiting out a poll
      }
    } catch (e) {
      console.error("worker loop error", e);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
};

console.info("setlog render worker up");
loop();
