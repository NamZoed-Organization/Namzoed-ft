/**
 * What "an edited picture" is, before any of it has been rendered.
 *
 * The whole editor is a pure description of edits sitting beside an
 * untouched original: nothing is written into pixels until export. That is
 * what makes every choice reversible — reopen a picture an hour later and
 * the crop handles are where you left them, the filter is still at 60%, and
 * the caption you typed on it is still a string you can retype rather than
 * paint you have to scrape off.
 *
 * It also decides the export pipeline. Geometry, colour and overlays are
 * three different machines — `expo-image-manipulator`, a GL shader and a
 * flattened view — so the model keeps them apart rather than interleaving
 * them, and each stage is skipped entirely when it would be a no-op.
 *
 * Coordinates are **normalised to the picture**, never pixels: an overlay
 * placed on a preview 340pt wide has to land in the same spot in a 1080px
 * export, and a tag pinned to a jacket has to stay on the jacket in the
 * feed at whatever size the feed draws it.
 */

import type { MascotMood } from "@/components/ui/Mascot";

// ── Geometry ────────────────────────────────────────────────────────────

/** A crop as fractions of the source, after rotation. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The largest-area upright rectangle that still fits inside a
 * `width` x `height` image rotated by `degrees`. Its aspect ratio is not the
 * original's — maximising area is the point, since the crop that follows is
 * what the editor's own aspect control then works on.
 *
 * A free rotation leaves transparent wedges at the corners, so the straighten
 * control is always followed by a centre crop to this — the alternative is
 * publishing pictures with white triangles in them. Returns the size only;
 * the caller centres it, because it knows the rotated canvas's real
 * dimensions and those are not simply the rotation of these.
 */
export const inscribedRect = (
  width: number,
  height: number,
  degrees: number,
): { width: number; height: number } => {
  if (!degrees || width <= 0 || height <= 0) return { width, height };

  // Folded into the first quadrant: a rectangle rotated by 100 degrees has
  // the same inscribed rectangle as one rotated by 80.
  const a = Math.abs((degrees * Math.PI) / 180) % Math.PI;
  const ang = a > Math.PI / 2 ? Math.PI - a : a;
  const sinA = Math.sin(ang);
  const cosA = Math.cos(ang);

  const shorter = Math.min(width, height);
  const longer = Math.max(width, height);

  // Past this angle the fit is limited by the short side alone, and the
  // general formula below divides by a cos(2a) that has gone to zero.
  if (shorter <= 2 * sinA * cosA * longer || Math.abs(sinA - cosA) < 1e-10) {
    const half = 0.5 * shorter;
    return width < height
      ? { width: half / sinA, height: half / cosA }
      : { width: half / cosA, height: half / sinA };
  }

  const cos2a = cosA * cosA - sinA * sinA;
  return {
    width: (width * cosA - height * sinA) / cos2a,
    height: (height * cosA - width * sinA) / cos2a,
  };
};

export type AspectKey = "free" | "1:1" | "4:5" | "3:4" | "16:9" | "9:16";

/** `null` is free-form. Width over height. */
export const ASPECT_RATIOS: Record<AspectKey, number | null> = {
  free: null,
  "1:1": 1,
  "4:5": 4 / 5,
  "3:4": 3 / 4,
  "16:9": 16 / 9,
  "9:16": 9 / 16,
};

export const ASPECT_ORDER: AspectKey[] = [
  "free",
  "1:1",
  "4:5",
  "3:4",
  "16:9",
  "9:16",
];

// ── Colour ──────────────────────────────────────────────────────────────

/**
 * Every colour control in the editor, in one shape.
 *
 * All of them are −1…1 around a neutral 0 (except `vignette`, which only
 * darkens, so 0…1). One range for everything means one slider component,
 * one reset, and a filter preset that is nothing more special than a set of
 * these values — which is why the presets below are honest rather than
 * baked LUTs nobody can adjust afterwards.
 */
export interface ColorAdjust {
  brightness: number;
  contrast: number;
  saturation: number;
  /** Positive pushes red and drops blue — daylight versus shade. */
  warmth: number;
  vignette: number;
  /** Above 0 sharpens; the shader does an unsharp mask against a blur. */
  sharpen: number;
}

export const NEUTRAL: ColorAdjust = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  vignette: 0,
  sharpen: 0,
};

export interface FilterPreset {
  id: string;
  name: string;
  adjust: ColorAdjust;
  /** Colour the whole frame drifts toward, and by how much. */
  tint?: [number, number, number];
  tintAmount?: number;
}

/**
 * The filmstrip.
 *
 * Named looks that are only combinations of the same sliders the Adjust tab
 * exposes — so "Original with the warmth up" and "Midday at 40%" are the
 * same kind of thing, and picking a filter never puts the picture somewhere
 * the manual controls can't reach. Eight is deliberate: a strip you can
 * thumb through in one swipe teaches itself, and thirty presets is a
 * catalogue nobody reads past the third.
 */
