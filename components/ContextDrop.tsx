/**
 * ContextDrop
 *
 * Reusable edge-swipe-back gesture with an optional bottom "drop target" —
 * inspired by RedNote: drag back from the left edge (like iOS's native back
 * gesture — starting anywhere else doesn't trigger it) to dismiss, or once
 * the dome (see below) has risen into place, touch it to arm and release
 * there to fire a contextual action instead of just dismissing.
 *
 * Built on react-native-gesture-handler's Gesture.Pan + Reanimated worklets
 * (same primitives as components/ui/EdgeSwipeBack.tsx), not React Native's
 * PanResponder/Animated — gesture recognition and every animated value here
 * run on the UI thread, so tracking and the spring-back/shrink motion stay
 * smooth even while the JS thread is busy mounting/unmounting whatever this
 * wraps (FeedPost, ProductDetailContent, ...). The one thing that genuinely
 * needs JS-thread involvement is calling back out to plain JS functions
 * (onDismiss, target.onDrop, haptics, the `armed` label swap) — those hop
 * over via runOnJS, everything else (the drag itself, the shrink, the dome
 * slide) never leaves the UI thread.
 *
 * A multi-image carousel's own "swipe right to see the previous image"
 * gesture looks identical to this one when it happens to start within the
 * edge zone, so ContextDrop additionally backs off while a carousel
 * registered in utils/edgeGestureRegistry.ts reports it isn't on its
 * first item under the touch. That check has to be answerable synchronously
 * from a UI-thread worklet (see this gesture's manual activation below), so
 * the registry itself is worklet-safe — see its own header comment.
 *
 * Deliberately generic (no post/chat-specific knowledge) — PostDetailOverlay
 * is its first consumer (drop target = "message the post's author"), but
 * any other "swipe back with a contextual drop action" feature should wrap
 * its content in this same component rather than re-implementing the
 * gesture. Pass `target={null}` for a plain dismiss-only edge swipe.
 *
 * Two-stage drag, not one continuous motion:
 *  - 0–30% of the screen width: content shrinks in from both top and
 *    bottom, tracking the drag 1:1 (not a fixed-duration reveal) — a normal
 *    edge-swipe. The dome (reused from WeChatVoiceRecorder's own
 *    hold-to-talk dome silhouette — see that file for the curve math)
 *    slides up from beneath the screen edge in lockstep with the same drag
 *    distance, like a drawer opening, reaching its resting position exactly
 *    at 30% — purely a preview at this stage, not yet interactive, so a
 *    user dragging slowly notices the feature exists well before reaching
 *    the threshold instead of having it appear out of nowhere once they're
 *    already there. A quick flick never gets this treatment at all — see
 *    domeVisibility below, gated on average speed since the gesture
 *    started (deliberately an average over elapsed time, not a raw
 *    per-sample velocity reading, which is noisy enough in a gesture's
 *    first few samples to make the dome show up inconsistently even for
 *    perfectly ordinary slow drags) — since it's headed straight for a
 *    dismiss and the dome popping up only to vanish again reads as a
 *    glitch, not a preview.
 *  - Past 30%: shrinking (and the dome's own slide) freezes at whatever it
 *    reached, and the content is picked up and can be dragged in Y too (not
 *    just X) — but only from THIS point, and only the incremental movement
 *    from here on (see dragYBase below), not the raw finger offset —
 *    otherwise whatever vertical drift had already accumulated before
 *    crossing the threshold would apply in one frame as a sudden jump the
 *    instant context-drop mode engages. Arming is "is the finger currently
 *    over the dome's hit area": touch it and it arms immediately, move off
 *    it (still holding) and it un-arms immediately, release while armed to
 *    drop. Crossing back below 30% mid-gesture immediately turns the
 *    interactivity off (arming can't happen, Y resets), while the dome
 *    keeps sliding with the drag continuously same as always, same as on
 *    release/cancel.
 */

