import FeedPost, { PostSkeleton } from "@/components/FeedPost";
import { VideoErrorBoundary } from "@/components/VideoErrorBoundary";
import { useUser } from "@/contexts/UserContext";
import { useSafety } from "@/contexts/SafetyContext";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { useFeedInfiniteScroll } from "@/hooks/useFeedInfiniteScroll";
import { canViewContent } from "@/lib/contentClassifier";
import { getReportedPostIds } from "@/lib/reportService";
import { PostData } from "@/types/post";
import { useLocalSearchParams } from "expo-router";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    RefreshControl,
    Text,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AuthPromptModal from "@/components/modals/AuthPromptModal";
import OnboardingTutorial from "@/components/onboarding/OnboardingTutorial";
import StoriesBar from "@/components/stories/StoriesBar";
import { useLivestreams } from "@/hooks/useLivestreams";
import { useOnboardingTutorial } from "@/hooks/useOnboardingTutorial";
import { useStories } from "@/hooks/useStories";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import type { UserStoryGroup } from "@/lib/storiesService";
import { feedEvents } from "@/utils/feedEvents";

type CreatePostProps = { onClose?: () => void };
type StoryComposerProps = { onClose?: () => void };
type StoryViewerProps = {
  visible: boolean;
  onClose: () => void;
  storyGroups: UserStoryGroup[];
  initialGroupIndex: number;
  currentUserId?: string;
  onGroupSeen?: (userId: string) => void;
};

