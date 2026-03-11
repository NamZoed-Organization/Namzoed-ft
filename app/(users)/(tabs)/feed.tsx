import { PostSkeleton } from "@/components/FeedPost";
import CreatePost from "@/components/modals/CreatePost";
import { VideoErrorBoundary } from "@/components/VideoErrorBoundary";
import { useUser } from "@/contexts/UserContext";
import { useFeedPagination } from "@/hooks/usePagination";
import { useVirtualizedList } from "@/hooks/useVirtualizedList";
import { fetchPosts, PostWithUser } from "@/lib/postsService";
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
    View
} from "react-native";

import FeedPost from "@/components/FeedPost";
import LivesBar from "@/components/livestream/LivesBar";
import AuthPromptModal from "@/components/modals/AuthPromptModal";
import { feedEvents } from "@/utils/feedEvents";

export default function FeedScreen() {
  const { currentUser } = useUser();
  const { streamId: deepLinkedStreamId } = useLocalSearchParams<{ streamId?: string }>();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [newPosts, setNewPosts] = useState<PostData[]>([]);
  const [loadingNewPosts, setLoadingNewPosts] = useState(true);
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const [reportedPostIds, setReportedPostIds] = useState<string[]>([]);

  // Dynamic import for LiveScrollScreen
  const [LiveScrollScreen, setLiveScrollScreen] = useState<React.ComponentType<{
    initialStreamId?: string;
    onClose: () => void;
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
        .catch(() => {
          setLiveScreenLoading(false);
        });
    }
  }, [showLive, LiveScrollScreen, liveScreenLoading]);

  // Convert Supabase post to PostData format
  const convertToPostData = (post: PostWithUser): PostData => {
    // Extract username from profiles data (prefer name, then email prefix)
    const username =
      post.profiles?.name ||
      post.profiles?.email?.split("@")[0] ||
      "Unknown User";

    return {
      id: post.id,
      userId: post.user_id,
      username: username,
      profilePic: post.profiles?.avatar_url || undefined,
      content: post.content,
      images: post.images,
      date: new Date(post.created_at),
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      tagged_products: (post as any).tagged_products ?? undefined,
      tagged_accounts: (post as any).tagged_accounts ?? undefined,
    };
  };

  // Load new posts from Supabase
  const loadNewPosts = async () => {
    try {
      setLoadingNewPosts(true);

      // Add a small delay to show skeleton
      await new Promise((resolve) => setTimeout(resolve, 500));

      const { posts: fetchedPosts } = await fetchPosts(0, 50);

      // Add null check for fetchedPosts
      if (!fetchedPosts || !Array.isArray(fetchedPosts)) {
        setNewPosts([]);
        return;
      }

      const convertedPosts = fetchedPosts.map(convertToPostData);

      // Sort by date (newest first)
      const sortedNewPosts = convertedPosts.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setNewPosts(sortedNewPosts);
    } catch (error) {
      console.error("Error loading new posts:", error);
      setNewPosts([]); // Set empty array on error to prevent crashes
    } finally {
      setLoadingNewPosts(false);
    }
  };

  // Load reported posts from the current user
  const loadReportedPosts = async () => {
    if (currentUser?.id) {
      try {
        const ids = await getReportedPostIds(currentUser.id);
        setReportedPostIds(ids);
      } catch (error) {
        console.error('Error loading reported posts:', error);
      }
    }
  };

  // Load posts on mount
  useEffect(() => {
    loadNewPosts();
    loadReportedPosts();
  }, []);

  // Deep-link from notifications: /(users)/(tabs)/feed?streamId=xxx
  useEffect(() => {
    if (deepLinkedStreamId) {
      setSelectedStreamId(deepLinkedStreamId);
      setShowLive(true);
    }
  }, [deepLinkedStreamId]);

  // Use only Supabase posts and filter out reported posts
  const allPosts = useMemo(() => {
    return newPosts.filter(post => !reportedPostIds.includes(post.id));
  }, [newPosts, reportedPostIds]);

  // Use pagination for feed posts - increased to 15 items per page
  const {
    items: paginatedPosts,
    loading: postsLoading,
    hasMore,
    loadMore,
    refresh,
  } = useFeedPagination({ data: allPosts, pageSize: 15, bufferSize: 10 });

  // Use virtualized list for performance
  const {
    flatListRef,
    state: virtualState,
    onLayout,
    onScroll,
    scrollToTop,
    visibleRange,
  } = useVirtualizedList({ estimatedItemSize: 400, overscan: 3 });

  // Handle pull to refresh - use useCallback to maintain stable reference
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNewPosts(); // Reload posts from Supabase
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Listen for double-tap events from the feed tab button
  // Use useCallback to maintain stable reference and prevent listener leaks
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
      setNewPosts(prev => prev.filter(p => p.id !== postId));
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
  }, []);

  // Handle end of list reached
  const handleEndReached = () => {
    if (hasMore && !postsLoading) {
      loadMore();
    }
  };

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

  const renderPost = ({ item, index }: { item: PostData; index: number }) => {
    // Show skeleton while loading new posts for the first few items
    if (loadingNewPosts && index < 3) {
      return <PostSkeleton />;
    }

    // Wrap FeedPost in VideoErrorBoundary to prevent crashes from bad video URIs
    // Pass isVisible prop - only the visible post will play videos
    const isVisible = visiblePostId === item.id;

    return (
      <VideoErrorBoundary>
        <FeedPost post={item} isVisible={isVisible} />
      </VideoErrorBoundary>
    );
  };

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

  const renderHeader = () => (
    <>
  
        <LivesBar
          onJoin={(stream: { id: string }) => {
            setSelectedStreamId(stream.id);
            setShowLive(true);
          }}
          onGoLive={() => {
          setSelectedStreamId(null);
          setShowLive(true);
        }}
        onCreatePost={() => setShowCreatePost(true)}
      />

      {/* Show skeleton while loading initial posts */}
      {loadingNewPosts && paginatedPosts.length === 0 && (
        <>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </>
      )}
    </>
  );

  const [showAuthModal, setShowAuthModal] = useState(false);

  if (!currentUser) {
    return (
      <View className="flex-1 bg-gray-100">
        {/* Status Bar Space */}
        <View className="h-12 bg-white" />

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
      <View className="h-12 bg-white" />

      {/* Dismiss Create menu backdrop */}
      {showCreateMenu && (
        <TouchableWithoutFeedback onPress={() => setShowCreateMenu(false)}>
          <View className="absolute inset-0 z-40" />
        </TouchableWithoutFeedback>
      )}

      {/* Feed Content */}
      <FlatList
        ref={flatListRef}
        data={paginatedPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 80 }}
        onLayout={onLayout}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        removeClippedSubviews={false}
        maxToRenderPerBatch={15}
        windowSize={21}
        initialNumToRender={15}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        getItemLayout={(data, index) => ({
          length: 400,
          offset: 400 * index,
          index,
        })}
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
              // Reload posts after creating a new one
              loadNewPosts();
            }}
          />
        </View>
      </Modal>

      {/* Live Modal — TikTok-style endless scroll */}
      <Modal
        visible={showLive}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setShowLive(false)}
      >
        {LiveScrollScreen ? (
          <LiveScrollScreen
            initialStreamId={selectedStreamId ?? undefined}
            onClose={() => setShowLive(false)}
          />
        ) : (
          <View className="flex-1 bg-black items-center justify-center">
            <ActivityIndicator size="large" color="white" />
            <Text className="mt-4 text-white opacity-60">Loading…</Text>
          </View>
        )}
      </Modal>

    </View>
  );
}
