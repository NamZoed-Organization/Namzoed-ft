import FullscreenVideoPlayer from "@/components/FullscreenVideoPlayer";
import ImageViewer from "@/components/ImageViewer";
import { useVideoCache } from "@/contexts/VideoCacheContext";
import { PostData } from "@/types/post";
// ✅ USING THE NEW, NON-DEPRECATED LIBRARY
import { VideoView, useVideoPlayer } from "expo-video";
import {
  Bookmark,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Play,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export { default as PostSkeleton } from "@/components/ui/PostSkeleton";

interface FeedPostProps {
  post: PostData;
  isVisible?: boolean; 
}

const formatDate = (date: Date): string => {
  const now = new Date();
  const diffInHours = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60)
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

const ImageSkeleton = ({ width, height }: { width: string; height: string }) => {
  const shimmerOpacity = React.useRef(new Animated.Value(0.3)).current;
  const animationRef = React.useRef<Animated.CompositeAnimation | null>(null);

  React.useEffect(() => {
    animationRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmerOpacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animationRef.current.start();

    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, []); // Remove shimmerOpacity from deps to prevent recreation

  return <Animated.View className="bg-gray-300 absolute inset-0 rounded-lg" style={{ opacity: shimmerOpacity }} />;
};

const PostImage = ({ imageUri, onPress, className, style }: any) => {
  const [imageLoading, setImageLoading] = useState(true);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} className={className} style={style}>
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
  onPress,
  className,
  style,
  videoId,
  postContent,
  username,
  likes,
  comments,
  isVisible = false
}: any) => {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [videoLoading, setVideoLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const isMounted = useRef(true);
  const statusSubscriptionRef = useRef<any>(null);
  const { registerPlayer, releasePlayer } = useVideoCache();

  // ✅ 1. Setup Player (New Library)
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = true;
    player.muted = true;
  });

  // Register player with cache
  useEffect(() => {
    if (player) {
      registerPlayer(videoId, player, videoUri);
    }
  }, [player, videoId, videoUri, registerPlayer]);

  // ✅ 2. Event Listeners (FIXED TYPE ERROR HERE)
  useEffect(() => {
    if (!player) return;

    statusSubscriptionRef.current = player.addListener('statusChange', (payload) => {
      // We access 'payload.status' now
      if (isMounted.current && payload.status === 'readyToPlay') {
        setVideoLoading(false);
        setDuration(player.duration);
      }
    });

    return () => {
      if (statusSubscriptionRef.current) {
        statusSubscriptionRef.current.remove();
        statusSubscriptionRef.current = null;
      }
    };
  }, [player]);

  // 3. Visibility Logic - Only play if visible and not in fullscreen
  useEffect(() => {
    if (!player) return;

    if (isVisible && !showFullscreen) {
        player.play();
    } else {
        player.pause();
    }
  }, [isVisible, player, showFullscreen]);

  // 4. Cleanup - Properly release player
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;

      // Clean up listeners
      if (statusSubscriptionRef.current) {
        statusSubscriptionRef.current.remove();
        statusSubscriptionRef.current = null;
      }

      // Pause and release from cache
      if (player) {
        player.pause();
      }

      // Release player from cache (it will handle cleanup)
      releasePlayer(videoId);
    };
  }, [player, videoId, releasePlayer]);

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => {
            player.pause();
            setShowFullscreen(true);
        }}
        activeOpacity={0.85}
        className={className}
        style={[videoPreviewStyles.container, style]}
      >
        <View style={videoPreviewStyles.videoWrapper}>
          {videoLoading && (
            <View style={videoPreviewStyles.loadingOverlay}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
          )}

          {/* ✅ New Component from expo-video */}
          <VideoView
            player={player}
            style={videoPreviewStyles.videoPlayer}
            nativeControls={false}
            contentFit="cover"
          />

          <View style={videoPreviewStyles.overlay}>
            <View style={videoPreviewStyles.playButton}>
              <Play size={52} color="#000" fill="#000" strokeWidth={0} />
            </View>
          </View>

          {!videoLoading && duration > 0 && (
            <View style={videoPreviewStyles.durationBadge}>
              <Text style={videoPreviewStyles.durationText}>
                {formatDuration(duration)}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <FullscreenVideoPlayer
        visible={showFullscreen}
        videoUri={videoUri}
        videoId={videoId}
        onClose={() => {
            setShowFullscreen(false);
            if (isVisible) player.play();
        }}
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
  isVisible?: boolean
) => {
  if (images.length === 0) return null;

  const renderMediaItem = (
    mediaUri: string,
    index: number,
    className: string,
    style?: any
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
    return <View className="mt-3 rounded-lg overflow-hidden">{renderMediaItem(images[0], 0, "w-full h-64")}</View>;
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
              <Text className="text-white font-bold text-xl">+{remainingCount}</Text>
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

  const handleLike = () => { setIsLiked(!isLiked); setLikesCount(isLiked ? likesCount - 1 : likesCount + 1); };
  const handleBookmark = () => setIsBookmarked(!isBookmarked);
  const handleImagePress = (index: number) => { setSelectedImageIndex(index); setShowImageViewer(true); };

  return (
    <View className="bg-white border-b border-gray-200">
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center flex-1">
          <View className="w-10 h-10 rounded-full bg-gray-300 items-center justify-center mr-3 overflow-hidden">
             {post.profilePic ? (
               <Image source={{ uri: post.profilePic }} className="w-full h-full" />
             ) : (
               <Text className="text-gray-600 font-semibold">{post.username?.charAt(0) || "U"}</Text>
             )}
          </View>
          <View className="flex-1">
            <Text className="font-semibold text-gray-900 text-base">{post.username || "Unknown"}</Text>
            <Text className="text-gray-500 text-sm">{formatDate(post.date)}</Text>
          </View>
        </View>
        <MoreHorizontal size={20} color="#666" />
      </View>

      <View className="px-4"><Text className="text-gray-900 text-base leading-6">{post.content}</Text></View>

      <View className="px-4">
        {renderImages(
          post.images,
          handleImagePress,
          post.id,
          post.content,
          post.username,
          likesCount,
          post.comments,
          isVisible
        )}
      </View>

      <View className="border-t border-gray-200 px-4 py-4">
        <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
                <TouchableOpacity onPress={handleLike} className="flex-row items-center mr-6">
                    <Heart size={20} color={isLiked ? "#e91e63" : "#666"} fill={isLiked ? "#e91e63" : "none"} />
                    <Text className="ml-1 font-medium text-gray-600">{likesCount}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleBookmark} className="flex-row items-center">
                    <Bookmark size={20} color={isBookmarked ? "#1976d2" : "#666"} fill={isBookmarked ? "#1976d2" : "none"} />
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
    </View>
  );
}

const videoPreviewStyles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
    height: 300,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden'
  },
  videoWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative'
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10
  },
  videoPlayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)'
  },
  playButton: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 50,
    padding: 15
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 4,
    borderRadius: 4
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold'
  },
});