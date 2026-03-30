/**
 * Post media framing for feed (matches `posts.media_display` jsonb).
 * `ratios[i]` = image width / height for `post.images[i]` when mode is `mixed`.
 */

export type PostMediaDisplayMode = "portrait" | "square" | "landscape" | "mixed";

export interface PostMediaDisplay {
  mode: PostMediaDisplayMode;
  ratios?: number[];
}

/** Classic IG-style vertical frame (width : height = 4 : 5) */
export const RATIO_PORTRAIT = 4 / 5;
export const RATIO_SQUARE = 1;
export const RATIO_LANDSCAPE = 16 / 9;
export const RATIO_VIDEO_DEFAULT = 9 / 16;

/** Min/max width÷height allowed in feed framing (slider + clamp). */
export const RATIO_MIN = 0.35;
export const RATIO_MAX = 2.8;

export function clampMediaRatio(r: number): number {
  if (!Number.isFinite(r) || r <= 0) return RATIO_PORTRAIT;
  return Math.min(RATIO_MAX, Math.max(RATIO_MIN, r));
}

export function parseMediaDisplay(raw: unknown): PostMediaDisplay | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const mode = o.mode;
  if (
    mode !== "portrait" &&
    mode !== "square" &&
    mode !== "landscape" &&
    mode !== "mixed"
  ) {
    return undefined;
  }
  const ratios = Array.isArray(o.ratios)
    ? o.ratios
        .map((x) => (typeof x === "number" ? clampMediaRatio(x) : null))
        .filter((x): x is number => x != null)
    : undefined;
  return { mode: mode as PostMediaDisplayMode, ratios };
}

export function slideHeight(screenW: number, widthOverHeight: number): number {
  const r = clampMediaRatio(widthOverHeight);
  return screenW / r;
}

export function ratioForUniformMode(mode: PostMediaDisplayMode): number {
  switch (mode) {
    case "square":
      return RATIO_SQUARE;
    case "landscape":
      return RATIO_LANDSCAPE;
    case "portrait":
    default:
      return RATIO_PORTRAIT;
  }
}
