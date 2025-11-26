import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

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
  const scrollX = useRef(new Animated.Value(0)).current;
  const animatedIndex = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<Animated.FlatList<any>>(null);
  const router = useRouter();

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
    <View className="flex-1 bg-white">
      {/* Top bar: counter + skip */}
      <View className="flex-row justify-between items-center px-6 pt-20 pb-4 absolute top-0 left-0 right-0 z-10">
        <Text className="text-gray-400 font-medium text-lg">
          {currentIndex + 1}/{slides.length}
        </Text>
        <TouchableOpacity onPress={() => router.replace("/login")}>
          <Text className="text-black font-medium text-lg">Skip</Text>
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
          <View style={{ width }} className="flex-1 justify-center px-6">
            <View className="flex-1 justify-center">
              <View className="items-center justify-center h-[290px] mb-4">
                <Image
                  source={item.image}
                  className="w-200 h-200"
                  resizeMode="cover"
                />
              </View>

              <View className="items-center space-y-2">
                <Text className="text-2xl  text-center text-gray-800 font-[Montserrat-ExtraBold] mb-3">
                  {item.title}
                </Text>
                <Text className="text-base font-semibold text-center text-gray-400 px-4">
                  {item.description}
                </Text>
              </View>
            </View>
          </View>
        )}
      />

      <View className="relative mx-5 py-10 h-22 justify-center">
        {/* Prev Button */}
        <TouchableOpacity
          onPress={goPrev}
          disabled={currentIndex === 0}
          className="absolute left-0"
        >
          <Animated.Text
            style={{ color: prevColor }}
            className="text-lg font-medium"
          >
            Prev
          </Animated.Text>
        </TouchableOpacity>

        {/* Dots Centered */}
        <View className="flex-row gap-2 items-center justify-center">
          {slides.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 42, 8],
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
                  height: 8,
                  borderRadius: 4,
                  marginHorizontal: 4,
                  width: dotWidth,
                  backgroundColor: dotColor,
                }}
              />
            );
          })}
        </View>

        {/* Next Button */}
        <TouchableOpacity onPress={goNext} className="absolute right-0">
          <Text className="text-lg text-primary font-medium">
            {currentIndex === slides.length - 1 ? "Get Started" : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
