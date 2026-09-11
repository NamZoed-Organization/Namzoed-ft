/**
 * Setlog's media, on this phone.
 *
 * The complaint this exists to answer: a clip recorded three weeks ago took
 * seconds to open, while the same clip in a comparable app opens instantly
 * on the same wifi. It was never a network problem. It was three:
 *
 *  1. **The phone threw away its own recording.** A clip was captured to a
 *     temporary file, uploaded, and the file left to be swept up — so the
 *     device that made the video downloaded it back the next time anybody
 *     looked at it. `keepRecordedClip` now files the original under the
 *     clip's id the moment the row exists, which costs one local copy and
 *     means your own clips are never fetched at all.
 *  2. **The cache was in the wrong folder and culled by age.** `Paths.cache`
 *     is the folder the OS empties when it likes, and everything older than
 *     a week was deleted outright — which is precisely why *old* clips were
 *     the slow ones. It lives in the documents directory now and is bounded
 *     by size, evicting least-recently-used, so a clip stays until the space
 *     is actually wanted.
 *  3. **Downloads ran one at a time.** Deliberately, for a meaningful
 *     progress count — but a day of twenty clips paid twenty round trips
 *     end to end. They run four at a time now, and the count still counts.
 *
 * Everything else in Setlog reads media through `resolveClipUrls`, which
 * hands back a `file://` where there is one and a signed URL where there is
 * not, so no caller has to know any of this.
 *
 * This module used to import `setlogService` for its signer while that
 * module imported this one for the cache — a require cycle Metro allows and
 * warns about. The signer is the only thing the two genuinely shared, so it
 * now lives in `setlogSigning` and both import that instead. The clip type
 * still comes from `setlogService`, as a type-only import that is erased at
 * build time and leaves no require behind.
 *
 * Threading a signer through every caller would have removed the cycle too,
 * and was the wrong fix: it puts the choke point back in the callers, which
 * is where the local-first rule kept being forgotten.
 */

import { Directory, File, Paths } from "expo-file-system";
import { signClips } from "./setlogSigning";
// Type-only, so it is erased at build time and no require survives it —
// this is the import that used to close the cycle.
import type { SetlogClip } from "./setlogService";

const FOLDER = "setlog-media";

/**
 * How much of the phone Setlog may keep. Twenty seconds of 720p is a couple
 * of megabytes, so this is months of daily logging — and it is a budget
 * rather than an age, because "old" is exactly the wrong thing to throw
 * away first when the whole feature is about looking back.
 */
const BUDGET_BYTES = 512 * 1024 * 1024;

/** Downloads in flight at once. Four is where a phone stops getting faster
 *  and starts making each one slower. */
const CONCURRENCY = 4;

/** The documents directory, not the cache directory: iOS empties the latter
 *  whenever it wants the space, and a clip that vanishes silently is the
 *  slow load this module exists to prevent. */
const folder = (): Directory => {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
};

const nameFor = (clipId: string, mediaType: string) =>
  `${clipId}.${mediaType === "photo" ? "jpg" : "mp4"}`;

const fileFor = (clip: Pick<SetlogClip, "id" | "mediaType">): File =>
  new File(folder(), nameFor(clip.id, clip.mediaType));

/** The local copy of a clip, or null. Cheap enough to call per render. */
export const localUriFor = (
  clip: Pick<SetlogClip, "id" | "mediaType">,
): string | null => {
  try {
    const file = fileFor(clip);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
};

export interface LocalClip extends SetlogClip {
  /** A `file://` URI when it is here, the signed URL until then, null if
   *  neither could be had. */
  url: string | null;
}

/**
 * Keep the file the camera just produced.
 *
 * Called right after a clip's row is created, with the URI the recorder
 * returned. This is the single highest-value line in the module: the clip is
 * already on the device, and copying it here is the difference between
 * opening your own log instantly forever and re-downloading it for the rest
 * of its life.
 *
 * Never throws. A clip that fails to copy is one that will be downloaded
 * later, which is exactly what used to happen to all of them.
 */
export const keepRecordedClip = async (
  clip: Pick<SetlogClip, "id" | "mediaType">,
  localUri: string,
): Promise<void> => {
  try {
    if (!localUri.startsWith("file://") && !localUri.startsWith("/")) return;
    const source = new File(localUri);
    if (!source.exists) return;
    const destination = fileFor(clip);
    if (destination.exists) return;
    source.copy(destination);
    void enforceBudget();
  } catch {
    // Housekeeping is never worth an error.
  }
};

/**
 * The URL each clip should be played from: local first, signed second.
 *
 * The one function the feed, the day grid, the player and the editors all
 * call. Signing is skipped entirely for clips that are already here, so a
 * fully-cached day costs no network at all — not even the round trip that
 * used to sign twenty paths nobody needed.
 */
export const resolveClipUrls = async <T extends SetlogClip>(
  clips: T[],
): Promise<Record<string, string>> => {
  const out: Record<string, string> = {};
  const needSigning: T[] = [];

  for (const clip of clips) {
    const local = localUriFor(clip);
    if (local) out[clip.storagePath] = local;
    else needSigning.push(clip);
  }

  if (needSigning.length > 0) {
    try {
      Object.assign(out, await signClips(needSigning));
    } catch {
      // A signing failure leaves those clips without a URL, which every
      // caller already handles; it must not take the cached ones with it.
    }
  }
  return out;
};

const downloadOne = async (clip: SetlogClip, remote: string | null) => {
  if (!remote) return null;
  try {
    const file = fileFor(clip);
    if (file.exists) return file.uri;
    const saved = await File.downloadFileAsync(remote, file);
    return saved.uri;
  } catch {
    // Keep the signed URL — streaming is worse than local, and much better
    // than a pane that never fills.
    return remote;
  }
};

/**
 * Put a day's clips on disk, reporting progress as it goes.
 *
 * Used by the export chooser, which downloads before it navigates so an
 * editor never opens on a screen of black rectangles. Four at a time, and
 * the ones already here cost nothing.
 */
export const prefetchClips = async (
  clips: SetlogClip[],
  onProgress?: (done: number, total: number) => void,
): Promise<LocalClip[]> => {
  if (clips.length === 0) return [];

  const missing = clips.filter((c) => !localUriFor(c));
  const urls: Record<string, string> =
    missing.length > 0 ? await signClips(missing).catch(() => ({})) : {};

  let done = 0;
  const results = new Map<string, string | null>();
  const queue = [...clips];

  const worker = async () => {
    for (;;) {
      const clip = queue.shift();
      if (!clip) return;
      const local = localUriFor(clip);
      results.set(
        clip.id,
        local ?? (await downloadOne(clip, urls[clip.storagePath] ?? null)),
      );
      done += 1;
      onProgress?.(done, clips.length);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, clips.length) }, worker),
  );
  void enforceBudget();

  return clips.map((clip) => ({ ...clip, url: results.get(clip.id) ?? null }));
};

