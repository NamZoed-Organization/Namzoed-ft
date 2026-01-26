import { PostSkeleton } from "@/components/FeedPost";
import CreatePost from "@/components/modals/CreatePost";
import FullscreenVideoPlayer from "@/components/FullscreenVideoPlayer";
import { VideoErrorBoundary } from "@/components/VideoErrorBoundary";
import { useLiveSession } from "@/contexts/LiveSessionProvider";
import { useUser } from "@/contexts/UserContext";
import { useFeedPagination } from "@/hooks/usePagination";
import { useVirtualizedList } from "@/hooks/useVirtualizedList";
import { fetchPosts, PostWithUser } from "@/lib/postsService";
import { getReportedPostIds } from "@/lib/reportService";
import { PostData } from "@/types/post";
import { useRouter } from "expo-router";
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
  TouchableOpacity,
  View
} from "react-native";

import FeedPost from "@/components/FeedPost";
import { feedEvents } from "@/utils/feedEvents";
import { Plus, Radio } from "lucide-react-native";

export default function FeedScreen() {
  const { currentUser } = useUser();
  const { setRestoreHandler, pendingRestore, consumePendingRestore } =
    useLiveSession();
  const router = useRouter();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showLive, setShowLive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newPosts, setNewPosts] = useState<PostData[]>([]);
  const [loadingNewPosts, setLoadingNewPosts] = useState(true);
  const [visiblePostId, setVisiblePostId] = useState<string | null>(null);
  const [reportedPostIds, setReportedPostIds] = useState<string[]>([]);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);
  const [shuffledVideos, setShuffledVideos] = useState<Array<{uri: string, id: string}>>([]);

  // Dynamic import for LiveWrapper to avoid WebRTC errors on app load
  const [LiveWrapper, setLiveWrapper] = useState<React.ComponentType<{
    onClose: () => void;
  }> | null>(null);
  const [liveWrapperLoading, setLiveWrapperLoading] = useState(false);

  // Dynamically import LiveWrapper only when user opens Live modal
  useEffect(() => {
    if (showLive && !LiveWrapper && !liveWrapperLoading) {
      setLiveWrapperLoading(true);
      import("@/components/livestream/LiveWrapper")
        .then((module) => {
          setLiveWrapper(() => module.default);
          setLiveWrapperLoading(false);
        })
        .catch((error) => {
          console.warn("Failed to load LiveWrapper:", error);
          setLiveWrapperLoading(false);
        });
    }
  }, [showLive, LiveWrapper, liveWrapperLoading]);

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
      profilePic: undefined, // We don't have profile pic in the database yet
      content: post.content,
      images: post.images,
      date: new Date(post.created_at),
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
    };
  };

  // Helper to check if URL is a video
  const isVideoUrl = (url: string): boolean => {
    const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
    const lowerUrl = url.toLowerCase();
    return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes("post-videos");
  };

  // Extract and shuffle all videos from feed posts
  const extractAndShuffleVideos = (posts: PostData[]) => {
    const allVideos: Array<{uri: string, id: string}> = [];

    posts.forEach(post => {
      const videoUris = post.images.filter(uri => isVideoUrl(uri));
      videoUris.forEach(uri => {
        allVideos.push({
          uri: uri,
          id: `${post.id}_${uri}` // Unique ID combining post ID and URI
        });
      });
    });

    // Fisher-Yates shuffle algorithm for random order
    for (let i = allVideos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allVideos[i], allVideos[j]] = [allVideos[j], allVideos[i]];
    }

    return allVideos;
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
        console.warn("No posts returned from fetchPosts");
        setNewPosts([]);
        return;
      }

      const convertedPosts = fetchedPosts.map(convertToPostData);

      // Sort by date (newest first)
      const sortedNewPosts = convertedPosts.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      );

      setNewPosts(sortedNewPosts);

      // Extract and shuffle videos for the video player
      const videos = extractAndShuffleVideos(sortedNewPosts);
      setShuffledVideos(videos);
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

  // Register restore handler so mini overlay can reopen the live modal (ensures navigation to feed first)
  useEffect(() => {
    setRestoreHandler(() => () => {
      router.push("/(users)/feed");
      // slight delay to allow navigation stack to settle
      setTimeout(() => setShowLive(true), 30);
    });
  }, [setRestoreHandler, router]);

  // If a restore was requested without a handler (e.g., from another screen), open live and consume flag
  useEffect(() => {
    if (pendingRestore) {
      router.push("/(users)/feed");
      setTimeout(() => {
        setShowLive(true);
        consumePendingRestore();
      }, 30);
    }
  }, [pendingRestore, consumePendingRestore, router]);

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
    console.log("Feed refreshed!");
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

  // Handle video tap - open player at tapped video, reorder to start from that video
  const handleVideoTap = useCallback((videoUri: string) => {
    const index = shuffledVideos.findIndex(v => v.uri === videoUri);
    if (index !== -1) {
      // Re-order array to start at tapped video, maintaining shuffle order
      const reordered = [
        ...shuffledVideos.slice(index),
        ...shuffledVideos.slice(0, index)
      ];
      setShuffledVideos(reordered);
      setShowVideoPlayer(true);
    }
  }, [shuffledVideos]);

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
        <FeedPost post={item} isVisible={isVisible} onVideoTap={handleVideoTap} />
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
      <View className="bg-white border-b border-gray-200 p-4">
        {/* Action Buttons */}
        <View className="flex-row">
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center py-3"
            onPress={() => setShowCreatePost(true)}
          >
            <Plus size={20} color="#1877F2" strokeWidth={1.5} />
            <Text className="ml-2 text-gray-700 font-medium">Create Post</Text>
          </TouchableOpacity>

          <View className="w-px bg-gray-200 mx-2" />

          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center py-3"
            onPress={() => setShowLive(true)}
          >
            <Radio size={20} color="#DC2626" strokeWidth={1.5} />
            <Text className="ml-2 text-gray-700 font-medium">Live</Text>
          </TouchableOpacity>
        </View>
      </View>

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

  if (!currentUser) {
    return (
      <View className="flex-1 bg-gray-100">
        {/* Status Bar Space */}
        <View className="h-12 bg-white" />

        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-semibold text-gray-700 mb-2">
            Welcome to Feed
          </Text>
          <Text className="text-base text-gray-500 text-center">
            Please log in to see your personalized feed
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-100">
      {/* Status Bar Space */}
      <View className="h-12 bg-white" />

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
        <View className="flex-1 bg-white">
          <CreatePost
            onClose={() => {
              setShowCreatePost(false);
              // Reload posts after creating a new one
              loadNewPosts();
            }}
          />
        </View>
      </Modal>

      {/* Live Modal */}
      <Modal
        visible={showLive}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => setShowLive(false)}
      >
        {LiveWrapper ? (
          <LiveWrapper onClose={() => setShowLive(false)} />
        ) : (
          <View className="flex-1 bg-white items-center justify-center">
            <ActivityIndicator size="large" color="#DC2626" />
            <Text className="mt-4 text-gray-600">Loading Live...</Text>
          </View>
        )}
      </Modal>

      {/* Fullscreen Video Player */}
      {shuffledVideos.length > 0 && (
        <FullscreenVideoPlayer
          visible={showVideoPlayer}
          videos={shuffledVideos}
          onClose={() => setShowVideoPlayer(false)}
        />
      )}
    </View>
  );
}
