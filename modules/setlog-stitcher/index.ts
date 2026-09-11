/**
 * Setlog's reel, stitched on the phone.
 *
 * What this replaced: a Node worker running ffmpeg on a machine somewhere.
 * The phone could not do it because `expo-camera` records and `expo-video`
 * plays and neither joins two videos, and ffmpeg-kit — the usual React
 * Native answer — was retired in January 2025 with its binaries pulled from
 * npm, CocoaPods and Maven. What was left was each platform's own encoder,
 * and both have one built for this exact job:
 *
 *   iOS      AVFoundation — AVMutableComposition + AVAssetExportSession
 *   Android  Media3 Transformer — Composition + EditedMediaItemSequence
 *
 * Both are hardware accelerated, which ffmpeg on a phone would not have
 * been, so this is faster than the thing it replaces as well as being free
 * of a server, a service-role key and a queue. It also works on a plane.
 *
 * **The two implementations answer to one contract** — these options, this
 * promise, this progress event — and that contract is the only place they
 * are allowed to differ from each other. Anything a platform cannot do is
 * clamped here, once, for both (see `split`), rather than becoming a feature
 * that quietly exists on one phone and not the other.
 */

import { NativeModule, requireOptionalNativeModule } from "expo";

export interface StitchClip {
  /** A local `file://` URI. Setlog already caches every clip on the phone
   *  (`lib/setlogMediaCache.ts`), so nothing is downloaded to render. */
  uri: string;
  mediaType: "video" | "photo";
  durationMs: number;
  /** The clock as the app prints it. Formatted here rather than natively
   *  because 12-vs-24-hour is this phone's preference and the app already
   *  knows it — two implementations deriving it would be two chances to
   *  disagree with the lock screen. */
  clock: string;
  title?: string | null;
}

export interface StitchOptions {
  clips: StitchClip[];
  /** Clips sharing the frame. See `stitchReel` — clamped to 1 for now. */
  split?: number;
  sound?: boolean;
  stamp?: boolean;
  watermark?: boolean;
  /** "#RRGGBB". */
  background?: string;
  /** The logo as a `file://` URI, resolved by the caller — the module keeps
   *  no assets of its own to fall out of step with the app's. */
  watermarkUri?: string | null;
  width?: number;
  height?: number;
}

type StitcherEvents = {
  onProgress: (event: { progress: number }) => void;
};

declare class SetlogStitcherModule extends NativeModule<StitcherEvents> {
  stitch(options: StitchOptions): Promise<string>;
}

/**
 * Optional, and resolved at import time only as a *lookup* — never a throw.
 *
 * `requireNativeModule` throws when the native side is not in the binary,
 * and this file is imported at the top of the reel screen, so a JS bundle
 * running on an app built before this module existed took the whole screen
 * down with "Cannot find native module 'SetlogStitcher'" — a red screen
 * where the honest answer is "this build predates the feature; rebuild".
 * That is guaranteed to happen at least once per developer, because the JS
 * reloads instantly and the binary does not.
 *
 * So the lookup is optional and the explanation is deferred to the moment
 * somebody actually asks for a reel (`stitchReel`), where there is a screen
 * to show it on.
 */
const native = requireOptionalNativeModule<SetlogStitcherModule>("SetlogStitcher");

/** Whether this build can stitch at all — false on a binary built before the
 *  module was added, and on web. */
export const canStitch = native != null;

const NEEDS_REBUILD =
  "This build of the app doesn't include the video stitcher yet. " +
  "It's native code, so it needs a new development build — reloading JS won't pick it up.";

/**
 * Stitch a day into one file. Resolves with a `file://` URI.
 *
 * `split` is clamped to 1. The multi-pane layout is implemented on iOS and
 * not yet on Android, and a reel that comes out three-up on one phone and
 * one-up on the other is worse than one that is the same everywhere — so the
 * clamp lives here, in the one place both platforms pass through, until
 * Media3's multi-sequence compositor is implemented and tested on a real
 * device. Nothing is lost today: the reel had never once rendered on either
 * platform, so one-up is the first working version rather than a reduction.
 */
export async function stitchReel(
  options: StitchOptions,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  if (!native) throw new Error(NEEDS_REBUILD);
  const stitcher = native;
  const subscription = onProgress
    ? stitcher.addListener("onProgress", ({ progress }) => onProgress(progress))
    : null;
  try {
    return await stitcher.stitch({ ...options, split: 1 });
  } finally {
    subscription?.remove();
  }
}

export default native;
