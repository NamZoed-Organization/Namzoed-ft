import GridCard, { gridCardHeight, GridCardSourceRect } from "@/components/GridCard";
import MasonryGrid from "@/components/MasonryGrid";
import GridSkeleton from "@/components/ui/GridSkeleton";
import TopNavbar from "@/components/ui/TopNavbar";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { useRankedFeed } from "@/hooks/useRankedFeed";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import {
  fetchMarketplaceForRanking,
  MarketplaceItemWithUser,
} from "@/lib/postMarketPlace";
import { readCache, writeCache } from "@/lib/queryCache";
import { supabase } from "@/lib/supabase";
import MarketplaceDetailOverlay from "@/components/MarketplaceDetailOverlay";
import { MapPin } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const { onTabBarScroll } = useTabBarScroll();
  const { trackTap, trackFeature } = useScreenAnalytics(Screens.MARKETPLACE);
  const [activeTab, setActiveTab] = useState("all");
  // Grid tile tapped — grows into MarketplaceDetailOverlay instead of a
  // plain router.push, same hero-grow treatment Home's post grid uses.
  const [marketplaceOverlay, setMarketplaceOverlay] = useState<{ item: MarketplaceItemWithUser; rect: GridCardSourceRect } | null>(null);

  // Fetches the whole marketplace pool once per session — ranked/randomized
  // client-side (see lib/feedRanking.ts) — then tab switches just re-filter
  // the same pool client-side (matching the old single-fetch-then-filter
  // pattern, which is what keeps the swipe-between-tabs gesture instant).
  const MARKETPLACE_CACHE_KEY = "marketplace:pool";
  // Same stale-while-revalidate seed as the "For You" feed
  // (hooks/useFeedInfiniteScroll.ts) — lets the grid paint instantly from
  // the last session's pool instead of a full-page skeleton, then silently
  // refreshes in the background.
  const seedFromCache = useCallback(
    async () => (await readCache<MarketplaceItemWithUser[]>(MARKETPLACE_CACHE_KEY))?.data ?? null,
    [],
  );
  const fetchPool = useCallback(async () => {
    const fetched = await fetchMarketplaceForRanking();
    writeCache(MARKETPLACE_CACHE_KEY, fetched);
    return fetched;
  }, []);
  const trackImpressions = useCallback(async (ids: string[]) => {
    const { error } = await supabase.rpc("increment_impressions_marketplace", { ids });
    if (error) console.error("Error tracking marketplace impressions:", error);
  }, []);

  const ranked = useRankedFeed<MarketplaceItemWithUser>({
    fetchPool,
    trackImpressions,
    pageSize: 1000, // this screen has never paginated — one session, whole pool
    boostSlotCount: 2,
    seedFromCache,
  });
  const marketplaceItems = ranked.items;
  const isLoading = ranked.loading;
  const refreshing = ranked.refreshing;

  const onRefresh = useCallback(async () => {
    await ranked.refresh();
  }, [ranked]);

  const handleTabChange = (newTab: string) => {
    if (newTab === activeTab) return;
    trackFeature("filter_apply", "filter_button", "tap", { category: newTab });
    setActiveTab(newTab);
  };

  const MARKETPLACE_CARD_RATIO = 4 / 3;

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
        ratio={MARKETPLACE_CARD_RATIO}
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
          getHeight={(_item, columnWidth) => gridCardHeight(MARKETPLACE_CARD_RATIO, columnWidth)}
          emptyText="No items found — try adjusting your filters."
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

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 72 + insets.bottom }}
          onScroll={onTabBarScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#094569"]}
            />
          }
        >
          {/* Tab Navigation — same plain-text style as Home's HomeTabs, and
              like Home, scrolls away with the rest of the content — only
              TopNavbar above stays fixed. */}
          <View className="bg-gray-50 px-4" style={{ paddingTop: 8, paddingBottom: 8 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: 18,
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
