/**
 * Asking for a day to be stitched into one video.
 *
 * The phone cannot encode — so it writes down what it wants, and a worker
 * with ffmpeg does the work (`render-worker/`). This module is the whole of
 * the app's side: put in a job, watch the row, get a file.
 *
 * A row rather than a request that blocks, because a render outlives the
 * screen that asked for it: somebody can back out of the editor, lock the
 * phone, and come back to a finished reel.
 *
 * If nothing is listening — no worker deployed — jobs sit at `queued` and
 * `waitForRender` gives up with a sentence saying so, rather than spinning
 * forever behind a progress bar that will never move.
 */

import { supabase } from "./supabase";
import { localDay, resolveUserId, type SetlogClip } from "./setlogService";

const CLIP_BUCKET = "setlog-clips";
const SIGNED_URL_TTL_S = 60 * 60;

/** Long enough for a day of clips on a modest worker; short enough that a
 *  queue nobody is serving admits it while somebody is still watching. */
const RENDER_TIMEOUT_MS = 3 * 60 * 1000;
const POLL_INTERVAL_MS = 1500;

/**
 * How long a job may sit at `queued`, untouched, before this concludes
 * nothing is listening.
 *
 * A running worker claims the oldest queued row within one poll of its own
 * (three seconds by default), so twelve is four chances to be picked up. The
 * old behaviour — three minutes of "Waiting for the renderer…" and then the
 * same verdict — is indistinguishable from a hang, and it is what somebody
 * sitting in front of an export screen actually experiences when the worker
 * is not deployed. Being told in ten seconds is a different feature to being
 * told in three minutes.
 */
const NO_WORKER_AFTER_MS = 12 * 1000;

export type RenderStatus = "queued" | "rendering" | "done" | "failed";

/** One sentence, in one place, because two screens show it and it is the
 *  only thing standing between a day and a reel. */
export const NO_WORKER_MESSAGE =
  "No renderer is running yet, so a reel can't be stitched. The collage exports from the phone and works now.";

export interface RenderParams {
  /** How many clips share the frame: 1, 2 or 3. */
  split: number;
  sound: boolean;
  watermark: boolean;
  /** The clock and title over each pane. */
  stamp: boolean;
  /** Hex, as chosen in the editor. */
  background: string;
}

export interface SetlogRender {
  id: string;
  status: RenderStatus;
  progress: number;
  outputPath: string | null;
  error: string | null;
}

const rowToRender = (r: any): SetlogRender => ({
  id: String(r.id),
  status: (r.status ?? "queued") as RenderStatus,
  progress: Number(r.progress ?? 0),
  outputPath: r.output_path ?? null,
  error: r.error ?? null,
});

/**
 * Put the job in.
 *
 * The clips are written into the job rather than looked up by the worker:
 * the editor already knows exactly which ones, in what order, with what
 * titles, and a worker that re-queried could disagree with what somebody
 * was just looking at.
 */
export const requestRender = async (
  clips: SetlogClip[],
  params: RenderParams,
  day: string = localDay(),
): Promise<SetlogRender> => {
  const uid = await resolveUserId();
  if (!uid) throw new Error("Sign in first.");
  if (clips.length === 0) throw new Error("There is nothing to render.");

  const { data, error } = await supabase
    .from("setlog_renders")
    .insert({
      user_id: uid,
      setlog_id: clips[0].setlogId,
      day,
      params: {
        ...params,
        clips: clips.map((c) => ({
          path: c.storagePath,
          title: c.title,
          at: c.createdAt,
          duration_ms: c.durationMs,
          media_type: c.mediaType,
          capture_mode: c.captureMode,
        })),
      },
    })
    .select()
    .single();
  if (error) throw error;
  return rowToRender(data);
};

export const getRender = async (id: string): Promise<SetlogRender | null> => {
  const { data, error } = await supabase
    .from("setlog_renders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToRender(data) : null;
};

/**
 * Watch a job until it finishes, and hand back a playable URL.
 *
 * Polled rather than subscribed: this is one row for a couple of minutes,
 * and a realtime channel opened and torn down per render costs more than it
 * saves.
 */
export const waitForRender = async (
  id: string,
  onProgress?: (render: SetlogRender) => void,
  timeoutMs = RENDER_TIMEOUT_MS,
): Promise<string> => {
  const startedAt = Date.now();
  let sawWorker = false;

  for (;;) {
    const render = await getRender(id);
    if (!render) throw new Error("That render went missing.");
    onProgress?.(render);

    if (render.status === "rendering") sawWorker = true;

    // Still exactly where it was put, and long enough for any running
    // worker to have claimed it: say so now rather than at the timeout.
    if (
      !sawWorker &&
      render.status === "queued" &&
      Date.now() - startedAt > NO_WORKER_AFTER_MS
    ) {
      throw new Error(NO_WORKER_MESSAGE);
    }

    if (render.status === "done" && render.outputPath) {
      const { data, error } = await supabase.storage
        .from(CLIP_BUCKET)
        .createSignedUrl(render.outputPath, SIGNED_URL_TTL_S);
      if (error) throw error;
      return data.signedUrl;
    }

    if (render.status === "failed") {
      throw new Error(render.error || "The reel didn't render.");
    }

    if (Date.now() - startedAt > timeoutMs) {
      // The two failures look identical from here and read very
      // differently, so they are told apart.
      throw new Error(
        sawWorker
          ? "The reel is taking longer than expected. It'll be ready in your logs shortly."
          : NO_WORKER_MESSAGE,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
};

/** The most recent finished reel for a day, if one was already made — so a
 *  second Share does not re-render what is already sitting in storage. */
export const findFinishedRender = async (
  day: string,
  params: RenderParams,
): Promise<string | null> => {
  const uid = await resolveUserId();
  if (!uid) return null;

  const { data } = await supabase
    .from("setlog_renders")
    .select("*")
    .eq("user_id", uid)
    .eq("day", day)
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(5);

  const match = (data ?? []).find((row: any) => {
    const p = row.params ?? {};
    // Only a render made with the same decisions is the same reel.
    return (
      Number(p.split) === params.split &&
      Boolean(p.sound) === params.sound &&
      Boolean(p.watermark) === params.watermark &&
      Boolean(p.stamp) === params.stamp &&
      String(p.background) === params.background
    );
  });
  if (!match?.output_path) return null;

  const { data: signed, error } = await supabase.storage
    .from(CLIP_BUCKET)
    .createSignedUrl(match.output_path, SIGNED_URL_TTL_S);
  if (error) return null;
  return signed.signedUrl;
};
