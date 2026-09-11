/**
 * "This is the thing the tutorial points at."
 *
 * Wraps a control in a plain `View` that measures itself in window
 * coordinates and hands the rect to the engine. It changes nothing about
 * the control — no press interception, no extra layout — because the whole
 * point is that the spotlight leaves the *real* button exposed and the real
 * press is what finishes the step. A wrapper that swallowed the touch would
 * be a picture of a button again.
 *
 * Two things it has to get right:
 *  - `collapsable={false}`, or Android flattens the view away and there is
 *    nothing left to measure.
 *  - re-measuring while it is the live anchor, on the same slow tick the
 *    engine polls with, because a control can arrive late (a sheet opening),
 *    move (a list scrolling) or re-lay-out (a tab bar) after its first
 *    measurement.
 */

import { useTutorial } from "@/contexts/TutorialContext";
import React, { useCallback, useEffect, useRef } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

export default function TutorialAnchor({
  id,
  children,
  style,
  /** The control's own corner radius, so the spotlight matches it. */
  radius = 12,
  /** `"none"` makes this a measuring frame rather than a wrapper — for a
   *  gesture, whose "control" is a whole surface that must keep every touch
   *  it already had. */
  pointerEvents,
}: {
  id: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  pointerEvents?: "none" | "auto" | "box-none" | "box-only";
}) {
  const { registerAnchor, unregisterAnchor, isAnchorLive } = useTutorial();
  const ref = useRef<View>(null);
  const live = isAnchorLive(id);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      // A control mid-animation measures as a zero box; publishing that
      // would put the spotlight in the corner of the screen.
      if (!width || !height) return;
      registerAnchor(id, { x, y, width, height, radius });
    });
  }, [id, radius, registerAnchor]);

  useEffect(() => {
    measure();
    return () => unregisterAnchor(id);
  }, [id, measure, unregisterAnchor]);

  useEffect(() => {
    if (!live) return;
    const tick = setInterval(measure, 350);
    return () => clearInterval(tick);
  }, [live, measure]);

  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={measure}
      style={style}
      pointerEvents={pointerEvents}
    >
      {children}
    </View>
  );
}
