import { useAppRouter } from "@/utils/navigation";
import React, { useRef, useState } from "react";
import { clamp, useResponsive } from "@/utils/responsive";
import {
  Animated,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const slides = [
  {
    key: "1",
    title: "Buy Products",
    description: "Browse a wide range of local products from trusted sellers.",
    image: require("../assets/images/getstarted-1.png"),
  },
  {
    key: "2",
    title: "Sell Products",
    description:
      "Create your shop and start selling to nearby buyers instantly.",
    image: require("../assets/images/getstarted-2.png"),
  },
  {
    key: "3",
    title: "Get Your Order",
    description: "Track orders and receive your items fast and reliably.",
    image: require("../assets/images/getstarted-3.png"),
  },
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function GetStarted() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { width, ms, vs, wp, hp } = useResponsive();
  const scrollX = useRef(new Animated.Value(0)).current;
  const animatedIndex = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<Animated.FlatList<any>>(null);
  const router = useAppRouter();
  const headerPaddingX = clamp(wp(6), 16, 28);
  const headerTop = clamp(hp(8), 52, 96);
  const headerBottom = clamp(vs(16), 10, 20);
  const counterSize = clamp(ms(18), 14, 22);
  const sideActionSize = clamp(ms(18), 14, 22);
  const slidePaddingX = clamp(wp(6), 16, 28);
  const artContainerHeight = clamp(hp(35), 220, 360);
  const artSize = clamp(wp(56), 180, 320);
  const titleSize = clamp(ms(30), 22, 34);
  const descSize = clamp(ms(16), 13, 18);
  const descPaddingX = clamp(wp(4), 12, 22);
  const footerPaddingY = clamp(vs(40), 26, 48);
  const footerMarginX = clamp(wp(5), 14, 24);
  const footerHeight = clamp(vs(88), 72, 104);
  const footerTextSize = clamp(ms(18), 14, 22);
  const dotGap = clamp(ms(8), 6, 10);
  const dotHeight = clamp(ms(8), 6, 10);
  const dotRadius = dotHeight / 2;
  const dotBaseWidth = clamp(ms(8), 6, 10);
  const dotExpandedWidth = clamp(ms(42), 32, 52);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = event.nativeEvent.contentOffset.x;
        const index = Math.round(offsetX / width);
        setCurrentIndex(index);

        Animated.timing(animatedIndex, {
          toValue: index,
          duration: 200,
          useNativeDriver: false,
        }).start();
      },
    }
  );

  const goNext = async () => {
    if (currentIndex < slides.length - 1) {
      await sleep(50);
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      router.replace("/login");
    }
  };

  const goPrev = async () => {
    if (currentIndex > 0) {
      await sleep(50);
      flatListRef.current?.scrollToIndex({
        index: currentIndex - 1,
        animated: true,
      });
    }
  };

  const prevColor = animatedIndex.interpolate({
    inputRange: [0, 1],
    outputRange: ["#D1D5DB", "#094569"],
    extrapolate: "clamp",
  });

  return (
    <View className="flex-1 bg-background">
      {/* Top bar: counter + skip */}
      <View
        className="flex-row justify-between items-center absolute top-0 left-0 right-0 z-10"
        style={{
          paddingHorizontal: headerPaddingX,
          paddingTop: headerTop,
          paddingBottom: headerBottom,
        }}
      >
        <Text
          className="text-gray-400 font-medium"
          style={{ fontSize: counterSize }}
        >
          {currentIndex + 1}/{slides.length}
        </Text>
        <TouchableOpacity onPress={() => router.replace("/login")}>
          <Text className="text-black font-medium" style={{ fontSize: sideActionSize }}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.FlatList
        data={slides}
        ref={flatListRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        scrollEventThrottle={16}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onScroll={handleScroll}
        renderItem={({ item }) => (
          <View
            style={{ width, paddingHorizontal: slidePaddingX }}
            className="flex-1 justify-center"
          >
            <View className="flex-1 justify-center">
              <View
                className="items-center justify-center"
                style={{
                  height: artContainerHeight,
                  marginBottom: clamp(vs(16), 10, 22),
                }}
              >
                <Image
                  source={item.image}
                  style={{ width: artSize, height: artSize }}
                  resizeMode="cover"
                />
              </View>

              <View className="items-center space-y-2">
                <Text
                  className="text-center text-gray-800 font-[Montserrat-ExtraBold]"
                  style={{
                    fontSize: titleSize,
                    marginBottom: clamp(vs(12), 8, 16),
                  }}
                >
                  {item.title}
                </Text>
                <Text
                  className="font-semibold text-center text-gray-400"
                  style={{ fontSize: descSize, paddingHorizontal: descPaddingX }}
                >
                  {item.description}
                </Text>
              </View>
            </View>
          </View>
        )}
      />

      <View
        className="relative justify-center"
        style={{
          marginHorizontal: footerMarginX,
          paddingVertical: footerPaddingY,
          height: footerHeight,
        }}
      >
        {/* Prev Button */}
        <TouchableOpacity
          onPress={goPrev}
          disabled={currentIndex === 0}
          className="absolute left-0"
        >
          <Animated.Text
            className="font-medium"
            style={[{ color: prevColor, fontSize: footerTextSize }]}
          >
            Prev
          </Animated.Text>
        </TouchableOpacity>

        {/* Dots Centered */}
        <View
          className="flex-row items-center justify-center"
          style={{ columnGap: dotGap }}
        >
          {slides.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [dotBaseWidth, dotExpandedWidth, dotBaseWidth],
              extrapolate: "clamp",
            });
            const dotColor = scrollX.interpolate({
              inputRange,
              outputRange: ["#ccc", "#094569", "#ccc"],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                key={i}
                style={{
                  height: dotHeight,
                  borderRadius: dotRadius,
                  width: dotWidth,
                  backgroundColor: dotColor,
                }}
              />
            );
          })}
        </View>

        {/* Next Button */}
        <TouchableOpacity onPress={goNext} className="absolute right-0">
          <Text className="text-primary font-medium" style={{ fontSize: footerTextSize }}>
            {currentIndex === slides.length - 1 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
