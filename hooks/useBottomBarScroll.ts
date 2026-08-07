import { useRef } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";

const SHRINK_SCALE = 0.9;
// Minimum per-event scroll delta before we react — filters out rubber-band
// bounce and sub-pixel jitter so the pill doesn't flicker between sizes.
const DIRECTION_THRESHOLD = 6;

/**
 * Standalone version of the tab-navigator's scroll-linked pill shrink, for
 * screens that render BottomNavBar outside the tab navigator (profile,
 * reels) and so aren't wrapped by TabBarScrollProvider. Each screen owns its
 * own instance — no context needed since it's just parent -> BottomNavBar.
 */
export function useBottomBarScroll(): {
  scale: SharedValue<number>;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
} {
  const scale = useSharedValue(1);
  const lastOffsetRef = useRef(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const delta = y - lastOffsetRef.current;
    lastOffsetRef.current = y;

    if (y <= 0) {
      scale.value = withTiming(1, { duration: 200 });
      return;
    }

    if (delta > DIRECTION_THRESHOLD) {
      scale.value = withTiming(SHRINK_SCALE, { duration: 200 });
    } else if (delta < -DIRECTION_THRESHOLD) {
      scale.value = withTiming(1, { duration: 200 });
    }
  };

  return { scale, onScroll };
}
