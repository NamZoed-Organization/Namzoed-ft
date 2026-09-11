/**
 * What a tutorial step looks like: a hole cut around the real control, and
 * a card that says what it is for.
 *
 * **The hole is a hole.** The scrim is four panels — above, below, left and
 * right of the control — and not one full-screen sheet with a transparent
 * patch, because a transparent patch still eats the touch. Built this way
 * the control underneath is genuinely pressable, and the press that closes
 * the step is the press that does the thing. Everything else on the screen
 * is covered, which is the other half of it: there is exactly one thing to
 * do, the way a game does it.
 *
 * A tap on the scrim does not dismiss. It pulses the ring instead — a
 * misdirected tap is somebody who hasn't found the control yet, and a
 * tutorial that vanishes on the first stray touch is one nobody ever
 * finishes. Skip is a word, always in the same place.
 *
 * A step whose control cannot be found (never wrapped, or gone from the
 * screen) degrades to the same card with no hole and **no scrim at all** —
 * it explains itself and blocks nothing. A tutorial must never be able to
 * trap the app behind a scrim with no way through.
 *
 * Mounted once, above the navigator, in `app/_layout.tsx`.
 */

import { useTutorial } from "@/contexts/TutorialContext";
import Mascot from "@/components/ui/Mascot";
import { MODAL_RADIUS } from "@/constants/theme";
import * as Haptics from "expo-haptics";
import { ChevronRight, Hand } from "lucide-react-native";
import React, { useEffect } from "react";
import {
  Dimensions,
  Pressable,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCRIM = "rgba(17,24,39,0.68)";
const ACCENT = "#094569";
/** How far the ring stands off the control it rings. */
const HALO = 6;
const CARD_MARGIN = 16;
const CARD_GAP = 14;

/** The overlay's own frame. `zIndex` rather than document order, because it
 *  is mounted at the top of one host's tree and the bottom of another's,
 *  and an overlay that renders behind the screen it is teaching is worse
 *  than no overlay at all. */
const FILL = {
  position: "absolute",
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  zIndex: 9999,
  elevation: 24,
} as const;

export default function TutorialOverlay({
  /**
   * Which surface this overlay belongs to. The root one is mounted in
   * `app/_layout.tsx`; anything presented in a React Native `Modal` — its
   * own window, and therefore in front of the root — mounts a second one
   * with its own id, and only the topmost draws.
   */
  hostId = "root",
}: {
  hostId?: string;
} = {}) {
  const {
    tour,
    step,
    stepIndex,
    rect,
    next,
    skip,
    turnTipsOff,
    pushHost,
    popHost,
    topHost,
  } = useTutorial();

  useEffect(() => {
    pushHost(hostId);
    return () => popHost(hostId);
  }, [hostId, popHost, pushHost]);
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();

  // The ring breathes while the step waits for a press, so the eye lands on
  // it before the words are finished. Explain-only steps hold still: there
  // is nothing there to press.
  const pulse = useSharedValue(0);
  const waiting = step?.advance.on === "action";
  useEffect(() => {
    cancelAnimation(pulse);
    pulse.value = 0;
    if (!waiting || !rect) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
        withDelay(250, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [pulse, rect, waiting, stepIndex]);

  // A tap on the scrim is somebody who hasn't found the control — the ring
  // flashes rather than the step closing.
  const nudge = useSharedValue(0);
  const onScrimPress = () => {
    Haptics.selectionAsync();
    nudge.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 260 }),
    );
  };

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.85 - pulse.value * 0.85,
    transform: [{ scale: 1 + pulse.value * 0.28 }],
  }));

  const ringSolidStyle = useAnimatedStyle(() => ({
    borderColor: ACCENT,
    transform: [{ scale: 1 + nudge.value * 0.06 }],
  }));

  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = withTiming(step ? 1 : 0, { duration: step ? 220 : 140 });
  }, [fade, step]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!tour || !step) return null;
  // Somebody else is in front; drawing here would be a card behind a modal.
  if (topHost !== hostId) return null;

  const total = tour.steps.length;
  /**
   * A control that has scrolled out of the viewport measures to a rect
   * outside it, and a hole drawn there is a scrim with no visible way
   * through — the exact trap this must never set. Off screen is treated as
   * unmeasured: the card explains itself and blocks nothing.
   */
  const onScreen =
    !!rect &&
    rect.y + rect.height > 0 &&
    rect.y < screenH &&
    rect.x + rect.width > 0 &&
    rect.x < screenW;
  const hole =
    rect && onScreen
      ? {
          x: Math.max(0, rect.x - HALO),
          y: Math.max(0, rect.y - HALO),
          width: rect.width + HALO * 2,
          height: rect.height + HALO * 2,
          radius: rect.radius + HALO,
        }
      : null;

  /** Above the hole when the hole is low on the screen, below when it is
   *  high — the card must never sit on the thing it is pointing at. */
  const cardBelow = hole ? hole.y + hole.height < screenH * 0.5 : false;

  const card = (
    <View
      style={{
        position: "absolute",
        left: CARD_MARGIN,
        right: CARD_MARGIN,
        ...(hole
          ? cardBelow
            ? { top: hole.y + hole.height + CARD_GAP }
            : { bottom: screenH - hole.y + CARD_GAP }
          : { bottom: insets.bottom + 24 }),
      }}
      pointerEvents="box-none"
    >
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: MODAL_RADIUS,
          borderCurve: "continuous",
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 12,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        }}
      >
        {/* The mongoose leads the card, and its face follows the step —
            keen where there is something to press, level where it is only
            explaining, puzzled on the gesture nobody guesses. A guide with
            a face is most of what makes a walkthrough feel played rather
            than read; it sits beside the words, never over them. */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          <Mascot mood={step.mascot} size={56} style={{ marginTop: 2 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "#9CA3AF" }}>
              {tour.title} · {stepIndex + 1} of {total}
            </Text>
            <Text
              style={{
                fontSize: 17,
                fontWeight: "700",
                color: "#111827",
                marginTop: 4,
              }}
            >
              {step.title}
            </Text>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 21,
                color: "#6B7280",
                marginTop: 4,
              }}
            >
              {step.body}
            </Text>
          </View>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 14,
          }}
        >
          {/* Skip is a word in the same place on every step, and a hold on
              it is how somebody who never wants these turns them off — one
              control, two intentions, rather than a second button asking a
              question nobody has yet. */}
          <TouchableOpacity
            onPress={skip}
            onLongPress={turnTipsOff}
            delayLongPress={600}
            hitSlop={8}
            style={{ paddingVertical: 6, paddingRight: 12 }}
          >
            <Text style={{ fontSize: 15, fontWeight: "500", color: "#9CA3AF" }}>
              Skip
            </Text>
          </TouchableOpacity>

          {step.advance.on === "next" ? (
            <TouchableOpacity
              onPress={next}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 2,
                backgroundColor: ACCENT,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                borderCurve: "continuous",
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>
                {stepIndex + 1 === total ? "Done" : "Got it"}
              </Text>
              {stepIndex + 1 < total && (
                <ChevronRight size={16} color="#fff" strokeWidth={2.2} />
              )}
            </TouchableOpacity>
          ) : (
            // Nothing to press here: the instruction is the thing to do,
            // and it is on the control itself.
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <Hand size={15} color={ACCENT} strokeWidth={2} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: ACCENT }}>
                {step.advance.hint}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  // ── No anchor: a card that explains and blocks nothing ────────────────
  if (!hole) {
    return (
      <Animated.View
        pointerEvents="box-none"
        style={[
          FILL,
          fadeStyle,
        ]}
      >
        {card}
      </Animated.View>
    );
  }

  // ── The spotlight ────────────────────────────────────────────────────
  const panel = (s: {
    top: number;
    left: number;
    width: number;
    height: number;
  }) => (
    <Pressable
      onPress={onScrimPress}
      style={{ position: "absolute", backgroundColor: SCRIM, ...s }}
    />
  );

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        FILL,
        fadeStyle,
      ]}
    >
      {/* Four panels, so the control in the middle keeps its own touches. */}
      {panel({ top: 0, left: 0, width: screenW, height: hole.y })}
      {panel({
        top: hole.y + hole.height,
        left: 0,
        width: screenW,
        height: Math.max(0, screenH - (hole.y + hole.height)),
      })}
      {panel({ top: hole.y, left: 0, width: hole.x, height: hole.height })}
      {panel({
        top: hole.y,
        left: hole.x + hole.width,
        width: Math.max(0, screenW - (hole.x + hole.width)),
        height: hole.height,
      })}

      {/* The ring, and the pulse leaving it. Neither takes a touch — the
          control underneath needs every one of them. */}
      <View pointerEvents="none">
        <Animated.View
          style={[
            {
              position: "absolute",
              left: hole.x,
              top: hole.y,
              width: hole.width,
              height: hole.height,
              borderRadius: hole.radius,
              borderCurve: "continuous",
              borderWidth: 2,
            },
            ringSolidStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              position: "absolute",
              left: hole.x,
              top: hole.y,
              width: hole.width,
              height: hole.height,
              borderRadius: hole.radius,
              borderCurve: "continuous",
              borderWidth: 2,
              borderColor: ACCENT,
            },
            ringStyle,
          ]}
        />
        {step.gesture === "swipe-right" && <SwipeHint hole={hole} />}
      </View>

      {card}
    </Animated.View>
  );
}

/**
 * A gesture has no button to ring, so it gets a finger that does it.
 *
 * The hand travels the first stretch of the drag, on the UI thread, on a
 * loop — the same motion the user is being asked to make, in the place they
 * are being asked to make it. Text alone ("swipe from the edge") is the
 * instruction people read twice and still get wrong.
 */
function SwipeHint({
  hole,
}: {
  hole: { x: number; y: number; width: number; height: number };
}) {
  const travel = useSharedValue(0);
  useEffect(() => {
    travel.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
        withDelay(220, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(travel);
  }, [travel]);

  const distance = Math.min(120, Dimensions.get("window").width * 0.3);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: travel.value * distance }],
    opacity: 0.25 + (1 - Math.abs(travel.value - 0.5) * 2) * 0.75,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          left: hole.x + 8,
          top: hole.y + hole.height / 2 - 18,
          width: 36,
          height: 36,
          borderRadius: 18,
          borderCurve: "continuous",
          backgroundColor: "#fff",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Hand size={20} color={ACCENT} strokeWidth={2} />
    </Animated.View>
  );
}
