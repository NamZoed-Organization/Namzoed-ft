// Path: app/(users)/index.tsx

import Banner from "@/components/Banner";
import ClosingSaleBanner from "@/components/ClosingSaleBanner";
import { CARD_LIST_HEIGHT, ForYouSection } from "@/components/ForYou";
import FeedGrid from "@/components/FeedGrid";
import HomeCard from "@/components/HomeCard";
import SearchBar from "@/components/modals/SearchBar";
import { isVideoUrl, PostGridCardSourceRect } from "@/components/PostGridCard";
import PostDetailOverlay from "@/components/PostDetailOverlay";
import ReelsViewer from "@/components/ReelsViewer";
import CircularLoader from "@/components/ui/CircularLoader";
import TopNavbar from "@/components/ui/TopNavbar";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { SortOrder, useForYouData } from "@/hooks/useForYouData";
import { useFilteredFeedPosts } from "@/hooks/useFilteredFeedPosts";
import { useLivestreams } from "@/hooks/useLivestreams";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import { Product } from "@/lib/productsService";
import { VideoReel } from "@/lib/postsService";
import { PostData } from "@/types/post";
import { useAppRouter } from "@/utils/navigation";
import {
  ArrowUpDown,
  Briefcase,
  Eye,
  Radio,
  Tv2,
  Video,
} from "lucide-react-native";
import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  InteractionManager,
  ListRenderItem,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabType = "foryou" | "featured" | "live" | "bidding" | "norbu";
type LiveFilter = "all" | "business" | "entertainment";

type PageItem =
  | { key: "banner" }
  | { key: "tabs" }
  | { key: "closing-sale" }
  | { key: "flash-deals" }
  | { key: "feed-posts" }
  | { key: "featured" }
  | { key: "live" }
  | { key: "coming-soon"; label: string }
  | { key: "footer" };

