import Banner from "@/components/Banner";
import SearchBar from "@/components/SearchBar";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import TopNavbar from "@/components/ui/TopNavbar";
import { useUser } from "@/contexts/UserContext";
import { freeItems } from "@/data/freeData";
import { rentItems } from "@/data/rentData";
import { secondHandItems } from "@/data/secondHandData";
import { swapItems } from "@/data/swapData";
import {
  Filter,
  Gift,
  Home,
  MapPin,
  MessageCircle,
  RefreshCw,
  ShoppingCart,
  User,
  X
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";


export default function MarketplaceScreen() {
  const { currentUser } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("rent");
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Track initial load
  const [filters, setFilters] = useState({
    rent: { category: "", duration: "", priceRange: "" },
    swap: { category: "", tags: [] },
    secondhand: { condition: "", minPrice: "", maxPrice: "" },
    free: { category: "" }
  });


  // Handle initial load
  useEffect(() => {
    // Simulate initial loading time
    const timer = setTimeout(() => {
      setIsLoading(false);
      setIsInitialLoad(false);
    }, 1500); // 1.5 seconds initial load

    return () => clearTimeout(timer);
  }, []);
  
  const handleTabChange = (newTab: string) => {
    if (newTab === activeTab) return;
    if (isInitialLoad) return; // Prevent tab changes during initial load

    setIsLoading(true);
    setActiveTab(newTab);

    // Simulate loading delay
    setTimeout(() => {
      setIsLoading(false);
    }, 1200); // 1.2 second delay
  };

  const renderMarketplaceCard = ({ item }) => (
    <View className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 overflow-hidden">
      {/* Product Image */}
      <ImageWithFallback 
        source={{ uri: item.images[0] }}
        className="w-full h-48"
        resizeMode="cover"
      />
      
      {/* Profile Section */}
      <View className="p-4 border-b border-gray-100">
        <View className="flex-row items-center">
          <View className="w-10 h-10 bg-gray-200 rounded-full items-center justify-center mr-3">
            <User size={20} color="#666" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-gray-900">
              {item.userName}
            </Text>
            <View className="flex-row items-center">
              <MapPin size={12} color="#666" />
              <Text className="text-xs text-gray-600 ml-1">{item.location}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Product Details */}
      <View className="p-4">
        <Text className="text-lg font-semibold text-gray-900 mb-2">
          {item.name}
        </Text>
        <Text className="text-sm text-gray-600 mb-3" numberOfLines={3}>
          {item.description}
        </Text>
        
        {/* Price/Type specific info */}
        {item.type === 'rent' && (
          <Text className="text-xl font-bold text-primary mb-3">
            {item.priceText}
          </Text>
        )}
        {item.type === 'secondhand' && (
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-xl font-bold text-primary">
              {item.priceText}
            </Text>
            <Text className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {item.condition}
            </Text>
          </View>
        )}
        {item.type === 'swap' && (
          <View className="flex-row flex-wrap mb-3">
            {item.tags.slice(0, 3).map((tag, index) => (
              <Text key={index} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2 mb-1">
                {tag}
              </Text>
            ))}
          </View>
        )}
        
        {/* Message Button */}
        <TouchableOpacity className="bg-primary flex-row items-center justify-center py-3 rounded-lg">
          <MessageCircle size={16} color="white" />
          <Text className="text-white font-semibold ml-2">Message User</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const filterData = (data) => {
    return data.filter(item => {
      const currentFilters = filters[activeTab];
      
      // Search query filter
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !item.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Tab-specific filters
      switch (activeTab) {
        case "rent":
          if (currentFilters.category && item.category !== currentFilters.category) return false;
          if (currentFilters.duration && item.duration !== currentFilters.duration) return false;
          break;
        case "swap":
          if (currentFilters.category && item.category !== currentFilters.category) return false;
          break;
        case "secondhand":
          if (currentFilters.condition && item.condition !== currentFilters.condition) return false;
          if (currentFilters.minPrice && item.price < parseInt(currentFilters.minPrice)) return false;
          if (currentFilters.maxPrice && item.price > parseInt(currentFilters.maxPrice)) return false;
          break;
      }
      
      return true;
    });
  };

  const renderTabContent = () => {
    let data = [];
    let title = "";

    switch (activeTab) {
      case "rent":
        data = filterData(rentItems);
        title = "Rent Options";
        break;
      case "swap":
        data = filterData(swapItems);
        title = "Swap Options";
        break;
      case "secondhand":
        data = filterData(secondHandItems);
        title = "Second Hand Buy";
        break;
      case "free":
        data = filterData(freeItems);
        title = "Free Options";
        break;
      default:
        return null;
    }

    // During initial load, don't show the section content at all
    if (isInitialLoad) {
      return (
        <View className="flex-1 items-center justify-center pt-20">
          <ActivityIndicator size="small" color="black" />
          <Text className="text-sm text-gray-600 mt-2">Loading marketplace...</Text>
        </View>
      );
    }

    return (
      <View className="px-4 pb-6">
        {/* Loading indicator at the top */}
        {isLoading && (
          <View className="flex-row items-center justify-center py-4 mb-2">
            <ActivityIndicator size="small" color="black" />
            <Text className="text-sm text-gray-600 ml-2">Loading {title.toLowerCase()}...</Text>
          </View>
        )}
        
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-lg font-semibold text-gray-900">
            {title}
          </Text>
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            className="bg-white border border-gray-300 rounded-lg p-2 shadow-sm"
            disabled={isLoading}
          >
            <Filter size={18} color={isLoading ? "#ccc" : "black"} />
          </TouchableOpacity>
        </View>
        
        {isLoading ? (
          /* Loading skeleton cards */
          <View>
            {[1, 2, 3].map((index) => (
              <View key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 overflow-hidden">
                {/* Image skeleton */}
                <View className="w-full h-48 bg-gray-200" />
                
                {/* Profile section skeleton */}
                <View className="p-4 border-b border-gray-100">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 bg-gray-200 rounded-full mr-3" />
                    <View className="flex-1">
                      <View className="bg-gray-200 h-4 w-24 rounded mb-1" />
                      <View className="bg-gray-200 h-3 w-20 rounded" />
                    </View>
                  </View>
                </View>
                
                {/* Content skeleton */}
                <View className="p-4">
                  <View className="bg-gray-200 h-5 w-3/4 rounded mb-2" />
                  <View className="bg-gray-200 h-4 w-full rounded mb-1" />
                  <View className="bg-gray-200 h-4 w-2/3 rounded mb-3" />
                  <View className="bg-gray-200 h-10 w-full rounded" />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={data}
            renderItem={renderMarketplaceCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    );
  };


  const renderFilterModal = () => {
    const currentFilters = filters[activeTab];
    
    const updateFilter = (key, value) => {
      setFilters(prev => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          [key]: value
        }
      }));
    };

    const clearFilters = () => {
      setFilters(prev => ({
        ...prev,
        [activeTab]: activeTab === 'rent' ? { category: "", duration: "", priceRange: "" } :
                     activeTab === 'swap' ? { category: "", tags: [] } :
                     activeTab === 'secondhand' ? { condition: "", minPrice: "", maxPrice: "" } :
                     { category: "" }
      }));
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

            {/* Rent Filters */}
            {activeTab === 'rent' && (
              <View className="space-y-4">
                <View>
                  <Text className="text-sm font-medium text-gray-700 mb-2">Category</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {['house', 'apartment', 'vehicle', 'equipment'].map(category => (
                      <TouchableOpacity
                        key={category}
                        onPress={() => updateFilter('category', currentFilters.category === category ? '' : category)}
                        className={`px-3 py-2 rounded-full border ${
                          currentFilters.category === category ? 'bg-black border-black' : 'bg-white border-gray-300'
                        }`}
                      >
                        <Text className={`text-sm capitalize ${
                          currentFilters.category === category ? 'text-white' : 'text-gray-600'
                        }`}>
                          {category}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                <View>
                  <Text className="text-sm font-medium text-gray-700 mb-2">Duration</Text>
                  <View className="flex-row gap-2">
                    {['daily', 'monthly'].map(duration => (
                      <TouchableOpacity
                        key={duration}
                        onPress={() => updateFilter('duration', currentFilters.duration === duration ? '' : duration)}
                        className={`px-3 py-2 rounded-full border ${
                          currentFilters.duration === duration ? 'bg-black border-black' : 'bg-white border-gray-300'
                        }`}
                      >
                        <Text className={`text-sm capitalize ${
                          currentFilters.duration === duration ? 'text-white' : 'text-gray-600'
                        }`}>
                          {duration}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Swap Filters */}
            {activeTab === 'swap' && (
              <View>
                <Text className="text-sm font-medium text-gray-700 mb-2">Category</Text>
                <View className="flex-row flex-wrap gap-2">
                  {['books', 'clothes', 'electronics'].map(category => (
                    <TouchableOpacity
                      key={category}
                      onPress={() => updateFilter('category', currentFilters.category === category ? '' : category)}
                      className={`px-3 py-2 rounded-full border ${
                        currentFilters.category === category ? 'bg-black border-black' : 'bg-white border-gray-300'
                      }`}
                    >
                      <Text className={`text-sm capitalize ${
                        currentFilters.category === category ? 'text-white' : 'text-gray-600'
                      }`}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Second Hand Filters */}
            {activeTab === 'secondhand' && (
              <View className="space-y-4">
                <View>
                  <Text className="text-sm font-medium text-gray-700 mb-2">Condition</Text>
                  <View className="flex-row gap-2">
                    {['new', 'good', 'old'].map(condition => (
                      <TouchableOpacity
                        key={condition}
                        onPress={() => updateFilter('condition', currentFilters.condition === condition ? '' : condition)}
                        className={`px-3 py-2 rounded-full border ${
                          currentFilters.condition === condition ? 'bg-black border-black' : 'bg-white border-gray-300'
                        }`}
                      >
                        <Text className={`text-sm capitalize ${
                          currentFilters.condition === condition ? 'text-white' : 'text-gray-600'
                        }`}>
                          {condition}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                <View>
                  <Text className="text-sm font-medium text-gray-700 mb-2">Price Range (BTN)</Text>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Text className="text-xs text-gray-600 mb-1">Min Price</Text>
                      <TextInput
                        value={currentFilters.minPrice}
                        onChangeText={(value) => updateFilter('minPrice', value)}
                        placeholder="Min"
                        className="border border-gray-300 rounded-lg p-3 text-gray-900"
                        keyboardType="numeric"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs text-gray-600 mb-1">Max Price</Text>
                      <TextInput
                        value={currentFilters.maxPrice}
                        onChangeText={(value) => updateFilter('maxPrice', value)}
                        placeholder="Max"
                        className="border border-gray-300 rounded-lg p-3 text-gray-900"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity
                onPress={clearFilters}
                className="flex-1 py-3 border border-gray-300 rounded-lg items-center"
              >
                <Text className="text-gray-600 font-medium">Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowFilters(false)}
                className="flex-1 py-3 bg-black rounded-lg items-center"
              >
                <Text className="text-white font-medium">Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };


  const headerData = [
    { key: 'header', component: 'header' },
    { key: 'content', component: 'content' }
  ];

  const renderItem = ({ item }) => {
    if (item.component === 'header') {
      return (
        <View className="px-4 gap-2">
          <TopNavbar />
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
          <Banner />
          
          {/* Marketplace Options H1 */}
          <Text className="text-2xl font-bold text-gray-900 mt-4 mb-4">
            Marketplace Options
          </Text>
          
          {/* Tab Navigation */}
          <View className="flex-row items-center w-full mx-auto mt-2 gap-2 mb-4">
            <TouchableOpacity
              onPress={() => handleTabChange("rent")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "rent"
                  ? "border-2 border-black"
                  : ""
              }`}
              disabled={isLoading || isInitialLoad}
            >
              <Home 
                size={20} 
                color={(isLoading || isInitialLoad) ? "#ccc" : "black"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTabChange("swap")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "swap"
                  ? "border-2 border-black"
                  : ""
              }`}
              disabled={isLoading || isInitialLoad}
            >
              <RefreshCw 
                size={20} 
                color={(isLoading || isInitialLoad) ? "#ccc" : "black"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTabChange("secondhand")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "secondhand"
                  ? "border-2 border-black"
                  : ""
              }`}
              disabled={isLoading || isInitialLoad}
            >
              <ShoppingCart 
                size={20} 
                color={(isLoading || isInitialLoad) ? "#ccc" : "black"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleTabChange("free")}
              className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm bg-white ${
                activeTab === "free"
                  ? "border-2 border-black"
                  : ""
              }`}
              disabled={isLoading || isInitialLoad}
            >
              <Gift 
                size={20} 
                color={(isLoading || isInitialLoad) ? "#ccc" : "black"}
              />
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    
    if (item.component === 'content') {
      return (
        <View className="flex-1 mb-20">
          {renderTabContent()}
        </View>
      );
    }
  };

  return (
    <>
      <FlatList
        data={headerData}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        className="flex-1 bg-gray-50"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      />
      {renderFilterModal()}
    </>
  );
}