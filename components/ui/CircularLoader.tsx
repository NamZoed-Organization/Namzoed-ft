/**
 * CircularLoader
 *
 * The app's standard loading indicator — 15 dots arranged around a shape
 * that continuously morphs: circle → octagon → heptagon → hexagon →
 * pentagon → square → triangle → back to circle, each dot sliding along
 * the shape's perimeter to its next position, looping forever.
 *
 * Drop-in for the app's generic loading states (size="small"|"large" +
 * color API) — LoadingBar stays reserved for video-buffering on the video
 * timeline; this is everywhere else.
 */

import React, { useEffect } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZES = {
  small: { diameter: 24, dotRadius: 1.4 },
  large: { diameter: 42, dotRadius: 2.4 },
} as const;

const DOT_COUNT = 15;
// "circle" = evenly spaced by angle; a number = a regular polygon with that
// many sides, dots spaced evenly by arc length along its perimeter.
type ShapeSpec = "circle" | number;
const SHAPE_SEQUENCE: readonly ShapeSpec[] = ["circle", 8, 7, 6, 5, 4, 3];

type Point = { x: number; y: number };

/** `count` points on the given shape's perimeter, in a -1..1 unit space centered at 0,0. */
function shapePoints(shape: ShapeSpec, count: number): Point[] {
  const angleFor = (k: number, n: number) => (k / n) * Math.PI * 2 - Math.PI / 2;

  if (shape === "circle") {
    return Array.from({ length: count }, (_, i) => {
      const a = angleFor(i, count);
      return { x: Math.cos(a), y: Math.sin(a) };
    });
  }

  const sides = shape;
  const vertices = Array.from({ length: sides }, (_, k) => {
    const a = angleFor(k, sides);
    return { x: Math.cos(a), y: Math.sin(a) };
  });
  const edgeLength = Math.hypot(vertices[1].x - vertices[0].x, vertices[1].y - vertices[0].y);
  const perimeter = edgeLength * sides;

  return Array.from({ length: count }, (_, i) => {
    const s = (i / count) * perimeter;
    const edgeIndex = Math.min(sides - 1, Math.floor(s / edgeLength));
    const localT = (s - edgeIndex * edgeLength) / edgeLength;
    const a = vertices[edgeIndex];
    const b = vertices[(edgeIndex + 1) % sides];
    return {
      x: a.x + (b.x - a.x) * localT,
      y: a.y + (b.y - a.y) * localT,
    };
  });
}

const SHAPES: readonly Point[][] = SHAPE_SEQUENCE.map((shape) => shapePoints(shape, DOT_COUNT));

// Time spent morphing from one shape to the next, in ms — the full loop is
// this times the number of shapes.
const SEGMENT_DURATION_MS = 420;

interface CircularLoaderProps {
  size?: "small" | "large";
  color?: string;
  style?: StyleProp<ViewStyle>;
}

function Dot({
  index,
  center,
  radius,
  dotRadius,
  color,
  t,
}: {
  index: number;
  center: number;
  radius: number;
  dotRadius: number;
  color: string;
  t: SharedValue<number>;
}) {
  const animatedProps = useAnimatedProps(() => {
    const shapeCount = SHAPES.length;
    // t runs 0 → shapeCount then snaps back to 0 (see withRepeat below) —
    // floor/fraction split which two shapes this dot is currently between.
    const i0 = Math.min(Math.floor(t.value), shapeCount - 1);
    const i1 = (i0 + 1) % shapeCount;
    const localT = t.value - i0;
    const p0 = SHAPES[i0][index];
    const p1 = SHAPES[i1][index];
    return {
      cx: center + (p0.x + (p1.x - p0.x) * localT) * radius,
      cy: center + (p0.y + (p1.y - p0.y) * localT) * radius,
    };
  });

  return <AnimatedCircle r={dotRadius} fill={color} animatedProps={animatedProps} />;
}

export default function CircularLoader({
  size = "small",
  color = "#094569",
  style,
}: CircularLoaderProps) {
  const { diameter, dotRadius } = SIZES[size];
  const center = diameter / 2;
  const radius = diameter / 2 - dotRadius - 1;
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(SHAPES.length, {
        duration: SEGMENT_DURATION_MS * SHAPES.length,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      false, // snap back to shape 0 (circle) and restart, not a yoyo
    );
  }, [t]);

  return (
    <View style={[{ width: diameter, height: diameter }, style]}>
      <Svg width={diameter} height={diameter}>
        {Array.from({ length: DOT_COUNT }, (_, i) => (
          <Dot
            key={i}
            index={i}
            center={center}
            radius={radius}
            dotRadius={dotRadius}
            color={color}
            t={t}
          />
        ))}
      </Svg>
    </View>
  );
}
