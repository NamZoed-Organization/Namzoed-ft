/**
 * ProfileTabRow
 *
 * The profile tab row — Posts / Marketplace / Likes / Saves / Comments on a
 * personal profile, Products / Services / Reviews on a work profile. Plain
 * text with a short underline, per UI_STANDARD.md § Tabs and pills: never
 * chips, never a full-width underline.
 *
 * Extracted from the personal profile rather than copied to the work one.
 * Two hand-maintained copies of a tab row drift — one gets an edge fade, the
 * other doesn't; one scrolls the active tab into view, the other leaves it
 * half-clipped — and the drift is invisible until someone compares the two
 * screens side by side.
 *
 * It owns its own scroll-into-view. Each button reports its x/width on
 * layout, the scroller reports its offset and visible width, all into refs
 * rather than state — they're only ever read inside the imperative
 * `scrollTo`, never rendered, so putting them in state would re-render the
 * row on every frame of a scroll for no visible benefit.
 */

import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

/** Breathing room kept between the active tab and the edge fade, so the
 *  active label never sits half-under the gradient. */
const EDGE_PAD = 24;
const FADE_WIDTH = 20;

export interface ProfileTab<K extends string = string> {
  key: K;
  label: string;
}

interface ProfileTabRowProps<K extends string> {
  tabs: readonly ProfileTab<K>[];
  activeKey: K;
  onChange: (key: K) => void;
  /** The colour the edge fades resolve to — whatever sits behind the row. */
  background?: string;
}

export default function ProfileTabRow<K extends string>({
  tabs,
  activeKey,
  onChange,
  background = "#ffffff",
}: ProfileTabRowProps<K>) {
  const scrollRef = useRef<ScrollView>(null);
  const layouts = useRef<Record<string, { x: number; width: number }>>({});
  const scrollX = useRef(0);
  const viewportWidth = useRef(0);

  // Keeps the active tab fully visible whether it was tapped directly or
  // selected by swiping the content below.
  const scrollActiveIntoView = useCallback((key: string) => {
    const layout = layouts.current[key];
    const viewport = viewportWidth.current;
    if (!layout || !viewport) return;

    const currentX = scrollX.current;
    const left = layout.x;
    const right = layout.x + layout.width;
    let targetX: number | null = null;

    if (left - EDGE_PAD < currentX) {
      targetX = Math.max(0, left - EDGE_PAD);
    } else if (right + EDGE_PAD > currentX + viewport) {
      targetX = right + EDGE_PAD - viewport;
    }
    if (targetX != null) {
      scrollRef.current?.scrollTo({ x: targetX, animated: true });
    }
  }, []);

  useEffect(() => {
    scrollActiveIntoView(activeKey);
  }, [activeKey, scrollActiveIntoView, tabs.length]);

  return (
    <View
      style={{ position: "relative" }}
      onLayout={(e) => {
        viewportWidth.current = e.nativeEvent.layout.width;
      }}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        onScroll={(e) => {
          scrollX.current = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            className="px-5 pt-3 items-center"
            onPress={() => onChange(tab.key)}
            onLayout={(e) => {
              layouts.current[tab.key] = {
                x: e.nativeEvent.layout.x,
                width: e.nativeEvent.layout.width,
              };
            }}
          >
            <Text
              className={`font-msemibold text-xl ${
                activeKey === tab.key ? "text-primary" : "text-gray-500"
              }`}
            >
              {tab.label}
            </Text>
            <View
              className={`w-6 h-[2px] rounded-full mt-1.5 ${
                activeKey === tab.key ? "bg-primary" : "bg-transparent"
              }`}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Edge fades, so a tab scrolled to the boundary dissolves rather than
          being cut off mid-letter. */}
      <LinearGradient
        colors={[background, "rgba(255,255,255,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: FADE_WIDTH }}
      />
      <LinearGradient
        colors={["rgba(255,255,255,0)", background]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        pointerEvents="none"
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: FADE_WIDTH }}
      />
    </View>
  );
}
