import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableWithoutFeedback,
} from "react-native";
import { X, Heart, MessageCircle, Bookmark, MoreHorizontal } from "lucide-react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useUser } from "@/contexts/UserContext";
import { hasUserLikedPost, togglePostLike, getPostLikeCount } from "@/lib/likesService";
import { hasUserBookmarkedPost, togglePostBookmark } from "@/lib/bookmarkService";
import { deletePost } from "@/lib/postsService";
import { feedEvents } from "@/utils/feedEvents";
import PopupMessage from "@/components/ui/PopupMessage";
import PostActionSheet from "@/components/modals/PostActionSheet";
import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";
import ReportPostModal from "@/components/modals/ReportPostModal";

interface ImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
  postContent?: string;
  username?: string;
  likes?: number;
  comments?: number;
  postId: string;
  postUserId: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// Helper to check if URL is a video
const isVideoUrl = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('post-videos');
};

// Zoomable Image Component
const ZoomableImage = ({ uri }: { uri: string }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      // Reset zoom if too zoomed out
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      }
      // Limit max zoom
      else if (scale.value > 3) {
        scale.value = withSpring(3);
        savedScale.value = 3;
      } else {
        savedScale.value = scale.value;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={pinchGesture}>
      <Animated.View style={[{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }, animatedStyle]}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
};

// Individual media item component
const MediaItem = ({ uri, index, isActive }: { uri: string; index: number; isActive?: boolean }) => {
  const isVideo = isVideoUrl(uri);
  const [videoLoading, setVideoLoading] = useState(true);

  const player = isVideo
    ? useVideoPlayer(uri, player => {
        player.loop = true;
        player.muted = false;
      })
    : null;

  // Check when video is ready to play - Use event listener instead of polling
  useEffect(() => {
    if (!isVideo || !player) return;

    const statusListener = player.addListener('statusChange', (payload) => {
      if (payload.status === 'readyToPlay') {
        setVideoLoading(false);
      }
    });

    return () => {
      statusListener.remove();
    };
  }, [player, isVideo]);

  // Play/pause based on active state
  useEffect(() => {
    if (isVideo && player) {
      if (isActive) {
        player.play();
      } else {
        player.pause();
      }
    }
  }, [isActive, isVideo, player]);

  if (isVideo) {
    return (
      <View
        key={index}
        className="items-center justify-center bg-black"
        style={{
          width: screenWidth,
          height: screenHeight,
          backgroundColor: '#000000'
        }}
      >
        {videoLoading ? (
          <View className="items-center justify-center flex-1">
            <ActivityIndicator size="large" color="white" />
            <Text className="text-white mt-4">Loading video...</Text>
          </View>
        ) : null}
        {player ? (
          <VideoView
            player={player}
            style={{ width: '100%', height: '70%' }}
            nativeControls={true}
            contentFit="contain"
          />
        ) : null}
      </View>
    );
  }

  return (
    <View
      key={index}
      className="items-center justify-center bg-black"
      style={{
        width: screenWidth,
        height: screenHeight,
        backgroundColor: '#000000'
      }}
    >
      <ZoomableImage uri={uri} />
    </View>
  );
};

