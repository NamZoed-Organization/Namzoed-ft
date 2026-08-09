import React, { useEffect, useRef } from "react";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type MessageStatusDotStatus = "sending" | "sent" | "delivered" | "seen";

interface MessageStatusDotProps {
  status: MessageStatusDotStatus;
  color?: string;
  size?: number;
}

const THIN_STROKE = 1.4;
const THICK_STROKE = 2.6;

/**
 * Small outgoing-message status marker: a thin ring that draws itself in
 * while "sending", thickens once "delivered", and fills solid once "seen" —
 * all in the same color, so the fill reads as a continuation of the ring.
 */
export default function MessageStatusDot({
  status,
  color = "#9CA3AF",
  size = 9,
}: MessageStatusDotProps) {
  const r = (size - THICK_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const innerFillRadius = Math.max(0, r - THICK_STROKE / 2 + 0.5);

  const isThick = status === "delivered" || status === "seen";

  const drawProgress = useSharedValue(status === "sending" ? 0 : 1);
  const strokeWidth = useSharedValue(isThick ? THICK_STROKE : THIN_STROKE);
  const fillProgress = useSharedValue(status === "seen" ? 1 : 0);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (status === "sending") {
      drawProgress.value = 0;
      drawProgress.value = withTiming(1, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      });
    } else if (hasMounted.current) {
      drawProgress.value = withTiming(1, { duration: 200 });
    }

    if (hasMounted.current) {
      strokeWidth.value = withTiming(isThick ? THICK_STROKE : THIN_STROKE, {
        duration: 250,
      });
      fillProgress.value = withTiming(status === "seen" ? 1 : 0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    }

    hasMounted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - drawProgress.value),
    strokeWidth: strokeWidth.value,
  }));

  const fillAnimatedProps = useAnimatedProps(() => ({
    r: innerFillRadius * fillProgress.value,
  }));

  return (
    <Svg width={size} height={size}>
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        animatedProps={ringAnimatedProps}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <AnimatedCircle
        cx={size / 2}
        cy={size / 2}
        fill={color}
        animatedProps={fillAnimatedProps}
      />
    </Svg>
  );
}
