// app/(users)/categories/[slug].tsx
import GridCard, { gridCardHeight, GridCardSourceRect } from "@/components/GridCard";
import MasonryGrid from "@/components/MasonryGrid";
import SearchBar from "@/components/modals/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import { categories as categoryData, categoryNames, SubCategory } from "@/data/categories";
import { RATIO_SQUARE } from "@/lib/postMediaDisplay";
import {
  fetchProductsForRanking,
  ProductWithUser,
} from "@/lib/productsService";
import { supabase } from "@/lib/supabase";
import { useRankedFeed } from "@/hooks/useRankedFeed";
import { useAppRouter } from "@/utils/navigation";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowUpDown, ChevronLeft } from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  BackHandler,
  NativeScrollEvent,
  NativeSyntheticEvent,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const PAGE_SIZE = 20;
const BOOST_SLOT_COUNT = 2;

type SortMode = "foryou" | "latest" | "oldest" | "cheapest" | "priciest";
const SORT_LABELS: Record<SortMode, string> = {
  foryou: "For You",
  latest: "Latest",
  oldest: "Oldest",
  cheapest: "Cheapest",
  priciest: "Priciest",
};
const SORT_CYCLE: SortMode[] = ["foryou", "latest", "oldest", "cheapest", "priciest"];

export default function CategoryDetailScreen() {
  const router = useAppRouter();
  const { slug, filter } = useLocalSearchParams<{
    slug: string;
    filter?: string;
  }>();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("foryou");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Category key is now the same as the slug (both use slug format)
  const categoryKey = slug || "";
  const subcategories: SubCategory[] = categoryData[categoryKey] || [];
  const activeFilter = filter ?? null;

  // Category taglines
  const categoryTaglines: Record<string, string> = {
    "fashion-and-jewelry": "Dress to impress. Style that speaks.",
    food: "Fresh flavors, local taste. Eat well, live well.",
    beauty: "Glow different. Be unapologetically you.",
    "kids-and-toys": "Play, learn, grow. Joy in every moment.",
    electronics: "Smart tech for smarter lives.",
    "home-and-living": "Make your space truly yours.",
    "real-estate-and-properties": "Find your perfect space.",
    "gifts-books-flowers-and-arts": "Share joy, express creativity.",
  };
  const tagline =
    categoryTaglines[categoryKey] || "Discover something amazing.";

  // Fetches the whole category pool once per session — ranked/randomized
  // client-side (see lib/feedRanking.ts) rather than the old fixed-20,
  // latest-first page, so products that keep getting buried under newer
  // ones eventually surface. Explicit sort modes below re-sort on top of
  // whatever's currently loaded, same as before.
  const fetchPool = useCallback(
    () => fetchProductsForRanking(categoryKey, activeFilter),
    [categoryKey, activeFilter],
  );
  const trackImpressions = useCallback(async (ids: string[]) => {
    const { error } = await supabase.rpc("increment_impressions_products", { ids });
    if (error) console.error("Error tracking product impressions:", error);
  }, []);

  const ranked = useRankedFeed<ProductWithUser>({
    fetchPool,
    trackImpressions,
    pageSize: PAGE_SIZE,
    boostSlotCount: BOOST_SLOT_COUNT,
    deps: [categoryKey, activeFilter],
  });
  const loading = ranked.loading;
  const refreshing = ranked.refreshing;

  // Handle Android back button - re-register on focus
  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          handleBackPress();
          return true; // Prevent default back behavior
        },
      );

      return () => backHandler.remove();
    }, []),
  );

  // Fade-in animation when data loads
  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim]);

  // Handle pull-to-refresh — draws a fresh random session, not just fresh data.
  const onRefresh = async () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    await ranked.refresh();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  };

  const handleLoadMoreScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!ranked.hasMore || ranked.loading) return;
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 400) {
        ranked.loadMore();
      }
    },
    [ranked],
  );

  const displayedProducts = useMemo(() => {
    let result = [...ranked.items];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.description && p.description.toLowerCase().includes(query)) ||
          (p.tags && p.tags.some((tag) => tag.toLowerCase().includes(query))),
      );
    }

    // "For You" keeps the ranked/randomized order as-is; the other modes
    // are an explicit deterministic override of whatever's currently loaded.
    if (sortMode === "latest") {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } else if (sortMode === "oldest") {
      result.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
    } else if (sortMode === "cheapest") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortMode === "priciest") {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [ranked.items, searchQuery, sortMode]);

  const handleProductPress = useCallback(
    (productId: string, _rect: GridCardSourceRect) => {
      router.push(`/(users)/product/${productId}`);
    },
    [router],
  );

  const handleFilterPress = (subcategoryName: string) => {
    if (activeFilter === subcategoryName) {
      router.setParams({ filter: undefined });
    } else {
      router.setParams({ filter: subcategoryName });
    }
  };

  const handleBackPress = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.push("/categories");
  };

  if (!slug) return null;

  return (
    <View className="flex-1 bg-gray-50">
      <TopNavbar />

      <View className="flex-row items-center gap-2 px-4 py-2">
        <TouchableOpacity
          onPress={handleBackPress}
          activeOpacity={0.7}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: "#f5f5f5",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <ChevronLeft size={24} color="#1a1a1a" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        </View>
      </View>

      <ScrollView
        className="flex-1 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        onScroll={handleLoadMoreScroll}
        scrollEventThrottle={200}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000"
            colors={["#000"]}
          />
        }
      >
        {/* Padded separately from MasonryGrid below — the grid already owns
            its own horizontal inset (see GRID_PADDING in MasonryGrid.tsx)
            sized for exactly that much padding; stacking this screen's own
            px-4 on top of it made the column-width math assume more space
            than was actually available, and the two columns overlapped. */}
        <View className="px-4">
          <View className="mb-4">
            {/* Category Header */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
                {categoryNames[categoryKey] || categoryKey.replace(/-/g, " ")}
              </Text>
              <Text className="text-xl font-bold text-gray-900">{tagline}</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-1"
            >
              <TouchableOpacity
                className={`px-4 py-2 mr-2 rounded-full border ${!activeFilter ? "bg-black border-black" : "bg-white border-gray-200"}`}
                onPress={() => router.setParams({ filter: undefined })}
              >
                <Text
                  className={`text-sm font-medium ${!activeFilter ? "text-white" : "text-gray-700"}`}
                >
                  All
                </Text>
              </TouchableOpacity>

              {subcategories.map((sub) => (
                <TouchableOpacity
                  key={sub.name}
                  className={`px-4 py-2 mr-2 rounded-full border ${activeFilter === sub.name ? "bg-black border-black" : "bg-white border-gray-200"}`}
                  onPress={() => handleFilterPress(sub.name)}
                >
                  <Text
                    className={`text-sm font-medium ${activeFilter === sub.name ? "text-white" : "text-gray-700"}`}
                  >
                    {sub.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-sm text-gray-500 font-medium">
              {displayedProducts.length} items found
            </Text>
            <TouchableOpacity
              onPress={() => {
                const currentIndex = SORT_CYCLE.indexOf(sortMode);
                const nextIndex = (currentIndex + 1) % SORT_CYCLE.length;
                setSortMode(SORT_CYCLE[nextIndex]);
              }}
              className="bg-white p-2 rounded-xl shadow-sm border border-gray-100"
            >
              <View className="flex-row items-center gap-1">
                <ArrowUpDown size={14} color="#1F2937" />
                <Text className="text-xs font-semibold text-gray-700">
                  {SORT_LABELS[sortMode]}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <MasonryGrid
            items={displayedProducts}
            loading={loading}
            keyExtractor={(product) => product.id}
            getHeight={(_product, columnWidth) => gridCardHeight(RATIO_SQUARE, columnWidth)}
            emptyText="No products found."
            renderCard={(product, columnWidth, deferred, priority) => (
              <GridCard
                id={product.id}
                width={columnWidth}
                ratio={RATIO_SQUARE}
                imageUri={product.images?.[0]}
                title={product.name}
                subtitle={product.profiles?.name || "Unknown"}
                avatarUri={product.profiles?.avatar_url}
                avatarLabel={product.profiles?.name}
                deferred={deferred}
                priority={priority}
                footerRight={
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#094569" }}>
                    Nu. {(product.is_currently_active ? product.current_price ?? product.price : product.price).toLocaleString()}
                  </Text>
                }
                onPress={handleProductPress}
              />
            )}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}
