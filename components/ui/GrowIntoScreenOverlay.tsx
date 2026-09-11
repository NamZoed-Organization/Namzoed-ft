/**
 * A grid tile growing into the screen it opens — the mechanism, without
 * knowing what kind of thing it is showing.
 *
 * This was written inside `ProductDetailOverlay` and is now shared with
 * services, which need exactly the same behaviour: the hero grows from the
 * tapped card's own rect to where the detail screen's hero actually sits,
 * crossfades into the real content, and hands the edge-swipe-back gesture
 * (and its "drop on the dome to message them" target) to `ContextDrop`.
 *
 * Two copies of this would be two copies of a delicate animation — see
 * `PostDetailOverlay`'s own header for the full writeup of why every value
 * here is a transform rather than a layout change, and why the crossfade
 * needs an opaque backing underneath it.
 *
 * The caller supplies four things: where it grew from, the picture to grow,
 * the drop target, and the content to crossfade into. Nothing else about a
 * product or a service reaches this file.
 */

import ContextDrop, { type ContextDropTarget } from "@/components/ContextDrop";
import { useOptionalTabBarScroll } from "@/contexts/TabBarScrollContext";
import { Image } from "expo-image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Dimensions, Platform, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Phase = "opening" | "open" | "closing";

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get("window");

const GROW_TIMING = { duration: 320, easing: Easing.out(Easing.cubic) };
const SHRINK_TIMING = { duration: 260, easing: Easing.out(Easing.cubic) };
const CROSSFADE_TIMING = { duration: 150 };
/** Matches GridCard's own thumbnail corner radius — see PostDetailOverlay. */
const GRID_CARD_RADIUS = 4;

function HeroFrame({ uri }: { uri: string }) {
  // Same uri the grid thumbnail (ProgressiveImage) just painted a frame ago —
  // matching its cachePolicy/recyclingKey means this fresh <Image> mount hits
  // the already-warm memory cache instead of re-decoding. transition={0}
  // because heroOpacity/contentOpacity already drive the crossfade; letting
  // expo-image fade in on top of that read as the image "reloading" mid-grow.
  return (
    <Image
      source={{ uri }}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={uri}
      transition={0}
    />
  );
}

