import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import AnimatedRN, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// Instagram/UIPageControl-style shrinking dot window: up to 3 "normal" dots
// centered around the active one, tapering to a small then tiny dot on
// whichever side(s) still have more images. The normal window trails 2
// behind the active index, but reassigns any unused "before" slots forward
// when active is near the start (and mirrors near the end) so the 3 normal
// dots don't run out of room.
//
// Shared between the post-detail carousel (FeedPost's MediaCarousel) and the
// product image carousel (app/(users)/product/[id].tsx) so both read as the
// same visual system.
type DotTier = "normal" | "small" | "tiny";
interface DotEntry {
  index: number;
  tier: DotTier;
}
const DOT_SIZE: Record<DotTier, number> = { normal: 6, small: 4.5, tiny: 3 };

function getDotWindow(active: number, total: number): DotEntry[] {
  if (total <= 1) return [];
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => ({ index: i, tier: "normal" as const }));
  }

  let normalStart = active - 2;
  let normalEnd = active;
  if (normalStart < 0) {
    normalEnd += -normalStart;
    normalStart = 0;
  }
  if (normalEnd > total - 1) {
    normalStart -= normalEnd - (total - 1);
    normalEnd = total - 1;
    normalStart = Math.max(0, normalStart);
  }

  const dots: DotEntry[] = [];
  if (normalStart - 2 >= 0) dots.push({ index: normalStart - 2, tier: "tiny" });
  if (normalStart - 1 >= 0) dots.push({ index: normalStart - 1, tier: "small" });
  for (let i = normalStart; i <= normalEnd; i++) dots.push({ index: i, tier: "normal" });
  if (normalEnd + 1 <= total - 1) dots.push({ index: normalEnd + 1, tier: "small" });
  if (normalEnd + 2 <= total - 1) dots.push({ index: normalEnd + 2, tier: "tiny" });

  return dots;
}

function CarouselDot({ tier, isActive }: { tier: DotTier; isActive: boolean }) {
  const size = useSharedValue(DOT_SIZE[tier]);
  const activeProgress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    size.value = withTiming(DOT_SIZE[tier], { duration: 180 });
  }, [tier, size]);

  useEffect(() => {
    activeProgress.value = withTiming(isActive ? 1 : 0, { duration: 180 });
  }, [isActive, activeProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: size.value,
    height: size.value,
    borderRadius: size.value / 2,
    borderCurve: "continuous",
    backgroundColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      ["rgba(0, 0, 0, 0.2)", "#094569"],
    ),
  }));

  return (
    <AnimatedRN.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[{ marginHorizontal: 2.5 }, animatedStyle]}
    />
  );
}

export default function CarouselDots({ activeIndex, total }: { activeIndex: number; total: number }) {
  const dots = useMemo(() => getDotWindow(activeIndex, total), [activeIndex, total]);

  return (
    <View style={styles.dotsRow}>
      {dots.map(({ index, tier }) => (
        <CarouselDot key={index} tier={tier} isActive={index === activeIndex} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
});
