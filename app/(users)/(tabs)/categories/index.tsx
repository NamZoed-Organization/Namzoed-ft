// app/categories.tsx

import CategoryFilterRow from "@/components/ui/CategoryFilterRow";
import { useViewableContent } from "@/hooks/useViewableContent";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import React, { useCallback, useMemo, useState } from "react";
import {
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import AuthPromptModal from "@/components/modals/AuthPromptModal";
import ReportProductModal from "@/components/modals/ReportProductModal";
import GridCard, {
  GridCardSourceRect,
  gridCardHeight,
  LISTING_CARD_RATIO,
} from "@/components/GridCard";
import MasonryGrid from "@/components/MasonryGrid";
import ProductDetailOverlay from "@/components/ProductDetailOverlay";
import PullToRefresh from "@/components/ui/PullToRefresh";
import TopNavbar from "@/components/ui/TopNavbar";
import { useUser } from "@/contexts/UserContext";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { categories as categoryData, categoryNames } from "@/data/categories";
import {
    fetchProductRankingPool,
    fetchProductsByIds,
    fetchProductsCreatedSince,
    ProductWithUser,
} from "@/lib/productsService";
import { useRankedFeed } from "@/hooks/useRankedFeed";
import { fetchFeedOrder } from "@/lib/feedSession";
import { supabase } from "@/lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 20;
const BOOST_SLOT_COUNT = 2;

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser, isLoading: userLoading } = useUser();
  const { trackTap } = useScreenAnalytics(Screens.CATEGORIES);
  const { onTabBarScroll } = useTabBarScroll();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<ProductWithUser | null>(null);
  // Grid tile tapped — grows into ProductDetailOverlay instead of a plain
  // router.push, same hero-grow treatment Home's post grid uses.
  const [productOverlay, setProductOverlay] = useState<{ product: ProductWithUser; rect: GridCardSourceRect } | null>(null);



  // "all" is the default browse mode — every product, every category.
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(
    null,
  );

  const currentUserId = currentUser?.id || "";

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

  // Product order for whatever's selected — one per category + subcategory,
  // per person, per day (hooks/useRankedFeed.ts), so coming back to a
  // category shows the grid you left rather than a reshuffle. The session
  // key matches the category page's, so the two share one order.
  const categoryFilter = activeCategory === "all" ? null : activeCategory;
  const fetchOrder = useCallback(
    (seed: string) =>
      fetchFeedOrder({
        rpc: "feed_order_products",
        args: { p_category: categoryFilter, p_tag: activeSubcategory },
        seed,
        fallbackPool: () => fetchProductRankingPool(categoryFilter, activeSubcategory),
        boostSlotCount: BOOST_SLOT_COUNT,
      }),
    [categoryFilter, activeSubcategory],
  );
  const fetchNewSince = useCallback(
    (asOf: string) => fetchProductsCreatedSince(asOf, categoryFilter, activeSubcategory),
    [categoryFilter, activeSubcategory],
  );
  const trackImpressions = useCallback(async (ids: string[]) => {
    const { error } = await supabase.rpc("increment_impressions_products", {
      ids,
    });
    if (error) console.error("Error tracking product impressions:", error);
  }, []);

  const ranked = useRankedFeed<ProductWithUser>({
    sessionKey: `products:${categoryFilter ?? "all"}:${activeSubcategory ?? "none"}`,
    userId: currentUser?.id,
    enabled: !userLoading,
    fetchOrder,
    fetchByIds: fetchProductsByIds,
    fetchNewSince,
    trackImpressions,
    pageSize: PAGE_SIZE,
  });

  /** The same gate the feed uses — a product photograph is a photograph
   *  (`lib/safeContent.ts`). */
  const { filter: filterViewable } = useViewableContent();
  const displayedProducts = useMemo(
    () => filterViewable<ProductWithUser>(ranked.items, (p) => p.user_id),
    [filterViewable, ranked.items],
  );

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
    (product: ProductWithUser, _productId: string, rect: GridCardSourceRect) => {
      setProductOverlay({ product, rect });
    },
    [],
  );

  const handleReportProduct = useCallback(
    (productId: string) => {
      if (!currentUserId) {
        setShowAuthModal(true);
        return;
      }
      const product = displayedProducts.find((p) => p.id === productId);
      if (product) setReportTarget(product);
    },
    [currentUserId, displayedProducts],
  );

  return (
    <View className="flex-1 bg-[#f8f9fa]">
      {/* Fixed header — TopNavbar never scrolls away. */}
      <View className="bg-[#f8f9fa]">
        <TopNavbar />
      </View>

      {/* Pull-to-refresh draws the app's own CircularLoader rather than the
          platform spinner — see components/ui/PullToRefresh.tsx. The native
          bounce is turned off so it doesn't fight the gesture. */}
      <PullToRefresh onRefresh={ranked.refresh}>
        {({ indicator, scrollEnabled, onScroll }) => (
          <>
            {indicator}
            <ScrollView
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(e) => {
                onScroll(e);
                handleScroll(e);
              }}
              scrollEnabled={scrollEnabled}
              bounces={false}
              overScrollMode="never"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 72 + insets.bottom }}
            >
              {/* The row, and the drawer behind its chevron — one component,
                  shared with Services (components/ui/CategoryFilterRow.tsx).
                  It lived here as ~150 lines of measuring and animation
                  until Services needed the same thing, and two copies of
                  this is the drift § Tabs and pills warns about. */}
              <CategoryFilterRow
                items={[
                  { key: "all", label: "All" },
                  ...categoryKeys.map((key) => ({
                    key,
                    label: categoryNames[key] || key,
                  })),
                ]}
                active={activeCategory}
                onSelect={handleSelectCategory}
                drawerTitle="All Categories"
              />

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
              <View style={{ paddingTop: 4 }}>
                <MasonryGrid
                  items={displayedProducts}
                  loading={ranked.loading}
                  keyExtractor={(product) => product.id}
                  getHeight={(_product, columnWidth) => gridCardHeight(LISTING_CARD_RATIO, columnWidth)}
                  emptyText="No products found."
                  renderCard={(product, columnWidth, deferred, priority) => (
                    <GridCard
                      id={product.id}
                      width={columnWidth}
                      ratio={LISTING_CARD_RATIO}
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
                      onPress={(id, rect) => handleProductPress(product, id, rect)}
                      onReport={handleReportProduct}
                    />
                  )}
                />
              </View>
            </ScrollView>
          </>
        )}
      </PullToRefresh>

      <ProductDetailOverlay
        visible={!!productOverlay}
        product={productOverlay?.product ?? null}
        sourceRect={productOverlay?.rect ?? null}
        onClose={() => setProductOverlay(null)}
      />

      <AuthPromptModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        message="Sign in to report this product"
      />

      {currentUser && reportTarget && (
        <ReportProductModal
          visible={!!reportTarget}
          onClose={() => setReportTarget(null)}
          productId={reportTarget.id}
          productName={reportTarget.name}
          productOwnerId={reportTarget.user_id}
          currentUserId={currentUser.id || ""}
          onReportSuccess={() => setReportTarget(null)}
        />
      )}

    </View>
  );
}