import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef, useState } from "react";
import { Dimensions, Platform, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isEdgeGestureBlockedAt } from "@/utils/edgeGestureRegistry";

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get("window");
// How far you must start from the left edge for the gesture to even
// consider engaging — native iOS's own back-swipe uses a similarly narrow
// strip, not "anywhere on screen". Enforced structurally: the gesture's own
// detector view (see render below) is only this wide, so a touch starting
// further in never reaches it at all.
const EDGE_ZONE = 24;
// Past this fraction of screen width, shrinking (and the dome's own growth
// — see shrinkProgress below) freezes, and "context drop mode" (Y-draggable,
// drop target interactive) begins.
const CONTEXT_DROP_THRESHOLD = WINDOW_WIDTH * 0.3;
// Past this fraction (or fast enough — see DISMISS_COMMIT_VELOCITY),
// releasing off-target commits a normal dismiss rather than snapping back.
// Checked only at release, never mid-drag: a fast flick should commit once
// you let go, but holding after one (finger still down) must keep tracking
// the gesture normally instead of yanking the screen away out from under it.
const DISMISS_COMMIT_DX = WINDOW_WIDTH * 0.4;
// Points/second — Gesture Handler's own velocity unit (React Native's old
// PanResponder measured px/ms; 0.6 px/ms there is ~600 px/s here).
const DISMISS_COMMIT_VELOCITY = 600;
// Average speed (px/ms) since the gesture started, caught anywhere before
// context-drop mode engages, means this swipe is headed for a dismiss (see
// DISMISS_COMMIT_VELOCITY above, checked at release) — the dome preview is
// suppressed for the rest of the gesture so it doesn't pop up only to
// vanish again the instant the screen leaves. An AVERAGE over elapsed time
// (translationX / ms-since-touch-down), not an instantaneous velocity
// reading — those are genuinely noisy, especially in a gesture's first few
// samples — so gating on one made the dome show up inconsistently even for
// perfectly ordinary slow drags whenever an early sample happened to spike.
// An average smooths that out completely.
const FAST_SWIPE_SUPPRESS_AVG_PX_PER_MS = 0.5;
// Don't evaluate the average above until at least this much time has
// passed — dx/elapsed is wildly unstable over the first couple of
// milliseconds (a few px over ~1ms reads as an enormous "velocity").
const FAST_SWIPE_MIN_ELAPSED_MS = 30;
// How far (px) the drag must move before this claims the gesture. Kept
// small on purpose: when a carousel is under the touch but reports no
// previous item (edgeGestureRegistry's hasPrevious() is false — e.g. the
// first image of a multi-image post), the carousel veto below already lets
// this claim the gesture, but the carousel's own FlatList still has a
// native scroll-gesture recognizer underneath that activates within a
// couple of pixels — a large threshold here just hands it the race,
// letting it start visibly rubber-banding (bouncing toward a "previous"
// page that doesn't exist) before this ever gets a chance to capture.
// Small enough to win that race, still large enough not to fire on tap
// jitter (a tap barely moves 1-2px).
const EDGE_SWIPE_CAPTURE_DX = 6;
// Vertical movement (px) past which a drag that's still more vertical than
// horizontal is treated as a scroll, not an edge-swipe, and this gesture
// gives up on it for the rest of the touch. Deliberately not evaluated the
// instant the ratio first looks unfavorable — an edge-swipe that starts at
// a slightly imprecise angle should still get claimed once it straightens
// out, so this waits for enough vertical travel to be confident it's a
// real scroll before giving up.
const VERTICAL_FAIL_DY = 15;

// Content shrinks in from BOTH edges while dragging (not just the bottom) —
// makes the dragged content read as a single controllable object rather
// than a full-bleed screen with an overlay bolted onto it.
const TOP_SHRINK = 40;
const BOTTOM_SHRINK = 110;
const DRAG_CORNER_RADIUS = 18;

