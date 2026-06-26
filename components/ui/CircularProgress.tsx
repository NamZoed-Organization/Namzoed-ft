import React from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface CircularProgressProps {
  /** Download fraction 0..1 (Reanimated shared value). */
  progress: SharedValue<number>;
  /** Ring opacity 0..1 (Reanimated shared value) — fade the ring in/out. */
  opacity: SharedValue<number>;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
}

/**
 * Thin circular fill that traces 0→100% as the image downloads. Centered over
 * its parent; pass Reanimated shared values so it animates on the UI thread.
 */
export default function CircularProgress({
  progress,
  opacity,
  size = 44,
  stroke = 3,
  color = "#ffffff",
  trackColor = "rgba(255,255,255,0.25)",
}: CircularProgressProps) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const animatedProps = useAnimatedProps(() => {
    const p = Math.min(1, Math.max(0, progress.value));
    return { strokeDashoffset: circumference * (1 - p) };
  });
  const wrapStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.center, wrapStyle]}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Start the fill at 12 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