export default function ImageViewer({
  visible,
  images,
  initialIndex,
  onClose,
  postContent,
  username,
  likes = 0,
  comments = 0,
  postId,
  postUserId,
}: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likesCount, setLikesCount] = useState(likes);
  const [showError, setShowError] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { currentUser } = useUser();
  const router = useRouter();

  const isOwnPost = currentUser?.id === postUserId;

  const showErrorPopup = (message: string) => {
    setPopupMessage(message);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  // Check if post is liked and bookmarked when modal becomes visible
  useEffect(() => {
    if (!visible) return;

    const checkLikeStatus = async () => {
      if (!currentUser?.id) return;
      const liked = await hasUserLikedPost(postId, currentUser.id);
      setIsLiked(liked);
      const count = await getPostLikeCount(postId);
      setLikesCount(count);
    };

    const checkBookmarkStatus = async () => {
      if (!currentUser?.id) return;
      const bookmarked = await hasUserBookmarkedPost(postId, currentUser.id);
      setIsBookmarked(bookmarked);
    };

    checkLikeStatus();
    checkBookmarkStatus();
  }, [visible, currentUser?.id, postId]);

  const handleLike = async () => {
    if (!currentUser?.id) return;

    // Optimistic update
    const previousLiked = isLiked;
    const previousCount = likesCount;

    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

    try {
      const result = await togglePostLike(postId, currentUser.id, isLiked);

      if (!result.success) {
        // Rollback on failure
        setIsLiked(previousLiked);
        setLikesCount(previousCount);
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
    }
  };

  const handleBookmark = async () => {
    if (!currentUser?.id) return;

    // Optimistic update
    const previousBookmarked = isBookmarked;
    setIsBookmarked(!isBookmarked);

    try {
      const result = await togglePostBookmark(postId, currentUser.id, isBookmarked);

      if (!result.success) {
        // Rollback on failure
        setIsBookmarked(previousBookmarked);
      } else {
        // Update with actual value from database
        setIsBookmarked(result.isBookmarked);
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      // Rollback on error
      setIsBookmarked(previousBookmarked);
    }
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

    onClose();
    router.push(`/(users)/chat/${postUserId}` as any);
  };

  const handleDeletePress = () => {
    setShowActionSheet(false);
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deletePost(postId);
      setShowDeleteConfirmation(false);
      onClose();
      feedEvents.emit('postDeleted', postId);
    } catch (error) {
      console.error('Error deleting post:', error);
      setShowDeleteConfirmation(false);
    }
  };

  const handleReportPress = () => {
    setShowActionSheet(false);
    setShowReportModal(true);
  };

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / screenWidth);
    setCurrentIndex(index);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-black" style={{ backgroundColor: '#000000' }}>
          {/* Header */}
          <View className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between p-4 pt-16">
            <TouchableOpacity
              onPress={onClose}
              className="bg-black/50 rounded-full p-2"
            >
              <X size={24} color="white" />
            </TouchableOpacity>

            <View className="flex-row items-center gap-3">
              {images.length > 1 && (
                <View className="bg-black/50 rounded-full px-3 py-1">
                  <Text className="text-white font-medium">
                    {currentIndex + 1} / {images.length}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={() => setShowActionSheet(true)}
                className="bg-black/50 rounded-full p-2"
              >
                <MoreHorizontal size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Media Carousel */}
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            contentOffset={{ x: initialIndex * screenWidth, y: 0 }}
            className="flex-1 bg-black"
            style={{ backgroundColor: '#000000' }}
          >
            {images.map((mediaUri, index) => (
              <MediaItem key={index} uri={mediaUri} index={index} isActive={index === currentIndex} />
            ))}
          </ScrollView>

        {/* Bottom Section with Dots and Description */}
        <View className="absolute bottom-0 left-0 right-0 z-10" style={{ paddingBottom: 20 }}>
          {/* Dots Indicator - 5px below image */}
          {images.length > 1 && (
            <View className="flex-row justify-center" style={{ marginBottom: 12 }}>
              <View className="flex-row bg-black/50 rounded-full px-3 py-2">
                {images.map((_, index) => (
                  <View
                    key={index}
                    className={`w-2 h-2 rounded-full mx-1 ${
                      index === currentIndex ? "bg-white" : "bg-white/40"
                    }`}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Post Description Box */}
          {postContent && (
            <View className="mx-4 p-4 border-2 border-gray-400 rounded-lg" style={{ backgroundColor: 'transparent', marginBottom: 8 }}>
              {username && (
                <Text className="text-white font-semibold text-sm mb-1">
                  {username}
                </Text>
              )}
              <Text className="text-white text-base leading-5">
                {postContent}
              </Text>
            </View>
          )}

          {/* Action Strip - Like, Bookmark, Message */}
          <View className="mx-4 px-4 py-3 border border-gray-400 rounded-lg flex-row items-center justify-around" style={{ backgroundColor: 'transparent' }}>
            <TouchableOpacity
              className="flex-row items-center"
              onPress={handleLike}
              disabled={!currentUser?.id}
            >
              <Heart
                size={20}
                color={isLiked ? "#e91e63" : "white"}
                fill={isLiked ? "#e91e63" : "none"}
                strokeWidth={1.5}
              />
              <Text className={`ml-2 font-medium ${isLiked ? 'text-pink-500' : 'text-white'}`}>
                {likesCount > 0 ? likesCount : 'Like'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center"
              onPress={handleBookmark}
              disabled={!currentUser?.id}
            >
              <Bookmark
                size={20}
                color={isBookmarked ? "#1976d2" : "white"}
                fill={isBookmarked ? "#1976d2" : "none"}
                strokeWidth={1.5}
              />
              <Text className={`ml-2 font-medium ${isBookmarked ? 'text-blue-500' : 'text-white'}`}>
                {isBookmarked ? 'Saved' : 'Save'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center"
              onPress={handleMessage}
            >
              <MessageCircle size={20} color="white" strokeWidth={1.5} />
              <Text className="text-white ml-2 font-medium">Message</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </GestureHandlerRootView>

      {/* Error Popup */}
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
        postContent={postContent || ""}
      />

      {/* Report Modal */}
      {currentUser?.id && postUserId && (
        <ReportPostModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          postId={postId}
          postContent={
            postContent
              ? postContent.substring(0, 50) + (postContent.length > 50 ? "..." : "")
              : ""
          }
          postOwnerId={postUserId}
          currentUserId={currentUser.id}
          onReportSuccess={() => {
            setShowReportModal(false);
            onClose();
          }}
        />
      )}
    </Modal>
  );
}