// Dome geometry — same construction as WeChatVoiceRecorder's DOME_PATH,
// just full device width instead of a composer's measured content width.
const DOME_RISE_HEIGHT = 92;
const DOME_EXTRA = 130;
const DOME_TOTAL = DOME_RISE_HEIGHT + DOME_EXTRA;
// Shallower arc than WeChatVoiceRecorder's own 0.5 ratio — a lower fraction
// here is a flatter curve (less pronounced peak), same math otherwise.
const DOME_CURVE_DEPTH = DOME_RISE_HEIGHT * 0.32;
const DOME_PATH = `M0,${DOME_TOTAL} L0,${DOME_CURVE_DEPTH} Q50,${-DOME_CURVE_DEPTH} 100,${DOME_CURVE_DEPTH} L100,${DOME_TOTAL} Z`;
// Clears where FloatingTabBar's own pill normally floats (56 height + 6 gap
// + margin) — moot once the tab bar is actually hidden, but keeps the dome
// positioned where a visible nav would still be cleared.
const NAV_CLEARANCE = 70;
// How far up from the true bottom the dome's crest (readable label area)
// sits — used for the arm/hover hit-test.
const DOME_CREST_Y_FROM_BOTTOM = DOME_RISE_HEIGHT * 0.55;
const DOME_HIT_TOLERANCE = 30;

// Shared spring/timing feel for both the release-snap-back and the
// terminated-mid-gesture cases below.
const RELEASE_TIMING = { duration: 220, easing: Easing.out(Easing.cubic) };

export interface ContextDropTarget {
  /** Idle label, e.g. "Contact Author". */
  label: string;
  /** Shown once the drag is hovering over the dome, e.g. "Drop to Contact Author". */
  armedLabel: string;
  icon: React.ReactNode;
  armedIcon: React.ReactNode;
  /** Fired on release while armed. */
  onDrop: () => void;
}

interface ContextDropProps {
  /** Whether the gesture is live at all right now. */
  enabled: boolean;
  /** Swiped back far/fast enough WITHOUT dropping on the target. */
  onDismiss: () => void;
  /** Omit (or pass null) for a plain dismiss-only edge swipe, no dome. */
  target?: ContextDropTarget | null;
  children: React.ReactNode;
  /** Optional externally-owned Reanimated shared value for the horizontal
   * drag — pass this if the parent needs to react to the exact same drag
   * distance itself, e.g. fading its own backdrop out so whatever real
   * screen sits behind this one shows through while dragging (this
   * component has no idea what that backdrop even is, so it can't do that
   * fade itself). */
  dragX?: SharedValue<number>;
}

