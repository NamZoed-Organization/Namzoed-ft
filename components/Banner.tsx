import { useBanners } from "@/data/bannerData";
import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import { FlatList, View, useWindowDimensions } from "react-native";

// Matches FeedGrid's GRID_PADDING so the banner and the feed grid below it
// share the same horizontal edges.
const SIDE_PADDING = 4;
const AUTO_SLIDE_INTERVAL = 7000;

export default function Banner() {
  const { width } = useWindowDimensions();
  const { banners, loading } = useBanners();
  const flatListRef = useRef<FlatList>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeIndexRef = useRef(0);

  const CARD_WIDTH = width - SIDE_PADDING * 2;
  const CARD_HEIGHT = CARD_WIDTH * 0.45;

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!banners.length) return;
      const next = (activeIndexRef.current + 1) % banners.length;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      activeIndexRef.current = next;
    }, AUTO_SLIDE_INTERVAL);
  };

  useEffect(() => {
    if (banners.length > 1) startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [banners.length]);

  if (loading || banners.length === 0) return null;

  return (
    // Bottom margin matches PostGridCard's own marginBottom so the gap
    // between the banner and the grid reads the same as the gap between
    // stacked cards within the grid.
    <View className="mt-1" style={{ marginBottom: 4 }}>
      <FlatList
        ref={flatListRef}
        data={banners}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          activeIndexRef.current = index;
          startTimer();
        }}
        scrollEventThrottle={16}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        renderItem={({ item }) => (
          <View style={{ width, alignItems: "center" }}>
            <View
              style={{
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                // Matches PostGridCard's borderRadius so the banner and the
                // feed grid below it read as one visual system.
                borderRadius: 4,
                borderCurve: "continuous",
                overflow: "hidden",
              }}
            >
              <Image
                source={{ uri: item.image_url }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            </View>
          </View>
        )}
      />
    </View>
  );
}
