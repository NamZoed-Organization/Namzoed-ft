/**
 * SubPageLayer
 *
 * One level of the Settings screen's nested sub-page stack: a full-bleed
 * container that slides in from the right, can be dragged back from the left
 * edge, and reveals whatever is beneath it while it moves.
 *
 * The transform lives on this container — the thing that paints the opaque
 * background — rather than on the content inside it. With it on the content,
 * a slow drag slid the page away but left its own background behind, so the
 * screen underneath never showed through, unlike every other back gesture on
 * the phone.
 *
 * Reanimated shared values rather than RN's Animated: the drag has to track
 * the finger on the UI thread, and each level owns its own value (created
 * with makeMutable, since these are made in an event handler, not a hook)
 * so a page that isn't moving never has its transform touched.
 */

import React from "react";
import { Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const SCREEN_WIDTH = Dimensions.get("window").width;
/** Gesture only starts from this strip, matching the native back gesture. */
const EDGE_WIDTH = 20;
const BACK_THRESHOLD = SCREEN_WIDTH * 0.28;
const VELOCITY_THRESHOLD = 800;
export const SUB_PAGE_SLIDE_MS = 250;

interface SubPageLayerProps {
  /** This level's own translateX, owned by the stack. */
  anim: SharedValue<number>;
  /** Only the top level is interactive. */
  isTop: boolean;
  /** Whether this level handles the back drag itself — false at the bottom
   *  of the stack, where the route's own gesture takes over so the screen
   *  behind Settings is what gets revealed. */
  swipeEnabled: boolean;
  zIndex: number;
  backgroundColor: string;
  paddingBottom: number;
  /** Called once this level has been dragged fully off-screen. */
  onSwipedBack: () => void;
  /** True while a push/pop animation owns the value — the drag stands down. */
  isAnimating: () => boolean;
  children: React.ReactNode;
}

export default function SubPageLayer({
  anim,
  isTop,
  swipeEnabled,
  zIndex,
  backgroundColor,
  paddingBottom,
  onSwipedBack,
  isAnimating,
  children,
}: SubPageLayerProps) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: anim.value }],
  }));

  const pan = Gesture.Pan()
    .enabled(swipeEnabled)
    .activeOffsetX(12)
    .failOffsetY([-12, 12])
    .onBegin(() => {
      "worklet";
    })
    .onUpdate((event) => {
      "worklet";
      if (isAnimating()) return;
      anim.value = Math.max(0, event.translationX);
    })
    .onEnd((event) => {
      "worklet";
      if (isAnimating()) return;
      const shouldGoBack =
        event.translationX > BACK_THRESHOLD || event.velocityX > VELOCITY_THRESHOLD;
      if (shouldGoBack) {
        // Carry it the rest of the way at the speed it was already moving,
        // then let the stack drop this level.
        anim.value = withTiming(SCREEN_WIDTH, { duration: 180 }, (finished) => {
          if (finished) runOnJS(onSwipedBack)();
        });
      } else {
        anim.value = withSpring(0, { damping: 22, stiffness: 250 });
      }
    });

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex,
          backgroundColor,
          paddingBottom,
        },
        style,
      ]}
      // Only the top page takes touches — the ones beneath are visible
      // during a transition but must not be interactive.
      pointerEvents={isTop ? "auto" : "none"}
    >
      {children}
      {swipeEnabled && (
        <GestureDetector gesture={pan}>
          <Animated.View
            style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: EDGE_WIDTH }}
          />
        </GestureDetector>
      )}
    </Animated.View>
  );
}
