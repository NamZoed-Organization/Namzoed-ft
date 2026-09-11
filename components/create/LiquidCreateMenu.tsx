/**
 * The "+" opening as liquid.
 *
 * The tab bar's yellow circle does not open a sheet any more — it *becomes*
 * the four things it can make. Four droplets separate out of it and settle
 * into an arc above it; choosing one runs the whole thing backwards.
 *
 * **The fluid part is a real gooey filter, not a metaphor.** Everything is
 * drawn as SVG circles inside a filter that blurs the group and then throws
 * the alpha channel through a hard contrast curve
 * (`feGaussianBlur` → `feColorMatrix`) — the standard metaball trick. Two
 * circles far apart stay two circles; as they approach, their blurred edges
 * overlap enough to survive the contrast and they fuse into one mass with a
 * concave neck. So the separation is not drawn or faked with a stretched
 * pill: it falls out of the geometry, which is why it reads as liquid rather
 * than as four views flying apart.
 *
 * Four things make the motion read as water rather than as a menu:
 *
 * - **The source loses volume as the droplets leave.** The origin blob dips
 *   to under three quarters of its radius at the moment of separation and
 *   recovers only part of the way. A source that stayed the same size while
 *   four droplets came out of it reads as a spawner, not a liquid.
 * - **Each droplet overshoots its own radius mid-flight** and settles back —
 *   surface tension pulling a stretched droplet round again.
 * - **They leave in sequence, not together.** ~55ms apart, so the mass
 *   necks and pinches four times instead of exploding once.
 * - **Nothing stops when it lands — but nothing moves, either.** Each blob
 *   holds its place and its *edge* travels: eight points around it, each
 *   swelling and flattening on its own frequency, with the whole
 *   deformation turning slowly. That is what a bubble does. A droplet that
 *   drifted around instead would read as floating, which is a different
 *   thing and a worse one. See `BLOB` and `blobPath`.
 *
 * The filter is the one part with a platform risk: `react-native-svg` has
 * native filter views on both iOS and Android, and if a build ever lacked
 * them the circles simply draw unmerged — the menu still works and still
 * animates, it just stops being liquid. Nothing here depends on the filter
 * for layout or hit testing (see `Bubble`'s own touch target, which is a
 * plain View above the SVG).
 */

import TutorialAnchor from "@/components/tutorial/TutorialAnchor";
import TutorialOverlay from "@/components/tutorial/TutorialOverlay";
import * as Haptics from "expo-haptics";
import {
  Camera,
  CirclePlus,
  ImagePlus,
  Plus,
  ShoppingBag,
} from "lucide-react-native";
import React, { useCallback, useEffect } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, FeColorMatrix, FeGaussianBlur, Filter, G, Path } from "react-native-svg";
import { PILL_FLOAT_GAP, PILL_HEIGHT } from "@/components/ui/FloatingTabBar";

/** Paths, not circles: what moves when this is idle is each blob's own
 *  outline, and a circle has no outline to move (see `blobPath`). */
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** The "+" tab's own colour, because this is that button, continued. */
const LIQUID = "#EDC06D";
const INK = "#0A0A0A";

/** The blob the droplets come out of — a little larger than the tab bar's
 *  circle so the first frame of the animation is a swell, not a jump. */
const SOURCE_R = 23;
const BUBBLE_R = 30;

/** How far the SVG canvas reaches above the bar. The filter's cost scales
 *  with its area, so it covers the arc and nothing else. */
const CANVAS_HEIGHT = 320;

/** Out on a spring-ish curve; back a good deal quicker, because a menu
 *  being dismissed should not be dwelt on (§ Feedback and motion). */
const OPEN = { duration: 620, easing: Easing.bezier(0.16, 1.2, 0.3, 1) };
const CLOSE = { duration: 240, easing: Easing.in(Easing.cubic) };
/** Each droplet leaves this much later than the one before it. */
const STAGGER = 0.09;

/**
 * The idle life: the **edge** moves, the blob does not.
 *
 * A droplet that stops dead the moment it lands stops being liquid and
 * becomes a button. But a droplet that drifts around its resting place
 * reads as floating, which is a different thing and a worse one — what a
 * bubble actually does is hold still while its surface travels.
 *
 * So each blob is drawn as a closed curve through eight points, and it is
 * the **radius of each point** that oscillates, on its own frequency and its
 * own phase. The centre never moves. The result bulges here and flattens
 * there the way surface tension does, and because the frequencies are not
 * multiples of one another the shape never repeats a pattern you can catch.
 *
 * The whole deformation also turns slowly (`SPIN`), which is what makes it
 * look like the surface is flowing around the blob rather than a fixed set
 * of lumps breathing in place.
 */
