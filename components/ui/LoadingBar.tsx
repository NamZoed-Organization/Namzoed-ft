/**
 * LoadingBar
 *
 * A horizontal track whose fill travels outward from its own center — both
 * edges moving in opposite directions at once — stopping 5% short of each
 * edge (90% of the total width). The travel itself decelerates: fast right
 * out of center, gradually slower as it approaches its resting point.
 * Opacity stays fully visible until the travel is 75% of the way there,
 * then fades out in step with the same decelerating motion, finishing
 * right as the travel completes — then the cycle snaps back to center and
 * repeats.
 *
 * Reserved for video buffering, shown directly on the video's own timeline/
 * scrubber (see ReelsViewer's ScrubBar) rather than as a separate floating
 * indicator — pass explicit `width`/`height` to size it to the scrubber's
 * own bounds instead of a size preset. Everywhere else uses CircularLoader.
 */

import React, { useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const SIZES = {
  small: { width: 56, height: 4 },
  large: { width: 112, height: 6 },
} as const;

// Travel stops 5% short of each edge — 90% of the total width.
const MAX_SCALE = 0.9;
// Opacity starts fading once the (decelerating) travel reaches 75% of its
// own progress, not when it finishes.
const FADE_START = 0.75;

interface LoadingBarProps {
  size?: "small" | "large";
  /** Explicit pixel width — overrides `size`, for fitting an exact container
   * (e.g. a video scrubber's own measured width) instead of a preset. */
  width?: number;
  /** Explicit pixel height — overrides `size`. */
  height?: number;
  /** Fill color. */
  color?: string;
  /** Track background color — defaults to a translucent grey. */
  trackColor?: string;
  /** One full grow-then-fade cycle, in ms. */
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

export default function LoadingBar({
  size = "small",
  width: widthProp,
  height: heightProp,
  color = "#ffffff",
  trackColor,
  duration = 600,
  style,
}: LoadingBarProps) {
  const width = widthProp ?? SIZES[size].width;
  const height = heightProp ?? SIZES[size].height;
  const radius = height / 2;
  // Single 0→1 driver for the whole cycle — scaleX and opacity are both
  // derived from it below so the grow and fade phases stay in lockstep.
  const cycle = useSharedValue(0);

  useEffect(() => {
    cycle.value = withRepeat(
      // One continuous decelerating travel from center to the 90% mark —
      // fast to start, progressively slower toward the end — not a
      // constant pace.
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
      -1,
      false, // snap back to 0 and restart, not a yoyo — the fade already returns it to "invisible"
    );
  }, [duration, cycle]);

  const fillStyle = useAnimatedStyle(() => {
    const scaleX = interpolate(cycle.value, [0, 1], [0, MAX_SCALE], Extrapolation.CLAMP);
    const opacity = interpolate(
      cycle.value,
      [0, FADE_START, 1],
      [1, 1, 0],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scaleX }], opacity };
  });

  return (
    <View
      style={[
        styles.track,
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: trackColor ?? "rgba(120, 120, 128, 0.5)",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: color, borderRadius: radius },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    overflow: "hidden",
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});
