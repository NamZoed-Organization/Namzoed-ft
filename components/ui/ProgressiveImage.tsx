import CircularProgress from "@/components/ui/CircularProgress";
import { toLowResPreviewUrl, toSizedImageUrl } from "@/lib/imagePreview";
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
  /** Width (pt) the image is drawn at. When set, a resized copy is requested
   *  instead of the original upload (lib/imagePreview.ts toSizedImageUrl);
   *  if that request fails, the original is loaded instead. */
  displayWidth?: number;
  /** Called when the image can't be loaded at all — after the original has
   *  also failed, if a resized copy was tried first. */
  onError?: () => void;
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
  displayWidth,
  onError,
}: ProgressiveImageProps) {
  const progress = useSharedValue(0); // 0..1 download fraction
  const ringOpacity = useSharedValue(0);
  const [ringMounted, setRingMounted] = useState(showProgress);

  // Remembered per URL rather than as a boolean, so a recycled list cell
  // showing a different image starts by trying its resized copy again.
  const sizedUri = useMemo(
    () => (displayWidth ? toSizedImageUrl(uri, displayWidth) : undefined),
    [uri, displayWidth],
  );
  const [failedSizedUri, setFailedSizedUri] = useState<string | null>(null);
  const sourceUri = sizedUri && failedSizedUri !== sizedUri ? sizedUri : uri;

  const handleError = useCallback(() => {
    if (sizedUri && sourceUri === sizedUri) {
      setFailedSizedUri(sizedUri);
      return;
    }
    onError?.();
  }, [sizedUri, sourceUri, onError]);

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
        source={{ uri: sourceUri }}
        placeholder={placeholder}
        placeholderContentFit={contentFit}
        contentFit={contentFit}
        cachePolicy="memory-disk"
        transition={transition}
        recyclingKey={recyclingKey}
        priority={priority}
        onProgress={handleProgress}
        onLoad={handleLoad}
        onError={handleError}
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
