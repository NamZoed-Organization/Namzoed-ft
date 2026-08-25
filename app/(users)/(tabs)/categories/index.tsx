// app/categories.tsx

import { LinearGradient } from "expo-linear-gradient";
import { useAppRouter } from "@/utils/navigation";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import { Plus } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import AuthPromptModal from "@/components/modals/AuthPromptModal";
import CreateProductModal from "@/components/modals/CreateProductModal";
import SearchBar from "@/components/modals/SearchBar";
import GridCard, { GridCardSourceRect, gridCardHeight } from "@/components/GridCard";
import MasonryGrid from "@/components/MasonryGrid";
import TopNavbar from "@/components/ui/TopNavbar";
import { useUser } from "@/contexts/UserContext";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { categories as categoryData, categoryNames } from "@/data/categories";
import { RATIO_SQUARE } from "@/lib/postMediaDisplay";
import {
    fetchProductsForRanking,
    ProductWithUser,
} from "@/lib/productsService";
import { useRankedFeed } from "@/hooks/useRankedFeed";
import { useTrendingSubcategories } from "@/hooks/useTrendingSubcategories";
import { supabase } from "@/lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 20;
const BOOST_SLOT_COUNT = 2;

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const router = useAppRouter();
  const { currentUser } = useUser();
  const { trackTap } = useScreenAnalytics(Screens.CATEGORIES);
  const { onTabBarScroll } = useTabBarScroll();

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalVisible, setModalVisible] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // "all" is the default browse mode — every product, every category.
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(
    null,
  );

  const currentUserId = currentUser?.id || "";

  const { trending, loading: countsLoading } = useTrendingSubcategories();
  const categoryKeys = useMemo(() => Object.keys(categoryData), []);

  const subcategoriesForActive =
    activeCategory !== "all" ? categoryData[activeCategory] || [] : [];

  const handleSelectCategory = useCallback(
    (key: string) => {
      trackTap("category_tab", "category_select", { category: key });
      setActiveCategory(key);
      setActiveSubcategory(null);
    },
    [trackTap],
  );

  // Rotating search-bar placeholder — trending subcategories, memoized so
  // the effect driving the rotation (see SearchBar) doesn't restart on
  // every render.
  const trendingPlaceholders = useMemo(
    () => trending.map((entry) => `Search "${entry.subcategoryName}"`),
    [trending],
  );

  // Product pool for whatever's currently selected — fetched once per
  // category+subcategory combo, ranked/randomized client-side (see
  // lib/feedRanking.ts), same pattern the old per-category detail screen used.
  const fetchPool = useCallback(
    () =>
      fetchProductsForRanking(
        activeCategory === "all" ? null : activeCategory,
        activeSubcategory,
      ),
    [activeCategory, activeSubcategory],
  );
  const trackImpressions = useCallback(async (ids: string[]) => {
    const { error } = await supabase.rpc("increment_impressions_products", {
      ids,
    });
    if (error) console.error("Error tracking product impressions:", error);
  }, []);

  const ranked = useRankedFeed<ProductWithUser>({
    fetchPool,
    trackImpressions,
    pageSize: PAGE_SIZE,
    boostSlotCount: BOOST_SLOT_COUNT,
    deps: [activeCategory, activeSubcategory],
  });

  const displayedProducts = useMemo(() => {
    if (!searchQuery.trim()) return ranked.items;
    const query = searchQuery.toLowerCase();
    return ranked.items.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.tags && p.tags.some((tag) => tag.toLowerCase().includes(query))),
    );
  }, [ranked.items, searchQuery]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      onTabBarScroll(e);
      if (!ranked.hasMore || ranked.loading) return;
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - 400
      ) {
        ranked.loadMore();
      }
    },
    [onTabBarScroll, ranked],
  );

  const handleProductPress = useCallback(
    (productId: string, _rect: GridCardSourceRect) => {
      router.push(`/(users)/product/${productId}` as any);
    },
    [router],
  );

  const handleCreatePress = () => {
    if (!currentUserId) {
      setShowAuthModal(true);
      return;
    }
    setModalVisible(true);
  };

  return (
    <View className="flex-1 bg-[#f8f9fa]">
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 72 + insets.bottom }}
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl
            refreshing={ranked.refreshing}
            onRefresh={ranked.refresh}
            tintColor="#000"
            colors={["#000"]}
          />
        }
      >
        {/* Header — scrolls away normally */}
        <View className="bg-[#f8f9fa]">
          <TopNavbar />
          <View className="px-4" style={{ paddingBottom: 8 }}>
            <View className="flex-row items-center gap-3">
              <View className="flex-1">
                <SearchBar
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search products..."
                  animatedPlaceholders={trendingPlaceholders}
                />
              </View>
              <TouchableOpacity
                onPress={handleCreatePress}
                activeOpacity={0.85}
                className="w-10 h-10 rounded-lg overflow-hidden"
              >
                <LinearGradient
                  colors={["#094569", "#0a5a8a", "#0b6ba8"]}
                  start={[0, 0]}
                  end={[1, 1]}
                  style={{
                    width: "100%",
                    height: "100%",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Plus color="white" size={26} strokeWidth={2.5} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Categories — sticky text bar, "All" first, matches Home/Marketplace. */}
        <View className="bg-[#f8f9fa] px-4" style={{ paddingTop: 4, paddingBottom: 10 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: "#9CA3AF",
              letterSpacing: 0.4,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Categories
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
              {["all", ...categoryKeys].map((key) => {
                const isActive = activeCategory === key;
                const label = key === "all" ? "All" : categoryNames[key] || key;
                return (
                  <TouchableOpacity key={key} onPress={() => handleSelectCategory(key)}>
                    <Text
                      className={
                        isActive
                          ? "text-[17px] font-mbold text-gray-900"
                          : "text-[15px] font-medium text-gray-400"
                      }
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Subcategory filter — e.g. Men / Women / All — only for a specific
            category, not while browsing "All". Pill chips (not plain text)
            to read as a filter layered under the section tabs above, not a
            third tab row. */}
        {activeCategory !== "all" && subcategoriesForActive.length > 0 && (
          <View className="px-4" style={{ paddingTop: 10, paddingBottom: 4 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setActiveSubcategory(null)}
                  className={`px-4 py-2 rounded-full border ${
                    activeSubcategory === null
                      ? "bg-black border-black"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <Text
                    className={`text-sm font-medium ${
                      activeSubcategory === null ? "text-white" : "text-gray-700"
                    }`}
                  >
                    All
                  </Text>
                </TouchableOpacity>
                {subcategoriesForActive.map((sub) => {
                  const isActive = activeSubcategory === sub.name;
                  return (
                    <TouchableOpacity
                      key={sub.name}
                      onPress={() => setActiveSubcategory(sub.name)}
                      className={`px-4 py-2 rounded-full border ${
                        isActive ? "bg-black border-black" : "bg-white border-gray-200"
                      }`}
                    >
                      <Text
                        className={`text-sm font-medium capitalize ${
                          isActive ? "text-white" : "text-gray-700"
                        }`}
                      >
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Products */}
        <View style={{ paddingTop: 12 }}>
          <MasonryGrid
            items={displayedProducts}
            loading={ranked.loading || countsLoading}
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
                    Nu.{" "}
                    {(product.is_currently_active
                      ? (product.current_price ?? product.price)
                      : product.price
                    ).toLocaleString()}
                  </Text>
                }
                onPress={handleProductPress}
              />
            )}
          />
        </View>
      </ScrollView>

      <CreateProductModal
        isVisible={isModalVisible}
        onClose={() => setModalVisible(false)}
        userId={currentUserId}
      />

      <AuthPromptModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        message="Sign in to create a product listing"
      />
    </View>
  );
}
