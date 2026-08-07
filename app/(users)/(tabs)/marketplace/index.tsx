import Banner from "@/components/Banner";
import AuthPromptModal from "@/components/modals/AuthPromptModal";
import MarketplacePostOverlay from "@/components/modals/MarketplacePostOverlay";
import SearchBar from "@/components/modals/SearchBar";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import TopNavbar from "@/components/ui/TopNavbar";
import { useUser } from "@/contexts/UserContext";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import { dzongkhagCenters } from "@/data/dzongkhag";
import {
  fetchMarketplaceItems,
  MarketplaceItemWithUser,
} from "@/lib/postMarketPlace";
import { supabase } from "@/lib/supabase";
import { Picker } from "@react-native-picker/picker";
import { useAppRouter } from "@/utils/navigation";
import { getInitials } from "@/utils/initials";
import {
  Briefcase,
  Filter,
  Gift,
  Home,
  MapPin,
  Plus,
  RefreshCw,
  ShoppingCart,
  Verified,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marketplaceItems, setMarketplaceItems] = useState<
    MarketplaceItemWithUser[]
  >([]);
  const [verifiedUserIds, setVerifiedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [filters, setFilters] = useState({
    dzongkhag: "",
    minPrice: "",
    maxPrice: "",
    tags: [],
  });

  // Fetch marketplace items
  const loadMarketplaceItems = async () => {
    try {
      setIsLoading(true);
      const { items } = await fetchMarketplaceItems(0, 50);
      setMarketplaceItems(items || []);
      const userIds = [...new Set((items || []).map((i) => i.user_id))];
      if (userIds.length > 0) {
        const { data: spData } = await supabase
          .from("service_providers")
          .select("user_id, verification_status")
          .in("user_id", userIds);
        setVerifiedUserIds(
          new Set(
            (spData || [])
              .filter((sp) => sp.verification_status === "verified")
              .map((sp) => sp.user_id),
          ),
        );
      }
    } catch (error) {
      console.error("Error loading marketplace items:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMarketplaceItems();
    setRefreshing(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadMarketplaceItems();
  }, []);

  const handleTabChange = (newTab: string) => {
    if (newTab === activeTab) return;
    trackFeature("filter_apply", "filter_button", "tap", { category: newTab });
    setActiveTab(newTab);
  };

  const renderMarketplaceCard = ({
    item,
  }: {
    item: MarketplaceItemWithUser;
  }) => (
    <TouchableOpacity
      onPress={() => {
        trackTap("marketplace_card", "marketplace_view", { item_id: item.id, item_type: item.type });
        router.push(`/(users)/marketplace/${item.id}` as any);
      }}
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
    >
      {/* Product Image */}
      <ImageWithFallback
        source={{ uri: item.images?.[0] || "" }}
        className="w-full h-32"
        resizeMode="cover"
      />

      {/* Card Content */}
      <View className="p-3">
        {/* Title */}
        <Text
          className="text-sm font-semibold text-gray-900 mb-1.5"
          numberOfLines={2}
        >
          {item.title}
        </Text>

        {/* Row 2: Seller avatar + name + verified badge */}
        {item.profiles?.name && (
          <View className="flex-row items-center mb-2 gap-1.5">
            {(item.profiles as any)?.avatar_url ? (
              <Image
                source={{ uri: (item.profiles as any).avatar_url }}
                style={{ width: 20, height: 20, borderRadius: 10 }}
              />
            ) : (
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: "#e0e7ef",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ fontSize: 9, fontWeight: "700", color: "#094569" }}
                >
                  {getInitials(item.profiles.name)}
                </Text>
              </View>
            )}
            <Text
              className="text-xs text-gray-500 font-medium"
              numberOfLines={1}
              style={{ flex: 1 }}
            >
              {item.profiles.name}
            </Text>
            {verifiedUserIds.has(item.user_id) && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: "#EFF6FF",
                  borderWidth: 1,
                  borderColor: "#094569",
                  borderRadius: 99,
                  paddingHorizontal: 5,
                  paddingVertical: 2,
                  gap: 2,
                }}
              >
                <Verified size={8} color="#094569" />
                <Text
                  style={{ fontSize: 8, fontWeight: "700", color: "#094569" }}
                >
                  Verified
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Row 3: Price + Location */}
        {(item.type === "rent" ||
          item.type === "second_hand" ||
          item.type === "job_vacancy") &&
        item.price > 0 ? (
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-base font-bold text-primary">
              Nu. {item.price}
            </Text>
            {item.dzongkhag && (
              <View className="flex-row items-center gap-0.5">
                <MapPin size={11} color="#9CA3AF" />
                <Text className="text-xs text-gray-400" numberOfLines={1}>
                  {item.dzongkhag}
                </Text>
              </View>
            )}
          </View>
        ) : item.dzongkhag ? (
          <View className="flex-row items-center mb-2 gap-0.5">
            <MapPin size={11} color="#9CA3AF" />
            <Text className="text-xs text-gray-400" numberOfLines={1}>
              {item.dzongkhag}
            </Text>
          </View>
        ) : null}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <View
            className="flex-row flex-wrap"
            style={{ alignSelf: "flex-start" }}
          >
            {item.tags.slice(0, 2).map((tag: string, index: number) => (
              <Text
                key={index}
                className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1 mb-1"
              >
                {tag}
              </Text>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

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
        <View className="flex-1 items-center justify-center pt-20">
          <ActivityIndicator size="large" color="#094569" />
          <Text className="text-sm text-gray-600 mt-2">
            Loading marketplace...
          </Text>
        </View>
      );
    }

    return (
      <View className="px-3 pb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-semibold text-gray-900">{title}</Text>
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            className="bg-white border border-gray-300 rounded-lg p-2 shadow-sm"
          >
            <Filter size={18} color="black" />
          </TouchableOpacity>
        </View>

        {data.length === 0 ? (
          <View className="items-center justify-center py-20">
            <Text className="text-gray-500 text-base">No items found</Text>
            <Text className="text-gray-400 text-sm mt-2">
              Try adjusting your filters
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap gap-2 justify-between">
            {data.map((item: MarketplaceItemWithUser) => (
              <View key={item.id} className="w-[48%]">
                {renderMarketplaceCard({ item })}
              </View>
            ))}
          </View>
        )}
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#094569"]}
            />
          }
        >
          {/* Header */}
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

            <Banner />

            {/* Tab Navigation — matches home screen pill design */}
            <View style={{ marginTop: 8, marginBottom: 4 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 16,
                }}
              >
                {(
                  [
                    { key: "job_vacancy", Icon: Briefcase },
                    { key: "rent", Icon: Home },
                    { key: "second_hand", Icon: ShoppingCart },
                    { key: "swap", Icon: RefreshCw },
                    { key: "free", Icon: Gift },
                  ] as const
                ).map(({ key, Icon }) => {
                  const isActive = activeTab === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      onPress={() => handleTabChange(key)}
                      disabled={isLoading}
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        backgroundColor: isActive ? "#094569" : "#f3f4f6",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: isLoading ? 0.5 : 1,
                      }}
                    >
                      <Icon size={17} color={isActive ? "#fff" : "#9ca3af"} />
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text
                className="text-2xl font-mbold text-gray-800"
                style={{ marginTop: 10, paddingHorizontal: 16 }}
              >
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
