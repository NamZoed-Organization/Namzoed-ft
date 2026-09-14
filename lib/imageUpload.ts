import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/**
 * Photos are resized on the phone before they are uploaded.
 *
 * A phone camera photo is 12MP or more and several megabytes; nothing in this
 * app draws one larger than a phone screen. Uploading the original costs the
 * person posting it their mobile data, and costs every person who later opens
 * it theirs — on Bhutanese data plans, both are real money. So every image
 * that goes through `uploadFileToSupabase` is brought down to the size it is
 * actually shown at, first.
 *
 * The presets are about where a picture is seen, not what it is of:
 *
 * - **photo** — feed posts, listings, services, chat, comments, reviews,
 *   profile covers. 1440px on the long edge covers a full-width detail view
 *   on a 3x phone (390pt × 3 = 1170px) with room to spare.
 * - **fullscreen** — stories, which fill a tall screen edge to edge and carry
 *   text drawn into the picture; 1920px keeps that text crisp.
 * - **avatar** — profile and business pictures. Small circles nearly
 *   everywhere, but they also open full-screen (ProfileImageViewer), so
 *   1080px — a square that size is still a fraction of a camera photo.
 * - **document** — business licences, read by a person checking small print
 *   during verification, so they keep more resolution and quality.
 *
 * Never upscales. A PNG stays a PNG (a logo's transparency would turn black
 * as JPEG). A JPEG already within its size and budget is uploaded untouched,
 * because re-encoding it only loses quality. And any failure here uploads
 * the original: a resize is a saving, never a reason to lose somebody's post.
 */
export type ImageUploadPreset = "photo" | "fullscreen" | "avatar" | "document";

const PRESETS: Record<ImageUploadPreset, { maxEdge: number; compress: number }> = {
  photo: { maxEdge: 1440, compress: 0.75 },
  fullscreen: { maxEdge: 1920, compress: 0.8 },
  avatar: { maxEdge: 1080, compress: 0.8 },
  document: { maxEdge: 2048, compress: 0.85 },
};

/** A JPEG within its edge limit and under this size is already small enough. */
const UNTOUCHED_JPEG_BYTES = 350 * 1024;

export interface PreparedImage {
  uri: string;
  contentType: string;
}

const isPng = (uri: string, contentType: string) =>
  contentType === "image/png" || /\.png(\?|$)/i.test(uri);

const isJpeg = (uri: string, contentType: string) =>
  contentType === "image/jpeg" || contentType === "image/jpg" || /\.jpe?g(\?|$)/i.test(uri);

/** Unknown counts as too big: a size that can't be read (an Android content
 *  URI, say) must lead to a re-encode, not to skipping the resize entirely. */
const fileBytes = (uri: string): number => {
  try {
    const size = new File(uri).size;
    return typeof size === "number" && Number.isFinite(size) ? size : Infinity;
  } catch {
    return Infinity;
  }
};

/**
 * One at a time. A post can carry ten photos, and decoding ten 12MP images at
 * once is several hundred megabytes of bitmaps — enough to take down the
 * low-end Android phones many people here use. Serial costs a second or two
 * on a big post; parallel costs the post.
 */
let queue: Promise<unknown> = Promise.resolve();
const serially = <T>(task: () => Promise<T>): Promise<T> => {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
};

export const prepareImageForUpload = (
  uri: string,
  contentType: string,
  preset: ImageUploadPreset,
): Promise<PreparedImage> =>
  serially(async () => {
    const { maxEdge, compress } = PRESETS[preset];
    const keepPng = isPng(uri, contentType);

    try {
      const source = await ImageManipulator.manipulate(uri).renderAsync();
      try {
        const longEdge = Math.max(source.width, source.height);
        const needsResize = longEdge > maxEdge;

        if (!needsResize) {
          if (keepPng) return { uri, contentType: "image/png" };
          if (isJpeg(uri, contentType) && fileBytes(uri) <= UNTOUCHED_JPEG_BYTES) {
            return { uri, contentType: "image/jpeg" };
          }
        }

        const context = ImageManipulator.manipulate(source);
        if (needsResize) {
          context.resize(
            source.width >= source.height ? { width: maxEdge } : { height: maxEdge },
          );
        }
        const rendered = await context.renderAsync();
        try {
          const saved = await rendered.saveAsync({
            compress,
            format: keepPng ? SaveFormat.PNG : SaveFormat.JPEG,
          });
          return { uri: saved.uri, contentType: keepPng ? "image/png" : "image/jpeg" };
        } finally {
          rendered.release();
        }
      } finally {
        source.release();
      }
    } catch (e) {
      console.warn("[imageUpload] resize failed; uploading the original:", e);
      return { uri, contentType };
    }
  });
