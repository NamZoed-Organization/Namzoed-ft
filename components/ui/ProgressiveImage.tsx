import CircularProgress from "@/components/ui/CircularProgress";
import { toLowResPreviewUrl } from "@/lib/imagePreview";
import { Image, type ImageContentFit } from "expo-image";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import {
  Easing,
  runOnJS,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

interface ProgressiveImageProps {
  uri: string;
  /** BlurHash string (from `posts.blur_hashes`) shown blurred while loading. */
  blurhash?: string | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  /** Crossfade duration (ms) from preview → sharp. */
  transition?: number;
  /** Show the circular 0–100% fill while downloading. */
  showProgress?: boolean;
  /** Solid fallback colour shown before any preview/image paints. */
  backgroundColor?: string;
  /** expo-image recyclingKey — pass a stable per-item key in lists. */
  recyclingKey?: string;
  priority?: "low" | "normal" | "high";
}

/**
 * Instagram-style progressive image:
 *   1. Paints a blurred/pixelated preview instantly — a BlurHash when available,
 *      otherwise a tiny low-res transform of the image itself.
 *   2. Traces a thin circular 0→100% ring from real download progress.
 *   3. Crossfades to the sharp image once decoded, then fades the ring out.
 *
 * Degrades gracefully: with neither a blurhash nor a transformable URL it shows
 * `backgroundColor`; cached images skip the ring (no progress events fire).
 */
export default function ProgressiveImage({
  uri,
  blurhash,
  style,
  contentFit = "cover",
  transition = 260,
  showProgress = true,
  backgroundColor = "#0b0b0c",
  recyclingKey,
  priority = "normal",
}: ProgressiveImageProps) {
  const progress = useSharedValue(0); // 0..1 download fraction
  const ringOpacity = useSharedValue(0);
  const [ringMounted, setRingMounted] = useState(showProgress);

  const unmountRing = useCallback(() => setRingMounted(false), []);

  // Prefer a precomputed BlurHash; otherwise fall back to a tiny low-res
  // transform of the image so a pixelated preview shows immediately.
  const placeholder = useMemo(() => {
    if (blurhash) return { blurhash };
    const lowRes = toLowResPreviewUrl(uri);
    return lowRes ? { uri: lowRes } : undefined;
  }, [blurhash, uri]);

  const handleProgress = useCallback(
    (e: { loaded: number; total: number }) => {
      if (!showProgress || e.total <= 0) return;
      const next = Math.min(1, e.loaded / e.total);
      if (ringOpacity.value === 0 && next < 1) {
        ringOpacity.value = withTiming(1, { duration: 120 });
      }
      progress.value = withTiming(next, {
        duration: 120,
        easing: Easing.linear,
      });
    },
    [showProgress, progress, ringOpacity],
  );

  const handleLoad = useCallback(() => {
    progress.value = withTiming(1, { duration: 140 }, () => {
      ringOpacity.value = withTiming(0, { duration: 220 }, (finished) => {
        if (finished) runOnJS(unmountRing)();
      });
    });
  }, [progress, ringOpacity, unmountRing]);

  return (
    <View style={[styles.wrap, { backgroundColor }, style]}>
      <Image
        style={StyleSheet.absoluteFill}
        source={{ uri }}
        placeholder={placeholder}
        placeholderContentFit={contentFit}
        contentFit={contentFit}
        cachePolicy="memory-disk"
        transition={transition}
        recyclingKey={recyclingKey}
        priority={priority}
        onProgress={handleProgress}
        onLoad={handleLoad}
      />
      {showProgress && ringMounted ? (
        <CircularProgress progress={progress} opacity={ringOpacity} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: "hidden" },
});
