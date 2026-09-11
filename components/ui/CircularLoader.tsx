/**
 * CircularLoader
 *
 * The app's standard loading indicator — three dots orbiting fast, each
 * one popping bigger with a springy overshoot right as it crosses the
 * top, the three kicks landing a third of a lap apart so there's a
 * constant little flurry chasing itself around (the "bounce trio" design
 * that won the A/B comparison in DevComponents' loader gallery). Runs at
 * a flat 1x always — an earlier version ramped 1x→1.5x after a second,
 * removed in favor of one steady, predictable speed everywhere.
 *
 * Each dot trails a couple of small, fading dots right behind it on the
 * same orbit (see TrailDot) — a plain circle would look identical whether
 * "spinning" or not, so that short comet tail is what makes the dots'
 * own rotation actually visible as the trio sweeps around.
 *
 * Experimental tri-color mode: instead of one flat `color` for all three
 * dots, they render as Namzoed blue / Namzoed yellow / a white-or-black
 * third dot chosen for contrast. Every call site already picks a `color`
 * suited to whatever it's sitting on (white-ish on dark screens, dark on
 * light ones) — that existing prop doubles as the background hint here
 * too, so no call site needs to change: `color` isn't painted directly
 * anymore, but its lightness decides whether the third dot goes white
 * (was picked for a dark backdrop) or black (was picked for a light one).
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
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZES = {
  small: { diameter: 24, dotRadius: 2.6 },
  large: { diameter: 42, dotRadius: 4.4 },
} as const;

const DOT_COUNT = 3;
// One full orbit at 1x — fast enough that the three pops feel like
// they're chasing each other rather than politely taking turns.
const ORBIT_MS = 620;
const POP_MS = 160;
// How much bigger a dot gets at the peak of its pop — the orbit radius
// below reserves headroom for exactly this, so the popped dot never
// clips against the SVG canvas edge.
const POP_SCALE = 1.35;

// Namzoed brand colors (see tailwind.config.js's primary/secondary) — the
// first two dots always render in these, regardless of the `color` prop.
const BRAND_BLUE = "#094569";
const BRAND_YELLOW = "#EDC06D";

/** Perceived brightness of a color this component might be handed —
 *  covers the hex formats and the couple of named colors actually used
 *  across the app's CircularLoader call sites. Anything else (rgb(...),
 *  an unrecognized name) falls back to "not light" — the vast majority of
 *  real call sites pass a dark/saturated color for a light backdrop, so
 *  that's the safer default. */
