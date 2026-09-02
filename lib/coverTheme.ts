// lib/coverTheme.ts
//
// Per-user color identity for the profile cover: the header gradient, cover
// gradient, and matte panel/button tint are all derived from a single hue —
// either pulled from the user's cover photo (so the whole cover blends with
// it) or, when there's no photo, a hue picked deterministically from a
// curated list based on the user's id (stable across sessions, varied across
// users). Saturation/lightness are always clamped to the same "dark matte
// navy" formula regardless of hue, so every result stays legible and
// tasteful instead of landing on something garish.

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l: l * 100 };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  switch (max) {
    case rn:
      h = (gn - bn) / d + (gn < bn ? 6 : 0);
      break;
    case gn:
      h = (bn - rn) / d + 2;
      break;
    default:
      h = (rn - gn) / d + 4;
  }
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r1, g1, b1] = [0, 0, 0];
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = ln - c / 2;
  return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

/** Hue (0-360) of a hex color — the only thing we take from an extracted
 *  photo color, since saturation/lightness are re-applied from our own
 *  formula below. */
export function extractHue(hex: string): number {
  return rgbToHsl(hexToRgb(hex)).h;
}

// Spread around the wheel, not clustered — the fixed saturation/lightness
// formula in buildCoverPalette keeps every one of these dark and matte, so
// there's no need to hand-pick "safe" hues here.
const FALLBACK_HUES = [200, 260, 160, 20, 320, 40, 280, 140];

function hashSeedToIndex(seed: string, len: number): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  }
  return hash % len;
}

/** Deterministic per-user hue for profiles with no cover photo — same user,
 *  same hue, every time; different users land on different (but equally
 *  tasteful) hues. */
export function getFallbackHue(seed: string): number {
  return FALLBACK_HUES[hashSeedToIndex(seed, FALLBACK_HUES.length)];
}

export interface CoverPalette {
  /** Mirrors the old fixed HEADER_GRADIENT — light-to-mid stop. */
  header: [string, string];
  /** Mirrors the old fixed COVER_GRADIENT — mid-to-dark stop. */
  cover: [string, string];
  /** RGB of the dark stop, for building the matte panel/button rgba(...)
   *  strings at whatever alpha each spot needs. */
  tintRgb: RGB;
}

/** Same three-stop "dark matte navy" ramp the original hardcoded palette
 *  used, just parameterized by hue instead of fixed to blue. Header's bottom
 *  stop intentionally matches cover's bottom stop (both "dark") rather than
 *  cover's top stop — once the header is fully scrolled-in, its solid color
 *  should match the matte panel at the bottom of the cover, not the top of
 *  the photo, so the fixed header and the pinned tab bar meet cleanly. */
export function buildCoverPalette(hue: number): CoverPalette {
  const light = rgbToHex(hslToRgb(hue, 50, 34));
  const mid = rgbToHex(hslToRgb(hue, 55, 26));
  const dark = rgbToHex(hslToRgb(hue, 60, 14));

  return {
    header: [light, dark],
    cover: [mid, dark],
    tintRgb: hexToRgb(dark),
  };
}
