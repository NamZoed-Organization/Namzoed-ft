import { useBanners } from "@/data/bannerData";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import { ScrollView, View, useWindowDimensions } from "react-native";

// Matches FeedGrid's GRID_PADDING so the banner and the feed grid below it
// share the same horizontal edges.
const SIDE_PADDING = 4;
const AUTO_SLIDE_INTERVAL = 7000;

/**
 * A horizontal ScrollView with removeClippedSubviews={false}, not a FlatList.
 *
 * This sits in a row of the home screen's vertical FlatList, which runs with
 * `removeClippedSubviews` on. That prop detaches a nested horizontal list's
 * children while the row itself is still laid out, so the banner kept its
 * height and rendered nothing — a full-width white gap above the feed, with
 * no error anywhere, because nothing had actually failed.
 *
 * Every other horizontal strip on this screen already avoids it the same way
 * (see the ForYou rows and the closing-sale row, both plain ScrollViews with
 * the flag explicitly off). Virtualising a couple of banners was buying
 * nothing to begin with — the whole data set is what a single screen shows.
 */
export default function Banner() {
  const { width } = useWindowDimensions();
  const { banners, loading } = useBanners();
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeIndexRef = useRef(0);
  // A banner whose image will not load is dropped rather than left holding an
  // empty box the height of a banner — the failure this file exists to stop
  // showing, whatever the cause next time.
  const [failed, setFailed] = useState<string[]>([]);

  const CARD_WIDTH = width - SIDE_PADDING * 2;
  const CARD_HEIGHT = CARD_WIDTH * 0.45;

  const visible = banners.filter((b) => !failed.includes(b.id));

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (visible.length < 2) return;
      const next = (activeIndexRef.current + 1) % visible.length;
      scrollRef.current?.scrollTo({ x: width * next, animated: true });
      activeIndexRef.current = next;
    }, AUTO_SLIDE_INTERVAL);
  };

  useEffect(() => {
    if (visible.length > 1) startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.length, width]);

  if (loading || visible.length === 0) return null;

  return (
    // Bottom margin matches PostGridCard's own marginBottom so the gap
    // between the banner and the grid reads the same as the gap between
    // stacked cards within the grid.
    <View className="mt-1" style={{ marginBottom: 4 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        bounces={false}
        overScrollMode="never"
        removeClippedSubviews={false}
        onMomentumScrollEnd={(e) => {
          activeIndexRef.current = Math.round(
            e.nativeEvent.contentOffset.x / width,
          );
          startTimer();
        }}
      >
        {visible.map((item) => (
          <View key={item.id} style={{ width, alignItems: "center" }}>
            <View
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                // Matches PostGridCard's borderRadius so the banner and the
                // feed grid below it read as one visual system.
                borderRadius: 4,
                borderCurve: "continuous",
                overflow: "hidden",
                // Something to look at while a multi-megabyte PNG comes down,
                // so the slot reads as loading rather than as broken.
                backgroundColor: "#EFEFEF",
              }}
            >
              <Image
                source={{ uri: item.image_url }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
                onError={() =>
                  setFailed((prev) =>
                    prev.includes(item.id) ? prev : [...prev, item.id],
                  )
                }
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