function isLightColor(color: string): boolean {
  const named: Record<string, [number, number, number]> = {
    white: [255, 255, 255],
    black: [0, 0, 0],
  };
  const lower = color.trim().toLowerCase();
  let r: number, g: number, b: number;
  if (named[lower]) {
    [r, g, b] = named[lower];
  } else if (lower.startsWith("#")) {
    const hex = lower.slice(1);
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    const num = parseInt(full, 16);
    if (Number.isNaN(num)) return false;
    r = (num >> 16) & 255;
    g = (num >> 8) & 255;
    b = num & 255;
  } else {
    return false;
  }
  // Standard perceived-luma weighting, not a flat average — eyes are far
  // more sensitive to green than red or blue.
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

interface CircularLoaderProps {
  size?: "small" | "large";
  color?: string;
  style?: StyleProp<ViewStyle>;
  /** Scales the whole animation's speed — 2 plays twice as fast, 0.5 half
   *  as fast. Production call sites just omit it and get a flat 1x. */
  speed?: number;
}

// Each dot gets a couple of small, fading trailing dots right behind it on
// the same orbit — since their angle is derived from the exact same
// `angle` shared value as the main dot (just offset backward), the little
// comet visibly sweeps/rotates as the whole trio orbits, instead of a
// plain circle that would look identical whether "spinning" or not.
const TRAIL_DOTS = 2;
const TRAIL_GAP_DEG = 9;

function TrailDot({
  index,
  trailIndex,
  angle,
  center,
  radius,
  dotRadius,
  color,
  popScale,
}: {
  index: number;
  trailIndex: number;
  angle: SharedValue<number>;
  center: number;
  radius: number;
  dotRadius: number;
  color: string;
  popScale: SharedValue<number>;
}) {
  const fade = 1 - trailIndex / (TRAIL_DOTS + 1);
  const animatedProps = useAnimatedProps(() => {
    const deg = angle.value + index * (360 / DOT_COUNT) - trailIndex * TRAIL_GAP_DEG;
    const rad = (deg * Math.PI) / 180;
    return {
      cx: center + radius * Math.cos(rad),
      cy: center + radius * Math.sin(rad),
      // Flares together with the main dot's own pop, so the whole little
      // comet swells at once rather than just its head.
      r: dotRadius * (0.3 + 0.35 * fade) * popScale.value,
    };
  });

  return <AnimatedCircle fill={color} fillOpacity={0.15 + 0.45 * fade} animatedProps={animatedProps} />;
}

function OrbitDot({
  index,
  angle,
  center,
  radius,
  dotRadius,
  color,
  orbitMs,
  popMs,
}: {
  index: number;
  angle: SharedValue<number>;
  center: number;
  radius: number;
  dotRadius: number;
  color: string;
  orbitMs: number;
  popMs: number;
}) {
  // A radius multiplier, not a transform scale — scaling the whole shape
  // via transform would grow/shrink it around the *view's* center (the
  // orbit's center), dragging the dot outward as it pops instead of
  // growing in place. Feeding it straight into the circle's own `r` prop
  // keeps growth centered on the dot itself, since an SVG circle is
  // defined by center + radius.
  const popScale = useSharedValue(1);

  useEffect(() => {
    popScale.value = 1;
    popScale.value = withDelay(
      (index * orbitMs) / DOT_COUNT,
      withRepeat(
        withSequence(
          withTiming(POP_SCALE, { duration: popMs, easing: Easing.out(Easing.back(2.2)) }),
          withTiming(1, { duration: popMs * 1.2, easing: Easing.in(Easing.cubic) }),
          // Idle at rest for the remainder of the lap before this dot's
          // next pop comes around.
          withTiming(1, { duration: Math.max(0, orbitMs - popMs * 2.2) }),
        ),
        -1,
        false,
      ),
    );
  }, [popScale, index, orbitMs, popMs]);

  const animatedProps = useAnimatedProps(() => {
    const deg = angle.value + index * (360 / DOT_COUNT);
    const rad = (deg * Math.PI) / 180;
    return {
      cx: center + radius * Math.cos(rad),
      cy: center + radius * Math.sin(rad),
      r: dotRadius * popScale.value,
    };
  });

  return (
    <>
      {Array.from({ length: TRAIL_DOTS }, (_, t) => (
        <TrailDot
          key={t}
          index={index}
          trailIndex={t + 1}
          angle={angle}
          center={center}
          radius={radius}
          dotRadius={dotRadius}
          color={color}
          popScale={popScale}
        />
      ))}
      <AnimatedCircle fill={color} animatedProps={animatedProps} />
    </>
  );
}

export default function CircularLoader({
  size = "small",
  color = "#094569",
  style,
  speed = 1,
}: CircularLoaderProps) {
  const { diameter, dotRadius } = SIZES[size];
  const center = diameter / 2;
  const radius = diameter / 2 - dotRadius * POP_SCALE - 1;
  const angle = useSharedValue(0);

  const orbitMs = ORBIT_MS / speed;
  const popMs = POP_MS / speed;
  const thirdDotColor = isLightColor(color) ? "#fff" : "#000";
  const dotColors = [BRAND_BLUE, BRAND_YELLOW, thirdDotColor];

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(360, { duration: orbitMs, easing: Easing.linear }),
      -1,
      false,
    );
  }, [angle, orbitMs]);

  return (
    <View style={[{ width: diameter, height: diameter }, style]}>
      <Svg width={diameter} height={diameter}>
        {Array.from({ length: DOT_COUNT }, (_, i) => (
          <OrbitDot
            key={i}
            index={i}
            angle={angle}
            center={center}
            radius={radius}
            dotRadius={dotRadius}
            color={dotColors[i]}
            orbitMs={orbitMs}
            popMs={popMs}
          />
        ))}
      </Svg>
    </View>
  );
}