export default function ContextDrop({ enabled, onDismiss, target, children, dragX: externalDragX }: ContextDropProps) {
  const insets = useSafeAreaInsets();

  // Read through refs inside the gesture worklets (built fresh every render,
  // like any RNGH Gesture object) so a parent that reuses this same mounted
  // instance across multiple opens (different target/onDismiss per open)
  // never fires a stale closure — same reasoning the old PanResponder
  // version had for these same refs.
  const targetRef = useRef(target);
  targetRef.current = target;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const internalDragX = useSharedValue(0);
  const dragX = externalDragX ?? internalDragX;
  // Only moves once past the 30% threshold ("context drop mode") — before
  // that the content only tracks X, per the request that it not also drift
  // vertically during a plain edge-swipe.
  const dragY = useSharedValue(0);
  // Eases the dome up slightly when armed (hovering, about to drop) — a
  // separate value from the dome's own shrinkProgress-driven entrance since
  // this one animates back and forth repeatedly within a single gesture as
  // the hover state toggles, not just once per gesture.
  const armedLift = useSharedValue(0);
  // 1 = dome allowed to show, 0 = suppressed for the rest of this gesture
  // (see FAST_SWIPE_SUPPRESS_AVG_PX_PER_MS). Multiplied into the dome's own
  // shrinkProgress-driven reveal below — never touches shrinkProgress
  // itself, so the content shrink/dismiss mechanics are unaffected either way.
  const domeVisibility = useSharedValue(1);
  const domeSuppressed = useSharedValue(false);
  // Set fresh on every touch-down — timestamps the average-speed check
  // above against, not a raw per-sample velocity reading.
  const gestureStartTime = useSharedValue(0);
  const inContextMode = useSharedValue(false);
  const armedSV = useSharedValue(false);
  // gesture.translationY already on the clock the instant context-drop mode
  // engages — subtracted back out so Y-tracking starts smoothly from 0
  // right at that moment instead of snapping straight to whatever had
  // already accumulated pre-threshold.
  const dragYBase = useSharedValue(0);
  const touchStartX = useSharedValue(0);
  const touchStartY = useSharedValue(0);
  const hasActivated = useSharedValue(false);
  const [armed, setArmed] = useState(false);

  const triggerLightHaptic = useCallback(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), []);
  const triggerMediumHaptic = useCallback(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), []);
  const triggerSelectionHaptic = useCallback(() => void Haptics.selectionAsync(), []);
  const triggerSuccessHaptic = useCallback(() => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), []);
  const triggerDrop = useCallback(() => targetRef.current?.onDrop(), []);
  const triggerDismiss = useCallback(() => onDismissRef.current(), []);

  const domeRestBottom = insets.bottom + NAV_CLEARANCE;
  const domeCrestY = WINDOW_HEIGHT - domeRestBottom - DOME_CREST_Y_FROM_BOTTOM;
  const hasTarget = !!target;

  const pan = Gesture.Pan()
    .enabled(enabled)
    // Manual activation is what lets the carousel veto (isEdgeGestureBlockedAt)
    // and the direction/ratio check below decide activation themselves,
    // synchronously, entirely on the UI thread — see this file's own header
    // comment and edgeGestureRegistry.ts for why that has to stay off the JS
    // thread rather than asking a plain JS function for an answer.
    .manualActivation(true)
    .onTouchesDown((e) => {
      "worklet";
      const touch = e.allTouches[0];
      touchStartX.value = touch.absoluteX;
      touchStartY.value = touch.absoluteY;
      gestureStartTime.value = Date.now();
      hasActivated.value = false;
      domeSuppressed.value = false;
      domeVisibility.value = 1;
    })
    .onTouchesMove((e, stateManager) => {
      "worklet";
      if (hasActivated.value || e.numberOfTouches === 0) return;
      const touch = e.allTouches[0];
      const dx = touch.absoluteX - touchStartX.value;
      const dy = touch.absoluteY - touchStartY.value;
      if (dx <= EDGE_SWIPE_CAPTURE_DX) return;
      if (Math.abs(dy) > VERTICAL_FAIL_DY && Math.abs(dx) <= Math.abs(dy) * 1.5) {
        stateManager.fail();
        return;
      }
      // A carousel currently under the touch can veto this — engaging is
      // skipped while it reports a "previous" item a rightward swipe would
      // reveal there instead, so a genuine mid-carousel page-back swipe
      // (which looks identical to this gesture) is left alone.
      if (isEdgeGestureBlockedAt(touch.absoluteY)) {
        stateManager.fail();
        return;
      }
      hasActivated.value = true;
      stateManager.activate();
      runOnJS(triggerLightHaptic)();
    })
    .onUpdate((e) => {
      "worklet";
      dragX.value = Math.max(0, e.translationX);

      const pastThreshold = e.translationX >= CONTEXT_DROP_THRESHOLD;
      if (pastThreshold && !inContextMode.value && hasTarget) {
        inContextMode.value = true;
        // Truly in context-drop mode now — the dome must show regardless
        // of how fast the drag got here, so any earlier suppression is
        // lifted. And Y-tracking starts fresh from here, not from whatever
        // translationY had already accumulated.
        domeSuppressed.value = false;
        domeVisibility.value = 1;
        dragYBase.value = e.translationY;
        runOnJS(triggerMediumHaptic)();
      } else if (!pastThreshold && inContextMode.value) {
        // Dragged back below the threshold mid-gesture — turns
        // interactivity off; the dome itself keeps tracking dragX (it just
        // shrinks back down along with the content, continuously). dragY
        // snaps here (not eased) since this is live feedback while still
        // actively dragging, not an end-of-gesture hand-off.
        inContextMode.value = false;
        armedLift.value = 0;
        if (armedSV.value) {
          armedSV.value = false;
          runOnJS(setArmed)(false);
        }
        dragY.value = 0;
      } else if (!inContextMode.value && !domeSuppressed.value) {
        const elapsed = Date.now() - gestureStartTime.value;
        if (elapsed > FAST_SWIPE_MIN_ELAPSED_MS && e.translationX / elapsed > FAST_SWIPE_SUPPRESS_AVG_PX_PER_MS) {
          // A quick flick, still short of the threshold — this is headed
          // for a dismiss, not a deliberate drag toward the dome, so don't
          // let it pop up only to disappear again a moment later.
          domeSuppressed.value = true;
          domeVisibility.value = 0;
        }
      }

      // Arming is purely "is the finger currently over the dome" —
      // e.absoluteY is the finger's actual on-screen position regardless of
      // how far the content itself has been dragged, so this stays correct
      // whether or not the content's own Y offset (below) has caught up
      // yet. Touch the dome, it arms; move off it, it un-arms.
      if (inContextMode.value) {
        dragY.value = Math.max(0, e.translationY - dragYBase.value);
        const nowArmed = e.absoluteY >= domeCrestY - DOME_HIT_TOLERANCE;
        if (nowArmed !== armedSV.value) {
          armedSV.value = nowArmed;
          armedLift.value = withTiming(nowArmed ? 1 : 0, { duration: 180, easing: Easing.out(Easing.cubic) });
          runOnJS(setArmed)(nowArmed);
          runOnJS(triggerSelectionHaptic)();
        }
      }
    })
    .onEnd((e, success) => {
      "worklet";
      if (!success) {
        // Terminated externally (app backgrounded, a sibling handler took
        // over, ...) — snap back, never commit.
        inContextMode.value = false;
        armedLift.value = 0;
        if (armedSV.value) {
          armedSV.value = false;
          runOnJS(setArmed)(false);
        }
        dragX.value = withTiming(0, RELEASE_TIMING);
        dragY.value = withTiming(0, RELEASE_TIMING);
        return;
      }

      if (armedSV.value && hasTarget) {
        armedLift.value = 0;
        inContextMode.value = false;
        armedSV.value = false;
        runOnJS(setArmed)(false);
        runOnJS(triggerSuccessHaptic)();
        runOnJS(triggerDrop)();
        return;
      }

      armedLift.value = 0;
      inContextMode.value = false;
      if (armedSV.value) {
        armedSV.value = false;
        runOnJS(setArmed)(false);
      }

      // A fast-enough release commits a dismiss even short of
      // DISMISS_COMMIT_DX — a quick flick shouldn't need to travel that far
      // first. Velocity is checked ONLY here, at release — never mid-drag
      // (see onUpdate above) — so a fast swipe that's then held keeps
      // tracking normally instead of committing before the finger even lifts.
      if (e.translationX > DISMISS_COMMIT_DX || e.velocityX > DISMISS_COMMIT_VELOCITY) {
        runOnJS(triggerDismiss)();
      } else {
        dragX.value = withTiming(0, RELEASE_TIMING);
        dragY.value = withTiming(0, RELEASE_TIMING);
      }
    });

  // Shrink is driven directly off dragX (not a separate animated value),
  // clamped past the threshold — this is what makes it freeze exactly where
  // it was the instant "context drop mode" begins, rather than continuing
  // to shrink while the content is also being dragged in Y.
  const shrinkProgress = useDerivedValue(() =>
    interpolate(dragX.value, [0, CONTEXT_DROP_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  );
  // Dome preview — a drawer-style slide, not a resize/fade: tracks the same
  // 0→threshold drag progress as the content shrink above, pushed down by
  // DOME_EXTRA (enough to clear the crest's curve overshoot too) at rest and
  // easing up to its true resting position exactly when shrinking freezes
  // and context-drop mode actually goes interactive — a "this feature
  // exists" hint that's visible well before the threshold, not a switch
  // that flips only once you're already there. Multiplied by domeVisibility
  // (1 normally, snapped to 0 mid-gesture for a fast flick) so a quick
  // dismissive swipe never gets this preview at all — shrinkProgress itself
  // is untouched, so the content shrink/dismiss keeps working the same either way.
  const domeReveal = useDerivedValue(() => shrinkProgress.value * domeVisibility.value);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: shrinkProgress.value }));

  const contentStyle = useAnimatedStyle(() => ({
    top: interpolate(shrinkProgress.value, [0, 1], [0, TOP_SHRINK]),
    bottom: interpolate(shrinkProgress.value, [0, 1], [0, BOTTOM_SHRINK]),
    borderRadius: interpolate(shrinkProgress.value, [0, 1], [0, DRAG_CORNER_RADIUS]),
    borderCurve: "continuous",
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }],
  }));

  const domeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(domeReveal.value, [0, 1], [DOME_EXTRA, 0]) },
      // Slight extra rise while armed/hovering — a separate, repeatable
      // transition stacked on top of the slide (same-key transform entries
      // compose additively), not tied to the drag-tracked entrance above.
      { translateY: interpolate(armedLift.value, [0, 1], [0, -14]) },
    ],
  }));

  return (
    <View style={{ flex: 1 }}>
      {/* Grey scrim — same "dim the screen while an active hold gesture is
          happening" treatment chat's own hold-to-talk uses. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(17,24,39,0.35)" }, scrimStyle]}
      />

      <Animated.View
        style={[
          { position: "absolute", left: 0, right: 0, overflow: "hidden", backgroundColor: "#fff" },
          contentStyle,
        ]}
      >
        {children}
      </Animated.View>

      {/* Gesture only ever needs to be recognized from this thin edge strip
          — same structural trick components/ui/EdgeSwipeBack.tsx already
          uses — rather than needing a manual "did this start near the left
          edge" check inside the gesture itself. Once a touch here is being
          tracked, it keeps tracking wherever the finger goes next, same as
          any native edge-swipe recognizer. */}
      <GestureDetector gesture={pan}>
        <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: EDGE_ZONE }} />
      </GestureDetector>

      {target && (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: "absolute", left: 0, right: 0, bottom: -DOME_EXTRA, height: DOME_TOTAL },
            domeStyle,
          ]}
        >
          <MaskedView
            style={StyleSheet.absoluteFill}
            maskElement={
              <Svg width="100%" height={DOME_TOTAL} viewBox={`0 0 100 ${DOME_TOTAL}`} preserveAspectRatio="none">
                <Path d={DOME_PATH} fill="#000000" />
              </Svg>
            }
          >
            {Platform.OS === "ios" && (
              <BlurView tint="dark" intensity={65} style={StyleSheet.absoluteFill} />
            )}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  // Same translucent fill whether armed or not — only the
                  // icon itself (see target.armedIcon) changes on arm now.
                  backgroundColor: Platform.OS === "ios" ? "rgba(75,85,99,0.22)" : "rgba(75,85,99,0.5)",
                },
              ]}
            />
          </MaskedView>

          <View pointerEvents="none" style={{ position: "absolute", top: 14, left: 0, right: 0, alignItems: "center" }}>
            <View style={{ alignItems: "center", gap: 4 }}>
              {armed ? target.armedIcon : target.icon}
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
                {armed ? target.armedLabel : target.label}
              </Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
}
