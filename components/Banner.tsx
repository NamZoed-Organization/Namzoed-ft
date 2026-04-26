import { useBanners } from "@/data/bannerData";
import React, { useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import { FlatList, View, useWindowDimensions } from "react-native";

const SIDE_PADDING = 16;
const AUTO_SLIDE_INTERVAL = 2000;

export default function Banner() {
  const { width } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
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
      setActiveIndex(next);
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
    <View className="mt-3">
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
          setActiveIndex(index);
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
                borderRadius: 16,
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

      {banners.length > 1 && (
        <View className="mt-3 flex-row justify-center gap-2">
          {banners.map((_, index) => (
            <View
              key={index}
              className={`w-2 h-2 rounded-full ${
                activeIndex === index ? "bg-primary" : "bg-gray-300"
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
}
