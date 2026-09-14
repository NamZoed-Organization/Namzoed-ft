import {
  FILTER_ROW_GAP,
  FILTER_ROW_INSET,
  FILTER_ROW_VERTICAL,
} from "@/constants/theme";
import GridCard, {
  gridCardHeight,
  LISTING_CARD_RATIO,
  GridCardSourceRect,
} from "@/components/GridCard";
import MasonryGrid from "@/components/MasonryGrid";
import GridSkeleton from "@/components/ui/GridSkeleton";
import TopNavbar from "@/components/ui/TopNavbar";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { useUser } from "@/contexts/UserContext";
import { useRankedFeed } from "@/hooks/useRankedFeed";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import { fetchFeedOrder } from "@/lib/feedSession";
import {
  fetchMarketplaceByIds,
  fetchMarketplaceCreatedSince,
  fetchMarketplaceRankingPool,
  MarketplaceItemWithUser,
} from "@/lib/postMarketPlace";
import { supabase } from "@/lib/supabase";
import MarketplaceDetailOverlay from "@/components/MarketplaceDetailOverlay";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { MapPin, Plus } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useViewableContent } from "@/hooks/useViewableContent";
import { useAppRouter } from "@/utils/navigation";

const PAGE_SIZE = 20;
/** A tab showing fewer listings than this keeps loading pages for itself. */
const MIN_TAB_ITEMS = 10;

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const router = useAppRouter();
  const { onTabBarScroll } = useTabBarScroll();
  const { trackTap, trackFeature } = useScreenAnalytics(Screens.MARKETPLACE);
  const [activeTab, setActiveTab] = useState("all");
  // Grid tile tapped — grows into MarketplaceDetailOverlay instead of a
  // plain router.push, same hero-grow treatment Home's post grid uses.
  const [marketplaceOverlay, setMarketplaceOverlay] = useState<{ item: MarketplaceItemWithUser; rect: GridCardSourceRect } | null>(null);

  // One order for the whole marketplace, per person, per day, fetched a page
  // at a time (hooks/useRankedFeed.ts). Tabs filter the rows already loaded,
  // which keeps the swipe between them instant; a tab that comes up short
  // loads further pages for itself (below).
  const { currentUser, isLoading: userLoading } = useUser();
  const fetchOrder = useCallback(
    (seed: string) =>
      fetchFeedOrder({
        rpc: "feed_order_marketplace",
        seed,
        fallbackPool: fetchMarketplaceRankingPool,
        boostSlotCount: 2,
      }),
    [],
  );
  const trackImpressions = useCallback(async (ids: string[]) => {
    const { error } = await supabase.rpc("increment_impressions_marketplace", { ids });
    if (error) console.error("Error tracking marketplace impressions:", error);
  }, []);

  const ranked = useRankedFeed<MarketplaceItemWithUser>({
    sessionKey: "marketplace",
    userId: currentUser?.id,
    enabled: !userLoading,
    fetchOrder,
    fetchByIds: fetchMarketplaceByIds,
    fetchNewSince: fetchMarketplaceCreatedSince,
    trackImpressions,
    pageSize: PAGE_SIZE,
  });
  /**
   * Safe View, an unverified age and being under 18 apply here exactly as
   * they do in the feed — a listing is a photograph somebody uploaded, and
   * the protection that stops at one screen is not protection
   * (`lib/safeContent.ts`).
   */
  const { filter: filterViewable } = useViewableContent();
  const marketplaceItems = useMemo(
    () =>
      filterViewable<MarketplaceItemWithUser>(
        ranked.items,
        (item) => item.user_id,
      ),
    [filterViewable, ranked.items],
  );
  const isLoading = ranked.loading;
  const { hasMore, loadingMore, loadMore } = ranked;

  // A narrow tab ("Free", "Swap") over a paged order can come up nearly empty
  // until more of the order is loaded — keep loading pages while it is short
  // and there is more. Only the tab being looked at spends anything.
  const activeTabCount = useMemo(
    () =>
      activeTab === "all"
        ? marketplaceItems.length
        : marketplaceItems.filter((item) => item.type === activeTab).length,
    [activeTab, marketplaceItems],
  );
  useEffect(() => {
    if (activeTab === "bidding" || isLoading || loadingMore || !hasMore) return;
    if (activeTabCount < MIN_TAB_ITEMS) loadMore();
  }, [activeTab, activeTabCount, isLoading, loadingMore, hasMore, loadMore]);

  const handleLoadMoreScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (activeTab === "bidding" || isLoading || !hasMore) return;
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 400) {
        loadMore();
      }
    },
    [activeTab, isLoading, hasMore, loadMore],
  );

  const onRefresh = useCallback(async () => {
    await ranked.refresh();
  }, [ranked]);

  const handleTabChange = (newTab: string) => {
    if (newTab === activeTab) return;
    trackFeature("filter_apply", "filter_button", "tap", { category: newTab });
    setActiveTab(newTab);
  };


  const handleMarketplacePress = useCallback(
    (itemId: string, rect: GridCardSourceRect) => {
      const item = marketplaceItems.find((i) => i.id === itemId);
      trackTap("marketplace_card", "marketplace_view", { item_id: itemId, item_type: item?.type });
      if (item) setMarketplaceOverlay({ item, rect });
    },
    [marketplaceItems, trackTap],
  );

  const renderMarketplaceCard = (
    item: MarketplaceItemWithUser,
    columnWidth: number,
    deferred: boolean,
    priority: "low" | "normal" | "high",
  ) => {
    const showPrice =
      (item.type === "rent" || item.type === "second_hand" || item.type === "job_vacancy") &&
      item.price > 0;
    return (
      <GridCard
        id={item.id}
        width={columnWidth}
        ratio={LISTING_CARD_RATIO}
        imageUri={item.images?.[0]}
        title={item.title}
        subtitle={item.profiles?.name}
        avatarUri={item.profiles?.avatar_url}
        avatarLabel={item.profiles?.name}
        deferred={deferred}
        priority={priority}
        footerRight={
          showPrice ? (
            <Text style={{ fontSize: 13, fontWeight: "700", color: "#094569" }}>Nu. {item.price}</Text>
          ) : item.dzongkhag ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <MapPin size={11} color="#9CA3AF" />
              <Text style={{ fontSize: 12, color: "#9CA3AF" }} numberOfLines={1}>
                {item.dzongkhag}
              </Text>
            </View>
          ) : undefined
        }
        onPress={handleMarketplacePress}
      />
    );
  };

  const filterData = (data: MarketplaceItemWithUser[]) => {
    return data.filter((item: MarketplaceItemWithUser) => {
      // Filter by active tab type — "all" skips this check entirely,
      // matching Categories' activeCategory === "all" pattern.
      if (activeTab !== "all" && item.type !== activeTab) return false;

      return true;
    });
  };

  const renderTabContent = () => {
    if (activeTab === "bidding") {
      return (
        <View className="flex-1 items-center justify-center py-24">
          <Text className="text-base font-medium text-gray-400">Coming soon</Text>
        </View>
      );
    }

    const data = filterData(marketplaceItems);

    if (isLoading) {
      return (
        <View className="px-3 pt-1">
          <GridSkeleton rows={3} imageHeight={140} />
        </View>
      );
    }

    return (
      <View className="pb-6">
        <MasonryGrid
          items={data}
          loading={false}
          keyExtractor={(item) => item.id}
          getHeight={(_item, columnWidth) => gridCardHeight(LISTING_CARD_RATIO, columnWidth)}
          emptyText="No items found — try adjusting your filters."
          // An empty marketplace is also somebody's chance to fill it: the
          // action goes to the screen that holds their own listings, opened
          // on the marketplace half (app/(users)/listings.tsx).
          emptyAction={
            <TouchableOpacity
              onPress={() => router.push("/(users)/listings?section=marketplace" as any)}
              activeOpacity={0.85}
              className="bg-primary flex-row items-center px-5 py-2.5 rounded-full"
            >
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text className="text-white text-sm font-semibold ml-1.5">
                List something
              </Text>
            </TouchableOpacity>
          }
          renderCard={renderMarketplaceCard}
        />
      </View>
    );
  };

  const MARKETPLACE_TABS = [
    "all",
    "job_vacancy",
    "rent",
    "second_hand",
    "swap",
    "free",
    "bidding",
  ];

  const MARKETPLACE_TAB_LABELS: Record<string, string> = {
    all: "All",
    job_vacancy: "Jobs",
    rent: "Rent",
    second_hand: "Preowned",
    swap: "Swap",
    free: "Free",
    bidding: "Bidding",
  };

  const swipeGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (isLoading) return;
      const idx = MARKETPLACE_TABS.indexOf(activeTab);
      if (e.translationX < -50 && idx < MARKETPLACE_TABS.length - 1) {
        handleTabChange(MARKETPLACE_TABS[idx + 1]);
      } else if (e.translationX > 50 && idx > 0) {
        handleTabChange(MARKETPLACE_TABS[idx - 1]);
      }
    });

  return (
    <GestureDetector gesture={swipeGesture}>
      <View className="flex-1 bg-gray-50">
        {/* Fixed header — TopNavbar never scrolls away. */}
        <View className="bg-gray-50">
          <TopNavbar />
        </View>

        {/* Pull-to-refresh draws the app's own CircularLoader rather than
            the platform spinner — see components/ui/PullToRefresh.tsx. The
            native bounce is turned off so it doesn't fight the gesture. */}
        <PullToRefresh onRefresh={onRefresh}>
          {({ indicator, scrollEnabled, onScroll }) => (
            <>
              {indicator}
              <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 72 + insets.bottom }}
                onScroll={(e) => {
                  onScroll(e);
                  onTabBarScroll(e);
                  handleLoadMoreScroll(e);
                }}
                scrollEventThrottle={16}
                scrollEnabled={scrollEnabled}
                bounces={false}
                overScrollMode="never"
              >
                {/* Tab Navigation — same plain-text style as Home's HomeTabs, and
                    like Home, scrolls away with the rest of the content — only
                    TopNavbar above stays fixed. */}
                <View
                  className="bg-gray-50"
                  style={{
                    paddingHorizontal: FILTER_ROW_INSET,
                    paddingTop: FILTER_ROW_VERTICAL,
                    paddingBottom: FILTER_ROW_VERTICAL,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "flex-start",
                      alignItems: "center",
                      gap: FILTER_ROW_GAP,
                    }}
                  >
                    {MARKETPLACE_TABS.map((key) => {
                      const isActive = activeTab === key;
                      return (
                        <TouchableOpacity
                          key={key}
                          onPress={() => handleTabChange(key)}
                          disabled={isLoading}
                          style={{ opacity: isLoading ? 0.5 : 1 }}
                        >
                          <Text
                            className={
                              isActive
                                ? "text-[17px] font-mbold text-gray-900"
                                : "text-[15px] font-medium text-gray-400"
                            }
                          >
                            {MARKETPLACE_TAB_LABELS[key]}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Marketplace Content */}
                {renderTabContent()}

                {/* Bottom Spacing */}
                <View className="h-20" />
              </ScrollView>
            </>
          )}
        </PullToRefresh>

        <MarketplaceDetailOverlay
          visible={!!marketplaceOverlay}
          item={marketplaceOverlay?.item ?? null}
          sourceRect={marketplaceOverlay?.rect ?? null}
          onClose={() => setMarketplaceOverlay(null)}
        />
      </View>
    </GestureDetector>
  );
}
