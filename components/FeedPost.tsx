import ImageViewer from "@/components/ImageViewer";
import { PostData } from "@/types/post";
import { VideoView, useVideoPlayer } from "expo-video";
import { Bookmark, Heart, MessageCircle, MoreHorizontal } from "lucide-react-native";
import React, { useState } from "react";
import { Animated, Image, Text, TouchableOpacity, View } from "react-native";

export { default as PostSkeleton } from "@/components/ui/PostSkeleton";

interface FeedPostProps {
  post: PostData;
}

const formatDate = (date: Date): string => {
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  
  if (diffInHours < 1) {
    return "Just now";
  } else if (diffInHours < 24) {
    return `${diffInHours}h`;
  } else {
    return date.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  }
};

// Helper to check if URL is a video
const isVideoUrl = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('post-videos');
};

const ImageSkeleton = ({ width, height }: { width: string; height: string }) => {
  const shimmerOpacity = React.useRef(new Animated.Value(0.3)).current;

  React.useEffect(() => {
    const shimmerAnimation = Animated.loop(
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
      ])
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, [shimmerOpacity]);

  return (
    <Animated.View
      className="bg-gray-300 absolute inset-0 rounded-lg"
      style={{ opacity: shimmerOpacity }}
    />
  );
};

const PostImage = ({
  imageUri,
  onPress,
  className,
  style
}: {
  imageUri: string;
  onPress: () => void;
  className?: string;
  style?: any;
}) => {
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
  style
}: {
  videoUri: string;
  onPress: () => void;
  className?: string;
  style?: any;
}) => {
  const [videoLoading, setVideoLoading] = useState(true);
  
  const player = useVideoPlayer(videoUri, player => {
    player.loop = true;
    player.muted = false;
  });

 React.useEffect(() => {
  const interval = setInterval(() => {
    if (player.status === 'readyToPlay') {
      setVideoLoading(false);
    }
  }, 100);

  return () => clearInterval(interval);
}, [player]);
  return (
    <View className={className} style={style}>
      <View className="relative">
        {videoLoading && <ImageSkeleton width="100%" height="100%" />}
        <VideoView
          player={player}
          style={{ width: '100%', height: '100%' }}
          nativeControls={true}
          contentFit="cover"
        />
      </View>
    </View>
  );
};

const renderImages = (images: string[], onImagePress: (index: number) => void) => {
  if (images.length === 0) return null;

  // Helper to render media item (image or video)
  const renderMediaItem = (mediaUri: string, index: number, className: string, style?: any) => {
    const isVideo = isVideoUrl(mediaUri);

    if (isVideo) {
      return (
        <PostVideo
          key={index}
          videoUri={mediaUri}
          onPress={() => onImagePress(index)}
          className={className}
          style={style}
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

  // For 3 or more images - Facebook layout
  const remainingCount = images.length - 3;

  return (
    <View className="mt-3 gap-1 rounded-lg overflow-hidden">
      {/* First row - single large media */}
      {renderMediaItem(images[0], 0, "w-full h-48")}

      {/* Second row - two smaller media items */}
      <View className="flex-row gap-1">
        {renderMediaItem(images[1], 1, "flex-1 h-32")}

        {/* Third media with overlay if more exist */}
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

export default function FeedPost({ post }: FeedPostProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [profilePicLoading, setProfilePicLoading] = useState(true);

  const handleLike = () => {
    if (isLiked) {
      setIsLiked(false);
      setLikesCount(likesCount - 1);
    } else {
      setIsLiked(true);
      setLikesCount(likesCount + 1);
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
  };

  const handleImagePress = (index: number) => {
    setSelectedImageIndex(index);
    setShowImageViewer(true);
  };

  return (
    <View className="bg-white border-b border-gray-200">
      {/* Post Header */}
      <View className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center flex-1">
          {/* Profile Picture */}
          <View className="w-10 h-10 rounded-full bg-gray-300 items-center justify-center mr-3 overflow-hidden relative">
            {post.profilePic ? (
              <>
                {profilePicLoading && <ImageSkeleton width="40" height="40" />}
                <Image
                  source={{ uri: post.profilePic }}
                  className="w-full h-full"
                  resizeMode="cover"
                  onLoad={() => setProfilePicLoading(false)}
                  onError={() => setProfilePicLoading(false)}
                />
              </>
            ) : (
              <Text className="text-gray-600 font-semibold">
                {post.username ? post.username.charAt(0).toUpperCase() : 'U'}
              </Text>
            )}
          </View>
          
          {/* User Info */}
          <View className="flex-1">
            <Text className="font-semibold text-gray-900 text-base">
              {post.username || 'Unknown User'}
            </Text>
            <Text className="text-gray-500 text-sm">
              {formatDate(post.date)}
            </Text>
          </View>
        </View>
        
        {/* Three Dots Menu */}
        <TouchableOpacity className="p-2">
          <MoreHorizontal size={20} color="#666" />
        </TouchableOpacity>
      </View>
      
      {/* Post Content */}
      <View className="px-4">
        <Text className="text-gray-900 text-base leading-6">
          {post.content}
        </Text>
      </View>
      
      {/* Post Images */}
      <View className="px-4">
        {renderImages(post.images, handleImagePress)}
      </View>
      
      {/* Action Buttons */}
      <View className="border-t border-gray-200 px-4 py-4">
        <View className="flex-row items-center justify-between">
          {/* Left side - Like and Bookmark */}
          <View className="flex-row items-center">
            <TouchableOpacity 
              className="flex-row items-center mr-6"
              onPress={handleLike}
            >
              <Heart 
                size={20} 
                color={isLiked ? "#e91e63" : "#666"} 
                fill={isLiked ? "#e91e63" : "none"}
                strokeWidth={1.5} 
              />
              <Text className={`ml-1 font-medium ${isLiked ? 'text-pink-600' : 'text-gray-600'}`}>
                {likesCount}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              className="flex-row items-center"
              onPress={handleBookmark}
            >
              <Bookmark 
                size={20} 
                color={isBookmarked ? "#1976d2" : "#666"} 
                fill={isBookmarked ? "#1976d2" : "none"}
                strokeWidth={1.5} 
              />
            </TouchableOpacity>
          </View>
          
          {/* Right side - Message */}
          <TouchableOpacity className="flex-row items-center">
            <MessageCircle size={20} color="#666" strokeWidth={1.5} />
            <Text className="ml-2 text-gray-600 font-medium">Message</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Viewer Modal */}
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