const SectionLoadingPlaceholder = React.memo(
  function SectionLoadingPlaceholder() {
    return (
      <View style={{ marginTop: 16, marginBottom: 24 }}>
        {/* Title skeleton */}
        <View
          style={{
            height: 12,
            width: 80,
            backgroundColor: "#e5e7eb",
            borderRadius: 6,
            marginBottom: 12,
            marginLeft: 16,
          }}
        />
        {/* Card skeletons */}
        <View style={{ flexDirection: "row", paddingLeft: 16 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                width: 130,
                height: 200,
                borderRadius: 14,
                backgroundColor: "#e5e7eb",
                marginRight: 10,
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: "100%",
                  height: 95,
                  backgroundColor: "#d1d5db",
                }}
              />
              <View style={{ padding: 8, gap: 5 }}>
                <View
                  style={{
                    height: 9,
                    width: "80%",
                    backgroundColor: "#d1d5db",
                    borderRadius: 4,
                  }}
                />
                <View
                  style={{
                    height: 9,
                    width: "50%",
                    backgroundColor: "#d1d5db",
                    borderRadius: 4,
                  }}
                />
                <View
                  style={{
                    height: 9,
                    width: "60%",
                    backgroundColor: "#d1d5db",
                    borderRadius: 4,
                  }}
                />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  },
);

const TabContentLoadingState = React.memo(function TabContentLoadingState({
  label,
}: {
  label: string;
}) {
  return (
    <View className="min-h-96 justify-center items-center px-6 py-12">
      <CircularLoader size="small" color="#094569" />
      <Text className="text-sm text-gray-500 mt-3">
        Loading {label.toLowerCase()}...
      </Text>
    </View>
  );
});

// ─── Memoised home tabs (RedNote-style left-aligned text navbar) ──────────────
const HomeTabs = React.memo(function HomeTabs({
  activeTab,
  onTabPress,
}: {
  activeTab: TabType;
  onTabPress: (tab: TabType) => void;
}) {
  const tabs: { key: TabType; label: string }[] = [
    { key: "foryou", label: "For You" },
    { key: "featured", label: "Featured" },
    { key: "live", label: "Live" },
    { key: "norbu", label: "Norbu" },
    { key: "bidding", label: "Bidding" },
  ];

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "center",
        gap: 18,
        marginTop: 12,
      }}
    >
      {tabs.map(({ key, label }) => {
        const isActive = activeTab === key;
        return (
          <TouchableOpacity key={key} onPress={() => onTabPress(key)}>
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
  );
});

// ─── Live tab ─────────────────────────────────────────────────────────────────
const LiveTab = React.memo(function LiveTab({
  onOpen,
}: {
  onOpen: (streamId: string) => void;
}) {
  const { livestreams, loading } = useLivestreams();
  const [filter, setFilter] = useState<LiveFilter>("all");

  const filtered =
    filter === "all"
      ? livestreams
      : livestreams.filter((s) => s.stream_type === filter);

  return (
    <View className="mt-4 px-4">
      <View className="flex-row gap-2 mb-4">
        {(["all", "business", "entertainment"] as LiveFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            activeOpacity={0.75}
            className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full ${
              filter === f ? "bg-primary" : "bg-white border border-gray-200"
            }`}
          >
            {f === "all" && (
              <Radio size={13} color={filter === f ? "white" : "#6B7280"} />
            )}
            {f === "business" && (
              <Briefcase size={13} color={filter === f ? "white" : "#6B7280"} />
            )}
            {f === "entertainment" && (
              <Tv2 size={13} color={filter === f ? "white" : "#6B7280"} />
            )}
            <Text
              className={`text-xs font-semibold ${filter === f ? "text-white" : "text-gray-500"}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View className="min-h-64 justify-center items-center">
          <CircularLoader size="small" color="#094569" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="min-h-64 justify-center items-center px-6">
          <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-4">
            <Video size={28} color="#EF4444" />
          </View>
          <Text className="text-base font-semibold text-gray-700">
            No live streams right now
          </Text>
          <Text className="text-sm text-gray-400 mt-1 text-center">
            Be the first to go live!
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {filtered.map((stream) => (
            <TouchableOpacity
              key={stream.id}
              onPress={() => onOpen(stream.id)}
              activeOpacity={0.85}
              style={{ width: "47%" }}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100"
            >
              <View className="w-full bg-gray-100" style={{ height: 110 }}>
                {stream.thumbnail || stream.profile_image ? (
                  <Image
                    source={{
                      uri:
                        (stream.thumbnail || stream.profile_image) ?? undefined,
                    }}
                    className="w-full h-full"
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <View className="w-full h-full bg-primary/10 items-center justify-center">
                    <Text className="text-primary font-bold text-3xl">
                      {(stream.username ?? "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View
                  className="absolute top-2 left-2 bg-red-500 rounded px-1.5 py-0.5"
                  style={{ borderWidth: 1, borderColor: "white" }}
                >
                  <Text className="text-white text-[9px] font-black">LIVE</Text>
                </View>
                <View className="absolute bottom-2 right-2 bg-black/50 rounded-full px-2 py-0.5 flex-row items-center gap-1">
                  <Eye size={10} color="white" />
                  <Text className="text-white text-[9px] font-semibold">
                    {stream.viewer_count ?? 0}
                  </Text>
                </View>
              </View>
              <View className="px-2.5 py-2 flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-full bg-primary items-center justify-center">
                  <Text className="text-white font-bold text-xs">
                    {(stream.username ?? "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text
                    className="text-xs font-semibold text-gray-800"
                    numberOfLines={1}
                  >
                    {stream.username ?? "Unknown"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { onTabBarScroll } = useTabBarScroll();
  const router = useAppRouter();
  const { trackTap, trackFeature } = useScreenAnalytics(Screens.HOME);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("foryou");
  const [renderedTab, setRenderedTab] = useState<TabType>("foryou");
  const [isTabContentPending, setIsTabContentPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showLive, setShowLive] = useState(false);
  const [FeaturedSellersComponent, setFeaturedSellersComponent] =
    useState<React.ComponentType | null>(null);
  const [liveStreamId, setLiveStreamId] = useState<string | undefined>();
  const [LiveScrollScreen, setLiveScrollScreen] = useState<React.ComponentType<{
    initialStreamId?: string;
    onClose: () => void;
  }> | null>(null);
  const [liveScreenLoading, setLiveScreenLoading] = useState(false);
  // Tapping a video card in the "For You" grid opens the fullscreen reels
  // player directly instead of the post-detail screen.
  const [reelsVisible, setReelsVisible] = useState(false);
  const [reelsInitial, setReelsInitial] = useState<VideoReel[]>([]);
  const [reelsIndex, setReelsIndex] = useState(0);
  const [reelsSourceRect, setReelsSourceRect] = useState<PostGridCardSourceRect | null>(null);
  // Tapping a (non-video) card morphs it into the full post-detail view —
  // see PostDetailOverlay — instead of a plain navigation push.
  const [postDetailVisible, setPostDetailVisible] = useState(false);
  const [postDetailPost, setPostDetailPost] = useState<PostData | null>(null);
  const [postDetailRect, setPostDetailRect] = useState<PostGridCardSourceRect | null>(null);

  useEffect(() => {
    if (showLive && !LiveScrollScreen && !liveScreenLoading) {
      setLiveScreenLoading(true);
      import("@/components/livestream/LiveScrollScreen")
        .then((m) => {
          setLiveScrollScreen(() => m.default);
          setLiveScreenLoading(false);
        })
        .catch(() => setLiveScreenLoading(false));
    }
  }, [showLive, LiveScrollScreen, liveScreenLoading]);

  useEffect(() => {
    if (activeTab === renderedTab) {
      setIsTabContentPending(false);
      return;
    }

    let cancelled = false;
    setIsTabContentPending(true);

    const task = InteractionManager.runAfterInteractions(() => {
      const loadTabDependencies = async () => {
        if (activeTab === "featured" && !FeaturedSellersComponent) {
          const module = await import("@/components/FeaturedSellers");
          if (!cancelled) {
            setFeaturedSellersComponent(() => module.default);
          }
        }
      };

      loadTabDependencies()
        .catch((error) => {
          console.error("Failed to prepare tab content:", error);
        })
        .finally(() => {
          if (cancelled) return;
          startTransition(() => {
            setRenderedTab(activeTab);
            setIsTabContentPending(false);
          });
        });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [activeTab, renderedTab, FeaturedSellersComponent]);

  const {
    loading,
    isClosingSaleTime,
    sortOrder,
    showSortMenu,
    toggleSortMenu,
    selectSort,
    getSortLabel,
    closingSaleFoodItems,
    discountedProducts,
    reload,
  } = useForYouData();

  const {
    posts: feedPosts,
    loading: feedLoading,
    loadingMore: feedLoadingMore,
    loadMore: loadMoreFeedPosts,
    hasMore: feedHasMore,
    refresh: refreshFeedPosts,
  } = useFilteredFeedPosts();

  const onPostPress = useCallback(
    (postId: string, rect: PostGridCardSourceRect) => {
      const post = feedPosts.find((p) => p.id === postId);
      const videoUrls = (post?.images || []).filter(isVideoUrl);
      if (post && videoUrls.length > 0) {
        const reels: VideoReel[] = videoUrls.map((uri, i) => ({
          id: `${post.id}::${i}`,
          uri,
          postId: String(post.id),
          userId: String(post.userId),
          username: post.username || "Unknown",
          avatarUrl: post.profilePic ?? null,
          content: post.content || "",
          createdAt: (post.date instanceof Date ? post.date : new Date(post.date)).toISOString(),
        }));
        setReelsInitial(reels);
        setReelsIndex(0);
        setReelsSourceRect(rect);
        setReelsVisible(true);
        return;
      }
      if (post) {
        setPostDetailPost(post);
        setPostDetailRect(rect);
        setPostDetailVisible(true);
        return;
      }
      router.push(`/(users)/post/${postId}` as any);
    },
    [router, feedPosts],
  );

  const handleTabPress = useCallback((tab: TabType) => {
    trackFeature("sort_change", "home_sort_chip", "tap", { sort: tab });
    setActiveTab(tab);
  }, [trackFeature]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    await Promise.all([reload(), refreshFeedPosts()]);
    setRefreshing(false);
  }, [reload, refreshFeedPosts]);

  // ─── Stable card render callbacks ────────────────────────────────────────

  const renderClosingSaleCard = useCallback(
    (item: Product) => {
      const dp = item.discount_percent
        ? item.price - (item.price * item.discount_percent) / 100
        : item.price;
      return (
        <HomeCard
          imageUrl={item.images[0] || ""}
          title={item.name}
          subtitle="FOOD"
          price={`Nu. ${dp.toLocaleString()}`}
          discountPercent={item.discount_percent}
          isClosingSale
          profileImage={(item as any).profiles?.avatar_url}
          profileName={(item as any).profiles?.name}
          isVerified={(item as any).isVerified}
          onPress={() => router.push(`/(users)/product/${item.id}` as any)}
        />
      );
    },
    [router],
  );

  const renderFlashDealCard = useCallback(
    (product: Product) => (
      <HomeCard
        imageUrl={product.images[0] || ""}
        title={product.name}
        subtitle={product.category?.toUpperCase() || "PRODUCT"}
        price={
          product.current_price && product.current_price > 0
            ? `Nu. ${product.current_price}`
            : undefined
        }
        discountPercent={product.discount_percent}
        isClosingSale={false}
        profileImage={(product as any).profiles?.avatar_url}
        profileName={(product as any).profiles?.name}
        isVerified={(product as any).isVerified}
        onPress={() => router.push(`/(users)/product/${product.id}` as any)}
      />
    ),
    [router],
  );

  const goCategories = useCallback(
    () => router.push("/(users)/(tabs)/categories" as any),
    [router],
  );

  // ─── Flat items list ──────────────────────────────────────────────────────
  const hasFlashDeals = !loading && discountedProducts.length > 0;
  const items = useMemo<PageItem[]>(() => {
    // "banner" and "tabs" are always the first two items (in that order) so
    // their indices stay fixed for stickyHeaderIndices below — the banner
    // scrolls away normally, then the tabs row sticks to the top of the
    // list (right under the fixed header) once the banner scrolls past it.
    const result: PageItem[] = [{ key: "banner" }, { key: "tabs" }];
    switch (activeTab) {
      case "foryou":
        // Hidden for now — re-enable when Closing Sale is ready to ship again.
        // result.push({ key: "closing-sale" });
        if (hasFlashDeals) result.push({ key: "flash-deals" });
        result.push({ key: "feed-posts" });
        break;
      case "featured":
        result.push({ key: "featured" });
        break;
      case "live":
        result.push({ key: "live" });
        break;
      case "norbu":
        result.push({ key: "coming-soon", label: "Norbu Coin" });
        break;
      case "bidding":
        result.push({ key: "coming-soon", label: "Bidding" });
        break;
    }
    result.push({ key: "footer" });
    return result;
  }, [activeTab, hasFlashDeals]);

  // Use ref to always have latest data in renderItem without changing its reference
  const dataRef = useRef({
    loading,
    isClosingSaleTime,
    sortOrder,
    showSortMenu,
    closingSaleFoodItems,
    discountedProducts,
    activeTab,
    renderedTab,
    isTabContentPending,
    refreshKey,
    renderClosingSaleCard,
    renderFlashDealCard,
    goCategories,
    toggleSortMenu,
    selectSort,
    getSortLabel,
    FeaturedSellersComponent,
    feedPosts,
    feedLoading,
    feedLoadingMore,
    feedHasMore,
    onPostPress,
  });
  dataRef.current = {
    loading,
    isClosingSaleTime,
    sortOrder,
    showSortMenu,
    closingSaleFoodItems,
    discountedProducts,
    activeTab,
    renderedTab,
    isTabContentPending,
    refreshKey,
    renderClosingSaleCard,
    renderFlashDealCard,
    goCategories,
    toggleSortMenu,
    selectSort,
    getSortLabel,
    FeaturedSellersComponent,
    feedPosts,
    feedLoading,
    feedLoadingMore,
    feedHasMore,
    onPostPress,
  };

  const renderItem = useCallback<ListRenderItem<PageItem>>(
    ({ item }) => {
      const d = dataRef.current;
      const isCurrentTabReady =
        !d.isTabContentPending && d.renderedTab === d.activeTab;

      switch (item.key) {
        case "banner":
          return <Banner />;

        case "tabs":
          // Opaque background required: once stickied, this row paints over
          // whatever scrolls up underneath it.
          return (
            <View className="bg-background px-4" style={{ paddingBottom: 10 }}>
              <HomeTabs activeTab={d.activeTab} onTabPress={handleTabPress} />
            </View>
          );

        case "closing-sale":
          if (!isCurrentTabReady) {
            return <SectionLoadingPlaceholder />;
          }
          return (
            <View style={{ marginBottom: 16, paddingTop: 8 }}>
              {d.isClosingSaleTime ? (
                /* ── Connected: banner + cards share one bordered container ── */
                <View
                  style={{
                    marginHorizontal: 16,
                    borderWidth: 1.5,
                    borderColor: "#F59E0B",
                    borderRadius: 16,
                  }}
                >
                  {/* Top: gradient banner — clip only the top corners */}
                  <View
                    style={{
                      borderTopLeftRadius: 14,
                      borderTopRightRadius: 14,
                      overflow: "hidden",
                    }}
                  >
                    <ClosingSaleBanner
                      foodItems={d.closingSaleFoodItems}
                      connected
                    />
                  </View>

                  {/* Bottom: sort + cards — no background, shares the border */}
                  <View style={{ paddingBottom: 14 }}>
                    {d.closingSaleFoodItems.length > 0 ? (
                      <>
                        <View
                          style={{
                            paddingHorizontal: 14,
                            marginTop: 10,
                            marginBottom: 8,
                          }}
                        >
                          <TouchableOpacity
                            onPress={d.toggleSortMenu}
                            className="bg-white/90 px-3 py-2 rounded-xl shadow-sm border border-white/50 flex-row items-center self-start"
                            style={{ backgroundColor: "rgba(255,255,255,0.9)" }}
                          >
                            <ArrowUpDown size={16} color="#1F2937" />
                            <Text className="ml-1.5 text-xs font-semibold text-gray-700">
                              {d.getSortLabel(d.sortOrder)}
                            </Text>
                          </TouchableOpacity>
                          {d.showSortMenu && (
                            <View className="mt-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                              {(
                                [
                                  "latest",
                                  "oldest",
                                  "high_discount",
                                  "low_discount",
                                  "high_price",
                                  "low_price",
                                ] as SortOrder[]
                              ).map((sort) => (
                                <TouchableOpacity
                                  key={sort}
                                  onPress={() => d.selectSort(sort)}
                                  className={`p-3 border-b border-gray-100 ${d.sortOrder === sort ? "bg-primary/10" : ""}`}
                                >
                                  <Text
                                    className={`text-sm font-medium ${d.sortOrder === sort ? "text-primary" : "text-gray-700"}`}
                                  >
                                    {d.getSortLabel(sort)}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{
                            paddingLeft: 14,
                            paddingRight: 14,
                          }}
                          style={{ height: CARD_LIST_HEIGHT }}
                          bounces={false}
                          overScrollMode="never"
                          decelerationRate="fast"
                        >
                          {d.closingSaleFoodItems.map((c) => (
                            <View key={c.id}>{d.renderClosingSaleCard(c)}</View>
                          ))}
                        </ScrollView>
                      </>
                    ) : (
                      <View
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 20,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "600",
                            color: "#9CA3AF",
                          }}
                        >
                          No items on sale right now
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                /* ── Dormant: standalone banner, no connected border ── */
                <ClosingSaleBanner foodItems={d.closingSaleFoodItems} />
              )}
            </View>
          );

        case "flash-deals":
          if (!isCurrentTabReady) {
            return <SectionLoadingPlaceholder />;
          }
          return (
            <ForYouSection
              title="🔥 Flash Deals"
              items={d.discountedProducts}
              loading={d.loading}
              renderCard={d.renderFlashDealCard}
              viewAllRoute="/(users)/(tabs)/categories"
              onViewAll={d.goCategories}
            />
          );

        case "feed-posts":
          if (!isCurrentTabReady) {
            return <SectionLoadingPlaceholder />;
          }
          return (
            <FeedGrid
              posts={d.feedPosts}
              loading={d.feedLoading || d.feedLoadingMore}
              onPostPress={d.onPostPress}
            />
          );

        case "featured": {
          if (!isCurrentTabReady || !d.FeaturedSellersComponent) {
            return <TabContentLoadingState label="Featured sellers" />;
          }
          const FeaturedSellers = d.FeaturedSellersComponent;
          return (
            <View className="mt-2 px-4">
              <FeaturedSellers key={`featured-${d.refreshKey}`} />
            </View>
          );
        }

        case "live":
          if (!isCurrentTabReady) {
            return <TabContentLoadingState label="Live streams" />;
          }
          return (
            <LiveTab
              onOpen={(id) => {
                trackTap("live_card", "live_stream_join", { stream_id: id });
                setLiveStreamId(id);
                setShowLive(true);
              }}
            />
          );

        case "coming-soon":
          if (!isCurrentTabReady) {
            return <TabContentLoadingState label={item.label} />;
          }
          return (
            <View className="mt-6 min-h-96 justify-center items-center">
              <Text className="text-base font-semibold text-primary mb-2">
                {item.label} (Coming Soon)
              </Text>
            </View>
          );

        default:
          return null;
      }
    },
    [handleTabPress],
  );
  // renderItem is intentionally stable — it reads live data via dataRef

  const handleFeedEndReached = useCallback(() => {
    const d = dataRef.current;
    if (d.activeTab === "foryou" && d.feedHasMore && !d.feedLoading && !d.feedLoadingMore) {
      loadMoreFeedPosts();
    }
  }, [loadMoreFeedPosts]);

  return (
    <>
      {/* Fixed header — TopNavbar + search trigger never scroll away. The
          banner (data index 0) and tabs row (index 1) live inside the
          FlatList itself: the banner scrolls normally, then the tabs row
          sticks to the top of the list via stickyHeaderIndices below. */}
      <View className="bg-background">
        <TopNavbar />
        <View className="px-4" style={{ paddingBottom: 8 }}>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        </View>
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        stickyHeaderIndices={[1]}
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 72 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        onScroll={onTabBarScroll}
        scrollEventThrottle={16}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        removeClippedSubviews={true}
        overScrollMode="never"
        bounces={true}
        onEndReached={handleFeedEndReached}
        onEndReachedThreshold={0.5}
        extraData={`${activeTab}-${renderedTab}-${isTabContentPending}-${refreshKey}-${feedPosts.length}-${feedLoading}-${feedLoadingMore}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#094569"]}
            tintColor="#094569"
          />
        }
      />

      {showLive && (
        <Modal
          visible={showLive}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowLive(false)}
        >
          {LiveScrollScreen ? (
            <LiveScrollScreen
              initialStreamId={liveStreamId}
              onClose={() => setShowLive(false)}
            />
          ) : (
            <View className="flex-1 bg-black items-center justify-center">
              <CircularLoader size="large" color="white" />
            </View>
          )}
        </Modal>
      )}

      <ReelsViewer
        visible={reelsVisible}
        initialReels={reelsInitial}
        initialIndex={reelsIndex}
        sourceRect={reelsSourceRect}
        onClose={() => setReelsVisible(false)}
      />

      <PostDetailOverlay
        visible={postDetailVisible}
        post={postDetailPost}
        sourceRect={postDetailRect}
        onClose={() => setPostDetailVisible(false)}
      />
    </>
  );
}
