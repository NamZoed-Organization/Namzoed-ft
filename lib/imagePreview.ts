import { PixelRatio } from "react-native";
import { isDataSaverActive } from "./dataSaver";

/**
 * Supabase Storage URLs, rewritten to cost less data.
 *
 * Public object URLs look like:
 *   …/storage/v1/object/public/<bucket>/<path>
 * The transform endpoint is:
 *   …/storage/v1/render/image/public/<bucket>/<path>?width=…&quality=…
 *
 * Every helper returns undefined for non-Supabase URLs (nothing to transform)
 * so callers fall back to the URL they already had. NOTE: requires Supabase
 * Image Transformations to be enabled on the project; if not, the request
 * fails and ProgressiveImage retries the original — slower, never broken.
 */

const OBJECT_MARKER = "/storage/v1/object/public/";
const RENDER_MARKER = "/storage/v1/render/image/public/";

/** Back to the plain object URL, whichever form it arrived in. */
const toObjectUrl = (url: string): string | undefined => {
  if (url.includes(OBJECT_MARKER)) return url;
  if (url.includes(RENDER_MARKER)) {
    return url.split("?")[0].replace(RENDER_MARKER, OBJECT_MARKER);
  }
  return undefined;
};

const toRenderUrl = (
  url: string,
  width: number,
  quality: number,
): string | undefined => {
  const objectUrl = toObjectUrl(url);
  if (!objectUrl) return undefined;
  const transformed = objectUrl.replace(OBJECT_MARKER, RENDER_MARKER);
  const sep = transformed.includes("?") ? "&" : "?";
  return `${transformed}${sep}width=${width}&quality=${quality}`;
};

/**
 * Build a tiny, low-resolution version of an image, used as an instant
 * "pixelated" placeholder while the real one downloads (Instagram-style),
 * without needing a precomputed BlurHash.
 */
export function toLowResPreviewUrl(
  url?: string | null,
  width = 32,
  quality = 30,
): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  return toRenderUrl(url, width, quality);
}

/**
 * The widths a sized image is ever requested at.
 *
 * Fixed steps rather than the exact pixel width, because the URL is the cache
 * key: a 191pt tile on one phone and a 187pt tile on another should share one
 * download, and so should the same photo on Home, a profile and Saved. A
 * handful of steps also bounds how many variants Supabase renders (and bills)
 * per photo.
 */
const WIDTH_STEPS = [240, 360, 480, 720, 1080] as const;

/**
 * Density is capped at 2x. A 3x phone asks for more than twice the pixels
 * again for a difference nobody sees at tile size — on paid mobile data that
 * is the wrong trade.
 */
const MAX_DENSITY = 2;

const SIZED_QUALITY = 70;

/**
 * On data saver (lib/dataSaver.ts): 1.5x and a lower quality. Softer on a
 * sharp screen, and usually one width step smaller — a trade somebody paying
 * per megabyte takes. Read when the URL is built, so pictures already on
 * screen keep theirs when the connection changes rather than downloading
 * again.
 */
const DATA_SAVER_DENSITY = 1.5;
const DATA_SAVER_QUALITY = 60;

/**
 * The image at the size it is drawn, not the size it was uploaded — a phone
 * photo is megabytes, the same photo in a grid tile is tens of kilobytes.
 */
export function toSizedImageUrl(
  url: string | null | undefined,
  displayWidth: number,
  quality?: number,
): string | undefined {
  if (!url || typeof url !== "string" || !(displayWidth > 0)) return undefined;
  const saving = isDataSaverActive();
  const density = Math.min(PixelRatio.get(), saving ? DATA_SAVER_DENSITY : MAX_DENSITY);
  const needed = displayWidth * density;
  const step =
    WIDTH_STEPS.find((w) => w >= needed) ?? WIDTH_STEPS[WIDTH_STEPS.length - 1];
  return toRenderUrl(url, step, quality ?? (saving ? DATA_SAVER_QUALITY : SIZED_QUALITY));
}

/**
 * Where video posters live. Deliberately not the post-videos bucket:
 * `isVideoUrl` (lib/postsService.ts) treats any URL containing "post-videos"
 * as a video, so a poster stored there would be played instead of shown.
 */
export const VIDEO_POSTER_BUCKET = "post-images";

/** Storage path of a video's poster: "123_ab.mp4" → "posters/123_ab.jpg". */
export const videoPosterPath = (videoFileName: string): string =>
  `posters/${videoFileName.replace(/\.[^./]+$/, "")}.jpg`;

/**
 * Public URL of a post video's poster frame, derived from the video URL by
 * convention — no column to migrate or thread through every mapper. Posters
 * are written by `uploadVideo` (lib/postsService.ts) and, for videos posted
 * before that, by scripts/backfill-video-posters.mjs.
 *
 * Returns undefined for anything that isn't a post-videos object.
 */
export function toVideoPosterUrl(
  videoUrl: string | null | undefined,
): string | undefined {
  if (!videoUrl || typeof videoUrl !== "string") return undefined;
  const objectUrl = toObjectUrl(videoUrl);
  const marker = `${OBJECT_MARKER}post-videos/`;
  if (!objectUrl?.includes(marker)) return undefined;
  const [origin, rest] = objectUrl.split(marker);
  const fileName = rest.split("?")[0];
  if (!fileName) return undefined;
  return `${origin}${OBJECT_MARKER}${VIDEO_POSTER_BUCKET}/${videoPosterPath(fileName)}`;
}