const BLOB = {
  /** Eight is where a closed quadratic curve stops looking like a polygon
   *  and starts looking like a membrane. Sixteen costs twice the arithmetic
   *  per frame and looks the same. */
  points: 8,
  /** How far a point may stray from the true radius, as a fraction of it.
   *  Seven per cent is a visible ripple on a 30pt droplet and still
   *  unmistakably a circle. */
  amplitude: 0.075,
  /** Radians per millisecond the deformation itself rotates — a full turn
   *  in about ninety seconds, so the surface travels without spinning. */
  spin: 0.00007,
  /** One frequency per point, none a multiple of another: eight points
   *  moving on unrelated cycles is what stops the outline from pulsing. */
  freqs: [
    0.00047, 0.00061, 0.00039, 0.00055, 0.00043, 0.00067, 0.00051, 0.00035,
  ],
};

/**
 * A blob's outline, as an SVG path.
 *
 * A closed curve through the midpoints of consecutive points, with each
 * point itself as the quadratic control — the standard way to smooth a
 * radial polygon, and it is always smooth by construction, so no amount of
 * wobble can produce a corner.
 *
 * `amount` scales the deformation: 0 is a plain circle (mid-flight, or when
 * the phone has asked for less motion), 1 is fully alive.
 */
function blobPath(
  cx: number,
  cy: number,
  r: number,
  ms: number,
  seed: number,
  amount: number,
): string {
  "worklet";
  const n = BLOB.points;
  const xs: number[] = [];
  const ys: number[] = [];
  const spin = ms * BLOB.spin;

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + spin;
    const ripple =
      amount <= 0
        ? 0
        : Math.sin(ms * BLOB.freqs[i] + seed * 1.9 + i) * BLOB.amplitude * amount;
    const radius = r * (1 + ripple);
    xs.push(cx + Math.cos(angle) * radius);
    ys.push(cy + Math.sin(angle) * radius);
  }

  // Two decimals: the difference is invisible at this size and the string is
  // rebuilt sixty times a second for five blobs.
  const round = (v: number) => Math.round(v * 100) / 100;
  const midX = (a: number, b: number) => round((xs[a] + xs[b]) / 2);
  const midY = (a: number, b: number) => round((ys[a] + ys[b]) / 2);

  let d = `M${midX(n - 1, 0)},${midY(n - 1, 0)}`;
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    d += ` Q${round(xs[i])},${round(ys[i])} ${midX(i, next)},${midY(i, next)}`;
  }
  return `${d} Z`;
}

export type CreateOptionKey = "post" | "product" | "setlog" | "story";

type Option = {
  key: CreateOptionKey;
  label: string;
  icon: React.ReactNode;
  /** Degrees, screen-style: 0 is right, negative is up. */
  angle: number;
  distance: number;
};

/** A fan, widest at the outside, so four bubbles read as an arc over the
 *  button rather than a row floating above it. */
const OPTIONS: Option[] = [
  {
    key: "post",
    label: "Post",
    icon: <ImagePlus size={22} color={INK} strokeWidth={1.9} />,
    angle: -158,
    distance: 116,
  },
  {
    key: "product",
    label: "Product",
    icon: <ShoppingBag size={22} color={INK} strokeWidth={1.9} />,
    angle: -117,
    distance: 132,
  },
  {
    key: "setlog",
    label: "Setlog",
    icon: <Camera size={22} color={INK} strokeWidth={1.9} />,
    angle: -63,
    distance: 132,
  },
  {
    key: "story",
    label: "Story",
    icon: <CirclePlus size={22} color={INK} strokeWidth={1.9} />,
    angle: -22,
    distance: 116,
  },
];

const target = (option: Option) => ({
  dx: Math.cos((option.angle * Math.PI) / 180) * option.distance,
  dy: Math.sin((option.angle * Math.PI) / 180) * option.distance,
});

