import Banner from "@/components/Banner";
import MarketplacePostOverlay from "@/components/MarketplacePostOverlay";
import SearchBar from "@/components/SearchBar";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import TopNavbar from "@/components/ui/TopNavbar";
import { useUser } from "@/contexts/UserContext";
import { dzongkhagCenters } from "@/data/dzongkhag";
import { fetchMarketplaceItems, MarketplaceItemWithUser } from "@/lib/postMarketPlace";
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import {
    Briefcase,
    Filter,
    Gift,
    Home,
    MapPin,
    Plus,
    RefreshCw,
    ShoppingCart,
    X
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    RefreshControl,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated";


export default function MarketplaceScreen() {
  const { currentUser } = useUser();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("job_vacancy");
  const [showFilters, setShowFilters] = useState(false);
  const [showPostOverlay, setShowPostOverlay] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItemWithUser[]>([]);
  const [filters, setFilters] = useState({
    dzongkhag: "",
    minPrice: "",
    maxPrice: "",
    tags: []
  });

  // Fetch marketplace items
  const loadMarketplaceItems = async () => {
    try {
      setIsLoading(true);
      const { items } = await fetchMarketplaceItems(0, 50);
      setMarketplaceItems(items || []);
    } catch (error) {
      console.error('Error loading marketplace items:', error);
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
    setActiveTab(newTab);
  };

  const renderMarketplaceCard = ({ item }: { item: MarketplaceItemWithUser }) => (
    <TouchableOpacity
      onPress={() => router.push(`/marketplace/${item.id}` as any)}
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
    >
      {/* Product Image */}
      <ImageWithFallback
        source={{ uri: item.images?.[0] || '' }}
        className="w-full h-32"
        resizeMode="cover"
      />

      {/* Card Content */}
      <View className="p-3">
        {/* Title */}
        <Text className="text-sm font-semibold text-gray-900 mb-2" numberOfLines={2}>
          {item.title}
        </Text>

        {/* Location */}
        {item.dzongkhag && (
          <View className="flex-row items-center mb-2">
            <MapPin size={12} color="#666" />
            <Text className="text-xs text-gray-600 ml-1">{item.dzongkhag}</Text>
          </View>
        )}

        {/* Price */}
        {(item.type === 'rent' || item.type === 'second_hand' || item.type === 'job_vacancy') && item.price > 0 && (
          <Text className="text-base font-bold text-primary mb-2">
            Nu. {item.price}
          </Text>
        )}

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <View className="flex-row flex-wrap" style={{ alignSelf: 'flex-start' }}>
            {item.tags.slice(0, 2).map((tag: string, index: number) => (
              <Text key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-1 mb-1">
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

      // Search query filter
      if (searchQuery) {
        const descriptionText = typeof item.description === 'string'
          ? item.description
          : item.description?.text || '';

        if (!item.title?.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !descriptionText.toLowerCase().includes(searchQuery.toLowerCase())) {
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
            itemTag.toLowerCase().includes(filterTag.toLowerCase())
          )
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
      job_vacancy: "Job Vacancies"
    }[activeTab];

    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center pt-20">
          <ActivityIndicator size="large" color="#094569" />
          <Text className="text-sm text-gray-600 mt-2">Loading marketplace...</Text>
        </View>
      );
    }

    return (
      <View className="px-3 pb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-semibold text-gray-900">
            {title}
          </Text>
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
            <Text className="text-gray-400 text-sm mt-2">Try adjusting your filters</Text>
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
      setFilters(prev => ({
        ...prev,
        [key]: value
      }));
    };

    const clearFilters = () => {
      setFilters({
        dzongkhag: "",
        minPrice: "",
        maxPrice: "",
        tags: []
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

            <ScrollView showsVerticalScrollIndicator={false} className="max-h-96">
              {/* Dzongkhag Filter */}
              <View className="mb-4">
                <Text className="text-sm font-msemibold text-gray-700 mb-2">Location (Dzongkhag)</Text>
                <View className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <Picker
                    selectedValue={filters.dzongkhag}
                    onValueChange={(value) => updateFilter('dzongkhag', value)}
                    style={{ height: 50 }}
                  >
                    <Picker.Item label="All Locations" value="" />
                    {dzongkhagCenters.map((dz) => (
                      <Picker.Item key={dz.name} label={dz.name} value={dz.name} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Price Range Filter (for rent, second_hand, and job_vacancy) */}
              {(activeTab === 'rent' || activeTab === 'second_hand' || activeTab === 'job_vacancy') && (
                <View className="mb-4">
                  <Text className="text-sm font-msemibold text-gray-700 mb-2">Price Range (Nu.)</Text>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="text-xs text-gray-600 mb-1">Min Price</Text>
                      <TextInput
                        value={filters.minPrice}
                        onChangeText={(value) => updateFilter('minPrice', value)}
                        placeholder="Min"
                        className="border border-gray-300 rounded-lg p-3 text-gray-900"
                        keyboardType="numeric"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-gray-600 mb-1">Max Price</Text>
                      <TextInput
                        value={filters.maxPrice}
                        onChangeText={(value) => updateFilter('maxPrice', value)}
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
                <Text className="text-sm font-msemibold text-gray-700 mb-2">Filter by Tags</Text>
                <TextInput
                  value={filters.tags.join(', ')}
                  onChangeText={(text) => {
                    const tagsArray = text.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                    updateFilter('tags', tagsArray);
                  }}
                  placeholder="Enter tags (comma separated)"
                  className="border border-gray-300 rounded-lg p-3 text-gray-900"
                />
                <Text className="text-xs text-gray-500 mt-1">Example: furniture, affordable</Text>
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


  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#094569"]} />
        }
      >
        {/* Header */}
        <View className="px-4 gap-2 bg-gray-50">
          <TopNavbar />

          {/* SearchBar with Plus Button */}
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            <TouchableOpacity
              className="w-11 h-11 bg-primary rounded-lg items-center justify-center"
              onPress={() => setShowPostOverlay(true)}
            >
              <Plus size={24} color="white" />
            </TouchableOpacity>
          </View>

          <Banner />

          {/* Marketplace Options H1 */}
          <Text className="text-2xl font-bold text-gray-900 mt-4 mb-4">
            Marketplace Options
          </Text>

          {/* Tab Navigation */}
          <View className="flex-row items-center w-full mx-auto mt-2 gap-2 mb-4">
            <TouchableOpacity
              onPress={() => handleTabChange("job_vacancy")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "job_vacancy" ? "border-2 border-black" : ""
              }`}
              disabled={isLoading}
            >
              <Briefcase size={20} color={isLoading ? "#ccc" : "black"} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTabChange("rent")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "rent" ? "border-2 border-black" : ""
              }`}
              disabled={isLoading}
            >
              <Home size={20} color={isLoading ? "#ccc" : "black"} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTabChange("second_hand")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "second_hand" ? "border-2 border-black" : ""
              }`}
              disabled={isLoading}
            >
              <ShoppingCart size={20} color={isLoading ? "#ccc" : "black"} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTabChange("swap")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "swap" ? "border-2 border-black" : ""
              }`}
              disabled={isLoading}
            >
              <RefreshCw size={20} color={isLoading ? "#ccc" : "black"} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTabChange("free")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "free" ? "border-2 border-black" : ""
              }`}
              disabled={isLoading}
            >
              <Gift size={20} color={isLoading ? "#ccc" : "black"} />
            </TouchableOpacity>
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
            style={{ height: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" }}
          >
            <MarketplacePostOverlay
              onClose={() => setShowPostOverlay(false)}
            />
          </Animated.View>
        </Modal>
      )}
    </View>
  );
}