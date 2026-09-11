// lib/coverHue.ts
//
// Pulling the dominant hue out of a cover photo. This is a network fetch (or
// a file read) plus a native decode, so it's deliberately kept off the render
// path: the hue it produces is saved to profiles.cover_hue at upload time and
// read back from there afterwards. See lib/coverTheme.ts for what the hue is
// then used for.

import { extractHue } from "@/lib/coverTheme";
import { getColors } from "react-native-image-colors";

// Keyed per URI so a profile re-rendering (or the same photo being asked
// about under both its local and its uploaded URL) doesn't re-extract.
const hueCache = new Map<string, number>();

export function peekCoverHue(uri: string): number | null {
  return hueCache.get(uri) ?? null;
}

export function cacheCoverHue(uri: string, hue: number): void {
  hueCache.set(uri, hue);
}

/**
 * Dominant hue (0-360) of the image at `uri` — a local picker URI works as
 * well as a remote one, which is what lets the upload flow compute the hue
 * before the photo has been uploaded. Resolves to null if the image can't be
 * decoded; callers fall back to whatever hue the profile already has.
 */
export async function extractCoverHue(uri: string): Promise<number | null> {
  const cached = hueCache.get(uri);
  if (cached != null) return cached;

  try {
    const result = await getColors(uri, {
      fallback: "#0F5075",
      cache: true,
      quality: "low",
    });
    const hex = result.platform === "ios" ? result.primary : result.dominant;
    const hue = extractHue(hex);
    hueCache.set(uri, hue);
    return hue;
  } catch {
    return null;
  }
}