export const FILTERS: FilterPreset[] = [
  { id: "none", name: "Original", adjust: NEUTRAL },
  {
    id: "bright",
    name: "Bright",
    adjust: { ...NEUTRAL, brightness: 0.08, contrast: 0.1, saturation: 0.08 },
  },
  {
    id: "midday",
    name: "Midday",
    adjust: { ...NEUTRAL, contrast: 0.16, saturation: 0.14, warmth: 0.18 },
    tint: [1, 0.86, 0.62],
    tintAmount: 0.06,
  },
  {
    id: "dusk",
    name: "Dusk",
    adjust: { ...NEUTRAL, brightness: -0.03, contrast: 0.1, warmth: -0.16 },
    tint: [0.36, 0.42, 0.7],
    tintAmount: 0.1,
  },
  {
    id: "film",
    name: "Film",
    adjust: {
      ...NEUTRAL,
      contrast: -0.08,
      saturation: -0.12,
      warmth: 0.08,
      vignette: 0.22,
    },
    tint: [0.86, 0.8, 0.68],
    tintAmount: 0.1,
  },
  {
    id: "crisp",
    name: "Crisp",
    adjust: { ...NEUTRAL, contrast: 0.2, saturation: 0.06, sharpen: 0.45 },
  },
  {
    id: "mono",
    name: "Mono",
    adjust: { ...NEUTRAL, saturation: -1, contrast: 0.14 },
  },
  {
    id: "linen",
    name: "Linen",
    adjust: { ...NEUTRAL, brightness: 0.06, contrast: -0.12, saturation: -0.2 },
    tint: [0.95, 0.93, 0.88],
    tintAmount: 0.14,
  },
];

export const filterById = (id: string): FilterPreset =>
  FILTERS.find((f) => f.id === id) ?? FILTERS[0];

/**
 * The filter at its chosen strength, plus the manual adjustments.
 *
 * One place, because the preview shader and the export pass must agree to
 * the decimal — an export that differs from the thing on screen is the one
 * bug an editor cannot have.
 */
export const resolveColor = (
  edit: Pick<ImageEdit, "filter" | "intensity" | "adjust">,
): { adjust: ColorAdjust; tint: [number, number, number]; tintAmount: number } => {
  const preset = filterById(edit.filter);
  const k = edit.intensity;
  const mix = (a: number, b: number) => a + b * k;
  return {
    adjust: {
      brightness: mix(edit.adjust.brightness, preset.adjust.brightness),
      contrast: mix(edit.adjust.contrast, preset.adjust.contrast),
      saturation: mix(edit.adjust.saturation, preset.adjust.saturation),
      warmth: mix(edit.adjust.warmth, preset.adjust.warmth),
      vignette: Math.max(
        0,
        Math.min(1, mix(edit.adjust.vignette, preset.adjust.vignette)),
      ),
      sharpen: Math.max(0, mix(edit.adjust.sharpen, preset.adjust.sharpen)),
    },
    tint: preset.tint ?? [1, 1, 1],
    tintAmount: (preset.tintAmount ?? 0) * k,
  };
};

// ── Things drawn on top ─────────────────────────────────────────────────

interface Placed {
  id: string;
  /** Centre, as a fraction of the picture. */
  x: number;
  y: number;
  scale: number;
  /** Degrees. */
  rotation: number;
}

export interface TextOverlay extends Placed {
  kind: "text";
  text: string;
  color: string;
  /** A plate behind the words, for text over a busy photograph. */
  plate: boolean;
}

export interface StickerOverlay extends Placed {
  kind: "sticker";
  mood: MascotMood;
}

export interface StrokeOverlay {
  kind: "stroke";
  id: string;
  color: string;
  /** Fraction of the picture's width, so it scales with the export. */
  width: number;
  points: { x: number; y: number }[];
}

export type Overlay = TextOverlay | StickerOverlay | StrokeOverlay;

/**
 * A tag pinned to a spot on the picture.
 *
 * The thing that makes a shopping post readable: the label sits *on* the
 * jacket rather than in a row underneath, so what is being pointed at is
 * never in doubt. It rides along in the post's existing `tagged_products` /
 * `tagged_accounts` JSON, so pinning cost no migration — a row without a
 * pin is simply an untagged-in-place tag, which is what every older post
 * has.
 */
export interface PinTag {
  id: string;
  kind: "product" | "account";
  /** The product or account id this points at. */
  refId: string;
  label: string;
  x: number;
  y: number;
  /** Which side the label opens toward, so a pin near the right edge does
   *  not run off the picture. */
  side: "left" | "right";
}

// ── The edit ────────────────────────────────────────────────────────────

export interface ImageEdit {
  /** Quarter turns, applied before the crop. */
  rotate: 0 | 90 | 180 | 270;
  flipH: boolean;
  /** −15…15 degrees, the horizon dial. Auto-crops to stay rectangular. */
  straighten: number;
  crop: CropRect | null;
  aspect: AspectKey;
  filter: string;
  /** 0…1, how much of the preset is applied. */
  intensity: number;
  adjust: ColorAdjust;
  overlays: Overlay[];
  pins: PinTag[];
}

export const EMPTY_EDIT: ImageEdit = {
  rotate: 0,
  flipH: false,
  straighten: 0,
  crop: null,
  aspect: "free",
  filter: "none",
  intensity: 1,
  adjust: NEUTRAL,
  overlays: [],
  pins: [],
};

export const hasGeometry = (e: ImageEdit): boolean =>
  e.rotate !== 0 || e.flipH || e.straighten !== 0 || e.crop != null;

export const hasColor = (e: ImageEdit): boolean => {
  const { adjust, tintAmount } = resolveColor(e);
  return (
    tintAmount > 0.001 ||
    (Object.keys(adjust) as (keyof ColorAdjust)[]).some(
      (k) => Math.abs(adjust[k]) > 0.001,
    )
  );
};

export const hasOverlays = (e: ImageEdit): boolean => e.overlays.length > 0;

/** Nothing to render — the original file can be used as it is. */
export const isUntouched = (e: ImageEdit): boolean =>
  !hasGeometry(e) && !hasColor(e) && !hasOverlays(e);

export const newId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
