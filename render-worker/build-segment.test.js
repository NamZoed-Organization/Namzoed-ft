/**
 * Runs the real stitching pipeline on generated clips — no Supabase, no
 * queue, no deploy. `node build-segment.test.js` (needs ffmpeg on PATH).
 *
 * This exists because the render is the one part of Setlog nobody can see
 * working until a worker is running somewhere, so it was written and shipped
 * without ever having been executed.
 */
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const run = promisify(execFile);
const { buildSegment, concatSegments } = require("./index.js");

const probe = async (file) => {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height,nb_frames:format=duration",
    "-of", "json", file,
  ]);
  const j = JSON.parse(stdout);
  return {
    width: j.streams[0].width,
    height: j.streams[0].height,
    duration: Number(j.format.duration),
  };
};

const makeClip = async (dir, i, seconds, portrait) => {
  const file = path.join(dir, `in${i}.mp4`);
  const size = portrait ? "720x1280" : "1280x720";
  await run("ffmpeg", [
    "-y", "-f", "lavfi",
    "-i", `testsrc=size=${size}:rate=30:duration=${seconds}`,
    "-f", "lavfi", "-i", `sine=frequency=${300 + i * 120}:duration=${seconds}`,
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest", file,
  ]);
  return file;
};

const makePhoto = async (dir, i) => {
  const file = path.join(dir, `in${i}.jpg`);
  await run("ffmpeg", ["-y", "-f", "lavfi", "-i", "testsrc=size=720x1280:duration=1", "-frames:v", "1", file]);
  return file;
};

const hasDrawtext = async () => {
  try {
    const { stdout } = await run("ffmpeg", ["-hide_banner", "-filters"]);
    return stdout.includes(" drawtext ");
  } catch {
    return false;
  }
};

(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "setlog-test-"));
  // Homebrew's ffmpeg is often built without libfreetype. The Docker image
  // has it; skip the stamp here rather than failing on the environment, and
  // say so, because an untested drawtext is exactly how the font bug got in.
  const stamp = await hasDrawtext();
  if (!stamp) console.log("  (no drawtext in this ffmpeg — stamps skipped)");
  let failures = 0;
  const check = (name, ok, detail) => {
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
    if (!ok) failures++;
  };

  try {
    const clips = [];
    for (let i = 0; i < 5; i++) {
      clips.push({
        file: await makeClip(dir, i, 2, i % 2 === 0),
        at: new Date(2026, 8, 11, 8 + i, 15).toISOString(),
        title: i === 1 ? "tea: it's good" : null,
        duration_ms: 2000,
        media_type: "video",
      });
    }
    clips.push({
      file: await makePhoto(dir, 5),
      at: new Date(2026, 8, 11, 14, 2).toISOString(),
      title: "a photo",
      duration_ms: 2000,
      media_type: "photo",
    });

    for (const split of [1, 2, 3]) {
      const params = { split, sound: true, watermark: false, stamp, background: "#111827" };
      const groups = [];
      for (let i = 0; i < clips.length; i += split) groups.push(clips.slice(i, i + split));

      const segments = [];
      for (let i = 0; i < groups.length; i++) {
        segments.push(await buildSegment(groups[i], params, dir, `${split}-${i}`));
      }
      const reel = await concatSegments(segments, dir);
      const info = await probe(reel);
      const expected = groups.length * 2;
      check(
        `split=${split}: ${groups.length} segments -> one reel`,
        info.width === 1080 && info.height === 1920 && Math.abs(info.duration - expected) < 0.6,
        `${info.width}x${info.height}, ${info.duration.toFixed(2)}s (expected ~${expected}s)`,
      );
      await fs.rename(reel, path.join(dir, `reel-split${split}.mp4`));
    }

    // A title containing ffmpeg's metacharacters must not break drawtext.
    if (stamp) {
      const nasty = [{ ...clips[0], title: "50% off: a'b\\c [x]" }];
      try {
        await buildSegment(nasty, { split: 1, sound: false, watermark: false, stamp: true, background: "#000000" }, dir, "nasty");
        check("title with : ' \\ % survives drawtext", true);
      } catch (e) {
        check("title with : ' \\ % survives drawtext", false, String(e.message).split("\n").pop().slice(0, 120));
      }
    }
  } catch (e) {
    check("pipeline ran", false, String(e.message).split("\n").slice(-3).join(" | ").slice(0, 300));
  } finally {
    console.log(failures === 0 ? "\nall good" : `\n${failures} failing`);
    if (failures === 0) await fs.rm(dir, { recursive: true, force: true });
    else console.log("artifacts kept in", dir);
    process.exit(failures === 0 ? 0 : 1);
  }
})();