/** Where a droplet is, in canvas coordinates, at a given progress. */
function useDropletPath(
  progress: SharedValue<number>,
  clock: SharedValue<number>,
  index: number,
  originX: number,
  originY: number,
  option: Option,
) {
  const { dx, dy } = target(option);
  return useAnimatedProps(() => {
    // Its own clock, offset from the shared one: the fourth droplet has not
    // begun moving while the first is already settling.
    const eased = Math.max(
      0,
      Math.min(1, interpolate(progress.value, [index * STAGGER, 1], [0, 1])),
    );
    // Overshoot, then settle — surface tension pulling a stretched droplet
    // back into a sphere.
    const radius = interpolate(
      eased,
      [0, 0.25, 0.7, 1],
      [3, BUBBLE_R * 0.55, BUBBLE_R * 1.12, BUBBLE_R],
    );
    // The edge only starts moving once the droplet has arrived. A blob
    // rippling while it is still travelling reads as unstable rather than
    // as alive.
    const alive = Math.max(0, Math.min(1, interpolate(eased, [0.8, 1], [0, 1])));
    return {
      d: blobPath(
        originX + dx * eased,
        originY + dy * eased,
        radius,
        clock.value,
        index,
        alive,
      ),
    };
  });
}

function Droplet({
  progress,
  clock,
  index,
  originX,
  originY,
  option,
}: {
  progress: SharedValue<number>;
  clock: SharedValue<number>;
  index: number;
  originX: number;
  originY: number;
  option: Option;
}) {
  const animatedProps = useDropletPath(
    progress,
    clock,
    index,
    originX,
    originY,
    option,
  );
  return <AnimatedPath animatedProps={animatedProps} fill={LIQUID} />;
}

/** The icon and label riding on top of a droplet, and its touch target.
 *  Deliberately outside the SVG: a filtered group is a poor thing to hit-test
 *  against, and text inside a goo filter would be smeared into paste. */
