// app/categories.tsx

import { LinearGradient } from "expo-linear-gradient";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    BackHandler,
    Dimensions,
    Easing,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import AuthPromptModal from "@/components/modals/AuthPromptModal";
import ReportProductModal from "@/components/modals/ReportProductModal";
import GridCard, { GridCardSourceRect, gridCardHeight } from "@/components/GridCard";
import MasonryGrid from "@/components/MasonryGrid";
import ProductDetailOverlay from "@/components/ProductDetailOverlay";
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
import { readCache, writeCache } from "@/lib/queryCache";
import { supabase } from "@/lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PAGE_SIZE = 20;
const BOOST_SLOT_COUNT = 2;
const SCREEN_HEIGHT = Dimensions.get("window").height;
// Fixed panel height (not "auto") so the slide-down reveal can animate a
// known distance — internally scrollable in case the category list ever
// grows past what fits.
const CATEGORY_DRAWER_HEIGHT = 260;
// Fixed header (title + chevron-up to close) sits above the scrollable
// list, not part of it, so closing is always reachable regardless of scroll
// position within the category list.
const DRAWER_HEADER_HEIGHT = 46;

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();
  const { trackTap } = useScreenAnalytics(Screens.CATEGORIES);
  const { onTabBarScroll } = useTabBarScroll();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<ProductWithUser | null>(null);
  // Grid tile tapped — grows into ProductDetailOverlay instead of a plain
  // router.push, same hero-grow treatment Home's post grid uses.
  const [productOverlay, setProductOverlay] = useState<{ product: ProductWithUser; rect: GridCardSourceRect } | null>(null);

  // Category drawer — slides down from the horizontal scroll row itself
  // (not a bottom sheet), overlaying it full-width (its own opaque panel
  // covers the row rather than leaving a blank gap) and dimming whatever's
  // below. categoryRowRef is measured on open so the drawer/scrim can be
  // anchored at the row's actual on-screen position, which varies with
  // scroll (the row is sticky). The panel carries its own chevron-up to
  // close, since it fully covers the external chevron that opened it.
  const categoryRowRef = useRef<View>(null);
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);
  const [drawerTop, setDrawerTop] = useState(0);
  const drawerSlide = useRef(new Animated.Value(-CATEGORY_DRAWER_HEIGHT)).current;
  const scrimOpacity = useRef(new Animated.Value(0)).current;

  const openCategoryDrawer = useCallback(() => {
    categoryRowRef.current?.measureInWindow((_x, y) => {
      setDrawerTop(y);
      setShowCategoryDrawer(true);
      drawerSlide.setValue(-CATEGORY_DRAWER_HEIGHT);
      scrimOpacity.setValue(0);
      Animated.timing(scrimOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(drawerSlide, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [drawerSlide, scrimOpacity]);

  const closeCategoryDrawer = useCallback(() => {
    Animated.timing(scrimOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    Animated.timing(drawerSlide, {
      toValue: -CATEGORY_DRAWER_HEIGHT,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShowCategoryDrawer(false);
    });
  }, [drawerSlide, scrimOpacity]);

  // Not a <Modal>, so Android's hardware back button needs its own handler
  // instead of Modal's onRequestClose.
  useEffect(() => {
    if (Platform.OS !== "android" || !showCategoryDrawer) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeCategoryDrawer();
      return true;
    });
    return () => sub.remove();
  }, [showCategoryDrawer, closeCategoryDrawer]);

  // "all" is the default browse mode — every product, every category.
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(
    null,
  );

  const currentUserId = currentUser?.id || "";

  const { loading: countsLoading } = useTrendingSubcategories();
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

  // Product pool for whatever's currently selected — fetched once per
  // category+subcategory combo, ranked/randomized client-side (see
  // lib/feedRanking.ts), same pattern the old per-category detail screen used.
  const productsCacheKey = `products:pool:${activeCategory}:${activeSubcategory ?? "none"}`;
  // Same stale-while-revalidate seed as the "For You" feed
  // (hooks/useFeedInfiniteScroll.ts) — lets the grid paint instantly from
  // this category's last-fetched pool instead of a full-page skeleton every
  // time the category/subcategory changes, then silently refreshes.
  const seedFromCache = useCallback(
    async () => (await readCache<ProductWithUser[]>(productsCacheKey))?.data ?? null,
    [productsCacheKey],
  );
  const fetchPool = useCallback(async () => {
    const fetched = await fetchProductsForRanking(
      activeCategory === "all" ? null : activeCategory,
      activeSubcategory,
    );
    writeCache(productsCacheKey, fetched);
    return fetched;
  }, [activeCategory, activeSubcategory, productsCacheKey]);
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
    seedFromCache,
  });

  const displayedProducts = ranked.items;

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

      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 72 + insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={ranked.refreshing}
            onRefresh={ranked.refresh}
            tintColor="#000"
            colors={["#000"]}
          />
        }
      >
        {/* Category row — "All" first, matches Home/Marketplace, scrolls away
            with the rest of the content (only TopNavbar above stays fixed).
            The chevron beside the row opens a drawer that slides down from
            right where the horizontal scroll starts (not a bottom sheet),
            overlaying it — the drawer's own opaque panel covers the row
            rather than leaving a blank gap where it used to be — with every
            category at once, so a full scroll through this row isn't the
            only way to reach one further down the list. */}
        <View className="bg-[#f8f9fa] px-4" style={{ paddingTop: 12, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View ref={categoryRowRef} style={{ flex: 1, position: "relative" }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                // Left padding matches the fade's width below — without it
                // "All" sits directly under the fade at rest (scroll x=0)
                // and reads as unpressable/washed out.
                contentContainerStyle={{ paddingLeft: 18, paddingRight: 14 }}
              >
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

              {/* Edge fades — hint that the row scrolls past what's visible,
                  same treatment at both ends. */}
              <LinearGradient
                colors={["#f8f9fa", "rgba(248,249,250,0)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                pointerEvents="none"
                style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 18 }}
              />
              <LinearGradient
                colors={["rgba(248,249,250,0)", "#f8f9fa"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                pointerEvents="none"
                style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 18 }}
              />
            </View>

            {/* Opens the drawer only — once open, the drawer's own
                full-width panel covers this button anyway, so closing is
                the drawer's own chevron-up, not this one. */}
            <TouchableOpacity
              onPress={openCategoryDrawer}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ marginLeft: 6, width: 26, height: 26, alignItems: "center", justifyContent: "center" }}
            >
              <ChevronDown size={20} color="#374151" />
            </TouchableOpacity>
          </View>
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
        <View style={{ paddingTop: 4 }}>
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
                onPress={(id, rect) => handleProductPress(product, id, rect)}
                onReport={handleReportProduct}
              />
            )}
          />
        </View>
      </ScrollView>

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

      {/* Category drawer — slides down from the row's own on-screen position
          (measured on open, see openCategoryDrawer) rather than sliding up
          from the bottom of the screen like a normal bottom sheet, and is
          full-width, so it covers the external chevron that opened it — the
          panel carries its own chevron-up in its header to close, and the
          scrim (dims everything below the panel) is tap-to-dismiss too.
          Deliberately NOT a <Modal> — a Modal is its own native window and
          swallows every touch within its bounds regardless of what's
          actually rendered there, which broke the external chevron closing
          this in an earlier version of this drawer. Plain in-tree overlay
          instead, same fix PostDetailOverlay's own comment documents for the
          identical class of bug. */}
      {showCategoryDrawer && (
        <>
          {/* Scrim only starts below the drawer panel itself — the panel is
              opaque, full-width, and already fully covers/replaces the row
              (chevron included) where it sits, so there's nothing left to
              dim there. */}
          <Animated.View
            style={{
              position: "absolute",
              top: drawerTop + CATEGORY_DRAWER_HEIGHT,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(17,24,39,0.45)",
              opacity: scrimOpacity,
            }}
          >
            <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeCategoryDrawer} />
          </Animated.View>

          <View
            style={{
              position: "absolute",
              top: drawerTop,
              left: 0,
              right: 0,
              height: CATEGORY_DRAWER_HEIGHT,
              maxHeight: SCREEN_HEIGHT - drawerTop,
              overflow: "hidden",
            }}
            pointerEvents="box-none"
          >
            <Animated.View
              style={{
                // Matches the screen's own bg-[#f8f9fa] — plain white read
                // as a mismatched, too-bright patch against it.
                backgroundColor: "#f8f9fa",
                borderBottomLeftRadius: 20,
                borderBottomRightRadius: 20,
                borderCurve: "continuous",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 16,
                elevation: 8,
                transform: [{ translateY: drawerSlide }],
              }}
            >
              {/* Fixed header, not part of the scrollable list below — the
                  panel is full-width and covers the external chevron that
                  opened it, so this is the only way to close it once open. */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingTop: 16,
                  paddingBottom: 10,
                  height: DRAWER_HEADER_HEIGHT,
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#111" }}>All Categories</Text>
                <TouchableOpacity
                  onPress={closeCategoryDrawer}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <ChevronUp size={20} color="#374151" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ height: CATEGORY_DRAWER_HEIGHT - DRAWER_HEADER_HEIGHT }}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {["all", ...categoryKeys].map((key) => {
                    const isActive = activeCategory === key;
                    const label = key === "all" ? "All" : categoryNames[key] || key;
                    return (
                      <TouchableOpacity
                        key={key}
                        activeOpacity={0.8}
                        onPress={() => {
                          handleSelectCategory(key);
                          closeCategoryDrawer();
                        }}
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 10,
                          borderRadius: 20,
                          borderCurve: "continuous",
                          // White (not the near-identical #F3F4F6 this was
                          // before) — needs contrast against the drawer's
                          // own #f8f9fa background now, not just the old
                          // pure-white one.
                          backgroundColor: isActive ? "#111827" : "#fff",
                          borderWidth: isActive ? 0 : 1,
                          borderColor: "#E5E7EB",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: "600",
                            color: isActive ? "#fff" : "#374151",
                          }}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </Animated.View>
          </View>
        </>
      )}
    </View>
  );
}
