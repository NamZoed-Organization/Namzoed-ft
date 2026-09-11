/**
 * PullToRefresh
 *
 * The app's own pull-to-refresh: CircularLoader fading in as you drag, in
 * place of the platform spinner RefreshControl draws.
 *
 * Why it's hand-rolled: RefreshControl only reports a before/after boolean,
 * not a live drag distance, and Android's pull gesture doesn't report one
 * through onScroll either (only iOS's overscroll bounce does) — so there's no
 * native way to fade a loader in AS you drag on both platforms. This tracks
 * the raw drag itself with a PanResponder, capturing on MOVE once the gesture
 * clearly matches (not on initial touch), so ordinary scrolling and tapping
 * are unaffected.
 *
 * Usage — the caller keeps ownership of its own scrollable, and places the
 * indicator wherever it belongs in its layout:
 *
 *   <PullToRefresh onRefresh={refresh}>
 *     {({ indicator, scrollEnabled, onScroll }) => (
 *       <>
 *         {indicator}
 *         <ScrollView
 *           scrollEnabled={scrollEnabled}
 *           onScroll={(e) => { onScroll(e); myOwnHandler(e); }}
 *           scrollEventThrottle={16}
 *           bounces={false}
 *           overScrollMode="never"
 *         >
 *           ...
 *
 * Chain `onScroll` rather than replacing it: the gesture only engages when
 * the list is already at the top, which it learns from those events.
 *
 * (The home feed carries its own inline copy of this, predating the
 * component — its indicator has to sit inside the sticky-header transform
 * wrapper. It can be migrated to this by passing `indicator` into that
 * wrapper.)
 */

import CircularLoader from "@/components/ui/CircularLoader";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
} from "react-native";

// Gesture geometry — a small capture threshold, a larger commit threshold.
const PULL_CAPTURE_DY = 6;
/** Drag distance (px) mapped to a fully revealed loader. */
const PULL_MAX = 90;
/** Drag distance needed at release to commit a refresh. */
const PULL_COMMIT_DY = 64;
/** Resting spacer height once committed — (56-24)/2 = 16px above and below
 *  the 24px loader, i.e. equal space either side. */
const REVEAL_HEIGHT = 56;

export interface PullToRefreshRenderProps {
  /** The reveal spacer + loader. Place it directly above the scrollable. */
  indicator: React.ReactNode;
  /** False while a pull is in progress, so the list doesn't scroll under it. */
  scrollEnabled: boolean;
  /** Feed the scrollable's scroll events here (chain with your own handler). */
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | unknown;
  children: (props: PullToRefreshRenderProps) => React.ReactNode;
  /** Loader color — defaults to the app's primary. */
  color?: string;
}

export default function PullToRefresh({
  onRefresh,
  children,
  color = "#094569",
}: PullToRefreshProps) {
  const pullDistance = useRef(new Animated.Value(0)).current;
  const [isPulling, setIsPulling] = useState(false);
  const refreshingRef = useRef(false);
  const scrollYRef = useRef(0);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const settlePull = useCallback(
    (toValue: number) => {
      Animated.spring(pullDistance, {
        toValue,
        useNativeDriver: false,
        friction: 7,
        tension: 70,
      }).start();
    },
    [pullDistance],
  );

  const commitPull = useCallback(() => {
    Animated.timing(pullDistance, {
      toValue: PULL_MAX,
      duration: 100,
      useNativeDriver: false,
    }).start();
    refreshingRef.current = true;
    Promise.resolve(onRefreshRef.current()).finally(() => {
      refreshingRef.current = false;
      settlePull(0);
    });
  }, [pullDistance, settlePull]);

  const pullResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
        !refreshingRef.current &&
        scrollYRef.current <= 0 &&
        gesture.dy > PULL_CAPTURE_DY &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        !refreshingRef.current &&
        scrollYRef.current <= 0 &&
        gesture.dy > PULL_CAPTURE_DY &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setIsPulling(true);
      },
      onPanResponderMove: (_evt, gesture) => {
        pullDistance.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_evt, gesture) => {
        setIsPulling(false);
        if (gesture.dy >= PULL_COMMIT_DY) {
          commitPull();
        } else {
          settlePull(0);
        }
      },
      onPanResponderTerminate: () => {
        setIsPulling(false);
        settlePull(0);
      },
    }),
  ).current;

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = e.nativeEvent.contentOffset.y;
    },
    [],
  );

  // Grows with the live drag (fading the loader in as you pull), springs to
  // REVEAL_HEIGHT on a committed release, or back to 0 if released early.
  const revealHeight = pullDistance.interpolate({
    inputRange: [0, PULL_MAX],
    outputRange: [0, REVEAL_HEIGHT],
    extrapolate: "clamp",
  });
  const loaderOpacity = pullDistance.interpolate({
    inputRange: [0, PULL_MAX * 0.4, PULL_MAX],
    outputRange: [0, 0.5, 1],
    extrapolate: "clamp",
  });

  const indicator = (
    <Animated.View
      style={{
        height: revealHeight,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View style={{ opacity: loaderOpacity }}>
        <CircularLoader size="small" color={color} />
      </Animated.View>
    </Animated.View>
  );

  return (
    <Animated.View {...pullResponder.panHandlers} style={{ flex: 1 }}>
      {children({ indicator, scrollEnabled: !isPulling, onScroll: handleScroll })}
    </Animated.View>
  );
}
