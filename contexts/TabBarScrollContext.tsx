import React, { createContext, useContext, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

const SHRINK_SCALE = 0.9;
// Minimum per-event scroll delta before we react — filters out rubber-band
// bounce and sub-pixel jitter so the pill doesn't flicker between sizes.
const DIRECTION_THRESHOLD = 6;

type TabBarScrollContextValue = {
  pillScale: SharedValue<number>;
  onTabBarScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** True while a fullscreen overlay (e.g. PostDetailOverlay) is standing in
   * for real navigation — FloatingTabBar renders nothing while this is set,
   * since it otherwise floats on top of that overlay's own bottom bar (it's
   * rendered by the Tabs navigator itself, outside any given screen's own
   * view tree, so z-index inside a screen can never out-stack it). */
  tabBarHidden: boolean;
  setTabBarHidden: (hidden: boolean) => void;
};

const TabBarScrollContext = createContext<TabBarScrollContextValue | null>(null);

export function TabBarScrollProvider({ children }: { children: React.ReactNode }) {
  const pillScale = useSharedValue(1);
  const lastOffsetRef = useRef(0);
  const [tabBarHidden, setTabBarHidden] = useState(false);

  const onTabBarScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const delta = y - lastOffsetRef.current;
    lastOffsetRef.current = y;

    // Always snap back to full size once we're back near the top.
    if (y <= 0) {
      pillScale.value = withTiming(1, { duration: 200 });
      return;
    }

    if (delta > DIRECTION_THRESHOLD) {
      pillScale.value = withTiming(SHRINK_SCALE, { duration: 200 });
    } else if (delta < -DIRECTION_THRESHOLD) {
      pillScale.value = withTiming(1, { duration: 200 });
    }
    // Otherwise: hold the current size — this is the "locking in" behavior,
    // the pill only changes size on a deliberate scroll-direction change.
  };

  return (
    <TabBarScrollContext.Provider value={{ pillScale, onTabBarScroll, tabBarHidden, setTabBarHidden }}>
      {children}
    </TabBarScrollContext.Provider>
  );
}

export function useTabBarScroll() {
  const ctx = useContext(TabBarScrollContext);
  if (!ctx) {
    throw new Error("useTabBarScroll must be used within TabBarScrollProvider");
  }
  return ctx;
}

/** Same context, but returns null instead of throwing when there's no
 * provider above — for components (e.g. ProductDetailOverlay/
 * MarketplaceDetailOverlay) that are reused both inside the (tabs) group
 * (where TabBarScrollProvider wraps the Tabs navigator) and from plain stack
 * screens pushed alongside it (e.g. app/(users)/categories/[slug].tsx),
 * which sit outside that subtree and have no floating tab bar to hide
 * anyway. */
export function useOptionalTabBarScroll() {
  return useContext(TabBarScrollContext);
}
