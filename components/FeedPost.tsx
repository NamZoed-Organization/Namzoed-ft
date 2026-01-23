import FullscreenVideoPlayer from "@/components/FullscreenVideoPlayer";
import ImageViewer from "@/components/modals/ImageViewer";
import ReportPostModal from "@/components/modals/ReportPostModal";
import { useUser } from "@/contexts/UserContext";
import { PostData } from "@/types/post";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Play,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export { default as PostSkeleton } from "@/components/ui/PostSkeleton";

interface FeedPostProps {
  post: PostData;
  isVisible?: boolean;
}

const formatDate = (date: Date): string => {
  const now = new Date();
  const diffInHours = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60),
  );

  if (diffInHours < 1) {
    return "Just now";
  } else if (diffInHours < 24) {
    return `${diffInHours}h`;
  } else {
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
};

const isVideoUrl = (url: string): boolean => {
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
  const lowerUrl = url.toLowerCase();
  return (
    videoExtensions.some((ext) => lowerUrl.includes(ext)) ||
    lowerUrl.includes("post-videos")
  );
};

const ImageSkeleton = ({
  width,
  height,
}: {
  width: string;
  height: string;
}) => {
  const shimmerOpacity = React.useRef(new Animated.Value(0.3)).current;
  const animationRef = React.useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    animationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animationRef.current.start();

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, []); // Remove shimmerOpacity from deps to prevent recreation

  return (
    <Animated.View
      className="bg-gray-300 absolute inset-0 rounded-lg"
      style={{ opacity: shimmerOpacity }}
    />
  );
};

const PostImage = ({ imageUri, onPress, className, style }: any) => {
  const [imageLoading, setImageLoading] = useState(true);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      className={className}
      style={style}
    >
      <View className="relative">
        {imageLoading && <ImageSkeleton width="100%" height="100%" />}
        <Image
          source={{ uri: imageUri }}
          className="w-full h-full"
          resizeMode="cover"
          onLoad={() => setImageLoading(false)}
          onError={() => setImageLoading(false)}
        />
      </View>
    </TouchableOpacity>
  );
};

const PostVideo = ({
  videoUri,
  className,
  style,
  videoId,
  postContent,
  username,
  likes,
  comments,
}: any) => {
  const [showFullscreen, setShowFullscreen] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowFullscreen(true)}
        activeOpacity={0.85}
        className={className}
        style={[videoPreviewStyles.container, style]}
      >
        <View style={videoPreviewStyles.videoWrapper}>
          {/* Static video thumbnail placeholder */}
          <Image
            source={{ uri: videoUri }}
            style={videoPreviewStyles.videoPlayer}
            resizeMode="cover"
          />

          <View style={videoPreviewStyles.overlay}>
            <View style={videoPreviewStyles.playButton}>
              <Play size={52} color="#000" fill="#000" strokeWidth={0} />
            </View>
          </View>

          {/* Video badge indicator */}
          <View style={videoPreviewStyles.videoBadge}>
            <Text style={videoPreviewStyles.videoBadgeText}>VIDEO</Text>
          </View>
        </View>
      </TouchableOpacity>

      <FullscreenVideoPlayer
        visible={showFullscreen}
        videoUri={videoUri}
        videoId={videoId}
        onClose={() => setShowFullscreen(false)}
        postContent={postContent}
        username={username}
        likes={likes}
        comments={comments}
      />
    </>
  );
};

