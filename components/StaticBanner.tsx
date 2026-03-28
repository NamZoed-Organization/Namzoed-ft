import React, { useCallback, useRef, useState } from "react";
import {
  Image,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
} from "react-native";

const IMAGES = [
  require("@/assets/banner/1.png"),
  require("@/assets/banner/2.png"),
  require("@/assets/banner/3.png"),
];

export default function StaticBanner() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [cardWidth, setCardWidth] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setCardWidth(e.nativeEvent.layout.width);
  }, []);

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (cardWidth === 0) return;
      const index = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
      setActiveIndex(index);
    },
    [cardWidth]
  );

  return (
    <View className="mt-3" onLayout={onLayout}>
      {cardWidth > 0 && (
        <View className="rounded-xl overflow-hidden" style={{ height: 160 }}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumScrollEnd}
            scrollEventThrottle={16}
            bounces={false}
            overScrollMode="never"
          >
            {IMAGES.map((img, i) => (
              <View
                key={i}
                style={{ width: cardWidth, height: 160, overflow: "hidden", borderRadius: 12 }}
              >
                <Image
                  source={img}
                  style={{ width: cardWidth, height: 160 }}
                  resizeMode="contain"
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View className="mt-3 flex-row justify-center gap-2">
        {IMAGES.map((_, index) => (
          <View
            key={index}
            className={`w-2 h-2 rounded-full ${
              activeIndex === index ? "bg-primary" : "bg-gray-300"
            }`}
          />
        ))}
      </View>
    </View>
  );
}
