// hooks/useCoverPalette.ts
import {
  buildCoverPalette,
  CoverPalette,
  extractHue,
  getFallbackHue,
} from "@/lib/coverTheme";
import { useEffect, useState } from "react";
import { getColors } from "react-native-image-colors";

// Extracting a photo's dominant hue is a network fetch + native decode —
// worth caching per URI so scrolling a feed of profiles (or this profile
// re-rendering) doesn't re-extract the same cover photo repeatedly.
const hueCache = new Map<string, number>();

/**
 * Per-user cover color identity — see lib/coverTheme.ts for the reasoning.
 * `seed` should be a stable per-user id (used for the no-photo fallback
 * hue); `coverImageUrl` is the actual cover photo, if any.
 */
export function useCoverPalette(
  seed: string | undefined,
  coverImageUrl?: string | null,
): CoverPalette {
  const fallbackHue = seed ? getFallbackHue(seed) : 200;
  const [hue, setHue] = useState<number>(() => {
    if (coverImageUrl && hueCache.has(coverImageUrl)) {
      return hueCache.get(coverImageUrl)!;
    }
    return fallbackHue;
  });

  useEffect(() => {
    if (!coverImageUrl) {
      setHue(fallbackHue);
      return;
    }

    const cached = hueCache.get(coverImageUrl);
    if (cached != null) {
      setHue(cached);
      return;
    }

    let cancelled = false;
    getColors(coverImageUrl, {
      fallback: "#0F5075",
      cache: true,
      quality: "low",
    })
      .then((result) => {
        if (cancelled) return;
        const hex =
          result.platform === "ios" ? result.primary : result.dominant;
        const extracted = extractHue(hex);
        hueCache.set(coverImageUrl, extracted);
        setHue(extracted);
      })
      .catch(() => {
        if (!cancelled) setHue(fallbackHue);
      });

    return () => {
      cancelled = true;
    };
    // fallbackHue depends only on `seed`, which is included below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverImageUrl, seed]);

  return buildCoverPalette(hue);
}
