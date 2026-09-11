// Path: app/(users)/index.tsx

import {
  FILTER_ROW_GAP,
  FILTER_ROW_INSET,
  FILTER_ROW_VERTICAL,
} from "@/constants/theme";
import Banner from "@/components/Banner";
import ClosingSaleBanner from "@/components/ClosingSaleBanner";
import { CARD_LIST_HEIGHT, ForYouSection } from "@/components/ForYou";
import FeedGrid from "@/components/FeedGrid";
import HomeCard from "@/components/HomeCard";
import { isVideoUrl, PostGridCardSourceRect } from "@/components/PostGridCard";
import PostDetailOverlay from "@/components/PostDetailOverlay";
import ReelsViewer from "@/components/ReelsViewer";
import CircularLoader from "@/components/ui/CircularLoader";
import GridSkeleton from "@/components/ui/GridSkeleton";
import FollowedCreatorRow from "@/components/home/FollowedCreatorRow";
import Mascot from "@/components/ui/Mascot";
import HomeSectionTabs, { HomeSection } from "@/components/ui/HomeSectionTabs";
import TopNavbar from "@/components/ui/TopNavbar";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { SortOrder, useForYouData } from "@/hooks/useForYouData";
import { useFilteredFeedPosts } from "@/hooks/useFilteredFeedPosts";
import { useFollowedCreators } from "@/hooks/useFollowedCreators";
import { useFollowingFeedPosts } from "@/hooks/useFollowingFeedPosts";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import { Product } from "@/lib/productsService";
import { VideoReel } from "@/lib/postsService";
import { PostData } from "@/types/post";
import { useAppRouter } from "@/utils/navigation";
import { ArrowUpDown, UserPlus } from "lucide-react-native";
import React, {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  InteractionManager,
  ListRenderItem,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ReAnimated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabType = "foryou" | "featured" | "live";

type PageItem =
  | { key: "banner" }
  | { key: "closing-sale" }
  | { key: "flash-deals" }
  | { key: "feed-posts" }
  | { key: "featured" }
  | { key: "live" }
  | { key: "creator-row" }
  | { key: "following-posts" }
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
            borderCurve: "continuous",
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
                borderCurve: "continuous",
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
                    borderCurve: "continuous",
                  }}
                />
                <View
                  style={{
                    height: 9,
                    width: "50%",
                    backgroundColor: "#d1d5db",
                    borderRadius: 4,
                    borderCurve: "continuous",
                  }}
                />
                <View
                  style={{
                    height: 9,
                    width: "60%",
                    backgroundColor: "#d1d5db",
                    borderRadius: 4,
                    borderCurve: "continuous",
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
  variant = "grid",
}: {
  label: string;
  /** "grid" previews the incoming two-column layout (Featured/Live tabs);
   * "spinner" is for tabs with no grid to preview (Coming Soon). */
  variant?: "grid" | "spinner";
}) {
  if (variant === "grid") {
    return (
      <View className="px-4 pt-2">
        <GridSkeleton rows={2} />
      </View>
    );
  }
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
  ];

  return (
    // No spacing of its own: the box around this row is the shared one below
    // (FILTER_ROW_* in constants/theme.ts), and a margin here would be a
    // fifth number that only this tab has.
    <View
      style={{
        flexDirection: "row",
        justifyContent: "flex-start",
        alignItems: "center",
        gap: FILTER_ROW_GAP,
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
/**
 * Live, while it is away.
 *
 * The tab is not empty and it is not broken — it is a feature being rebuilt,
 * and "no live streams right now" said neither of those things. The
 * mongoose ascending says it better than a sentence can, and the sentence
 * under it is the joke's straight man.
 *
 * The streaming itself is untouched: going live from the "+" menu, the
 * player and everything behind them still exist. This is the *tab*, which
 * is what people look at when nothing is on.
 */
const LiveTab = React.memo(function LiveTab() {
  return (
    <View className="min-h-96 items-center justify-center px-10 pt-10">
      <Mascot mood="super" size={168} />
      <Text className="text-[19px] font-mbold text-gray-900 mt-4 text-center">
        Live is evolving into a higher being
      </Text>
      <Text className="text-sm text-gray-400 mt-2 text-center leading-5">
        It will be back, louder. Until then the feed is where everything is
        happening.
      </Text>
    </View>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { onTabBarScroll } = useTabBarScroll();
  const router = useAppRouter();
  const { trackFeature } = useScreenAnalytics(Screens.HOME);
  const [mainSection, setMainSection] = useState<HomeSection>("explore");
  const [activeTab, setActiveTab] = useState<TabType>("foryou");
  const [renderedTab, setRenderedTab] = useState<TabType>("foryou");
  const [isTabContentPending, setIsTabContentPending] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  // The tabs row (For You/Featured/...) is its own collapsing header,
  // decoupled from the FlatList's content — see the JSX below. It hides on
  // scroll-down and reappears on scroll-up (tabsTranslateY), and snaps back
  // to fully visible whenever the list is at/above its top — which is also
  // exactly when a pull-to-refresh can happen, so the tabs row always stays
  // put (rather than dragging along) while the list content underneath it
  // pulls down to reveal "refresh-indicator". 56 is a reasonable first-paint
  // guess (overwritten by onLayout below) so there's no visible jump on mount.
  const [tabsHeight, setTabsHeight] = useState(56);
  // Reanimated, not legacy Animated — same reasoning as TabBarScrollContext's
  // own pillScale (see that file): the decision of WHEN to hide/show still
  // happens on the JS thread (one cheap branch per scroll event, in
  // handleListScroll below), but the actual animation runs via withTiming
  // on the UI thread, immune to JS-thread contention from list rendering —
  // legacy Animated.timing here (with useNativeDriver: false, forced by
  // marginTop below not being native-driver-compatible) ran the WHOLE
  // animation on the JS thread instead, which is what made the hide/show
  // visibly lag behind the actual scroll gesture.
  const tabsTranslateY = useSharedValue(0);
  const lastListScrollYRef = useRef(0);
  // Custom pull-to-refresh — native RefreshControl only reports a before/
  // after boolean, not a live drag distance, and Android's own pull gesture
  // doesn't report one via onScroll either (only iOS's overscroll bounce
  // does), so there's no native way to fade the loader in AS you drag on
  // both platforms. This hand-rolled gesture (PanResponder, same technique
  // ContextDrop uses for its edge-swipe: capture on MOVE once the drag
  // clearly matches, not on initial touch, so plain scrolling/tapping is
  // unaffected) tracks the raw drag distance itself instead.
  const pullDistance = useRef(new Animated.Value(0)).current;
  const [isPulling, setIsPulling] = useState(false);
  const refreshingRef = useRef(false);
  const [showLive, setShowLive] = useState(false);
  const [FeaturedSellersComponent, setFeaturedSellersComponent] =
    useState<React.ComponentType | null>(null);
  // Nothing sets this while the Live tab is a placeholder; the viewer still
  // reads it, and opens on whatever is live when it is undefined.
  const [liveStreamId] = useState<string | undefined>();
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

  const {
    posts: followingPosts,
    loading: followingLoading,
    loadingMore: followingLoadingMore,
    hasMore: followingHasMore,
    hasFollows,
    loadMore: loadMoreFollowingPosts,
    refresh: refreshFollowingPosts,
  } = useFollowingFeedPosts();

  /**
   * The row of faces above the Following grid, and the dot on the Explore
   * header — one source for both (`hooks/useFollowedCreators.ts`).
   *
   * `null` is everybody, which is what the tab opens on: the row narrows a
   * feed that already works rather than being a gate in front of it.
   */
  const {
    creators,
    markSeen: markCreatorSeen,
    anyUnseen: anyCreatorUnseen,
    latest: latestCreator,
    refresh: refreshCreators,
  } = useFollowedCreators();
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);

  /**
   * Filtering is done on the posts already loaded.
   *
   * The Following feed is one chronological pool of everybody's posts, and
   * the newest of any one person is by definition near the top of it — so
   * the pool answers "their latest" without a second query, and the answer
   * arrives instantly instead of after a round trip. Scrolling loads more of
   * the same pool, so a quiet creator fills in as you go.
   */
  const shownFollowingPosts = useMemo(
    () =>
      selectedCreator
        ? followingPosts.filter((post) => post.userId === selectedCreator)
        : followingPosts,
    [followingPosts, selectedCreator],
  );

  const onSelectCreator = useCallback(
    (creatorId: string | null) => {
      setSelectedCreator(creatorId);
      // Opening somebody is what clears their dot — scrolling past one of
      // their posts in the mixed feed is a glance, not catching up.
      if (creatorId) markCreatorSeen(creatorId);
    },
    [markCreatorSeen],
  );

  const onPostPress = useCallback(
    (postId: string, rect: PostGridCardSourceRect) => {
      const post =
        feedPosts.find((p) => p.id === postId) ||
        followingPosts.find((p) => p.id === postId);
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
    [router, feedPosts, followingPosts],
  );

  const handleTabPress = useCallback((tab: TabType) => {
    trackFeature("sort_change", "home_sort_chip", "tap", { sort: tab });
    setActiveTab(tab);
  }, [trackFeature]);

  // Tabs row always starts fully visible when (re)entering Explore — avoids
  // landing mid-collapsed from whatever scroll position Following left it at.
  useEffect(() => {
    if (mainSection !== "explore") return;
    lastListScrollYRef.current = 0;
    tabsTranslateY.value = 0;
  }, [mainSection, tabsTranslateY]);

  const DIRECTION_THRESHOLD = 6;
  const handleListScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      onTabBarScroll(e);
      const y = e.nativeEvent.contentOffset.y;
      const delta = y - lastListScrollYRef.current;
      lastListScrollYRef.current = y;

      // At/above the top — also true throughout the custom pull-to-refresh
      // gesture below, since it disables the list's own scroll for its
      // duration — the tabs row always sits fully visible here so it never
      // drags along with the list content during that gesture.
      if (y <= 0) {
        tabsTranslateY.value = withTiming(0, { duration: 150 });
        return;
      }
      if (delta > DIRECTION_THRESHOLD) {
        tabsTranslateY.value = withTiming(-tabsHeight, { duration: 200 });
      } else if (delta < -DIRECTION_THRESHOLD) {
        tabsTranslateY.value = withTiming(0, { duration: 200 });
      }
    },
    [onTabBarScroll, tabsTranslateY, tabsHeight],
  );

  // Content's reserved top space shrinks in lockstep with the tabs row
  // hiding (tabsHeight + tabsTranslateY: tabsTranslateY is 0..-tabsHeight,
  // so this runs tabsHeight..0) so the content actually rises to fill the
  // gap as the tabs row slides away, instead of leaving it behind. A
  // useAnimatedStyle (not Animated.add) since tabsTranslateY is now a
  // Reanimated shared value — this still runs on the UI thread despite
  // marginTop being a layout prop, unlike legacy Animated's native driver
  // which can't touch layout props at all (that restriction is why this
  // used to have to be JS-driven).
  const contentMarginTopStyle = useAnimatedStyle(() => ({
    marginTop: mainSection === "explore" ? tabsHeight + tabsTranslateY.value : 0,
  }));
  const tabsRowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabsTranslateY.value }],
  }));

  const onRefresh = useCallback(async () => {
    refreshingRef.current = true;
    setRefreshKey((k) => k + 1);

    // Kick off every refresh at once, but only wait on whatever's actually
    // on screen right now — the loader clears the moment THAT'S ready
    // instead of sitting there until everything (including tabs/data the
    // user isn't even looking at) finishes. The rest keep loading silently
    // in the background and settle in whenever they're done.
    const reloadPromise = reload();
    const feedPromise = refreshFeedPosts();
    const followingPromise = refreshFollowingPosts();
    // The faces and their dots are read from the same pull: a refreshed
    // feed with a stale row would show a post whose author has no dot.
    const creatorsPromise = refreshCreators();

    // On "foryou", the feed grid is what actually dominates the screen —
    // Flash Deals (reloadPromise) is a small secondary row that updates
    // silently whenever it's ready, same as everything not currently in
    // view, rather than holding the loader up for it too.
    const visiblePromises: Promise<unknown>[] =
      mainSection === "following"
        ? [followingPromise, creatorsPromise]
        : activeTab === "foryou"
          ? [feedPromise]
          : []; // Featured/Live don't depend on any of these three

    await Promise.all(visiblePromises).catch(() => {});
    refreshingRef.current = false;

    Promise.all([
      reloadPromise,
      feedPromise,
      followingPromise,
      creatorsPromise,
    ]).catch(() => {});
  }, [
    reload,
    refreshFeedPosts,
    refreshFollowingPosts,
    refreshCreators,
    mainSection,
    activeTab,
  ]);

  // Pull-to-refresh gesture geometry — mirrors ContextDrop's own constants
  // in spirit (a small capture threshold, a larger commit threshold).
  const PULL_CAPTURE_DY = 6;
  const PULL_MAX = 90; // drag distance (px) mapped to a fully revealed loader
  const PULL_COMMIT_DY = 64; // drag distance needed at release to commit a refresh
  const REVEAL_HEIGHT = 56; // resting spacer height once committed — (56-24)/2 = 16px above/below the 24px loader, i.e. equal top/bottom space

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const settlePull = useCallback((toValue: number) => {
    Animated.spring(pullDistance, {
      toValue,
      useNativeDriver: false,
      friction: 7,
      tension: 70,
    }).start();
  }, [pullDistance]);

  const commitPull = useCallback(() => {
    Animated.timing(pullDistance, { toValue: PULL_MAX, duration: 100, useNativeDriver: false }).start();
    onRefreshRef.current().finally(() => settlePull(0));
  }, [pullDistance, settlePull]);

  const pullResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_evt, gesture) =>
        !refreshingRef.current &&
        lastListScrollYRef.current <= 0 &&
        gesture.dy > PULL_CAPTURE_DY &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        !refreshingRef.current &&
        lastListScrollYRef.current <= 0 &&
        gesture.dy > PULL_CAPTURE_DY &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setIsPulling(true);
      },
      onPanResponderMove: (_evt, gesture) => {
        pullDistance.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_evt, gesture) => {
        setIsPulling(false);
        if (gesture.dy >= PULL_COMMIT_DY) {
          commitPull();
        } else {
          settlePull(0);
        }
      },
      onPanResponderTerminate: () => {
        setIsPulling(false);
        settlePull(0);
      },
    }),
  ).current;

  const revealHeight = pullDistance.interpolate({
    inputRange: [0, PULL_MAX],
    outputRange: [0, REVEAL_HEIGHT],
    extrapolate: "clamp",
  });
  const loaderOpacity = pullDistance.interpolate({
    inputRange: [0, PULL_MAX * 0.4, PULL_MAX],
    outputRange: [0, 0.5, 1],
    extrapolate: "clamp",
  });

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
    if (mainSection === "following") {
      // The faces are their own item so they scroll away with the posts —
      // a row pinned above a grid is chrome, and this is a caption on what
      // follows.
      return [{ key: "creator-row" }, { key: "following-posts" }, { key: "footer" }];
    }
    // The tabs row (For You/Featured/...) is no longer a list item at all —
    // it's rendered as its own absolutely-positioned, collapsing header (see
    // the JSX below) so it can hide/show on scroll independently of the
    // FlatList's own content, and stay put while the pull-to-refresh gesture
    // drags the list content underneath it. The pull-to-refresh loading
    // state is its own dedicated reveal spacer (also below), not a list
    // item. Never hides/replaces existing content:
    // reload()/refreshFeedPosts()/refreshFollowingPosts() below all fetch in
    // the background and swap their data in once ready.
    const result: PageItem[] = [];
    switch (activeTab) {
      case "foryou":
        result.push({ key: "banner" });
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
    }
    result.push({ key: "footer" });
    return result;
  }, [mainSection, activeTab, hasFlashDeals]);

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
    mainSection,
    followingPosts,
    followingLoading,
    followingLoadingMore,
    followingHasMore,
    hasFollows,
    creators,
    selectedCreator,
    shownFollowingPosts,
    onSelectCreator,
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
    mainSection,
    followingPosts,
    followingLoading,
    followingLoadingMore,
    followingHasMore,
    hasFollows,
    creators,
    selectedCreator,
    shownFollowingPosts,
    onSelectCreator,
  };

  const renderItem = useCallback<ListRenderItem<PageItem>>(
    ({ item }) => {
      const d = dataRef.current;
      const isCurrentTabReady =
        !d.isTabContentPending && d.renderedTab === d.activeTab;

      switch (item.key) {
        case "banner":
          return <Banner />;

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
                    borderCurve: "continuous",
                  }}
                >
                  {/* Top: gradient banner — clip only the top corners */}
                  <View
                    style={{
                      borderTopLeftRadius: 14,
                      borderTopRightRadius: 14,
                      borderCurve: "continuous",
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
                            className="bg-white/90 px-3 py-2 shadow-sm border border-white/50 flex-row items-center self-start"
                            style={{ backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 12, borderCurve: "continuous" }}
                          >
                            <ArrowUpDown size={16} color="#1F2937" />
                            <Text className="ml-1.5 text-xs font-semibold text-gray-700">
                              {d.getSortLabel(d.sortOrder)}
                            </Text>
                          </TouchableOpacity>
                          {d.showSortMenu && (
                            <View
                              style={{ borderRadius: 12, borderCurve: "continuous" }} className="mt-2 bg-white shadow-lg border border-gray-200 overflow-hidden">
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
          // Nothing to wait for while the tab is a placeholder — a skeleton
          // in front of a fixed message is a wait for nothing.
          return <LiveTab />;

        case "creator-row":
          return (
            <FollowedCreatorRow
              creators={d.creators}
              selected={d.selectedCreator}
              onSelect={d.onSelectCreator}
            />
          );

        case "following-posts":
          if (!d.hasFollows) {
            if (d.followingLoading) {
              return (
                <View className="px-4 pt-6">
                  <GridSkeleton rows={2} />
                </View>
              );
            }
            return (
              <View className="mt-16 min-h-96 justify-center items-center px-8">
                <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
                  <UserPlus size={28} color="#094569" />
                </View>
                <Text className="text-base font-semibold text-gray-700 text-center">
                  No posts yet
                </Text>
                <Text className="text-sm text-gray-400 mt-1 text-center">
                  Follow people to see their posts here
                </Text>
              </View>
            );
          }
          // Nobody's posts have loaded for this creator yet — the pool is
          // chronological, so more of them are further down it.
          if (d.selectedCreator && d.shownFollowingPosts.length === 0) {
            return (
              <View className="mt-12 min-h-64 justify-center items-center px-8">
                <Text className="text-base font-semibold text-gray-700 text-center">
                  {d.followingLoading || d.followingLoadingMore
                    ? "Looking…"
                    : "Nothing from them yet"}
                </Text>
                <Text className="text-sm text-gray-400 mt-1 text-center">
                  Their posts will appear here as the feed loads.
                </Text>
              </View>
            );
          }
          return (
            <FeedGrid
              posts={d.shownFollowingPosts}
              loading={d.followingLoading || d.followingLoadingMore}
              onPostPress={d.onPostPress}
            />
          );

        default:
          return null;
      }
    },
    [],
  );
  // renderItem is intentionally stable — it reads live data via dataRef

  const handleFeedEndReached = useCallback(() => {
    const d = dataRef.current;
    if (d.mainSection === "following") {
      if (d.hasFollows && d.followingHasMore && !d.followingLoading && !d.followingLoadingMore) {
        loadMoreFollowingPosts();
      }
      return;
    }
    if (d.activeTab === "foryou" && d.feedHasMore && !d.feedLoading && !d.feedLoadingMore) {
      loadMoreFeedPosts();
    }
  }, [loadMoreFeedPosts, loadMoreFollowingPosts]);

  return (
    <>
      {/* Fixed header — TopNavbar never scrolls away. Search now lives in
          TopNavbar's own expanding search field, not a full-width bar here. */}
      <View className="bg-background">
        <TopNavbar
          centerContent={
            <HomeSectionTabs
              active={mainSection}
              onChange={setMainSection}
              // On Explore, Following is a face: whoever posted most
              // recently, with a dot when there is something unopened.
              followingAvatarUrl={latestCreator?.avatarUrl}
              followingUnseen={anyCreatorUnseen}
            />
          }
        />
      </View>

      <View style={{ flex: 1 }}>
        {/* Tabs row — its own collapsing header, absolutely positioned over
            the FlatList's reserved top padding (see contentMarginTopStyle
            below) rather than a list item. Hides on scroll-down, reappears on
            scroll-up, and always snaps back to visible at/above the list's
            top — including mid pull-to-refresh — so it never drags along
            with the content underneath it during that gesture.
            The outer View is a fixed-height, overflow:"hidden" clip — the
            inner Animated.View (the actual translateY) is unbounded/
            absolute, so without this clip sliding it up wouldn't hide it,
            it'd just keep moving upward past its own bounds and render over
            TopNavbar above it instead. */}
        {mainSection === "explore" && (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: tabsHeight,
              overflow: "hidden",
              zIndex: 10,
              elevation: 10,
            }}
          >
            <ReAnimated.View
              onLayout={(e) => setTabsHeight(e.nativeEvent.layout.height)}
              style={[
                {
                  // Inline instead of NativeWind's className — mixing
                  // className with an Animated `style.transform` on the same
                  // node is a known source of the transform silently not
                  // taking effect (NativeWind's resolved style can end up
                  // overriding/dropping it).
                  backgroundColor: "#f8f9fa",
                  paddingHorizontal: FILTER_ROW_INSET,
                  paddingTop: FILTER_ROW_VERTICAL,
                  paddingBottom: FILTER_ROW_VERTICAL,
                },
                tabsRowStyle,
              ]}
            >
              <HomeTabs activeTab={activeTab} onTabPress={handleTabPress} />
            </ReAnimated.View>
          </View>
        )}

        {/* Custom pull-to-refresh gesture — panHandlers live on the outer
            (legacy Animated, untouched) View, wrapping both the reveal
            spacer and the FlatList, so a qualifying drag (at the list's top,
            moving down) is captured before it reaches the FlatList's own
            scroll responder; anything else (a tap, a normal scroll, a
            horizontal drag) is left alone. The inner Reanimated View's own
            marginTop (contentMarginTopStyle) offsets this whole area below
            the (absolutely positioned, zIndex'd) tabs row, and shrinks in
            lockstep as that row slides away on scroll, so the content
            actually rises to fill the gap instead of leaving it behind. */}
        <Animated.View {...pullResponder.panHandlers} style={{ flex: 1 }}>
          <ReAnimated.View style={[{ flex: 1 }, contentMarginTopStyle]}>
            {/* Reveal spacer — grows with the live drag distance (fades the
                loader in as you pull) and springs to REVEAL_HEIGHT on a
                committed release, centering the loader with equal space
                above/below, or back to 0 if released early/cancelled. */}
            <Animated.View
              style={{
                height: revealHeight,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Animated.View style={{ opacity: loaderOpacity }}>
                <CircularLoader size="small" color="#094569" />
              </Animated.View>
            </Animated.View>

            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item) => item.key}
              className="flex-1 bg-background"
              contentContainerStyle={{
                paddingBottom: 72 + insets.bottom,
              }}
              showsVerticalScrollIndicator={false}
              onScroll={handleListScroll}
              scrollEventThrottle={16}
              scrollEnabled={!isPulling}
              windowSize={5}
              maxToRenderPerBatch={3}
              initialNumToRender={2}
              removeClippedSubviews={true}
              overScrollMode="never"
              bounces={false}
              onEndReached={handleFeedEndReached}
              onEndReachedThreshold={0.5}
              extraData={`${mainSection}-${activeTab}-${renderedTab}-${isTabContentPending}-${refreshKey}-${feedPosts.length}-${feedLoading}-${feedLoadingMore}-${followingPosts.length}-${followingLoading}-${followingLoadingMore}-${hasFollows}`}
            />
          </ReAnimated.View>
        </Animated.View>
      </View>

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