function Bubble({
  progress,
  index,
  option,
  onSelect,
}: {
  progress: SharedValue<number>;
  index: number;
  option: Option;
  onSelect: (key: CreateOptionKey) => void;
}) {
  const { dx, dy } = target(option);
  const style = useAnimatedStyle(() => {
    const p = Math.max(
      0,
      Math.min(1, interpolate(progress.value, [index * STAGGER, 1], [0, 1])),
    );
    // The icon sits still, because the blob does: what moves is the edge
    // around it. An icon that tracked the ripple would be the thing wobbling,
    // which is the opposite of a bubble.
    return {
      transform: [{ translateX: dx * p }, { translateY: dy * p }],
      // The label arrives after the droplet has stopped moving; fading it in
      // with the flight makes it look printed on a moving object.
      opacity: interpolate(p, [0, 0.72, 1], [0, 0, 1]),
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: -BUBBLE_R,
          top: -BUBBLE_R,
          width: BUBBLE_R * 2,
          height: BUBBLE_R * 2,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {/* Each droplet is a thing the tutorial points at, so it is wrapped
          rather than described — see components/tutorial/. */}
      <TutorialAnchor
        id={`create.${option.key}`}
        radius={BUBBLE_R}
        style={{ width: BUBBLE_R * 2, height: BUBBLE_R * 2 }}
      >
        <Pressable
          onPress={() => onSelect(option.key)}
          hitSlop={10}
          style={{
            width: BUBBLE_R * 2,
            height: BUBBLE_R * 2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {option.icon}
        </Pressable>
      </TutorialAnchor>
      <Text
        style={{
          position: "absolute",
          top: BUBBLE_R * 2 + 6,
          fontSize: 12.5,
          fontWeight: "600",
          color: "#fff",
        }}
        numberOfLines={1}
      >
        {option.label}
      </Text>
    </Animated.View>
  );
}

export default function LiquidCreateMenu({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  /** Fired after the liquid has run back into the button. */
  onSelect: (key: CreateOptionKey) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const progress = useSharedValue(0);
  /** Milliseconds since the callback started, on the UI thread — one clock
   *  the whole menu wobbles against, rather than a repeating animation per
   *  value per droplet. */
  const clock = useSharedValue(0);
  // Somebody who has asked their phone to stop moving things has asked this
  // too. The separation still plays — it is the transition, and it ends —
  // but nothing keeps moving afterwards.
  const reduceMotion = useReducedMotion();

  const frame = useFrameCallback((info) => {
    "worklet";
    clock.value = info.timeSinceFirstFrame;
  }, false);

  // Where the tab bar's "+" actually is: the pill floats this far off the
  // bottom and is this tall, and "+" is its middle item, so the centre of
  // the screen. Taken from the bar's own constants rather than measured —
  // a measurement would need the bar to hand it over through a context, and
  // these two numbers are what decide it.
  const barCentreFromBottom =
    Math.max(insets.bottom - 16, 0) + PILL_FLOAT_GAP + PILL_HEIGHT / 2;
  const originX = screenWidth / 2;
  const originY = CANVAS_HEIGHT - barCentreFromBottom;

  const finish = useCallback(
    (key: CreateOptionKey | null) => {
      onClose();
      if (key) onSelect(key);
    },
    [onClose, onSelect],
  );

  const collapse = useCallback(
    (key: CreateOptionKey | null) => {
      progress.value = withTiming(0, CLOSE, (done) => {
        "worklet";
        if (done) runOnJS(finish)(key);
      });
    },
    [finish, progress],
  );

  useEffect(() => {
    if (!visible) {
      progress.value = 0;
      // Nothing is on screen: a frame callback still ticking behind a closed
      // modal is a phone kept awake for a menu nobody opened.
      frame.setActive(false);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    progress.value = withTiming(1, OPEN);
    frame.setActive(!reduceMotion);
    return () => frame.setActive(false);
  }, [visible, progress, frame, reduceMotion]);

  const handleSelect = useCallback(
    (key: CreateOptionKey) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      collapse(key);
    },
    [collapse],
  );

  // The blob the droplets come from. It loses volume as they separate and
  // only partly recovers — the detail that makes this read as one body of
  // liquid rather than a button spitting out bubbles.
  const sourceProps = useAnimatedProps(() => {
    // The source's edge moves too, on its own seed — a perfectly round blob
    // sitting under four rippling ones is the one that looks like a hole in
    // the effect.
    const radius = interpolate(
      progress.value,
      [0, 0.3, 0.65, 1],
      [SOURCE_R, SOURCE_R * 0.72, SOURCE_R * 0.86, SOURCE_R * 0.92],
    );
    const alive = Math.max(
      0,
      Math.min(1, interpolate(progress.value, [0.7, 1], [0, 1])),
    );
    return {
      d: blobPath(originX, originY, radius, clock.value, 5, alive * 0.8),
    };
  });

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.35], [0, 1]),
  }));

  // The "+" turns into a close mark as the menu opens — the button is still
  // the way out, so it says so.
  const plusStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [0, 45])}deg` },
      { scale: interpolate(progress.value, [0, 0.3, 1], [1, 0.8, 0.92]) },
    ],
  }));

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => collapse(null)}>
      <Pressable style={{ flex: 1 }} onPress={() => collapse(null)}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(17,24,39,0.45)" },
            scrimStyle,
          ]}
        />

        <View
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: CANVAS_HEIGHT,
          }}
        >
          <Svg width="100%" height={CANVAS_HEIGHT} pointerEvents="none">
            <Defs>
              {/* Blur the group, then drive alpha through a steep contrast:
                  everything under the threshold vanishes, everything over it
                  becomes solid, and two blurred edges that overlap cross the
                  threshold *between* the circles — which is the neck. */}
              <Filter id="liquid" x="-40%" y="-40%" width="180%" height="180%">
                <FeGaussianBlur in="SourceGraphic" stdDeviation="9" result="blurred" />
                <FeColorMatrix
                  in="blurred"
                  type="matrix"
                  values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
                />
              </Filter>
            </Defs>
            <G filter="url(#liquid)">
              <AnimatedPath animatedProps={sourceProps} fill={LIQUID} />
              {OPTIONS.map((option, i) => (
                <Droplet
                  key={option.key}
                  progress={progress}
                  clock={clock}
                  index={i}
                  originX={originX}
                  originY={originY}
                  option={option}
                />
              ))}
            </G>
          </Svg>

          {/* Icons, labels and touch targets, anchored on the origin so each
              one only has to carry its own offset. */}
          <View
            pointerEvents="box-none"
            style={{ position: "absolute", left: originX, top: originY }}
          >
            {OPTIONS.map((option, i) => (
              <Bubble
                key={option.key}
                progress={progress}
                index={i}
                option={option}
                onSelect={handleSelect}
              />
            ))}

            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: -SOURCE_R,
                  top: -SOURCE_R,
                  width: SOURCE_R * 2,
                  height: SOURCE_R * 2,
                  alignItems: "center",
                  justifyContent: "center",
                },
                plusStyle,
              ]}
            >
              <Pressable
                onPress={() => collapse(null)}
                hitSlop={14}
                style={{ padding: 6 }}
              >
                <Plus size={24} color={INK} strokeWidth={2.2} />
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </Pressable>

      {/* A modal is its own window, so the root overlay is behind this one.
          The tour draws here while the menu is open. */}
      <TutorialOverlay hostId="create-menu" />
    </Modal>
  );
}
