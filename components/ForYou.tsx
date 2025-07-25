import ProductCard from "@/components/ui/ProductCard";
import { products } from "@/data/products";
import { ArrowRight } from "lucide-react-native";
import React, { useRef } from "react";
import {
    Animated,
    Dimensions,
    Image,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const filters = ["beauty", "fashion", "kids", "mens", "womens", "toys"];
const CARD_WIDTH = 160;
const CARD_SPACING = 16;
const TOTAL_CARDS = 11; // 10 products + 1 "Go to Page"

export default function ForYou() {
  const screenWidth = Dimensions.get("window").width;

  return (
    <View className="flex-1 bg-background pt-4 px-4">
      {/* Filter Section */}
      <View className="bg-white rounded-lg px-4 py-3 mb-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8, gap: 16 }}
        >
          {filters.map((filter) => (
            <TouchableOpacity key={filter} className="items-center">
              <Image
                source={require("@/assets/images/all.png")}
                className="w-14 h-14 rounded-full mb-1"
              />
              <Text className="text-xs font-medium text-gray-500">
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Section Builder */}
      {[
        { title: "Clothes", key: "clothes" },
        { title: "Live", key: "live" },
        { title: "Toys", key: "toys" },
      ].map((section) => {
        const scrollX = useRef(new Animated.Value(0)).current;

        const totalScrollWidth =
          TOTAL_CARDS * (CARD_WIDTH + CARD_SPACING) - CARD_SPACING;
        const visibleWidth = screenWidth - 32;

        const progress = Animated.divide(scrollX, totalScrollWidth - visibleWidth);

        return (
          <View key={section.key} className="mb-10">
            <Text className="text-lg font-mbold text-gray-800 mb-2">
              {section.title}
            </Text>

            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={Animated.event(
                [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                { useNativeDriver: false }
              )}
              scrollEventThrottle={1}
              contentContainerStyle={{
                paddingLeft: 4,
                paddingRight: 16,
                gap: CARD_SPACING,
              }}
            >
              {products.slice(0, 10).map((product) => (
                <ProductCard
                  key={`${product.id}-${section.key}`}
                  product={product}
                  style={{ width: CARD_WIDTH }}
                />
              ))}

              <TouchableOpacity
                className="w-40 h-52 rounded-2xl bg-white justify-center items-center shadow shadow-black/10"
                activeOpacity={0.7}
              >
                <Text className="text-primary font-medium mb-1">Go to Page</Text>
                <ArrowRight color="#094569" size={24} />
              </TouchableOpacity>
            </Animated.ScrollView>

            {/* Progress Bar */}
            <View className="h-1 w-full bg-gray-200 mt-2 rounded-full overflow-hidden">
              <Animated.View
                style={{
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                    extrapolate: "clamp",
                  }),
                  height: 4,
                  backgroundColor: "#094569",
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
