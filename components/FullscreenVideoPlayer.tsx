import React, { useState, useEffect } from "react";
import {
  View,
  TouchableOpacity,
  Modal,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  Text,
} from "react-native";
import { X, Heart, MessageCircle, Share2, Play, Pause, RotateCw } from "lucide-react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useVideoPlayback } from "@/contexts/VideoPlaybackContext";
import Slider from "@react-native-community/slider";

interface FullscreenVideoPlayerProps {
  visible: boolean;
  videoUri: string;
  videoId: string;
  onClose: () => void;
  postContent?: string;
  username?: string;
  likes?: number;
  comments?: number;
}

const { width: screenWidth } = Dimensions.get("window");

export default function FullscreenVideoPlayer({
  visible,
  videoUri,
  videoId,
  onClose,
  postContent,
  username,
  likes = 0,
  comments = 0,
}: FullscreenVideoPlayerProps) {
  const [videoLoading, setVideoLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(likes);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasEnded, setHasEnded] = useState(false);
  const { currentlyPlayingId, play, pause } = useVideoPlayback();
  const isPlaying = currentlyPlayingId === videoId;

  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  const handleLike = () => {
    if (isLiked) {
      setIsLiked(false);
      setLikesCount(likesCount - 1);
    } else {
      setIsLiked(true);
      setLikesCount(likesCount + 1);
    }
  };

  // Monitor video status
  useEffect(() => {
    if (!visible) return;

    const interval = setInterval(() => {
      if (player.status === "readyToPlay") {
        setVideoLoading(false);
        setDuration(player.duration);
      }

      // Update current time
      setCurrentTime(player.currentTime);

      // Check if ended
      if (player.currentTime >= player.duration - 0.1 && player.duration > 0) {
        if (!hasEnded) {
          setHasEnded(true);
          pause(videoId);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [player, visible, hasEnded, videoId, pause]);

  // Handle play/pause based on global state
  useEffect(() => {
    if (!visible) return;

    if (isPlaying && !hasEnded) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying, hasEnded, player, visible]);

  // Reset and play when modal opens
  useEffect(() => {
    if (visible) {
      setVideoLoading(true);
      setHasEnded(false);
      player.currentTime = 0;
      setCurrentTime(0);
      play(videoId);
    } else {
      pause(videoId);
      player.pause();
      player.currentTime = 0;
      setCurrentTime(0);
      setHasEnded(false);
    }
  }, [visible, videoId, play, pause, player]);

  const handleClose = () => {
    pause(videoId);
    player.pause();
    player.currentTime = 0;
    setHasEnded(false);
    onClose();
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pause(videoId);
    } else {
      play(videoId);
    }
  };

  const handleReplay = () => {
    setHasEnded(false);
    player.currentTime = 0;
    setCurrentTime(0);
    play(videoId);
    player.play();
  };

  const handleSliderChange = (value: number) => {
    player.currentTime = value;
    setCurrentTime(value);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <StatusBar hidden />
      <View className="flex-1 bg-black">
        {/* Back button - top left */}
        <TouchableOpacity
          onPress={handleClose}
          className="absolute top-12 left-4 z-20 bg-black/70 rounded-full p-3"
          activeOpacity={0.7}
        >
          <X size={28} color="#fff" />
        </TouchableOpacity>

        {/* Video player */}
        <View className="flex-1 items-center justify-center">
          {videoLoading && (
            <View className="absolute inset-0 items-center justify-center z-10">
              <ActivityIndicator size="large" color="white" />
              <Text className="text-white mt-4">Loading video...</Text>
            </View>
          )}

          <VideoView
            player={player}
            style={{ width: screenWidth, height: screenWidth * 1.2 }}
            nativeControls={false}
            contentFit="cover"
          />

          {/* Play/Pause/Replay button overlay */}
          {!videoLoading && (
            <View className="absolute inset-0 items-center justify-center">
              {hasEnded ? (
                <TouchableOpacity
                  onPress={handleReplay}
                  className="bg-white/90 rounded-full p-6"
                  activeOpacity={0.8}
                >
                  <RotateCw size={48} color="#000" />
                </TouchableOpacity>
              ) : !isPlaying ? (
                <TouchableOpacity
                  onPress={handlePlayPause}
                  className="bg-white/90 rounded-full p-6"
                  activeOpacity={0.8}
                >
                  <Play size={48} color="#000" fill="#000" />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Simple controls at bottom of video */}
          {!videoLoading && !hasEnded && (
            <View className="absolute bottom-0 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-black/80 to-transparent">
              <View className="flex-row items-center gap-3">
                <TouchableOpacity onPress={handlePlayPause} className="p-2">
                  {isPlaying ? (
                    <Pause size={24} color="#fff" fill="#fff" />
                  ) : (
                    <Play size={24} color="#fff" fill="#fff" />
                  )}
                </TouchableOpacity>

                <Text className="text-white text-xs font-medium w-10">
                  {formatTime(currentTime)}
                </Text>

                <View className="flex-1">
                  <Slider
                    value={currentTime}
                    minimumValue={0}
                    maximumValue={duration || 1}
                    onSlidingComplete={handleSliderChange}
                    minimumTrackTintColor="#fff"
                    maximumTrackTintColor="#666"
                    thumbTintColor="#fff"
                  />
                </View>

                <Text className="text-white text-xs font-medium w-10">
                  {formatTime(duration)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Section - Same as ImageViewer */}
        <View className="absolute bottom-0 left-0 right-0 z-10" style={{ paddingBottom: 20 }}>
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
    </Modal>
  );
}
