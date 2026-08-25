/**
 * ContextDrop
 *
 * Reusable edge-swipe-back gesture with an optional bottom "drop target" —
 * inspired by RedNote: drag back from the left edge (like iOS's native back
 * gesture — starting anywhere else doesn't trigger it) to dismiss, or curve
 * the drag down toward a dome that rises from the bottom and release there
 * to fire a contextual action instead of just dismissing.
 *
 * A multi-image carousel's own "swipe right to see the previous image"
 * gesture looks identical to this one when it happens to start within the
 * edge zone, so ContextDrop additionally backs off while a carousel
 * registered in utils/edgeGestureRegistry.ts reports it isn't on its
 * first item under the touch.
 *
 * Deliberately generic (no post/chat-specific knowledge) — PostDetailOverlay
 * is its first consumer (drop target = "message the post's author"), but
 * any other "swipe back with a contextual drop action" feature should wrap
 * its content in this same component rather than re-implementing the
 * gesture. Pass `target={null}` for a plain dismiss-only edge swipe.
 *
 * Two-stage drag, not one continuous motion:
 *  - 0–25% of the screen width: content shrinks in from both top and
 *    bottom, tracking the drag 1:1 (not a fixed-duration reveal) — a normal
 *    edge-swipe with no dome yet.
 *  - Past 25%: shrinking freezes at whatever it reached — from here the
 *    content is picked up and can be dragged in Y too (not just X), and the
 *    dome (reused from WeChatVoiceRecorder's own hold-to-talk dome
 *    silhouette — see that file for the curve math) fades in beneath it to
 *    drag toward. Crossing back below 25% reverses this immediately: the
 *    dome doesn't ease out, it's just gone, same as on release/cancel.
 */

import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MaskedView from "@react-native-masked-view/masked-view";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isEdgeGestureBlockedAt } from "@/utils/edgeGestureRegistry";

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get("window");
// How far you must start from the left edge for the gesture to even
// consider engaging — native iOS's own back-swipe uses a similarly narrow
// strip, not "anywhere on screen".
const EDGE_ZONE = 24;
// Past this fraction of screen width, shrinking freezes and "context drop
// mode" (Y-draggable, dome visible) begins.
const CONTEXT_DROP_THRESHOLD = WINDOW_WIDTH * 0.25;
// Past this fraction (or fast enough), releasing off-target commits a
// normal dismiss rather than snapping back.
const DISMISS_COMMIT_DX = WINDOW_WIDTH * 0.4;
// A flick at least this fast, caught early (before context-drop mode
// engages), commits an immediate dismiss instead of tracking the drag —
// see the "instant swipe" short-circuit in onPanResponderMove below.
const INSTANT_SWIPE_VX = 1.0;

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
  /** Optional externally-owned Animated.Value for the horizontal drag —
   * pass this if the parent needs to react to the exact same drag distance
   * itself, e.g. fading its own backdrop out so whatever real screen sits
   * behind this one shows through while dragging (this component has no
   * idea what that backdrop even is, so it can't do that fade itself). */
  dragX?: Animated.Value;
}

