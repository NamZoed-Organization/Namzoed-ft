import React, { createContext, useContext, useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

const SHRINK_SCALE = 0.9;
// Minimum per-event scroll delta before we react — filters out rubber-band
// bounce and sub-pixel jitter so the pill doesn't flicker between sizes.
const DIRECTION_THRESHOLD = 6;

type TabBarScrollContextValue = {
  pillScale: SharedValue<number>;
  onTabBarScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const TabBarScrollContext = createContext<TabBarScrollContextValue | null>(null);

export function TabBarScrollProvider({ children }: { children: React.ReactNode }) {
  const pillScale = useSharedValue(1);
  const lastOffsetRef = useRef(0);

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
    <TabBarScrollContext.Provider value={{ pillScale, onTabBarScroll }}>
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
