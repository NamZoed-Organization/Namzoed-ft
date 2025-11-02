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
} from "react-native";
import { X, Heart, MessageCircle, Share2 } from "lucide-react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

interface ImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
  postContent?: string;
  username?: string;
  likes?: number;
  comments?: number;
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

  // Check when video is ready to play
  useEffect(() => {
    if (!isVideo || !player) return;

    const interval = setInterval(() => {
      if (player.status === 'readyToPlay') {
        setVideoLoading(false);
      }
    }, 100);

    return () => clearInterval(interval);
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
}: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(likes);

  const handleLike = () => {
    if (isLiked) {
      setIsLiked(false);
      setLikesCount(likesCount - 1);
    } else {
      setIsLiked(true);
      setLikesCount(likesCount + 1);
    }
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

            {images.length > 1 && (
              <View className="bg-black/50 rounded-full px-3 py-1">
                <Text className="text-white font-medium">
                  {currentIndex + 1} / {images.length}
                </Text>
              </View>
            )}
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

          {/* Action Strip - Likes, Comments, Share */}
          <View className="mx-4 px-4 py-3 border border-gray-400 rounded-lg flex-row items-center justify-around" style={{ backgroundColor: 'transparent' }}>
            <TouchableOpacity className="flex-row items-center" onPress={handleLike}>
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

            <TouchableOpacity className="flex-row items-center">
              <MessageCircle size={20} color="white" strokeWidth={1.5} />
              <Text className="text-white ml-2 font-medium">
                {comments > 0 ? comments : 'Comment'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity className="flex-row items-center">
              <Share2 size={20} color="white" strokeWidth={1.5} />
              <Text className="text-white ml-2 font-medium">Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}