export default function GrowIntoScreenOverlay({
  visible,
  onClose,
  sourceRect,
  heroUri,
  /** Where the settled screen's own hero sits, so the grow ends on it. */
  mediaTop,
  mediaHeight,
  /** Built by the caller from its own item; `onDrop` is wrapped here so the
   *  overlay shrinks back to the grid before anything is pushed. */
  target,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  sourceRect?: SourceRect | null;
  heroUri?: string | null;
  mediaTop: number;
  mediaHeight: number;
  target: ContextDropTarget | null;
  /** The real screen. `commitClose` closes the overlay first, then runs
   *  whatever navigation was asked for. */
  children: (args: {
    phase: Phase;
    commitClose: (after?: () => void) => void;
  }) => React.ReactNode;
}) {
  const setTabBarHidden = useOptionalTabBarScroll()?.setTabBarHidden ?? (() => {});
  const rect = sourceRect ?? { x: 0, y: 0, width: WINDOW_WIDTH, height: WINDOW_HEIGHT };

  const [phase, setPhase] = useState<Phase>("opening");
  const phaseRef = useRef<Phase>("opening");
  const closingRef = useRef(false);

  const progress = useSharedValue(0);
  const heroProgress = useSharedValue(0);
  const heroOpacity = useSharedValue(1);
  const contentOpacity = useSharedValue(0);
  const backingOpacity = useSharedValue(1);
  const dragX = useSharedValue(0);
  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    progress.value = 0;
    heroProgress.value = 0;
    heroOpacity.value = 1;
    contentOpacity.value = 0;
    backingOpacity.value = 1;
    dragX.value = 0;
    setPhaseBoth("opening");
    setTabBarHidden(true);

    progress.value = withTiming(1, GROW_TIMING);
    heroProgress.value = withTiming(1, GROW_TIMING, (finished) => {
      "worklet";
      if (!finished) return;
      runOnJS(setPhaseBoth)("open");
      heroOpacity.value = withTiming(0, CROSSFADE_TIMING);
      contentOpacity.value = withTiming(1, CROSSFADE_TIMING, (finished2) => {
        "worklet";
        if (finished2) backingOpacity.value = withTiming(0, CROSSFADE_TIMING);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const commitClose = useCallback((after?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setTabBarHidden(false);
    backingOpacity.value = 1;

    const shrink = () => {
      setPhaseBoth("closing");
      progress.value = withTiming(0, SHRINK_TIMING);
      heroProgress.value = withTiming(0, SHRINK_TIMING, (finished) => {
        "worklet";
        if (finished) {
          runOnJS(onClose)();
          if (after) runOnJS(after)();
        }
      });
    };

    if (phaseRef.current === "open") {
      contentOpacity.value = withTiming(0, CROSSFADE_TIMING);
      heroOpacity.value = withTiming(1, CROSSFADE_TIMING, (finished) => {
        "worklet";
        if (finished) runOnJS(shrink)();
      });
    } else {
      shrink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, setTabBarHidden]);

  // No <Modal> here (see render below — this is a plain in-tree overlay so
  // the real grid stays mounted and visible behind it), so Android's
  // hardware back button needs its own handler instead of Modal's
  // onRequestClose.
  useEffect(() => {
    if (Platform.OS !== "android" || !visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      commitClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, commitClose]);

  const wrappedTarget = React.useMemo(() => {
    if (!target) return null;
    // Dropping on the dome shrinks the overlay FIRST — otherwise chat pushes
    // on top of a still-open overlay, and popping back lands on it rather
    // than on the grid.
    return { ...target, onDrop: () => commitClose(target.onDrop) };
  }, [target, commitClose]);

  const heroScaleX = rect.width / WINDOW_WIDTH;
  const heroScaleY = rect.height / mediaHeight;
  const heroTranslateX = rect.x + rect.width / 2 - WINDOW_WIDTH / 2;
  const heroTranslateY = rect.y + rect.height / 2 - (mediaTop + mediaHeight / 2);

  const dragReveal = useDerivedValue(() =>
    interpolate(dragX.value, [0, WINDOW_WIDTH * 0.4], [1, 0.08], Extrapolation.CLAMP),
  );
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * dragReveal.value }));
  const backingStyle = useAnimatedStyle(() => ({ opacity: heroProgress.value * backingOpacity.value }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    borderRadius: interpolate(heroProgress.value, [0, 1], [GRID_CARD_RADIUS, 0], Extrapolation.CLAMP),
    borderCurve: "continuous",
    transform: [
      { translateX: interpolate(heroProgress.value, [0, 1], [heroTranslateX, 0]) },
      { translateY: interpolate(heroProgress.value, [0, 1], [heroTranslateY, 0]) },
      { scaleX: interpolate(heroProgress.value, [0, 1], [heroScaleX, 1]) },
      { scaleY: interpolate(heroProgress.value, [0, 1], [heroScaleY, 1]) },
    ],
  }));
  const contentWrapperStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 200 }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff" }, backdropStyle]} />

      {/* Opaque backing pinned to the settled media rect — masks the single
          frame where the incoming texture has not painted yet during the
          crossfade. */}
      {heroUri && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: mediaTop,
              left: 0,
              width: WINDOW_WIDTH,
              height: mediaHeight,
              backgroundColor: "#000",
            },
            backingStyle,
          ]}
        />
      )}

      {heroUri && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: mediaTop,
              left: 0,
              width: WINDOW_WIDTH,
              height: mediaHeight,
              overflow: "hidden",
              backgroundColor: "#000",
            },
            heroStyle,
          ]}
        >
          <HeroFrame uri={heroUri} />
        </Animated.View>
      )}

      <Animated.View
        pointerEvents={phase === "open" ? "auto" : "none"}
        style={[StyleSheet.absoluteFill, contentWrapperStyle]}
      >
        <ContextDrop
          enabled={phase === "open"}
          onDismiss={commitClose}
          target={wrappedTarget}
          dragX={dragX}
        >
          {children({ phase, commitClose })}
        </ContextDrop>
      </Animated.View>
    </View>
  );
}
