import { Heart, MessageCircle, Pause, Play, RotateCw, Share2, SkipBack, SkipForward, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
// ✅ USING THE NEW LIBRARY
import { useVideoPlayback } from "@/contexts/VideoPlaybackContext";
import Slider from "@react-native-community/slider";
import { VideoView, useVideoPlayer } from "expo-video";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";

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
  const [controlsVisible, setControlsVisible] = useState(true);

  const { currentlyPlayingId, play, pause } = useVideoPlayback();
  const isPlaying = currentlyPlayingId === videoId;

  const isMounted = useRef(true);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = false;
    player.muted = false;
  });

  // Drag-to-close gesture
  const translateY = useSharedValue(0);
  const dragContext = useSharedValue({ y: 0 });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      dragContext.value = { y: translateY.value };
    })
    .onUpdate((e) => {
      // Only allow dragging down
      if (e.translationY > 0) {
        translateY.value = e.translationY + dragContext.value.y;
      }
    })
    .onEnd((e) => {
      if (translateY.value > 100 || e.velocityY > 500) {
        // Close the modal
        translateY.value = withTiming(1000, { duration: 250 }, (finished) => {
          if (finished) {
            runOnJS(handleClose)();
          }
        });
      } else {
        // Spring back to original position
        translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (progressInterval.current) clearInterval(progressInterval.current);
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, []);

  // Reset translateY when modal opens
  useEffect(() => {
    if (visible) {
      translateY.value = 0;
    }
  }, [visible]);

  // ✅ EVENT LISTENER (FIXED TYPE ERROR)
  useEffect(() => {
    const statusListener = player.addListener('statusChange', (payload) => {
      if (!isMounted.current) return;
      // We check payload.status now
      if (payload.status === 'readyToPlay') {
        setVideoLoading(false);
        setDuration(player.duration);
      }
    });

    const endListener = player.addListener('playToEnd', () => {
        if (!isMounted.current) return;
        setHasEnded(true);
        pause(videoId);
        setControlsVisible(true);
    });

    return () => {
      statusListener.remove();
      endListener.remove();
    };
  }, [player, videoId, pause]);

  useEffect(() => {
    if (isPlaying && visible && !videoLoading && !hasEnded) {
        progressInterval.current = setInterval(() => {
            if (isMounted.current && player) {
                setCurrentTime(player.currentTime);
            }
        }, 250); 
    } else {
        if (progressInterval.current) clearInterval(progressInterval.current);
    }

    return () => {
        if (progressInterval.current) clearInterval(progressInterval.current);
    }
  }, [isPlaying, visible, videoLoading, hasEnded, player]);

  const handleLike = () => {
    if (isLiked) {
      setIsLiked(false);
      setLikesCount(likesCount - 1);
    } else {
      setIsLiked(true);
      setLikesCount(likesCount + 1);
    }
  };

  const handleClose = () => {
    pause(videoId);
    player.pause();
    setHasEnded(false);
    onClose();
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pause(videoId);
    } else {
      if (hasEnded) {
          handleReplay();
      } else {
          play(videoId);
      }
    }
    resetControlsTimeout();
  };

  const handleReplay = () => {
    setHasEnded(false);
    player.currentTime = 0;
    setCurrentTime(0);
    play(videoId);
    player.play();
  };

  useEffect(() => {
    if (!visible) return;
    if (isPlaying && !hasEnded) {
      player.play();
    } else {
      player.pause();
    }
  }, [isPlaying, hasEnded, player, visible]);

  useEffect(() => {
    if (visible) {
      if (!player.currentTime || player.currentTime === 0) {
        setVideoLoading(true);
      }
      setHasEnded(false);
      play(videoId);
      resetControlsTimeout();
    } else {
      pause(videoId);
      player.pause();
    }
  }, [visible, videoId]);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    setControlsVisible(true);
    controlsTimeout.current = setTimeout(() => {
      if (isMounted.current && isPlaying) {
        setControlsVisible(false);
      }
    }, 3000);
  }, [isPlaying]);

  const seekForward = useCallback(() => {
    const newTime = Math.min(currentTime + 5, duration);
    player.currentTime = newTime;
    setCurrentTime(newTime);
    resetControlsTimeout();
  }, [currentTime, duration, player, resetControlsTimeout]);

  const seekBackward = useCallback(() => {
    const newTime = Math.max(currentTime - 5, 0);
    player.currentTime = newTime;
    setCurrentTime(newTime);
    resetControlsTimeout();
  }, [currentTime, player, resetControlsTimeout]);

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
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <StatusBar hidden />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.container, animatedContainerStyle]}>
          {/* Drag Handle */}
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          <TouchableOpacity onPress={handleClose} style={styles.closeButton} activeOpacity={0.7}>
            <X size={28} color="#fff" />
          </TouchableOpacity>

        <View style={styles.videoWrapper}>
          {videoLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="white" />
              <Text style={styles.loadingText}>Loading video...</Text>
            </View>
          )}

          <VideoView
            player={player}
            style={{ width: screenWidth, height: screenWidth * 1.5 }}
            nativeControls={false}
            contentFit="contain" 
          />

          {!videoLoading && controlsVisible && (
            <View style={styles.centerControlOverlay}>
              {hasEnded ? (
                <TouchableOpacity onPress={handleReplay} style={styles.centerButton}>
                  <RotateCw size={48} color="#000" />
                </TouchableOpacity>
              ) : !isPlaying ? (
                <TouchableOpacity onPress={handlePlayPause} style={styles.centerButton}>
                  <Play size={48} color="#000" fill="#000" />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {!videoLoading && !hasEnded && controlsVisible && (
            <View style={styles.controlsContainer}>
              <View style={styles.controlsInner}>
                <View style={styles.progressSection}>
                  <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                  <View style={styles.sliderWrapper}>
                    <Slider
                      value={currentTime}
                      minimumValue={0}
                      maximumValue={duration || 1}
                      onSlidingComplete={handleSliderChange}
                      onSlidingStart={resetControlsTimeout}
                      minimumTrackTintColor="#fff"
                      maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
                      thumbTintColor="#fff"
                      style={{ width: '100%', height: 40 }}
                    />
                  </View>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>

                <View style={styles.buttonControls}>
                    <TouchableOpacity onPress={seekBackward} style={styles.controlButton}>
                        <SkipBack size={24} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handlePlayPause} style={[styles.controlButton, styles.playPauseButton]}>
                        {isPlaying ? <Pause size={28} color="#fff" fill="#fff" /> : <Play size={28} color="#fff" fill="#fff" />}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={seekForward} style={styles.controlButton}>
                        <SkipForward size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={styles.bottomSection}>
          {postContent && (
            <View style={styles.postContentBox}>
              {username && <Text style={styles.usernameText}>{username}</Text>}
              <Text style={styles.contentText}>{postContent}</Text>
            </View>
          )}
          <View style={styles.actionStrip}>
            <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
              <Heart size={20} color={isLiked ? "#ec4899" : "white"} fill={isLiked ? "#ec4899" : "none"} />
              <Text style={[styles.actionText, isLiked && styles.actionTextLiked]}>{likesCount > 0 ? likesCount : 'Like'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <MessageCircle size={20} color="white" />
              <Text style={styles.actionText}>{comments > 0 ? comments : 'Comment'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Share2 size={20} color="white" />
              <Text style={styles.actionText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
        </Animated.View>
      </GestureDetector>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dragHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 30,
  },
  dragHandle: {
    width: 60,
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 3,
  },
  closeButton: { position: 'absolute', top: 60, left: 16, zIndex: 40, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 50, padding: 8 },
  videoWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingOverlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' },
  loadingText: { color: '#fff', marginTop: 10 },
  centerControlOverlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' },
  centerButton: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 50, padding: 20 },
  controlsContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: 'rgba(0,0,0,0.3)' },
  controlsInner: { gap: 10 },
  progressSection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeText: { color: '#fff', fontSize: 12, width: 40, textAlign: 'center' },
  sliderWrapper: { flex: 1 },
  buttonControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 30, marginTop: 10 },
  controlButton: { padding: 8 },
  playPauseButton: { padding: 12, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 50 },
  bottomSection: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 20 },
  postContentBox: { marginHorizontal: 16, marginBottom: 10, padding: 12, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8 },
  usernameText: { color: '#fff', fontWeight: 'bold', marginBottom: 4 },
  contentText: { color: '#fff' },
  actionStrip: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.6)' },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: '#fff', fontSize: 12 },
  actionTextLiked: { color: '#ec4899' },
});