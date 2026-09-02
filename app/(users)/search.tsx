import CircularLoader from "@/components/ui/CircularLoader";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { useUser } from "@/contexts/UserContext";
import { searchAll, SearchResult, SearchResults } from "@/lib/searchService";
import {
  addRecentSearch,
  getRecentSearches,
  removeRecentSearch,
  clearRecentSearches,
} from "@/lib/recentSearches";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import { useAppRouter } from "@/utils/navigation";
import { clamp, useResponsive } from "@/utils/responsive";
import { TrendingEntry, useTrendingSubcategories } from "@/hooks/useTrendingSubcategories";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GlobalSearchScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();
  const { trackFeature } = useScreenAnalytics(Screens.SEARCH);
  const { q: initialQuery } = useLocalSearchParams<{ q?: string }>();
  const { ms, vs, wp } = useResponsive();

  // Same formulas as components/ui/TopNavbar.tsx's header row — this screen
  // is landed on straight from that header's own expand animation, so the
  // search pill needs to sit at the exact same height/position for the
  // transition to read as one continuous UI, not a hand-off to a new screen.
  const contentHeight =
    Platform.OS === "android" ? clamp(ms(48), 44, 56) : clamp(ms(44), 40, 52);
  const topSpacing =
    Platform.OS === "android" ? clamp(vs(16), 12, 22) : clamp(vs(10), 8, 16);
  const horizontalPadding = clamp(wp(4), 14, 24);

  const [query, setQuery] = useState(initialQuery || "");
  const [throttledQuery, setThrottledQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(
    null,
  );
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<
    "all" | "users" | "services" | "products" | "marketplace"
  >("all");
  const inputRef = useRef<TextInput>(null);
  const tabScrollRef = useRef<ScrollView>(null);
  const touchStartX = useRef(0);
  const tabLayouts = useRef<{ [key: string]: { x: number; width: number } }>(
    {},
  );
  const tabBarVisibleWidth = useRef(0);

  const { trending } = useTrendingSubcategories();

  // Load this user's recent searches on mount
  useEffect(() => {
    getRecentSearches(currentUser?.id).then(setRecentSearches);
  }, [currentUser?.id]);

  const runSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      setQuery(trimmed);
      setThrottledQuery(trimmed);
      if (trimmed.length >= 2) {
        addRecentSearch(currentUser?.id, trimmed).then(setRecentSearches);
      }
    },
    [currentUser?.id],
  );

  const handleRemoveRecent = useCallback(
    (term: string) => {
      removeRecentSearch(currentUser?.id, term).then(setRecentSearches);
    },
    [currentUser?.id],
  );

  const handleClearRecents = useCallback(() => {
    clearRecentSearches(currentUser?.id).then(() => setRecentSearches([]));
  }, [currentUser?.id]);

  const handleSubmitSearch = useCallback(() => {
    Keyboard.dismiss();
    if (query.trim().length >= 2) {
      addRecentSearch(currentUser?.id, query.trim()).then(setRecentSearches);
    }
  }, [query, currentUser?.id]);

  // Auto-focus on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  // Debounce query
  useEffect(() => {
    const t = setTimeout(() => {
      setThrottledQuery(query);
      if (query.trim().length >= 2) {
        trackFeature("search", "search_bar", "search", { query_length: query.trim().length });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, trackFeature]);

  // Search on debounced query
  useEffect(() => {
    if (throttledQuery.trim().length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    searchAll(throttledQuery, currentUser?.id)
      .then((results) => {
        if (!cancelled) setSearchResults(results);
      })
      .catch(() => {
        if (!cancelled) setSearchResults(null);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [throttledQuery, currentUser?.id]);

  const handleResultPress = (result: SearchResult) => {
    Keyboard.dismiss();
    switch (result.type) {
      case "user":
        router.push(
          result.id === currentUser?.id
            ? "/(users)/profile"
            : (`/(users)/profile/${result.id}` as any),
        );
        break;
      case "service":
        router.push(`/(users)/servicedetail/${result.id}` as any);
        break;
      case "product":
        router.push(`/(users)/product/${result.id}` as any);
        break;
      case "marketplace":
        router.push(`/(users)/marketplace/${result.id}` as any);
        break;
      case "post":
        // Route through the shared post-detail screen — same as every other
        // post entry point (profile, notifications, saved posts, chat, deep
        // links) — so this gets ContextDrop's edge-swipe-back + "drop to
        // Contact Author" gesture and the full comments section for free,
        // instead of the bespoke media-only ImageViewer this used to open.
        router.push(`/(users)/post/${result.id}` as any);
        break;
    }
  };

  const highlightMatch = (text: string, q: string) => {
    if (!q.trim()) return <Text className="text-gray-800">{text}</Text>;
    const parts = text.split(new RegExp(`(${q.trim()})`, "i"));
    return parts.map((part, i) => (
      <Text
        key={i}
        className={
          part.toLowerCase() === q.toLowerCase().trim()
            ? "font-semibold text-black"
            : "text-gray-800"
        }
      >
        {part}
      </Text>
    ));
  };

  const getFilteredResults = (): SearchResult[] => {
    if (!searchResults) return [];
    if (activeTab === "all") {
      return [
        ...searchResults.products,
        ...searchResults.services,
        ...searchResults.users,
        ...searchResults.marketplace,
        ...searchResults.posts,
      ];
    }
    return searchResults[activeTab] || [];
  };

  const getTabCount = (tab: string): number => {
    if (!searchResults) return 0;
    if (tab === "all") {
      return (
        searchResults.users.length +
        searchResults.services.length +
        searchResults.products.length +
        searchResults.marketplace.length +
        searchResults.posts.length
      );
    }
    return searchResults[tab as keyof SearchResults]?.length || 0;
  };

  const tabs = [
    { key: "all", label: "All", icon: "apps" },
    { key: "users", label: "Users", icon: "people" },
    { key: "services", label: "Services", icon: "construct" },
    { key: "products", label: "Products", icon: "pricetag" },
    { key: "marketplace", label: "Market", icon: "storefront" },
  ];

  // Shared by manual tab taps (layout already known by the time you can tap
  // a rendered tab) and the trending-chip handler below (which sets the
  // active tab before the results/tabs row has even mounted — see the
  // effect that re-runs this once layout becomes available).
  const scrollTabIntoView = useCallback((tabKey: string) => {
    const tabIndex = tabs.findIndex((t) => t.key === tabKey);
    const layout = tabLayouts.current[tabKey];
    const visibleWidth = tabBarVisibleWidth.current;
    if (tabIndex === -1 || !layout || !visibleWidth) return;
    const targetX =
      tabIndex === 0
        ? 0
        : tabIndex === tabs.length - 1
          ? 99999
          : layout.x - visibleWidth / 2 + layout.width / 2;
    tabScrollRef.current?.scrollTo({ x: Math.max(0, targetX), animated: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabPress = (tabKey: string, _tabIndex: number) => {
    setActiveTab(tabKey as any);
    scrollTabIntoView(tabKey);
  };

  // Trending chips can set the active tab before the tab row exists yet
  // (tapped from the empty state, before any search has run) — once real
  // results land and the tab row mounts, catch up and slide it into view.
  useEffect(() => {
    if (!searchResults) return;
    const raf = requestAnimationFrame(() => scrollTabIntoView(activeTab));
    return () => cancelAnimationFrame(raf);
  }, [searchResults, activeTab, scrollTabIntoView]);

  const handleTrendingPress = (entry: TrendingEntry) => {
    trackFeature("search", "trending_chip", "search", {
      subcategory: entry.subcategoryName,
    });
    Keyboard.dismiss();
    setQuery(entry.subcategoryName);
    setThrottledQuery(entry.subcategoryName);
    setActiveTab("products");
  };

  const handleTouchEnd = (e: any) => {
    const diff = touchStartX.current - e.nativeEvent.pageX;
    if (Math.abs(diff) < 50) return;
    const currentIndex = tabs.findIndex((t) => t.key === activeTab);
    if (diff > 0 && currentIndex < tabs.length - 1)
      setActiveTab(tabs[currentIndex + 1].key as any);
    if (diff < 0 && currentIndex > 0)
      setActiveTab(tabs[currentIndex - 1].key as any);
  };

  const PostCard = ({ result }: { result: SearchResult }) => (
    <TouchableOpacity
      onPress={() => handleResultPress(result)}
      className="mb-3"
      activeOpacity={0.7}
    >
      <View
        style={{ borderRadius: 8, borderCurve: "continuous" }} className="bg-white overflow-hidden border border-gray-100">
        {result.imageUrl && (
          <ProgressiveImage
            uri={result.imageUrl}
            style={{ width: "100%", height: 128 }}
            showProgress={false}
            recyclingKey={result.id}
          />
        )}
        <View className={result.imageUrl ? "p-2.5" : "p-3"}>
          <Text
            className="text-xs font-semibold text-gray-900"
            numberOfLines={1}
          >
            {result.title}
          </Text>
          {result.subtitle && (
            <Text
              className="text-xs text-gray-500 mt-1.5"
              numberOfLines={result.imageUrl ? 2 : 4}
            >
              {result.subtitle}
            </Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const SearchResultItem = ({
    result,
    showTypeTag = false,
  }: {
    result: SearchResult;
    showTypeTag?: boolean;
  }) => {
    const isUser = result.type === "user";
    const typeColors: Record<string, string> = {
      user: "bg-blue-100 text-blue-700",
      service: "bg-purple-100 text-purple-700",
      product: "bg-green-100 text-green-700",
      marketplace: "bg-orange-100 text-orange-700",
      post: "bg-pink-100 text-pink-700",
    };
    const typeLabels: Record<string, string> = {
      user: "User",
      service: "Service",
      product: "Product",
      marketplace: "Marketplace",
      post: "Post",
    };
    const typeIcons: Record<string, string> = {
      user: "person",
      service: "construct",
      product: "pricetag",
      marketplace: "storefront",
      post: "chatbubble",
    };

    return (
      <TouchableOpacity
        style={{ borderRadius: 8, borderCurve: "continuous" }}
        onPress={() => handleResultPress(result)}
        className="flex-row items-center bg-white p-3 mb-2 border border-gray-100"
        activeOpacity={0.7}
      >
        <View
          className={`w-14 h-14 ${isUser ? "rounded-full" : "rounded-lg"} bg-gray-200 overflow-hidden mr-3`}
        >
          {result.imageUrl ? (
            <ProgressiveImage
              uri={result.imageUrl}
              style={{ width: "100%", height: "100%" }}
              showProgress={false}
              recyclingKey={result.id}
            />
          ) : (
            <View className="w-full h-full items-center justify-center bg-gray-300">
              <Ionicons
                name={typeIcons[result.type] as any}
                size={24}
                color="#9CA3AF"
              />
            </View>
          )}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text
              className="text-base font-semibold text-gray-900 flex-1"
              numberOfLines={1}
            >
              {highlightMatch(result.title, throttledQuery)}
            </Text>
            {showTypeTag && (
              <View
                className={`ml-2 px-2 py-0.5 rounded-full ${typeColors[result.type] ?? "bg-gray-100 text-gray-700"}`}
              >
                <Text
                  className={`text-xs font-medium ${typeColors[result.type] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {typeLabels[result.type] ?? ""}
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
        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: "#f8f9fa", paddingTop: insets.top }}
    >
      {/* Header — same bg, height, and horizontal padding as TopNavbar's own
          header row, and the same white/rounded-full pill as its expand
          animation, so landing here reads as a continuation of that
          transition rather than a hand-off to a different screen. */}
      <View
        className="flex-row items-center"
        style={{
          height: contentHeight,
          paddingTop: topSpacing,
          paddingHorizontal: horizontalPadding,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginRight: 12 }}
        >
          <ChevronLeft size={24} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#fff",
            borderRadius: 999,
            borderCurve: "continuous",
            paddingHorizontal: 12,
            height: contentHeight * 0.82,
          }}
        >
          <Ionicons name="search" size={16} color="#888" />
          <TextInput
            ref={inputRef}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 14,
              color: "#111",
              paddingVertical: 0,
            }}
            placeholder="Search users, services, products..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={handleSubmitSearch}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onTouchStart={(e) => {
          touchStartX.current = e.nativeEvent.pageX;
        }}
        onTouchEnd={handleTouchEnd}
      >
        {/* Searching indicator */}
        {isSearching && (
          <View className="py-8 items-center">
            <CircularLoader size="large" color="#094569" />
            <Text className="text-gray-500 mt-2">Searching...</Text>
          </View>
        )}

        {/* Empty prompt */}
        {!isSearching && !searchResults && throttledQuery.length === 0 && (
          <View className="py-16 items-center">
            <Ionicons name="search" size={48} color="#9CA3AF" />
            <Text className="text-gray-500 mt-4 text-center px-6">
              Search for users, services, products, marketplace items, or posts
            </Text>

            {recentSearches.length > 0 && (
              <View style={{ marginTop: 28, width: "100%" }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: "#9CA3AF",
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                    }}
                  >
                    Recent Searches
                  </Text>
                  <TouchableOpacity onPress={handleClearRecents} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#094569" }}>
                      Clear all
                    </Text>
                  </TouchableOpacity>
                </View>
                {recentSearches.map((term) => (
                  <View
                    key={term}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => runSearch(term)}
                      activeOpacity={0.7}
                      style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
                    >
                      <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                      <Text
                        style={{ flex: 1, marginLeft: 10, fontSize: 14, color: "#374151" }}
                        numberOfLines={1}
                      >
                        {term}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRemoveRecent(term)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={16} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {trending.length > 0 && (
              <View style={{ marginTop: 28, width: "100%" }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: "#9CA3AF",
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    textAlign: "center",
                    marginBottom: 10,
                  }}
                >
                  Trending
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "center",
                    gap: 8,
                    paddingHorizontal: 16,
                  }}
                >
                  {trending.map((entry) => (
                    <TouchableOpacity
                      key={`${entry.categoryKey}-${entry.subcategoryName}`}
                      onPress={() => handleTrendingPress(entry)}
                      activeOpacity={0.8}
                      className="px-3.5 py-2 rounded-full bg-gray-100 flex-row items-center gap-1.5"
                    >
                      <Ionicons name="trending-up" size={12} color="#094569" />
                      <Text className="text-sm font-medium text-gray-700 capitalize">
                        {entry.subcategoryName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Too short */}
        {!isSearching &&
          throttledQuery.length > 0 &&
          throttledQuery.length < 2 && (
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

        {/* Results with tabs */}
        {!isSearching && searchResults && throttledQuery.length >= 2 && (
          <>
            <ScrollView
              ref={tabScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-3 mb-3"
              contentContainerStyle={{ paddingHorizontal: 4 }}
              onLayout={(e) => {
                tabBarVisibleWidth.current = e.nativeEvent.layout.width;
              }}
            >
              {tabs.map((tab, index) => {
                const count = getTabCount(tab.key);
                const isActive = activeTab === tab.key;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => handleTabPress(tab.key, index)}
                    onLayout={(e) => {
                      tabLayouts.current[tab.key] = {
                        x: e.nativeEvent.layout.x,
                        width: e.nativeEvent.layout.width,
                      };
                    }}
                    className={`mr-2 px-4 py-2 rounded-full flex-row items-center ${
                      isActive
                        ? "bg-primary"
                        : "bg-white border border-gray-200"
                    }`}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={tab.icon as any}
                      size={16}
                      color={isActive ? "white" : "#6B7280"}
                    />
                    <Text
                      className={`ml-1.5 text-sm font-msemibold ${isActive ? "text-white" : "text-gray-700"}`}
                    >
                      {tab.label}
                    </Text>
                    {count > 0 && (
                      <View
                        className={`ml-1.5 px-1.5 py-0.5 rounded-full min-w-[18px] items-center ${isActive ? "bg-white/20" : "bg-gray-200"}`}
                      >
                        <Text
                          className={`text-xs font-semibold ${isActive ? "text-white" : "text-gray-600"}`}
                        >
                          {count}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {activeTab === "all" ? (
              getFilteredResults().length > 0 ? (
                (() => {
                  const posts = getFilteredResults().filter(
                    (r) => r.type === "post",
                  );
                  const others = getFilteredResults().filter(
                    (r) => r.type !== "post",
                  );
                  return (
                    <>
                      {others.map((result) => (
                        <SearchResultItem
                          key={result.id}
                          result={result}
                          showTypeTag
                        />
                      ))}
                      {posts.length > 0 && (
                        <>
                          {others.length > 0 && (
                            <View className="border-t border-gray-200 my-4" />
                          )}
                          <View className="flex-row flex-wrap justify-between">
                            {posts.map((result) => (
                              <View key={result.id} style={{ width: "48%" }}>
                                <PostCard result={result} />
                              </View>
                            ))}
                          </View>
                        </>
                      )}
                    </>
                  );
                })()
              ) : (
                <View className="py-8 items-center">
                  <Ionicons name="search-outline" size={48} color="#9CA3AF" />
                  <Text className="text-gray-500 mt-4 text-center">
                    No results found for &quot;{throttledQuery}&quot;
                  </Text>
                  <Text className="text-gray-400 mt-2 text-center text-sm">
                    Try different keywords
                  </Text>
                </View>
              )
            ) : getFilteredResults().length > 0 ? (
              getFilteredResults().map((result) => (
                <SearchResultItem key={result.id} result={result} />
              ))
            ) : (
              <View className="py-8 items-center">
                <Ionicons name="search-outline" size={48} color="#9CA3AF" />
                <Text className="text-gray-500 mt-4 text-center">
                  No {activeTab} found for &quout;{throttledQuery}&quot;
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}
