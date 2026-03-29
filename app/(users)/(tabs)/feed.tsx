import { PostSkeleton } from "@/components/FeedPost";
import CreatePost from "@/components/modals/CreatePost";
import { VideoErrorBoundary } from "@/components/VideoErrorBoundary";
import { useUser } from "@/contexts/UserContext";
import { useFeedInfiniteScroll } from "@/hooks/useFeedInfiniteScroll";
import { getReportedPostIds } from "@/lib/reportService";
import { PostData } from "@/types/post";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
    View
} from "react-native";

import FeedPost from "@/components/FeedPost";
import LivesBar from "@/components/livestream/LivesBar";
import AuthPromptModal from "@/components/modals/AuthPromptModal";
import { feedEvents } from "@/utils/feedEvents";
import { useLiveSession } from "@/contexts/LiveSessionProvider";
import { useLivestreams } from "@/hooks/useLivestreams";

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();
  const { setRestoreHandler } = useLiveSession();
  const { streamId: deepLinkedStreamId } = useLocalSearchParams<{ streamId?: string }>();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [liveRefreshKey, setLiveRefreshKey] = useState(0);
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const [reportedPostIds, setReportedPostIds] = useState<string[]>([]);
  const { getLivestreamForUser } = useLivestreams();

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

  // Filter out reported posts
  const filteredPosts = useMemo(() => {
    if (reportedPostIds.length === 0) return allPosts;
    return allPosts.filter(post => !reportedPostIds.includes(post.id));
  }, [allPosts, reportedPostIds]);

  // Dynamic import for LiveScrollScreen
  const [LiveScrollScreen, setLiveScrollScreen] = useState<React.ComponentType<{
    initialStreamId?: string;
    onClose: () => void;
    openCreateOnMount?: boolean;
  }> | null>(null);
  const [liveScreenLoading, setLiveScreenLoading] = useState(false);

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
        .catch((error) => console.error('Error loading reported posts:', error));
    }
  }, [currentUser?.id]);

  // Deep-link from notifications: /(users)/(tabs)/feed?streamId=xxx
  useEffect(() => {
    if (deepLinkedStreamId) {
      setSelectedStreamId(deepLinkedStreamId);
      setShowLive(true);
    }
  }, [deepLinkedStreamId]);

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
      setReportedPostIds(prev => [...prev, postId]);
    };

    feedEvents.on('postDeleted', handlePostDeleted);
    feedEvents.on('postReported', handlePostReported);

    return () => {
      feedEvents.off('postDeleted', handlePostDeleted);
      feedEvents.off('postReported', handlePostReported);
    };
  }, [removePost]);

  // Handle end of list reached
  const handleEndReached = useCallback(() => {
    if (hasMore && !postsLoading) {
      loadMore();
    }
  }, [hasMore, postsLoading, loadMore]);

  // TikTok-style viewability handler - only visible post gets to play videos
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    // Find the most visible item (the one that's 50%+ visible)
    const mostVisibleItem = viewableItems.find(
      (item: any) => item.isViewable && item.item && item.item.id,
    );

    if (mostVisibleItem) {
      setVisiblePostId(mostVisibleItem.item.id);
    } else {
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

  const renderPost = useCallback(({ item }: { item: PostData }) => {
    const isVisible = visiblePostId === item.id;
    const isAuthorLive = !!getLivestreamForUser(item.userId);

    return (
      <VideoErrorBoundary>
        <FeedPost post={item} isVisible={isVisible} isAuthorLive={isAuthorLive} />
      </VideoErrorBoundary>
    );
  }, [visiblePostId, getLivestreamForUser]);

  // Footer component for loading more posts
  const renderFooter = () => {
    if (!postsLoading) return null;
    return (
      <View className="py-4 items-center">
        <ActivityIndicator size="small" color="#1877F2" />
        <Text className="text-sm text-gray-500 mt-1">
          Loading more posts...
        </Text>
      </View>
    );
  };

  const handleJoinLive = useCallback((stream: { id: string }) => {
    console.log("[FeedLive] handleJoinLive", { streamId: stream.id });
    setSelectedStreamId(stream.id);
    setShowLive(true);
  }, []);

  const handleGoLive = useCallback(() => {
    console.log("[FeedLive] handleGoLive", {
      selectedStreamId: null,
      openCreateOnMount: true,
    });
    setSelectedStreamId(null);
    setShowLive(true);
  }, []);

  const handleCreatePost = useCallback(() => setShowCreatePost(true), []);

  const renderHeader = useCallback(() => (
    <LivesBar
      onJoin={handleJoinLive}
      onGoLive={handleGoLive}
      onCreatePost={handleCreatePost}
      refreshKey={liveRefreshKey}
    />
  ), [handleJoinLive, handleGoLive, handleCreatePost, liveRefreshKey]);

  const [showAuthModal, setShowAuthModal] = useState(false);

  if (!currentUser) {
    return (
      <View className="flex-1 bg-gray-100">
        {/* Status Bar Space */}
        <View style={{ height: insets.top, backgroundColor: 'white' }} />

        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-semibold text-gray-700 mb-2">
            Welcome to Feed
          </Text>
          <Text className="text-base text-gray-500 text-center mb-4">
            Sign in to see your personalized feed
          </Text>
          <TouchableWithoutFeedback onPress={() => setShowAuthModal(true)}>
            <View className="bg-primary px-8 py-3 rounded-full">
              <Text className="text-white font-msemibold text-base">Sign In</Text>
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
      <View style={{ height: insets.top, backgroundColor: 'white' }} />

      {/* Feed Content */}
      <FlatList
        ref={flatListRef}
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={postsLoading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : null}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 72 + insets.bottom }}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={51}
        initialNumToRender={5}
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

      {/* Create Post Modal */}
      <Modal
        visible={showCreatePost}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setShowCreatePost(false)}
      >
        <View className="flex-1 bg-background">
          <CreatePost
            onClose={() => {
              setShowCreatePost(false);
              refresh();
            }}
          />
        </View>
      </Modal>

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
              onRestore={(streamId) => {
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
