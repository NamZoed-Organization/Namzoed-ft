// hooks/useCoverPalette.ts
import { extractCoverHue, peekCoverHue } from "@/lib/coverHue";
import {
  buildCoverPalette,
  CoverPalette,
  getFallbackHue,
  normalizeHue,
} from "@/lib/coverTheme";
import { useEffect, useState } from "react";

/**
 * Per-user cover color identity — see lib/coverTheme.ts for the reasoning.
 *
 * `storedHue` is profiles.cover_hue and is authoritative: when it's set, the
 * very first paint is already the final color and nothing is extracted. The
 * extraction path below only runs for profiles saved before cover_hue
 * existed (a cover photo, but no hue stored yet); `onHueResolved` lets the
 * owner's own profile screen write that recovered hue back so it happens
 * once, not on every visit.
 *
 * `seed` should be a stable per-user id — it only feeds the last-resort hue
 * for a profile with neither a stored hue nor a cover photo. It stays a hash
 * rather than a random roll so that this fallback is at least stable for the
 * moments before the real hue arrives.
 */
export function useCoverPalette(
  seed: string | undefined,
  coverImageUrl?: string | null,
  storedHue?: number | null,
  onHueResolved?: (hue: number) => void,
): CoverPalette {
  const normalizedStored = normalizeHue(storedHue);
  const fallbackHue = seed ? getFallbackHue(seed) : 200;
  const [extractedHue, setExtractedHue] = useState<number | null>(() =>
    coverImageUrl ? peekCoverHue(coverImageUrl) : null,
  );

  useEffect(() => {
    // A stored hue means there's nothing to work out.
    if (normalizedStored != null || !coverImageUrl) {
      setExtractedHue(null);
      return;
    }

    const cached = peekCoverHue(coverImageUrl);
    if (cached != null) {
      setExtractedHue(cached);
      onHueResolved?.(cached);
      return;
    }

    let cancelled = false;
    extractCoverHue(coverImageUrl).then((hue) => {
      if (cancelled || hue == null) return;
      setExtractedHue(hue);
      onHueResolved?.(hue);
    });

    return () => {
      cancelled = true;
    };
    // onHueResolved is a callback the callers keep stable; re-running on its
    // identity would re-extract for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverImageUrl, normalizedStored]);

  const hue = normalizedStored ?? extractedHue ?? fallbackHue;
  return buildCoverPalette(hue);
}