function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { onTabBarScroll } = useTabBarScroll();
  const { currentUser } = useUser();
  const { safeView, userAge, isAgeVerified } = useSafety();
  const { trackTap, trackFeature } = useScreenAnalytics(Screens.FEED);
  const { streamId: deepLinkedStreamId, storyUserId: deepLinkedStoryUserId } = useLocalSearchParams<{
    streamId?: string;
    storyUserId?: string;
  }>();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [CreatePostComponent, setCreatePostComponent] =
    useState<React.ComponentType<CreatePostProps> | null>(null);
  const [createPostLoading, setCreatePostLoading] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [liveRefreshKey, setLiveRefreshKey] = useState(0);
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const visiblePostIdRef = useRef<string | null>(null);
  const [reportedPostIds, setReportedPostIds] = useState<string[]>([]);
  const { getLivestreamForUser } = useLivestreams();

  // ── Stories ─────────────────────────────────────────────────────────────
  const {
    storyGroups,
    loading: storiesLoading,
    isUserSeen: isStoryUserSeen,
    markGroupSeen: markStoryGroupSeen,
    reload: reloadStories,
  } = useStories(currentUser?.id);
  const [showStoryComposer, setShowStoryComposer] = useState(false);
  const [StoryComposerComponent, setStoryComposerComponent] =
    useState<React.ComponentType<StoryComposerProps> | null>(null);
  const [storyComposerLoading, setStoryComposerLoading] = useState(false);
  const [viewingStoryGroups, setViewingStoryGroups] = useState<UserStoryGroup[] | null>(null);
  const [viewingGroupIndex, setViewingGroupIndex] = useState(0);
  const [StoryViewerComponent, setStoryViewerComponent] =
    useState<React.ComponentType<StoryViewerProps> | null>(null);
  const [storyViewerLoading, setStoryViewerLoading] = useState(false);

  useEffect(() => {
    if (showStoryComposer && !StoryComposerComponent && !storyComposerLoading) {
      setStoryComposerLoading(true);
      import("@/components/modals/StoryComposer")
        .then((m) => {
          setStoryComposerComponent(() => m.default);
          setStoryComposerLoading(false);
        })
        .catch((err) => {
          console.error("[Feed] Failed to load StoryComposer", err);
          setStoryComposerLoading(false);
        });
    }
  }, [showStoryComposer, StoryComposerComponent, storyComposerLoading]);

  useEffect(() => {
    if (viewingStoryGroups && !StoryViewerComponent && !storyViewerLoading) {
      setStoryViewerLoading(true);
      import("@/components/modals/StoryViewer")
        .then((m) => {
          setStoryViewerComponent(() => m.default);
          setStoryViewerLoading(false);
        })
        .catch((err) => {
          console.error("[Feed] Failed to load StoryViewer", err);
          setStoryViewerLoading(false);
        });
    }
  }, [viewingStoryGroups, StoryViewerComponent, storyViewerLoading]);

  const handleAddStory = useCallback(() => {
    trackFeature("story_add", "stories_bar", "tap");
    setShowStoryComposer(true);
  }, [trackFeature]);

  const handleOpenStory = useCallback(
    (_group: UserStoryGroup, index: number, allGroups: UserStoryGroup[]) => {
      trackFeature("story_view", "stories_bar", "tap");
      setViewingGroupIndex(index);
      setViewingStoryGroups(allGroups);
    },
    [trackFeature],
  );

  // ── Onboarding tutorial (first-time only) ──────────────────────────────
  const {
    hasUnseen,
    loading: tutorialLoading,
    markComplete,
  } = useOnboardingTutorial();
  const [showTutorial, setShowTutorial] = useState(false);
  const tutorialTriggeredRef = useRef(false);

  // Wait until the feed has loaded and the tutorial state is known,
  // then show the modal once for brand-new users.
  useEffect(() => {
    if (tutorialLoading || tutorialTriggeredRef.current || !currentUser) return;
    if (hasUnseen) {
      tutorialTriggeredRef.current = true;
      // Small delay so the feed renders first before the modal appears
      const timer = setTimeout(() => setShowTutorial(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [tutorialLoading, hasUnseen, currentUser]);

  // Infinite scroll hook — cursor-based pagination from Supabase
  const {
    posts: allPosts,
    loading: postsLoading,
    refreshing,
    hasMore,
    loadMore,
    refresh,
    removePost,
  } = useFeedInfiniteScroll();

  // Filter out reported posts and filter by moderation + user age
  const filteredPosts = useMemo(() => {
    let posts = allPosts;
    
    // Remove reported posts
    if (reportedPostIds.length > 0) {
      posts = posts.filter((post) => !reportedPostIds.includes(post.id));
    }

    // Filter by moderation status: only show approved posts or pending if user is admin
    posts = posts.filter((post) => {
      const moderationStatus = (post as any).moderationStatus || 'approved';
      // For now, only show approved posts. Admin view can show all.
      return moderationStatus === 'approved';
    });

    // Filter by content rating, the viewer's age, and their Safe View setting.
    // With Safe View ON (default) or for minors/unverified users, mature
    // (sensitive / 18+) posts are hidden entirely so they're never recommended.
    posts = posts.filter((post) => {
      const contentRating = (post as any).contentRating || 'general';
      return canViewContent(contentRating, userAge, isAgeVerified, safeView);
    });

    return posts;
  }, [allPosts, reportedPostIds, userAge, isAgeVerified, safeView]);

  // Dynamic import for LiveScrollScreen
  const [LiveScrollScreen, setLiveScrollScreen] = useState<React.ComponentType<{
    initialStreamId?: string;
    onClose: () => void;
    openCreateOnMount?: boolean;
    onRestore?: (streamId: string) => void;
  }> | null>(null);
  const [liveScreenLoading, setLiveScreenLoading] = useState(false);

  // Lazy-load composer so the route module stays a small sync graph (avoids
  // expo-router dev warning: default export undefined during circular require).
  useEffect(() => {
    if (showCreatePost && !CreatePostComponent && !createPostLoading) {
      setCreatePostLoading(true);
      import("@/components/modals/CreatePost")
        .then((m) => {
          setCreatePostComponent(() => m.default);
          setCreatePostLoading(false);
        })
        .catch((err) => {
          console.error("[Feed] Failed to load CreatePost", err);
          setCreatePostLoading(false);
        });
    }
  }, [showCreatePost, CreatePostComponent, createPostLoading]);

  // Dynamically import LiveScrollScreen only when user opens live
  useEffect(() => {
    if (showLive && !LiveScrollScreen && !liveScreenLoading) {
      setLiveScreenLoading(true);
      import("@/components/livestream/LiveScrollScreen")
        .then((module) => {
          setLiveScrollScreen(() => module.default);
          setLiveScreenLoading(false);
        })
        .catch((error) => {
          console.error("[FeedLive] Failed to import LiveScrollScreen", error);
          setLiveScreenLoading(false);
        });
    }
  }, [showLive, LiveScrollScreen, liveScreenLoading]);

  // Load reported posts from the current user
  useEffect(() => {
    if (currentUser?.id) {
      getReportedPostIds(currentUser.id)
        .then(setReportedPostIds)
        .catch((error) =>
          console.error("Error loading reported posts:", error),
        );
    }
  }, [currentUser?.id]);

  // Deep-link from notifications: /(users)/(tabs)/feed?streamId=xxx
  useEffect(() => {
    if (deepLinkedStreamId) {
      setSelectedStreamId(deepLinkedStreamId);
      setShowLive(true);
    }
  }, [deepLinkedStreamId]);

  // Deep-link from notifications: /(users)/(tabs)/feed?storyUserId=xxx
  // Stories are ephemeral (24h), so this waits for storyGroups to load and
  // silently no-ops if that user's story has since expired — no error, the
  // user just lands on the feed normally.
  const storyDeepLinkHandledRef = useRef(false);
  useEffect(() => {
    if (!deepLinkedStoryUserId || storyDeepLinkHandledRef.current) return;
    if (storiesLoading) return; // wait for the first load to resolve
    const index = storyGroups.findIndex((g) => g.userId === deepLinkedStoryUserId);
    storyDeepLinkHandledRef.current = true;
    if (index !== -1) {
      handleOpenStory(storyGroups[index], index, storyGroups);
    }
  }, [deepLinkedStoryUserId, storiesLoading, storyGroups, handleOpenStory]);

  const flatListRef = useRef<FlatList<PostData>>(null);

  const scrollToTop = useCallback((animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  // Handle pull to refresh
  const handleRefresh = useCallback(async () => {
    setLiveRefreshKey((prev) => prev + 1);
    await refresh();
  }, [refresh]);

  // Listen for double-tap events from the feed tab button
  const handleScrollToTop = useCallback(() => {
    scrollToTop(true);
    handleRefresh();
  }, [scrollToTop, handleRefresh]);

  useEffect(() => {
    feedEvents.on("scrollToTop", handleScrollToTop);
    return () => {
      feedEvents.off("scrollToTop", handleScrollToTop);
    };
  }, [handleScrollToTop]);

  // Listen for post deletion and report events
  useEffect(() => {
    const handlePostDeleted = (postId: string) => {
      removePost(postId);
    };

    const handlePostReported = (postId: string) => {
      setReportedPostIds((prev) => [...prev, postId]);
    };

    feedEvents.on("postDeleted", handlePostDeleted);
    feedEvents.on("postReported", handlePostReported);

    return () => {
      feedEvents.off("postDeleted", handlePostDeleted);
      feedEvents.off("postReported", handlePostReported);
    };
  }, [removePost]);

  // Handle end of list reached
  const handleEndReached = useCallback(() => {
    if (hasMore) {
      loadMore();
    }
  }, [hasMore, loadMore]);

  // TikTok-style viewability handler - only visible post gets to play videos
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    // Find the most visible item (the one that's 50%+ visible)
    const mostVisibleItem = viewableItems.find(
      (item: any) => item.isViewable && item.item && item.item.id,
    );

    if (mostVisibleItem) {
      const newVisiblePostId = mostVisibleItem.item.id;
      visiblePostIdRef.current = newVisiblePostId;
      setVisiblePostId(newVisiblePostId);
    } else {
      visiblePostIdRef.current = null;
      setVisiblePostId(null);
    }
  }, []);

  // Viewability config - item is considered visible when 50% is on screen
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 300,
  }).current;

  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged },
  ]).current;

  const renderPost = useCallback(
    ({ item }: { item: PostData }) => {
      const isVisible = visiblePostIdRef.current === item.id;
      const isAuthorLive = !!getLivestreamForUser(item.userId);

      return (
        <VideoErrorBoundary>
          <FeedPost
            post={item}
            isVisible={isVisible}
            isAuthorLive={isAuthorLive}
          />
        </VideoErrorBoundary>
      );
    },
    [getLivestreamForUser],
  );

  // Footer component for loading more posts
  const renderFooter = useCallback(() => {
    if (!postsLoading) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color="#1877F2" />
        <Text className="text-sm text-gray-500 mt-1">
          Loading more posts...
        </Text>
      </View>
    );
  }, [postsLoading]);

  const handleJoinLive = useCallback((stream: { id: string }) => {
    console.log("[FeedLive] handleJoinLive", { streamId: stream.id });
    trackFeature("live_stream_join", "live_card", "tap", { stream_id: stream.id });
    setSelectedStreamId(stream.id);
    setShowLive(true);
  }, [trackFeature]);

  const handleGoLive = useCallback(() => {
    console.log("[FeedLive] handleGoLive", {
      selectedStreamId: null,
      openCreateOnMount: true,
    });
    trackFeature("live_stream_start", "live_bar", "tap");
    setSelectedStreamId(null);
    setShowLive(true);
  }, [trackFeature]);

  const handleCreatePost = useCallback(() => {
    trackTap("create_post_fab", "post_create");
    setShowCreatePost(true);
  }, [trackTap]);

  const renderHeader = useCallback(
    () => (
      <StoriesBar
        storyGroups={storyGroups}
        isUserSeen={isStoryUserSeen}
        onAddStory={handleAddStory}
        onOpenStory={handleOpenStory}
        onGoLive={handleGoLive}
        onCreatePost={handleCreatePost}
        onJoinLive={handleJoinLive}
        liveRefreshKey={liveRefreshKey}
        currentUserId={currentUser?.id}
      />
    ),
    [
      storyGroups,
      isStoryUserSeen,
      handleAddStory,
      handleOpenStory,
      currentUser?.id,
      handleJoinLive,
      handleGoLive,
      handleCreatePost,
      liveRefreshKey,
    ],
  );

  const [showAuthModal, setShowAuthModal] = useState(false);

  if (!currentUser) {
    return (
      <View className="flex-1 bg-gray-100">
        {/* Status Bar Space */}
        <View style={{ height: insets.top, backgroundColor: "white" }} />

        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-semibold text-gray-700 mb-2">
            Welcome to Feed
          </Text>
          <Text className="text-base text-gray-500 text-center mb-4">
            Sign in to see your personalized feed
          </Text>
          <TouchableWithoutFeedback onPress={() => setShowAuthModal(true)}>
            <View className="bg-primary px-8 py-3 rounded-full">
              <Text className="text-white font-msemibold text-base">
                Sign In
              </Text>
            </View>
          </TouchableWithoutFeedback>
          <AuthPromptModal
            visible={showAuthModal}
            onClose={() => setShowAuthModal(false)}
            message="Sign in to see your personalized feed"
          />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      {/* Status Bar Space */}
      <View style={{ height: insets.top, backgroundColor: "white" }} />

      {/* Feed Content */}
      <FlatList
        ref={flatListRef}
        data={filteredPosts}
        extraData={visiblePostId}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          postsLoading ? (
            <>
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </>
          ) : null
        }
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 72 + insets.bottom }}
        onScroll={onTabBarScroll}
        scrollEventThrottle={16}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={2}
        updateCellsBatchingPeriod={50}
        windowSize={3}
        initialNumToRender={3}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1877F2"
            colors={["#1877F2"]}
          />
        }
      />

      {/* ── First-time Onboarding Tutorial ─────────────────────────────────── */}
      <OnboardingTutorial
        visible={showTutorial}
        mode="all"
        onComplete={async () => {
          setShowTutorial(false);
          await markComplete("addProducts", "tagInPosts");
        }}
        onDismiss={async () => {
          setShowTutorial(false);
          await markComplete("addProducts", "tagInPosts");
        }}
      />

      {/* Create Post Modal */}
      <Modal
        visible={showCreatePost}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setShowCreatePost(false)}
      >
        <View className="flex-1 bg-background">
          {CreatePostComponent ? (
            <CreatePostComponent
              onClose={() => {
                setShowCreatePost(false);
                refresh();
              }}
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-white">
              <ActivityIndicator size="large" color="#094569" />
              <Text className="mt-3 text-gray-500 text-sm">Loading…</Text>
            </View>
          )}
        </View>
      </Modal>

      {/* Story Composer — mirrors CreatePost's Modal wrapper. */}
      <Modal
        visible={showStoryComposer}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setShowStoryComposer(false)}
      >
        <View className="flex-1 bg-black">
          {StoryComposerComponent ? (
            <StoryComposerComponent
              onClose={() => {
                setShowStoryComposer(false);
                reloadStories();
              }}
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-black">
              <ActivityIndicator size="large" color="#fff" />
            </View>
          )}
        </View>
      </Modal>

      {/* Story Viewer — manages its own internal Modal, so it's rendered
          directly (only mounted while a group is being viewed, matching the
          Live Modal's "only rendered when open" convention below). */}
      {viewingStoryGroups && StoryViewerComponent && (
        <StoryViewerComponent
          visible
          onClose={() => setViewingStoryGroups(null)}
          storyGroups={viewingStoryGroups}
          initialGroupIndex={viewingGroupIndex}
          currentUserId={currentUser?.id}
          onGroupSeen={markStoryGroupSeen}
        />
      )}

      {/* Live Modal — TikTok-style endless scroll.
          Only rendered when open: a hidden Modal on Android blocks all touches,
          and keeping LiveScrollScreen mounted in the background wastes resources. */}
      {showLive && (
        <Modal
          visible={true}
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent={true}
          onRequestClose={() => setShowLive(false)}
        >
          {LiveScrollScreen ? (
            <LiveScrollScreen
              initialStreamId={selectedStreamId ?? undefined}
              openCreateOnMount={selectedStreamId === null}
              onClose={() => setShowLive(false)}
              onRestore={(streamId: string) => {
                setSelectedStreamId(streamId);
                setShowLive(true);
              }}
            />
          ) : (
            <View className="flex-1 bg-black items-center justify-center">
              <ActivityIndicator size="large" color="white" />
              <Text className="mt-4 text-white opacity-60">Loading…</Text>
            </View>
          )}
        </Modal>
      )}
    </View>
  );
}

export default FeedScreen;
