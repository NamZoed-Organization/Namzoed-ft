import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";
import ImageViewer from "@/components/modals/ImageViewer";
import PostActionSheet from "@/components/modals/PostActionSheet";
import ReportPostModal from "@/components/modals/ReportPostModal";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import { deletePost } from "@/lib/postsService";
import { hasUserLikedPost, togglePostLike, getPostLikeCount } from "@/lib/likesService";
import { hasUserBookmarkedPost, togglePostBookmark } from "@/lib/bookmarkService";
import { PostData } from "@/types/post";
import { feedEvents } from "@/utils/feedEvents";
import { useRouter } from "expo-router";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Play,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export { default as PostSkeleton } from "@/components/ui/PostSkeleton";

interface FeedPostProps {
  post: PostData;
  isVisible?: boolean;
  onVideoTap?: (videoUri: string) => void;
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

interface PostVideoProps {
  videoUri: string;
  className?: string;
  style?: any;
  onVideoTap: (videoUri: string) => void;
}

const PostVideo = ({ videoUri, className, style, onVideoTap }: PostVideoProps) => {
  return (
    <TouchableOpacity
      onPress={() => onVideoTap(videoUri)}
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
  );
};

// Helper to handle layout logic for images
const renderImages = (
  images: string[],
  onImagePress: (index: number) => void,
  postId: string,
  onVideoTap?: (videoUri: string) => void,
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
          className={className}
          style={style}
          onVideoTap={onVideoTap || (() => {})}
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

export default function FeedPost({ post, isVisible = true, onVideoTap }: FeedPostProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showError, setShowError] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const { currentUser } = useUser();
  const router = useRouter();

  const isOwnPost = currentUser?.id === post.userId;

  const showErrorPopup = (message: string) => {
    setPopupMessage(message);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  // Check if post is bookmarked and liked on mount and when ImageViewer closes
  useEffect(() => {
    // Skip when ImageViewer is open
    if (showImageViewer) return;

    const checkBookmarkStatus = async () => {
      if (!currentUser?.id) return;

      // Check if user has bookmarked the post
      const bookmarked = await hasUserBookmarkedPost(post.id, currentUser.id);
      setIsBookmarked(bookmarked);
    };

    const checkLikeStatus = async () => {
      if (!currentUser?.id) return;

      // Check if user has liked the post
      const liked = await hasUserLikedPost(post.id, currentUser.id);
      setIsLiked(liked);

      // Get actual like count from database
      const count = await getPostLikeCount(post.id);
      setLikesCount(count);
    };

    checkBookmarkStatus();
    checkLikeStatus();
  }, [showImageViewer, currentUser?.id, post.id]);

  const handleLike = async () => {
    if (!currentUser?.id) {
      showErrorPopup("Please sign in to like posts");
      return;
    }

    // Optimistic update
    const previousLiked = isLiked;
    const previousCount = likesCount;

    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

    try {
      // Toggle like in database
      const result = await togglePostLike(post.id, currentUser.id, isLiked);

      if (!result.success) {
        // Rollback on failure
        setIsLiked(previousLiked);
        setLikesCount(previousCount);
        showErrorPopup("Failed to update like. Please try again.");
      } else {
        // Update with actual values from database
        setIsLiked(result.isLiked);
        setLikesCount(result.likeCount);
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      // Rollback on error
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
      showErrorPopup("Failed to update like. Please try again.");
    }
  };

  const handleBookmark = async () => {
    if (!currentUser?.id) {
      showErrorPopup("Please sign in to bookmark posts");
      return;
    }

    // Optimistic update
    const previousBookmarked = isBookmarked;
    setIsBookmarked(!isBookmarked);

    try {
      // Toggle bookmark in database
      const result = await togglePostBookmark(post.id, currentUser.id, isBookmarked);

      if (!result.success) {
        // Rollback on failure
        setIsBookmarked(previousBookmarked);
        showErrorPopup("Failed to update bookmark. Please try again.");
      } else {
        // Update with actual value from database
        setIsBookmarked(result.isBookmarked);
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      // Rollback on error
      setIsBookmarked(previousBookmarked);
      showErrorPopup("Failed to update bookmark. Please try again.");
    }
  };

  const handleImagePress = (index: number) => {
    setSelectedImageIndex(index);
    setShowImageViewer(true);
  };

  const handleDeletePress = () => {
    setShowActionSheet(false);
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deletePost(post.id);
      setShowDeleteConfirmation(false);
      feedEvents.emit('postDeleted', post.id);
    } catch (error) {
      console.error('Error deleting post:', error);
      setShowDeleteConfirmation(false);
    }
  };

  const handleReportPress = () => {
    setShowActionSheet(false);
    setShowReportModal(true);
  };

  const handleMessage = () => {
    if (!currentUser?.id) {
      showErrorPopup("Please sign in to send messages");
      return;
    }

    if (isOwnPost) {
      showErrorPopup("You cannot send a message to your own post");
      return;
    }

    // Navigate to chat with the post author
    router.push(`/(users)/chat/${post.userId}` as any);
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
        <TouchableOpacity onPress={() => setShowActionSheet(true)}>
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
          onVideoTap,
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
          <TouchableOpacity
            className="flex-row items-center"
            onPress={handleMessage}
          >
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
        postId={post.id}
        postUserId={post.userId}
      />

      {/* Post Action Sheet */}
      <PostActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        isOwnPost={isOwnPost}
        onDelete={handleDeletePress}
        onReport={handleReportPress}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        visible={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleConfirmDelete}
        postContent={post.content}
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

      {/* Error Popup - Rendered at screen level */}
      <Modal
        visible={showError}
        transparent={true}
        animationType="none"
        statusBarTranslucent={true}
      >
        <TouchableWithoutFeedback onPress={() => setShowError(false)}>
          <View style={{ flex: 1 }}>
            <PopupMessage visible={showError} type="error" message={popupMessage} />
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
