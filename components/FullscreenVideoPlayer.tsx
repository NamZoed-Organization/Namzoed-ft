import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { useVideoPlayer, VideoView } from "expo-video";
import { Heart, MessageCircle, Share2, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface Video {
  uri: string;
  id: string;
}

interface FullscreenVideoPlayerProps {
  visible: boolean;
  videos: Video[];
  onClose: () => void;
}

interface VideoItemProps {
  video: Video;
  isActive: boolean;
  index: number;
  totalVideos: number;
}

function VideoItem({ video, isActive, index, totalVideos }: VideoItemProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);

  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const player = useVideoPlayer(video.uri, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    if (isActive && player) {
      player.play();
      setIsPlaying(true);
    } else if (player) {
      player.pause();
      setIsPlaying(false);
    }
  }, [isActive, player]);

  useEffect(() => {
    if (!player) return;

    const interval = setInterval(() => {
      if (player.currentTime !== undefined) {
        setCurrentTime(player.currentTime);
      }
      if (player.duration !== undefined) {
        setDuration(player.duration);
      }
      setIsPlaying(player.playing);
    }, 100);

    return () => clearInterval(interval);
  }, [player]);

  const resetControlsTimeout = () => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    setShowControls(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setShowControls(false));
      }
    }, 3000);
  };

  const togglePlayPause = () => {
    if (player) {
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
      setIsPlaying(!isPlaying);
    }
    resetControlsTimeout();
  };

  const onSeek = (value: number) => {
    if (player) {
      player.currentTime = value;
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setLikeCount(isLiked ? likeCount - 1 : likeCount + 1);
  };

  return (
    <View style={styles.videoContainer}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
      />

      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={resetControlsTimeout}
      />

      {showControls && (
        <Animated.View
          style={[styles.controlsOverlay, { opacity: fadeAnim }]}
          pointerEvents="box-none"
        >
          {totalVideos > 1 && (
            <View style={styles.videoCounter} pointerEvents="none">
              <Text style={styles.videoCounterText}>
                {index + 1} / {totalVideos}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.centerPlayButton}
            onPress={togglePlayPause}
          >
            <View style={styles.centerPlayButtonBg}>
              <Text style={styles.playPauseIcon}>{isPlaying ? "❚❚" : "▶"}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.bottomControls} pointerEvents="box-none">
            <View style={styles.progressContainer} pointerEvents="auto">
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Slider
                style={styles.progressBar}
                minimumValue={0}
                maximumValue={duration || 1}
                value={currentTime}
                onSlidingComplete={onSeek}
                minimumTrackTintColor="#CC785C"
                maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
                thumbTintColor="#CC785C"
              />
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>
        </Animated.View>
      )}

      <View style={styles.bottomSection} pointerEvents="box-none">
        <View style={styles.postContentBox} pointerEvents="none">
          <Text style={styles.usernameText}>You</Text>
          <Text style={styles.contentText}>Uploaded Video {index + 1}</Text>
        </View>
        <View style={styles.actionStrip} pointerEvents="auto">
          <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
            <Heart
              size={20}
              color={isLiked ? "#FF4458" : "white"}
              fill={isLiked ? "#FF4458" : "none"}
            />
            <Text style={styles.actionText}>
              {likeCount > 0 ? likeCount : "Like"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <MessageCircle size={20} color="white" />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <Share2 size={20} color="white" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {totalVideos > 1 && showControls && (
        <Animated.View
          style={[styles.swipeHint, { opacity: fadeAnim }]}
          pointerEvents="none"
        >
          <Text style={styles.swipeHintText}>↕ Swipe to browse videos</Text>
        </Animated.View>
      )}
    </View>
  );
}

export default function FullscreenVideoPlayer({
  visible,
  videos,
  onClose,
}: FullscreenVideoPlayerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index;
      setCurrentIndex(index);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }).current;

  useEffect(() => {
    if (visible) {
      setCurrentIndex(0);
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: 0, animated: false });
      }, 100);
    }
  }, [visible]);

  const handleClose = () => {
    setCurrentIndex(0);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <StatusBar hidden />
      <View style={styles.container}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeButton}
          activeOpacity={0.7}
        >
          <X size={28} color="#fff" />
        </TouchableOpacity>

        <FlatList
          ref={flatListRef}
          data={videos}
          renderItem={({ item, index }) => (
            <VideoItem
              video={item}
              isActive={index === currentIndex}
              index={index}
              totalVideos={videos.length}
            />
          )}
          keyExtractor={(item) => item.id}
          pagingEnabled
          snapToInterval={SCREEN_HEIGHT}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          removeClippedSubviews
          maxToRenderPerBatch={2}
          windowSize={3}
          getItemLayout={(_, index) => ({
            length: SCREEN_HEIGHT,
            offset: SCREEN_HEIGHT * index,
            index,
          })}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  videoContainer: {
    width: "100%",
    height: SCREEN_HEIGHT,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    top: 60,
    left: 16,
    zIndex: 50,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 50,
    padding: 8,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  videoCounter: {
    position: "absolute",
    top: 60,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  videoCounterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  centerPlayButton: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -40 }, { translateY: -40 }],
  },
  centerPlayButtonBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.8)",
  },
  playPauseIcon: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },
  bottomControls: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 40,
  },
  timeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    minWidth: 40,
  },
  bottomSection: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingBottom: 20,
  },
  postContentBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 8,
  },
  usernameText: {
    color: "#fff",
    fontWeight: "bold",
    marginBottom: 4,
  },
  contentText: {
    color: "#fff",
  },
  actionStrip: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionText: {
    color: "#fff",
    fontSize: 12,
  },
  swipeHint: {
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  swipeHintText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "600",
  },
});