export default function ContextDrop({ enabled, onDismiss, target, children, dragX: externalDragX }: ContextDropProps) {
  const insets = useSafeAreaInsets();

  // Read through refs inside the PanResponder (built once via useRef) so a
  // parent that reuses this same mounted instance across multiple opens
  // (different target/onDismiss per open) never fires a stale closure.
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const targetRef = useRef(target);
  targetRef.current = target;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // Tracks the raw finger offset 1:1 — not eased, this is what "slowly
  // transitional[ly] reduce the height" as you drag actually means (driven
  // by drag distance, not a timer). Uses the parent's own value when given
  // one (see dragX prop above) instead of creating a private one.
  const internalDragX = useRef(new Animated.Value(0)).current;
  const dragX = externalDragX ?? internalDragX;
  // Only moves once past the 25% threshold ("context drop mode") — before
  // that the content only tracks X, per the request that it not also drift
  // vertically during a plain edge-swipe.
  const dragY = useRef(new Animated.Value(0)).current;
  // Dome opacity/scale — eases in the moment the threshold is crossed, but
  // is snapped (not eased) back to 0 the moment it's crossed back below, or
  // on release/cancel/drop. See resetDome vs the animated entrance below.
  const domeOpacity = useRef(new Animated.Value(0)).current;
  // Eases the dome up slightly when armed (hovering, about to drop) — a
  // separate value from domeOpacity's own entrance since this one animates
  // back and forth repeatedly within a single gesture as the hover state
  // toggles, not just once per gesture.
  const armedLift = useRef(new Animated.Value(0)).current;
  const inContextModeRef = useRef(false);
  const [armed, setArmed] = useState(false);
  const armedRef = useRef(false);
  // Set the instant a fast early flick commits the dismiss (see
  // INSTANT_SWIPE_VX below) — once true, the rest of this same gesture
  // (further moves, the eventual release/terminate) is ignored so the
  // already-fired dismiss doesn't get double-processed.
  const committedRef = useRef(false);

  const domeRestBottom = insets.bottom + NAV_CLEARANCE;
  const domeCrestY = WINDOW_HEIGHT - domeRestBottom - DOME_CREST_Y_FROM_BOTTOM;

  const resetDome = () => {
    domeOpacity.setValue(0);
    armedLift.setValue(0);
    inContextModeRef.current = false;
    armedRef.current = false;
    setArmed(false);
  };

  const cancelDrag = () => {
    Animated.parallel([
      Animated.timing(dragX, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(dragY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      // Edge-swipe only (like iOS's native back gesture) — starting the
      // gesture anywhere in the middle of the screen would otherwise
      // collide with, e.g., a multi-image post's own carousel paging.
      //
      // Capture-phase (not just bubble-phase) is required here: a plain
      // onMoveShouldSetPanResponder still lets content underneath — e.g. the
      // media carousel's own horizontal FlatList, which spans the full
      // width including this edge zone — see the gesture first and claim it
      // for its own paging, so the edge-swipe never got a chance to fire at
      // all on multi-image posts. Capturing on MOVE (not on the initial
      // touch-down) intercepts it before that FlatList's own move-based
      // claim wins the race, without also swallowing plain taps on the back
      // button that sits in this same edge zone — a tap never generates
      // enough movement to reach this check at all.
      //
      // A carousel currently under the touch can veto this via the shared
      // edgeGestureRegistry — engaging is skipped while there's a
      // "previous" item for a rightward swipe to reveal there, so a
      // genuine mid-carousel page-back swipe (which looks identical to
      // this gesture) is left alone instead of being hijacked into a
      // dismiss. See utils/edgeGestureRegistry.ts.
      onMoveShouldSetPanResponderCapture: (evt, gesture) =>
        enabledRef.current &&
        gesture.x0 < EDGE_ZONE &&
        gesture.dx > 18 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5 &&
        !isEdgeGestureBlockedAt(evt.nativeEvent.pageY),
      onMoveShouldSetPanResponder: (evt, gesture) =>
        enabledRef.current &&
        gesture.x0 < EDGE_ZONE &&
        gesture.dx > 18 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5 &&
        !isEdgeGestureBlockedAt(evt.nativeEvent.pageY),
      onPanResponderGrant: () => {
        committedRef.current = false;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_evt, gesture) => {
        if (committedRef.current) return;

        // Instant swipe: caught fast enough (and before context-drop mode
        // ever engages) that the drag never gets a chance to visually track
        // at all — commit straight to a normal dismiss instead of shrinking
        // the content in and/or arming the drop dome first.
        if (!inContextModeRef.current && gesture.vx > INSTANT_SWIPE_VX) {
          committedRef.current = true;
          dragX.setValue(0);
          dragY.setValue(0);
          resetDome();
          onDismissRef.current();
          return;
        }

        dragX.setValue(Math.max(0, gesture.dx));

        const pastThreshold = gesture.dx >= CONTEXT_DROP_THRESHOLD;
        if (pastThreshold && !inContextModeRef.current && targetRef.current) {
          inContextModeRef.current = true;
          Animated.timing(domeOpacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else if (!pastThreshold && inContextModeRef.current) {
          // Dragged back below the threshold mid-gesture — same "gone
          // immediately, not eased" rule as a release/cancel.
          resetDome();
          dragY.setValue(0);
        }

        if (inContextModeRef.current) {
          dragY.setValue(Math.max(0, gesture.dy));
          const nowArmed = gesture.moveY >= domeCrestY - DOME_HIT_TOLERANCE;
          if (nowArmed !== armedRef.current) {
            armedRef.current = nowArmed;
            setArmed(nowArmed);
            Animated.timing(armedLift, { toValue: nowArmed ? 1 : 0, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
            void Haptics.selectionAsync();
          }
        }
      },
      onPanResponderRelease: (_evt, gesture) => {
        // Already dismissed by the instant-swipe short-circuit above —
        // nothing left to do for the rest of this gesture.
        if (committedRef.current) {
          committedRef.current = false;
          return;
        }
        if (armedRef.current && targetRef.current) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          resetDome();
          targetRef.current.onDrop();
          return;
        }
        resetDome();
        if (gesture.dx > DISMISS_COMMIT_DX || gesture.vx > 0.6) {
          onDismissRef.current();
        } else {
          cancelDrag();
        }
      },
      onPanResponderTerminate: () => {
        if (committedRef.current) {
          committedRef.current = false;
          return;
        }
        resetDome();
        cancelDrag();
      },
    }),
  ).current;

  // Shrink is driven directly off dragX (not a separate animated value),
  // clamped past the threshold — this is what makes it freeze exactly where
  // it was the instant "context drop mode" begins, rather than continuing
  // to shrink while the content is also being dragged in Y.
  const shrinkProgress = dragX.interpolate({ inputRange: [0, CONTEXT_DROP_THRESHOLD], outputRange: [0, 1], extrapolate: "clamp" });
  const topInset = shrinkProgress.interpolate({ inputRange: [0, 1], outputRange: [0, TOP_SHRINK] });
  const bottomInset = shrinkProgress.interpolate({ inputRange: [0, 1], outputRange: [0, BOTTOM_SHRINK] });
  const cornerRadius = shrinkProgress.interpolate({ inputRange: [0, 1], outputRange: [0, DRAG_CORNER_RADIUS] });

  return (
    <View style={{ flex: 1 }}>
      {/* Grey scrim — same "dim the screen while an active hold gesture is
          happening" treatment chat's own hold-to-talk uses. */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(17,24,39,0.35)", opacity: shrinkProgress }]}
      />

      <Animated.View
        {...(enabled ? panResponder.panHandlers : {})}
        style={{
          position: "absolute",
          top: topInset,
          left: 0,
          right: 0,
          bottom: bottomInset,
          borderRadius: cornerRadius,
          overflow: "hidden",
          backgroundColor: "#fff",
          transform: [{ translateX: dragX }, { translateY: dragY }],
        }}
      >
        {children}
      </Animated.View>

      {target && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -DOME_EXTRA,
            height: DOME_TOTAL,
            opacity: domeOpacity,
            transform: [
              { scale: domeOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
              // Slight rise while armed/hovering — a separate, repeatable
              // transition (not tied to the one-shot entrance above).
              { translateY: armedLift.interpolate({ inputRange: [0, 1], outputRange: [0, -14] }) },
            ],
          }}
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
