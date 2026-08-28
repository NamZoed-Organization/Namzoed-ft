// app/categories.tsx

import { LinearGradient } from "expo-linear-gradient";
import { useAppRouter } from "@/utils/navigation";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import { ChevronDown, ChevronUp, Plus } from "lucide-react-native";
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
import CreateProductModal from "@/components/modals/CreateProductModal";
import ReportProductModal from "@/components/modals/ReportProductModal";
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
  const router = useAppRouter();
  const { currentUser } = useUser();
  const { trackTap } = useScreenAnalytics(Screens.CATEGORIES);
  const { onTabBarScroll } = useTabBarScroll();

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalVisible, setModalVisible] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [reportTarget, setReportTarget] = useState<ProductWithUser | null>(null);

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

        {/* Shopping — sticky text bar, "All" first, matches Home/Marketplace.
            The chevron beside the row opens a drawer that slides down from
            right where the horizontal scroll starts (not a bottom sheet),
            overlaying it — the drawer's own opaque panel covers the row
            rather than leaving a blank gap where it used to be — with every
            category at once, so a full scroll through this row isn't the
            only way to reach one further down the list. */}
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
            Shopping
          </Text>
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
                onReport={handleReportProduct}
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
