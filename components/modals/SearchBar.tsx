import ImageViewer from "@/components/modals/ImageViewer";
import { useUser } from "@/contexts/UserContext";
import { searchAll, SearchResult, SearchResults } from "@/lib/searchService";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  Image,
  Keyboard,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function SearchBar({
  value,
  onChangeText,
  placeholder = "Search any products...",
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [throttledValue, setThrottledValue] = useState(value);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "all" | "users" | "services" | "products" | "marketplace"
  >("all");
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(30)).current;
  const inputRef = useRef<TextInput>(null);
  const tabScrollRef = useRef<ScrollView>(null);
  const touchStartX = useRef(0);
  const router = useRouter();
  const { currentUser } = useUser();

  useEffect(() => {
    setIsLoading(true);
    const handler = setTimeout(() => {
      setThrottledValue(value);
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(handler);
  }, [value]);

  // Search effect - triggers when throttled value changes
  useEffect(() => {
    const performSearch = async () => {
      if (throttledValue.trim().length < 2) {
        setSearchResults(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      try {
        const results = await searchAll(throttledValue, currentUser?.id);
        setSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [throttledValue, currentUser?.id]);

  useEffect(() => {
    const onBackPress = () => {
      if (isFocused) {
        closeOverlay();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );

    if (isFocused) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      });
    }

    return () => backHandler.remove();
  }, [isFocused]);

  // Auto-scroll tab bar when active tab changes
  useEffect(() => {
    if (tabScrollRef.current && searchResults) {
      const tabIndex = tabs.findIndex((tab) => tab.key === activeTab);
      // Scroll to show the active tab (approximate position)
      tabScrollRef.current.scrollTo({ x: tabIndex * 100, animated: true });
    }
  }, [activeTab, searchResults]);

  const closeOverlay = () => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 30,
        duration: 75,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsFocused(false);
      onChangeText("");
      setSearchResults(null);
    });
  };

  const handleResultPress = (result: SearchResult) => {
    switch (result.type) {
      case "user":
        // Navigate to user profile (own profile or other user's profile)
        router.push(
          result.id === currentUser?.id
            ? "/(users)/profile"
            : (`/(users)/profile/${result.id}` as any),
        );
        break;
      case "service":
        // Navigate to service detail page
        router.push(`/(users)/servicedetail/${result.id}` as any);
        break;
      case "product":
        // Navigate to product detail page
        router.push(`/(users)/product/${result.id}` as any);
        break;
      case "marketplace":
        // Navigate to marketplace detail page
        router.push(`/(users)/marketplace/${result.id}` as any);
        break;
      case "post":
        // Open ImageViewer modal instead of navigating
        setSelectedPost({
          id: result.id,
          user_id: result.metadata.userId,
          content: result.metadata.content,
          images: result.metadata.images || [],
          likes: result.metadata.likes || 0,
          comments: result.metadata.comments || 0,
          shares: result.metadata.shares || 0,
          userName: result.metadata.userName || result.title,
        });
        setShowImageViewer(true);
        return; // Don't close overlay yet
    }
    closeOverlay();
  };

  const levenshtein = (a: string, b: string): number => {
    const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
      Array.from({ length: a.length + 1 }, (_, j) => 0),
    );

    for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] =
          b[i - 1] === a[j - 1]
            ? matrix[i - 1][j - 1]
            : Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1,
              );
      }
    }

    return matrix[b.length][a.length];
  };

  const fuzzyMatch = (
    query: string,
    item: { name: string; category: string },
  ): boolean => {
    const q = query.toLowerCase().trim();
    const name = item.name.toLowerCase();
    const category = item.category.toLowerCase();

    if (name.includes(q) || category.includes(q)) return true;

    const nameWords = name.split(" ");
    const categoryWords = category.split(" ");

    return [...nameWords, ...categoryWords].some(
      (word) => word.startsWith(q) || levenshtein(q, word) <= 2,
    );
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return <Text className="text-gray-800">{text}</Text>;

    const q = query.toLowerCase().trim();
    const parts = text.split(new RegExp(`(${q})`, "i"));

    return parts.map((part, index) => {
      const isMatch = part.toLowerCase() === q;
      return (
        <Text
          key={index}
          className={isMatch ? "font-semibold text-black" : "text-gray-800"}
        >
          {part}
        </Text>
      );
    });
  };

  // Section Header Component
  const SectionHeader = ({
    title,
    count,
    icon,
  }: {
    title: string;
    count: number;
    icon: string;
  }) => (
    <View className="flex-row items-center py-2 px-2 mt-3 mb-1 border-b border-gray-200">
      <Ionicons name={icon as any} size={16} color="#6B7280" />
      <Text className="ml-2 text-sm font-semibold text-gray-600 uppercase">
        {title} ({count})
      </Text>
    </View>
  );

  // Post Card Component (for grid display)
  const PostCard = ({ result }: { result: SearchResult }) => {
    const hasImage = !!result.imageUrl;

    return (
      <TouchableOpacity
        onPress={() => handleResultPress(result)}
        className="mb-3"
        activeOpacity={0.7}
      >
        <View className="bg-white rounded-lg overflow-hidden border border-gray-100">
          {/* Image (only if available) */}
          {hasImage && (
            <Image
              source={{ uri: result.imageUrl }}
              className="w-full h-32"
              resizeMode="cover"
            />
          )}

          {/* Post Info */}
          <View className={hasImage ? "p-2.5" : "p-3"}>
            <Text
              className="text-xs font-semibold text-gray-900"
              numberOfLines={1}
            >
              {result.title}
            </Text>
            {result.subtitle && (
              <Text
                className="text-xs text-gray-500 mt-1.5"
                numberOfLines={hasImage ? 2 : 4}
              >
                {result.subtitle}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Search Result Item Component (for other types)
  const SearchResultItem = ({
    result,
    query,
    showTypeTag = false,
  }: {
    result: SearchResult;
    query: string;
    showTypeTag?: boolean;
  }) => {
    const isUser = result.type === "user";
    const imageStyle = isUser ? "rounded-full" : "rounded-lg";

    const getTypeLabel = () => {
      switch (result.type) {
        case "user":
          return "User";
        case "service":
          return "Service";
        case "product":
          return "Product";
        case "marketplace":
          return "Marketplace";
        case "post":
          return "Post";
        default:
          return "";
      }
    };

    const getTypeColor = () => {
      switch (result.type) {
        case "user":
          return "bg-blue-100 text-blue-700";
        case "service":
          return "bg-purple-100 text-purple-700";
        case "product":
          return "bg-green-100 text-green-700";
        case "marketplace":
          return "bg-orange-100 text-orange-700";
        case "post":
          return "bg-pink-100 text-pink-700";
        default:
          return "bg-gray-100 text-gray-700";
      }
    };

    return (
      <TouchableOpacity
        onPress={() => handleResultPress(result)}
        className="flex-row items-center bg-white rounded-lg p-3 mb-2 border border-gray-100"
        activeOpacity={0.7}
      >
        {/* Avatar/Image */}
        <View
          className={`w-14 h-14 ${imageStyle} bg-gray-200 overflow-hidden mr-3`}
        >
          {result.imageUrl ? (
            <Image
              source={{ uri: result.imageUrl }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full items-center justify-center bg-gray-300">
              <Ionicons
                name={
                  result.type === "user"
                    ? "person"
                    : result.type === "service"
                      ? "construct"
                      : result.type === "product"
                        ? "pricetag"
                        : result.type === "marketplace"
                          ? "storefront"
                          : "chatbubble"
                }
                size={24}
                color="#9CA3AF"
              />
            </View>
          )}
        </View>

        {/* Content */}
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text
              className="text-base font-semibold text-gray-900 flex-1"
              numberOfLines={1}
            >
              {highlightMatch(result.title, query)}
            </Text>
            {showTypeTag && (
              <View
                className={`ml-2 px-2 py-0.5 rounded-full ${getTypeColor()}`}
              >
                <Text className={`text-xs font-medium ${getTypeColor()}`}>
                  {getTypeLabel()}
                </Text>
              </View>
            )}
          </View>
          {result.subtitle && (
            <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={1}>
              {result.subtitle}
            </Text>
          )}
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
      </TouchableOpacity>
    );
  };

  // Helper functions for filtering results
  const getFilteredResults = (): SearchResult[] => {
    if (!searchResults) return [];

    if (activeTab === "all") {
      // Posts only show in "All" tab
      return [
        ...searchResults.users,
        ...searchResults.services,
        ...searchResults.products,
        ...searchResults.marketplace,
        ...searchResults.posts,
      ];
    }

    // Individual tabs don't include posts
    return searchResults[activeTab] || [];
  };

  const getTabCount = (tab: string): number => {
    if (!searchResults) return 0;
    if (tab === "all") {
      // Include posts in "All" count
      return (
        searchResults.users.length +
        searchResults.services.length +
        searchResults.products.length +
        searchResults.marketplace.length +
        searchResults.posts.length
      );
    }
    // Individual tabs don't count posts
    return searchResults[tab as keyof SearchResults]?.length || 0;
  };

  // Swipe handling for tab navigation
  const tabs = [
    { key: "all", label: "All", icon: "apps" },
    { key: "users", label: "Users", icon: "people" },
    { key: "services", label: "Services", icon: "construct" },
    { key: "products", label: "Products", icon: "pricetag" },
    { key: "marketplace", label: "Market", icon: "storefront" },
  ];

  const handleSwipe = (direction: "left" | "right") => {
    const currentIndex = tabs.findIndex((tab) => tab.key === activeTab);

    if (direction === "left" && currentIndex < tabs.length - 1) {
      // Swipe left = next tab
      setActiveTab(tabs[currentIndex + 1].key as any);
    } else if (direction === "right" && currentIndex > 0) {
      // Swipe right = previous tab
      setActiveTab(tabs[currentIndex - 1].key as any);
    }
  };

  const handleTouchStart = (e: any) => {
    touchStartX.current = e.nativeEvent.pageX;
  };

  const handleTouchEnd = (e: any) => {
    const touchEndX = e.nativeEvent.pageX;
    const diff = touchStartX.current - touchEndX;
    const threshold = 50; // Minimum swipe distance

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        handleSwipe("left");
      } else {
        handleSwipe("right");
      }
    }
  };

  // Tab Bar Component
  const TabBar = () => {
    return (
      <ScrollView
        ref={tabScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3"
        contentContainerStyle={{ paddingHorizontal: 4 }}
      >
        {tabs.map((tab) => {
          const count = getTabCount(tab.key);
          const isActive = activeTab === tab.key;

          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key as any)}
              className={`mr-2 px-4 py-2 rounded-full flex-row items-center ${
                isActive ? "bg-primary" : "bg-white border border-gray-200"
              }`}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={isActive ? "white" : "#6B7280"}
              />
              <Text
                className={`ml-1.5 text-sm font-msemibold ${
                  isActive ? "text-white" : "text-gray-700"
                }`}
              >
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full min-w-[18px] items-center ${
                    isActive ? "bg-white/20" : "bg-gray-200"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      isActive ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <>
      <TouchableOpacity
        className="flex-row items-center rounded-full px-4 py-2 border border-gray-200"
        activeOpacity={0.9}
        onPress={() => setIsFocused(true)}
      >
        <Ionicons
          name="search"
          size={18}
          color="#888"
          style={{ marginRight: 8 }}
        />
        <TextInput
          pointerEvents="none"
          editable={false}
          className="flex-1 font-regular text-sm text-gray-800"
          placeholder={placeholder}
          placeholderTextColor="#888"
          value={value}
        />
      </TouchableOpacity>

      <Modal
        visible={isFocused}
        animationType="none"
        transparent={false}
        statusBarTranslucent={true}
        onRequestClose={closeOverlay}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Animated.View
            style={{
              opacity: opacityAnim,
              transform: [{ translateY: translateYAnim }],
            }}
            className="flex-1 bg-gray-50 pt-16 px-4"
          >
            <View className="flex-row items-center mb-4">
              <TouchableOpacity onPress={closeOverlay} className="p-2">
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
              <TextInput
                ref={inputRef}
                className="flex-1 font-regular text-base text-gray-800 ml-2"
                placeholder={placeholder}
                placeholderTextColor="#888"
                value={value}
                onChangeText={onChangeText}
              />
              {value.length > 0 && (
                <TouchableOpacity
                  onPress={() => onChangeText("")}
                  className="p-2"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={20} color="#888" />
                </TouchableOpacity>
              )}
            </View>

            {/* Search Results */}
            <ScrollView
              className="flex-1 px-2"
              showsVerticalScrollIndicator={false}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Loading State */}
              {isSearching && (
                <View className="py-8 items-center">
                  <ActivityIndicator size="large" color="#094569" />
                  <Text className="text-gray-500 mt-2">Searching...</Text>
                </View>
              )}

              {/* Initial State */}
              {!isSearching &&
                !searchResults &&
                throttledValue.length === 0 && (
                  <View className="py-4">
                    <View className="items-center">
                      <Ionicons name="search" size={48} color="#9CA3AF" />
                      <Text className="text-gray-500 mt-4 text-center">
                        Search for users, services, products, marketplace items,
                        or posts
                      </Text>
                    </View>
                  </View>
                )}

              {/* Empty State - Too Short Query */}
              {!isSearching &&
                throttledValue.length > 0 &&
                throttledValue.length < 2 && (
                  <View className="py-8 items-center">
                    <Ionicons
                      name="information-circle-outline"
                      size={48}
                      color="#9CA3AF"
                    />
                    <Text className="text-gray-500 mt-4 text-center">
                      Type at least 2 characters to search
                    </Text>
                  </View>
                )}

              {/* Results Display with Tabs */}
              {!isSearching && searchResults && throttledValue.length >= 2 && (
                <>
                  {/* Tab Bar */}
                  <TabBar />

                  {/* Filtered Results */}
                  {activeTab === "all" ? (
                    // Show all results with type tags
                    <>
                      {getFilteredResults().length > 0 ? (
                        <>
                          {/* Separate posts from other results */}
                          {(() => {
                            const posts = getFilteredResults().filter(
                              (r) => r.type === "post",
                            );
                            const otherResults = getFilteredResults().filter(
                              (r) => r.type !== "post",
                            );

                            return (
                              <>
                                {/* Other Results (non-posts) */}
                                {otherResults.map((result) => (
                                  <SearchResultItem
                                    key={result.id}
                                    result={result}
                                    query={throttledValue}
                                    showTypeTag={true}
                                  />
                                ))}

                                {/* Posts in 2-column grid */}
                                {posts.length > 0 && (
                                  <>
                                    {otherResults.length > 0 && (
                                      <View className="border-t border-gray-200 my-4" />
                                    )}
                                    <View className="flex-row flex-wrap justify-between">
                                      {posts.map((result, index) => (
                                        <View
                                          key={result.id}
                                          style={{ width: "48%" }}
                                        >
                                          <PostCard result={result} />
                                        </View>
                                      ))}
                                    </View>
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        <View className="py-8 items-center">
                          <Ionicons
                            name="search-outline"
                            size={48}
                            color="#9CA3AF"
                          />
                          <Text className="text-gray-500 mt-4 text-center">
                            No results found for "{throttledValue}"
                          </Text>
                          <Text className="text-gray-400 mt-2 text-center text-sm">
                            Try different keywords
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    // Show filtered results for specific tab
                    <View>
                      {getFilteredResults().length > 0 ? (
                        getFilteredResults().map((result) => (
                          <SearchResultItem
                            key={result.id}
                            result={result}
                            query={throttledValue}
                            showTypeTag={false}
                          />
                        ))
                      ) : (
                        <View className="py-8 items-center">
                          <Ionicons
                            name="search-outline"
                            size={48}
                            color="#9CA3AF"
                          />
                          <Text className="text-gray-500 mt-4 text-center">
                            No {activeTab} found for "{throttledValue}"
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>

      {showImageViewer && selectedPost && (
        <ImageViewer
          visible={showImageViewer}
          images={selectedPost.images}
          initialIndex={0}
          onClose={() => {
            setShowImageViewer(false);
            setSelectedPost(null);
            closeOverlay();
          }}
          postContent={selectedPost.content}
          username={selectedPost.userName}
          likes={selectedPost.likes}
          comments={selectedPost.comments}
        />
      )}
    </>
  );
}
