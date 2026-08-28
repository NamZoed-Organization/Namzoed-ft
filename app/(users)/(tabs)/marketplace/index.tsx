import Banner from "@/components/Banner";
import GridCard, { gridCardHeight, GridCardSourceRect } from "@/components/GridCard";
import MasonryGrid from "@/components/MasonryGrid";
import AuthPromptModal from "@/components/modals/AuthPromptModal";
import MarketplacePostOverlay from "@/components/modals/MarketplacePostOverlay";
import SearchBar from "@/components/modals/SearchBar";
import GridSkeleton from "@/components/ui/GridSkeleton";
import TopNavbar from "@/components/ui/TopNavbar";
import { useUser } from "@/contexts/UserContext";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { useRankedFeed } from "@/hooks/useRankedFeed";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import { dzongkhagCenters } from "@/data/dzongkhag";
import {
  fetchMarketplaceForRanking,
  MarketplaceItemWithUser,
} from "@/lib/postMarketPlace";
import { supabase } from "@/lib/supabase";
import { Picker } from "@react-native-picker/picker";
import { useAppRouter } from "@/utils/navigation";
import {
  Filter,
  MapPin,
  Plus,
  X,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MarketplaceScreen() {
  const insets = useSafeAreaInsets();
  const { onTabBarScroll } = useTabBarScroll();
  const { currentUser } = useUser();
  const router = useAppRouter();
  const { trackTap, trackFeature } = useScreenAnalytics(Screens.MARKETPLACE);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("job_vacancy");
  const [showFilters, setShowFilters] = useState(false);
  const [showPostOverlay, setShowPostOverlay] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [filters, setFilters] = useState({
    dzongkhag: "",
    minPrice: "",
    maxPrice: "",
    tags: [],
  });

  // Fetches the whole marketplace pool once per session — ranked/randomized
  // client-side (see lib/feedRanking.ts) — then tab switches just re-filter
  // the same pool client-side (matching the old single-fetch-then-filter
  // pattern, which is what keeps the swipe-between-tabs gesture instant).
  const fetchPool = useCallback(() => fetchMarketplaceForRanking(), []);
  const trackImpressions = useCallback(async (ids: string[]) => {
    const { error } = await supabase.rpc("increment_impressions_marketplace", { ids });
    if (error) console.error("Error tracking marketplace impressions:", error);
  }, []);

  const ranked = useRankedFeed<MarketplaceItemWithUser>({
    fetchPool,
    trackImpressions,
    pageSize: 1000, // this screen has never paginated — one session, whole pool
    boostSlotCount: 2,
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
    (itemId: string, _rect: GridCardSourceRect) => {
      const item = marketplaceItems.find((i) => i.id === itemId);
      trackTap("marketplace_card", "marketplace_view", { item_id: itemId, item_type: item?.type });
      router.push(`/(users)/marketplace/${itemId}` as any);
    },
    [marketplaceItems, router, trackTap],
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
      // Filter by active tab type
      if (item.type !== activeTab) return false;

      // query filter
      if (searchQuery) {
        let descriptionText = "";
        if (typeof item.description === "string") {
          descriptionText = item.description;
        } else if (item.description) {
          descriptionText =
            (item.description as any).text ||
            (item.description as any).description ||
            "";
        }

        if (
          !item.title?.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !descriptionText.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }
      }

      // Dzongkhag filter
      if (filters.dzongkhag && item.dzongkhag !== filters.dzongkhag) {
        return false;
      }

      // Price filters (for rent and secondhand)
      if (filters.minPrice && item.price < parseInt(filters.minPrice)) {
        return false;
      }
      if (filters.maxPrice && item.price > parseInt(filters.maxPrice)) {
        return false;
      }

      // Tags filter
      if (filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some((filterTag: string) =>
          item.tags?.some((itemTag: string) =>
            itemTag.toLowerCase().includes(filterTag.toLowerCase()),
          ),
        );
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  };

  const renderTabContent = () => {
    const data = filterData(marketplaceItems);
    const title = {
      rent: "Rent Options",
      swap: "Swap Options",
      second_hand: "Second Hand Buy",
      free: "Free Options",
      job_vacancy: "Opportunities and Scholarships",
    }[activeTab];

    if (isLoading) {
      return (
        <View className="px-3 pt-1">
          <GridSkeleton rows={3} imageHeight={140} />
        </View>
      );
    }

    return (
      <View className="pb-6">
        {/* Padded separately from MasonryGrid below — the grid already owns
            its own horizontal inset (see GRID_PADDING in MasonryGrid.tsx)
            sized for exactly that much padding; stacking this screen's own
            px-3 on top of it made the column-width math assume more space
            than was actually available, and the two columns overlapped. */}
        <View className="flex-row items-center justify-between mb-3 px-3">
          <Text className="text-lg font-semibold text-gray-900">{title}</Text>
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            className="bg-white border border-gray-300 rounded-lg p-2"
          >
            <Filter size={18} color="black" />
          </TouchableOpacity>
        </View>

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

  const renderFilterModal = () => {
    const updateFilter = (key: string, value: string | string[]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
      }));
    };

    const clearFilters = () => {
      setFilters({
        dzongkhag: "",
        minPrice: "",
        maxPrice: "",
        tags: [],
      });
    };

    return (
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilters(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-6">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-xl font-bold text-gray-900">Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              className="max-h-96"
            >
              {/* Dzongkhag Filter */}
              <View className="mb-4">
                <Text className="text-sm font-msemibold text-gray-700 mb-2">
                  Location (Dzongkhag)
                </Text>
                <View className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <Picker
                    selectedValue={filters.dzongkhag}
                    onValueChange={(value) => updateFilter("dzongkhag", value)}
                    style={{ height: 50 }}
                  >
                    <Picker.Item label="All Locations" value="" />
                    {dzongkhagCenters.map((dz) => (
                      <Picker.Item
                        key={dz.name}
                        label={dz.name}
                        value={dz.name}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Price Range Filter (for rent, second_hand, and job_vacancy) */}
              {(activeTab === "rent" ||
                activeTab === "second_hand" ||
                activeTab === "job_vacancy") && (
                <View className="mb-4">
                  <Text className="text-sm font-msemibold text-gray-700 mb-2">
                    Price Range (Nu.)
                  </Text>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="text-xs text-gray-600 mb-1">
                        Min Price
                      </Text>
                      <TextInput
                        value={filters.minPrice}
                        onChangeText={(value) =>
                          updateFilter("minPrice", value)
                        }
                        placeholder="Min"
                        className="border border-gray-300 rounded-lg p-3 text-gray-900"
                        keyboardType="numeric"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-gray-600 mb-1">
                        Max Price
                      </Text>
                      <TextInput
                        value={filters.maxPrice}
                        onChangeText={(value) =>
                          updateFilter("maxPrice", value)
                        }
                        placeholder="Max"
                        className="border border-gray-300 rounded-lg p-3 text-gray-900"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Tags Filter */}
              <View className="mb-4">
                <Text className="text-sm font-msemibold text-gray-700 mb-2">
                  Filter by Tags
                </Text>
                <TextInput
                  value={filters.tags.join(", ")}
                  onChangeText={(text) => {
                    const tagsArray = text
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter((tag) => tag.length > 0);
                    updateFilter("tags", tagsArray);
                  }}
                  placeholder="Enter tags (comma separated)"
                  className="border border-gray-300 rounded-lg p-3 text-gray-900"
                />
                <Text className="text-xs text-gray-500 mt-1">
                  Example: furniture, affordable
                </Text>
              </View>
            </ScrollView>

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={clearFilters}
                className="flex-1 py-3 border border-gray-300 rounded-lg items-center"
              >
                <Text className="text-gray-600 font-medium">Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowFilters(false)}
                className="flex-1 py-3 bg-primary rounded-lg items-center"
              >
                <Text className="text-white font-medium">Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const MARKETPLACE_TABS = [
    "job_vacancy",
    "rent",
    "second_hand",
    "swap",
    "free",
  ];

  const MARKETPLACE_TAB_LABELS: Record<string, string> = {
    job_vacancy: "Jobs",
    rent: "Rent",
    second_hand: "2nd Hand",
    swap: "Swap",
    free: "Free",
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
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 72 + insets.bottom }}
          onScroll={onTabBarScroll}
          scrollEventThrottle={16}
          stickyHeaderIndices={[2]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#094569"]}
            />
          }
        >
          {/* Header — scrolls away normally */}
          <View className="bg-gray-50">
            <TopNavbar />
            <View className="px-4 gap-2">
              {/* SearchBar with Plus Button */}
              <View className="flex-row items-center gap-2">
                <View className="flex-1">
                  <SearchBar
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>
                <TouchableOpacity
                  className="w-10 h-10 bg-primary rounded-lg items-center justify-center"
                  onPress={() => {
                    if (!currentUser) {
                      setShowAuthModal(true);
                      return;
                    }
                    setShowPostOverlay(true);
                  }}
                >
                  <Plus size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Banner — scrolls away normally, same as Home */}
          <View className="bg-gray-50">
            <Banner />
          </View>

          {/* Tab Navigation — same plain-text style as Home's HomeTabs,
              sticky (index 2 of stickyHeaderIndices above) so it stays
              pinned once scrolled to, matching Home's own tab row. */}
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

          {/* Section title — scrolls away with the content below it */}
          <View className="bg-gray-50 px-4" style={{ paddingBottom: 4 }}>
            <Text className="text-2xl font-mbold text-gray-800">
              {
                (
                  {
                    job_vacancy: "Jobs & Vacancies",
                    rent: "For Rent",
                    second_hand: "Second Hand",
                    swap: "Swap",
                    free: "Free Items",
                  } as Record<string, string>
                )[activeTab]
              }
            </Text>
          </View>

          {/* Marketplace Content */}
          {renderTabContent()}

          {/* Bottom Spacing */}
          <View className="h-20" />
        </ScrollView>

        {renderFilterModal()}

        {/* Marketplace Post Creation Modal */}
        {showPostOverlay && (
          <Modal
            transparent
            statusBarTranslucent
            animationType="none"
            visible={showPostOverlay}
            onRequestClose={() => setShowPostOverlay(false)}
          >
            <Animated.View
              entering={SlideInDown.springify()}
              exiting={SlideOutDown}
              style={{
                height: "100%",
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                overflow: "hidden",
              }}
            >
              <MarketplacePostOverlay
                onClose={() => setShowPostOverlay(false)}
              />
            </Animated.View>
          </Modal>
        )}

        <AuthPromptModal
          visible={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          message="Sign in to post on the marketplace"
        />
      </View>
    </GestureDetector>
  );
}