// Helper to handle layout logic for images
const renderImages = (
  images: string[],
  onImagePress: (index: number) => void,
  postId: string,
  postContent?: string,
  username?: string,
  likes?: number,
  comments?: number,
  isVisible?: boolean,
) => {
  if (images.length === 0) return null;

  const renderMediaItem = (
    mediaUri: string,
    index: number,
    className: string,
    style?: any,
  ) => {
    const isVideo = isVideoUrl(mediaUri);

    if (isVideo) {
      return (
        <PostVideo
          key={index}
          videoUri={mediaUri}
          onPress={() => onImagePress(index)}
          className={className}
          style={style}
          videoId={`${postId}-video-${index}`}
          postContent={postContent}
          username={username}
          likes={likes}
          comments={comments}
          isVisible={isVisible}
        />
      );
    }

    return (
      <PostImage
        key={index}
        imageUri={mediaUri}
        onPress={() => onImagePress(index)}
        className={className}
        style={style}
      />
    );
  };

  if (images.length === 1) {
    return (
      <View className="mt-3 rounded-lg overflow-hidden">
        {renderMediaItem(images[0], 0, "w-full h-64")}
      </View>
    );
  }
  if (images.length === 2) {
    return (
      <View className="mt-3 flex-row gap-1 rounded-lg overflow-hidden">
        {renderMediaItem(images[0], 0, "flex-1 h-48")}
        {renderMediaItem(images[1], 1, "flex-1 h-48")}
      </View>
    );
  }

  const remainingCount = images.length - 3;
  return (
    <View className="mt-3 gap-1 rounded-lg overflow-hidden">
      {renderMediaItem(images[0], 0, "w-full h-48")}
      <View className="flex-row gap-1">
        {renderMediaItem(images[1], 1, "flex-1 h-32")}
        <View className="flex-1 relative">
          {renderMediaItem(images[2], 2, "w-full h-32")}
          {remainingCount > 0 && (
            <View className="absolute inset-0 bg-black/60 items-center justify-center z-10">
              <Text className="text-white font-bold text-xl">
                +{remainingCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

export default function FeedPost({ post, isVisible }: FeedPostProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const { currentUser } = useUser();

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);
  };
  const handleBookmark = () => setIsBookmarked(!isBookmarked);
  const handleImagePress = (index: number) => {
    setSelectedImageIndex(index);
    setShowImageViewer(true);
  };

  return (
    <View className="bg-white border-b border-gray-200">
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-full bg-gray-300 items-center justify-center mr-3 overflow-hidden">
            {post.profilePic ? (
              <Image
                source={{ uri: post.profilePic }}
                className="w-full h-full"
              />
            ) : (
              <Text className="text-gray-600 font-semibold">
                {post.username?.charAt(0) || "U"}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-gray-900 text-base">
              {post.username || "Unknown"}
            </Text>
            <Text className="text-gray-500 text-sm">
              {formatDate(post.date)}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setShowReportModal(true)}>
          <MoreHorizontal size={20} color="#666" />
        </TouchableOpacity>
      </View>

      <View className="px-4">
        <Text className="text-gray-900 text-base leading-6">
          {post.content}
        </Text>
      </View>

      <View className="px-4">
        {renderImages(
          post.images,
          handleImagePress,
          post.id,
          post.content,
          post.username,
          likesCount,
          post.comments,
          isVisible,
        )}
      </View>

      <View className="border-t border-gray-200 px-4 py-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={handleLike}
              className="flex-row items-center mr-6"
            >
              <Heart
                size={20}
                color={isLiked ? "#e91e63" : "#666"}
                fill={isLiked ? "#e91e63" : "none"}
              />
              <Text className="ml-1 font-medium text-gray-600">
                {likesCount}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBookmark}
              className="flex-row items-center"
            >
              <Bookmark
                size={20}
                color={isBookmarked ? "#1976d2" : "#666"}
                fill={isBookmarked ? "#1976d2" : "none"}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity className="flex-row items-center">
            <MessageCircle size={20} color="#666" />
            <Text className="ml-2 text-gray-600 font-medium">Message</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ImageViewer
        visible={showImageViewer}
        images={post.images}
        initialIndex={selectedImageIndex}
        onClose={() => setShowImageViewer(false)}
        postContent={post.content}
        username={post.username}
        likes={likesCount}
        comments={post.comments}
      />

      {/* Report Modal */}
      {currentUser?.id && post.userId && (
        <ReportPostModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          postId={post.id}
          postContent={
            post.content.substring(0, 50) +
            (post.content.length > 50 ? "..." : "")
          }
          postOwnerId={post.userId}
          currentUserId={currentUser.id}
          onReportSuccess={() => {
            setShowReportModal(false);
          }}
        />
      )}
    </View>
  );
}

const videoPreviewStyles = StyleSheet.create({
  container: {
    position: "relative",
    width: "100%",
    height: 300,
    backgroundColor: "#000",
    borderRadius: 8,
    overflow: "hidden",
  },
  videoWrapper: {
    width: "100%",
    height: "100%",
    position: "relative",
  },
  videoPlayer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  playButton: {
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 50,
    padding: 15,
  },
  videoBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  videoBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
});