/**
 * Warm a day in the background, without blocking anything.
 *
 * The feed and a log's day call this as they render: by the time somebody
 * taps a clip, or opens the export chooser, the file is usually already
 * here. Fire and forget on purpose — nothing waits on it and nothing reports
 * it, because a warm cache is invisible when it works.
 */
export const warmClips = (clips: SetlogClip[]): void => {
  const missing = clips.filter((c) => !localUriFor(c));
  if (missing.length === 0) return;
  void prefetchClips(missing).catch(() => {});
};

/**
 * Bring a finished render down to the phone.
 *
 * Both the share sheet and the photo library want a local file, not a URL
 * that expires — and a signed link handed to another app stops working the
 * moment its hour is up, which is a share that breaks a day later for no
 * visible reason.
 */
export const downloadRender = async (
  url: string,
  filename: string,
): Promise<string> => {
  const file = new File(folder(), filename);
  if (file.exists) file.delete();
  const saved = await File.downloadFileAsync(url, file);
  return saved.uri;
};

/** What the store is holding, for Dev Components and for the budget. */
export const mediaCacheStats = (): { files: number; bytes: number } => {
  try {
    const dir = new Directory(Paths.document, FOLDER);
    if (!dir.exists) return { files: 0, bytes: 0 };
    let files = 0;
    let bytes = 0;
    for (const entry of dir.list()) {
      if (!(entry instanceof File)) continue;
      files += 1;
      bytes += entry.size ?? 0;
    }
    return { files, bytes };
  } catch {
    return { files: 0, bytes: 0 };
  }
};

/**
 * Evict least-recently-used files until the store is back under budget.
 *
 * By modification time, which on a copied or downloaded file is when it
 * arrived here — near enough to "last wanted" for a store where re-fetching
 * costs one download.
 */
export const enforceBudget = async (): Promise<void> => {
  try {
    const dir = new Directory(Paths.document, FOLDER);
    if (!dir.exists) return;

    const entries: { file: File; size: number; at: number }[] = [];
    let total = 0;
    for (const entry of dir.list()) {
      if (!(entry instanceof File)) continue;
      const size = entry.size ?? 0;
      total += size;
      entries.push({
        file: entry,
        size,
        at: (entry.modificationTime ?? 0) * 1000,
      });
    }
    if (total <= BUDGET_BYTES) return;

    entries.sort((a, b) => a.at - b.at);
    for (const entry of entries) {
      if (total <= BUDGET_BYTES) break;
      entry.file.delete();
      total -= entry.size;
    }
  } catch {
    // Housekeeping is never worth an error.
  }
};

/**
 * Startup housekeeping, called with the query cache's own prune.
 *
 * It is a budget now, not an age: deleting a clip because it is old is the
 * one rule guaranteed to make exactly the wrong thing slow in an app whose
 * point is looking back at old things.
 */
export const pruneMediaCache = async (): Promise<void> => {
  await enforceBudget();
};

/** Everything, gone — for the settings/dev "clear" affordance and logout. */
export const clearMediaCache = (): void => {
  try {
    const dir = new Directory(Paths.document, FOLDER);
    if (dir.exists) dir.delete();
  } catch {
    // Nothing to do about it.
  }
};
