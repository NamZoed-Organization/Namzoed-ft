import React, { memo, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import FeedPost from "@/components/FeedPost";
import { PostData } from "@/types/post";

interface VirtualizedFeedPostProps {
  post: PostData;
  index: number;
  isVisible: boolean;
  estimatedHeight?: number;
}

// Skeleton component for posts outside viewport
const PostSkeleton = memo(({ height }: { height: number }) => (
  <View style={{ height }} className="bg-white border-b border-gray-200">
    <View className="flex-row items-center p-4">
      <View className="w-10 h-10 rounded-full bg-gray-200 mr-3" />
      <View className="flex-1">
        <View className="bg-gray-200 h-4 w-24 rounded mb-1" />
        <View className="bg-gray-200 h-3 w-16 rounded" />
      </View>
    </View>
    <View className="px-4">
      <View className="bg-gray-200 h-4 w-full rounded mb-1" />
      <View className="bg-gray-200 h-4 w-3/4 rounded mb-3" />
      <View className="bg-gray-200 h-48 w-full rounded mb-3" />
    </View>
    <View className="border-t border-gray-200 px-4 py-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <View className="bg-gray-200 h-6 w-16 rounded mr-6" />
          <View className="bg-gray-200 h-6 w-6 rounded" />
        </View>
        <View className="bg-gray-200 h-6 w-20 rounded" />
      </View>
    </View>
  </View>
));

// Optimized feed post with visibility-based rendering
const VirtualizedFeedPost = memo(({
  post,
  index,
  isVisible,
  estimatedHeight = 400
}: VirtualizedFeedPostProps) => {
  const [hasRendered, setHasRendered] = useState(false);

  // Only render full component when visible or has been rendered before
  if (!isVisible && !hasRendered) {
    return <PostSkeleton height={estimatedHeight} />;
  }

  // Mark as rendered once visible
  if (isVisible && !hasRendered) {
    setHasRendered(true);
  }

  return (
    <View>
      <FeedPost post={post} />
    </View>
  );
});

VirtualizedFeedPost.displayName = 'VirtualizedFeedPost';
PostSkeleton.displayName = 'PostSkeleton';

export default VirtualizedFeedPost;