import { bannerData } from "@/data/bannerData";
import { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Linking,
  Pressable,
  Text,
  View,
} from "react-native";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width * 0.9;

export default function Banner() {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const renderItem = ({ item, index }: any) => {
    const inputRange = [
      (index - 1) * CARD_WIDTH,
      index * CARD_WIDTH,
      (index + 1) * CARD_WIDTH,
    ];

    const translateX = scrollX.interpolate({
      inputRange,
      outputRange: [30, 0, -30],
    });

    return (
      <View
        style={{ width: CARD_WIDTH }}
        className="mx-auto h-full justify-center"
      >
        <View className="flex-row items-center justify-between w-full px-4">
          <View className="flex-1 pr-4">
            <Text className="text-xl font-mbold mb-2 text-white">
              {item.header}
            </Text>
            <Text className="text-base font-regular mb-3 text-white/80">
              {item.body}
            </Text>
            <Pressable
              onPress={() => Linking.openURL("https://google.com")}
              className="self-start px-5 py-2 rounded-full bg-white"
            >
              <Text className="text-sm font-medium text-black">
                {item.cta || "Learn More"}
              </Text>
            </Pressable>
          </View>

          <Animated.View
            style={{ transform: [{ translateX }], height: "100%" }}
            className="justify-center items-center"
          >
            <View className="relative h-[90%] aspect-square w-full">
              <Image
                source={item.image}
                style={{
                  height: "100%",
                  width: "100%",
                  borderRadius: 16,
                }}
                resizeMode="cover"
              />

              {item.type === "live" && (
                <View className="absolute top-0 right-0 bg-red-600 px-2 py-0.5 rounded-sm">
                  <Text className="text-[12px] text-white font-medium">
                    Live
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      </View>
    );
  };

  return (
    <View className="relative mt-3">
      <View className="bg-primary rounded-xl overflow-hidden h-56 justify-center">
        <Animated.FlatList
          data={bannerData}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(
              e.nativeEvent.contentOffset.x / CARD_WIDTH
            );
            setActiveIndex(index);
          }}
          scrollEventThrottle={16}
          renderItem={renderItem}
          snapToInterval={CARD_WIDTH}
          decelerationRate="fast"
          snapToAlignment="start"
        />
      </View>

      <View className="mt-4 flex-row justify-center gap-2">
        {bannerData.map((_, index) => (
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
