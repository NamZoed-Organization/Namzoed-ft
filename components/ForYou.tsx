import ProductCard from "@/components/ui/ProductCard";
import LazyProductCard from "@/components/ui/LazyProductCard";
import { products } from "@/data/products";
import { useRouter } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const filters = ["all", "beauty", "fashion", "kids", "mens", "womens", "toys"];
const CARD_WIDTH = 170;
const CARD_SPACING = 16;
const BUFFER_SIZE = 5; // Number of items to buffer outside viewport

export default function ForYou() {
  const router = useRouter();
  const screenWidth = Dimensions.get("window").width;
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [visibleIndices, setVisibleIndices] = useState<{[key: string]: {start: number, end: number}}>({});

  const getFilteredProducts = useCallback(
    (sectionKey: string) => {
      if (sectionKey === "clothes" && activeFilter !== "all") {
        return products.filter(
          (product) =>
            product.category?.toLowerCase() === activeFilter ||
            product.tags?.some((tag) => tag.toLowerCase() === activeFilter)
        );
      }
      return products;
    },
    [activeFilter]
  );

  const getScrollLimits = useCallback(
    (filteredProducts: typeof products) => {
      const totalCards = filteredProducts.length + 1;
      const totalContentWidth =
        totalCards * (CARD_WIDTH + CARD_SPACING) - CARD_SPACING + 20;
      const visibleWidth = screenWidth - 32;
      const maxScrollX = Math.max(0, totalContentWidth - visibleWidth);
      return { totalContentWidth, maxScrollX };
    },
    [screenWidth]
  );

  const handleGoToPage = (sectionKey: string) => {
    switch (sectionKey) {
      case "clothes":
        if (activeFilter === "all") {
          // Navigate to fashion category page
          router.push({
            pathname: "/(users)/categories/[slug]",
            params: { slug: "fashion" },
          });
        } else {
          // Navigate to specific category with filter
          const categorySlug = activeFilter === "kids" ? "kids-toys" : 
                              activeFilter === "mens" || activeFilter === "womens" ? "fashion" : 
                              activeFilter;
          const slug = categorySlug.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-");
          
          router.push({
            pathname: "/(users)/categories/[slug]",
            params: { 
              slug,
              filter: activeFilter === "mens" || activeFilter === "womens" ? activeFilter : undefined
            },
          });
        }
        break;
      case "live":
        // Navigate to live products or featured products page
        router.push("/live"); // or whatever your live page route is
        break;
      case "toys":
        // Navigate to toys category
        router.push({
          pathname: "/(users)/categories/[slug]",
          params: { slug: "kids-toys" },
        });
        break;
      default:
        router.push("/(users)/categories");
    }
  };

  const getSectionTitle = (sectionKey: string) => {
    switch (sectionKey) {
      case "clothes":
        return activeFilter !== "all" 
          ? `${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Clothes`
          : "Clothes";
      case "live":
        return "Live Products";
      case "toys":
        return "Toys & Games";
      default:
        return sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1);
    }
  };

  const getGoToPageText = (sectionKey: string) => {
    switch (sectionKey) {
      case "clothes":
        return activeFilter !== "all" 
          ? `View All ${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}`
          : "View All Clothes";
      case "live":
        return "View Live";
      case "toys":
        return "View All Toys";
      default:
        return "View All";
    }
  };

  return (
    <View className="flex-1 bg-background pt-4 px-4">
      <View className="bg-white rounded-lg px-4 py-3 mb-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8, gap: 16 }}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              className="items-center"
              onPress={() => setActiveFilter(filter)}
            >
              <View
                className={`w-14 h-14 rounded-full mb-1 border-2 ${
                  activeFilter === filter
                    ? "border-primary"
                    : "border-transparent"
                }`}
              >
                <Image
                  source={require("@/assets/images/all.png")}
                  className="w-full h-full rounded-full"
                />
              </View>
              <Text
                className={`text-xs font-medium ${
                  activeFilter === filter ? "text-primary" : "text-gray-500"
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {[
        { title: "Clothes", key: "clothes" },
        { title: "Live", key: "live" },
        { title: "Toys", key: "toys" },
      ].map((section) => {
        const scrollX = useRef(new Animated.Value(0)).current;
        const scrollRef = useRef<ScrollView>(null);

        const filteredProducts = getFilteredProducts(section.key);
        const displayProducts = filteredProducts.slice(0, 10);
        const { maxScrollX } = getScrollLimits(displayProducts);

        React.useEffect(() => {
          if (section.key === "clothes" && scrollRef.current) {
            scrollRef.current.scrollTo({ x: 0, animated: true });
            scrollX.setValue(0);
          }
        }, [activeFilter, section.key]);

        const progress =
          maxScrollX > 0
            ? Animated.divide(scrollX, maxScrollX)
            : new Animated.Value(0);

        // Calculate visible items based on scroll position
        const updateVisibleItems = (offsetX: number) => {
          const cardsPerScreen = Math.ceil(screenWidth / (CARD_WIDTH + CARD_SPACING));
          const firstVisibleIndex = Math.floor(offsetX / (CARD_WIDTH + CARD_SPACING));
          const start = Math.max(0, firstVisibleIndex - BUFFER_SIZE);
          const end = Math.min(displayProducts.length - 1, firstVisibleIndex + cardsPerScreen + BUFFER_SIZE);

          setVisibleIndices(prev => ({
            ...prev,
            [section.key]: { start, end }
          }));
        };

        const handleScroll = Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: false,
            listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
              const offsetX = event.nativeEvent.contentOffset.x;
              updateVisibleItems(offsetX);

              if (offsetX > maxScrollX && scrollRef.current) {
                scrollRef.current.scrollTo({ x: maxScrollX, animated: false });
              }
            },
          }
        );

        // Initialize visible range
        React.useEffect(() => {
          if (!visibleIndices[section.key]) {
            updateVisibleItems(0);
          }
        }, [section.key]);

        return (
          <View key={section.key} className="mb-10">
            <Text className="text-lg font-mbold text-gray-800 mb-2">
              {getSectionTitle(section.key)}
              {section.key === "clothes" && activeFilter !== "all" && (
                <Text className="text-sm font-normal text-gray-500">
                  {` (${displayProducts.length} items)`}
                </Text>
              )}
            </Text>

            <Animated.ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              bounces={false}
              overScrollMode="never"
              snapToInterval={CARD_WIDTH + CARD_SPACING}
              decelerationRate="fast"
              contentContainerStyle={{
                paddingLeft: 4,
                paddingRight: 16,
                gap: CARD_SPACING,
              }}
            >
              {displayProducts.map((product, index) => {
                const isVisible = visibleIndices[section.key] ?
                  (index >= visibleIndices[section.key].start && index <= visibleIndices[section.key].end) :
                  index < 5; // Default to first 5 items visible

                return (
                  <LazyProductCard
                    key={`${product.id}-${section.key}-${index}`}
                    product={product}
                    index={index}
                    isVisible={isVisible}
                    estimatedHeight={280}
                  />
                );
              })}

              {displayProducts.length > 0 && (
                <TouchableOpacity
                  className="w-40 h-52 rounded-2xl bg-white justify-center items-center shadow shadow-black/10"
                  activeOpacity={0.7}
                  onPress={() => handleGoToPage(section.key)}
                >
                  <Text className="text-primary font-medium mb-1 text-center px-2">
                    {getGoToPageText(section.key)}
                  </Text>
                  <ArrowRight color="#094569" size={24} />
                </TouchableOpacity>
              )}
            </Animated.ScrollView>

            {maxScrollX > 0 && (
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
            )}

            {section.key === "clothes" &&
              displayProducts.length === 0 &&
              activeFilter !== "all" && (
                <View className="h-52 justify-center items-center bg-gray-50 rounded-2xl">
                  <Text className="text-gray-500 font-medium">
                    No products found for "{activeFilter}"
                  </Text>
                </View>
              )}
          </View>
        );
      })}
    </View>
  );
}
