import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";
import PostActionSheet from "@/components/modals/PostActionSheet";
import PostFeedbackOverlay from "@/components/modals/PostFeedbackOverlay";
import ReportPostModal from "@/components/modals/ReportPostModal";
import { useUser } from "@/contexts/UserContext";
import { deletePost } from "@/lib/postsService";
import { feedEvents } from "@/utils/feedEvents";
import * as Haptics from "expo-haptics";
import { VideoView, useVideoPlayer } from "expo-video";
import { ChevronLeft } from "lucide-react-native";
import CircularProgress from "@/components/ui/CircularProgress";
import CircularLoader from "@/components/ui/CircularLoader";
import { toLowResPreviewUrl } from "@/lib/imagePreview";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Image } from "expo-image";
import {
    Dimensions,
    Modal,
    Platform,
    ScrollView,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ImageViewerProps {
  visible: boolean;
  images: string[];
  /** BlurHash per image, aligned with `images`. */
  blurHashes?: (string | null)[];
  initialIndex: number;
  onClose: () => void;
  postId: string;
  postUserId: string;
  /** Not shown in the viewer itself — only feeds the delete/report confirmation copy. */
  postContent?: string;
}

const { width: screenWidth } = Dimensions.get("window");
const DISMISS_SWIPE_THRESHOLD = 90;
const EDGE_BACK_SWIPE_THRESHOLD = 50;

const isVideoUrl = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('post-videos');
};

// Zoomable image with pinch + pan (only when zoomed). When not zoomed: single
// tap or a vertical swipe closes the viewer; long-press surfaces report/delete.
const ZoomableImage = ({
  uri,
  placeholder,
  height,
  onClose,
  onLongPress,
  onZoomChange,
  onProgress,
  onLoad,
}: {
  uri: string;
  placeholder?: { blurhash: string } | { uri: string };
  height: number;
  onClose: () => void;
  onLongPress: () => void;
  onZoomChange?: (zoomed: boolean) => void;
  onProgress?: (e: { loaded: number; total: number }) => void;
  onLoad?: () => void;
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const notifyZoom = useCallback((zoomed: boolean) => {
    setIsZoomed(zoomed);
    onZoomChange?.(zoomed);
  }, [onZoomChange]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 5);
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(notifyZoom)(false);
      } else {
        savedScale.value = scale.value;
        runOnJS(notifyZoom)(true);
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(onClose)();
  });

  const longPressGesture = Gesture.LongPress().onStart(() => {
    runOnJS(onLongPress)();
  });

  // Vertical swipe-to-dismiss — only when not zoomed. activeOffsetY/failOffsetX
  // keep it from stealing horizontal swipes (those page the carousel).
  const dismissPanGesture = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .failOffsetX([-20, 20])
    .onEnd((e) => {
      if (Math.abs(e.translationY) > DISMISS_SWIPE_THRESHOLD) {
        runOnJS(onClose)();
      }
    });

  // When not zoomed: no repositioning pan — horizontal swipes pass through to
  // the carousel ScrollView, vertical ones dismiss.
  const composed = isZoomed
    ? Gesture.Race(tapGesture, longPressGesture, Gesture.Simultaneous(pinchGesture, panGesture))
    : Gesture.Race(tapGesture, longPressGesture, pinchGesture, dismissPanGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          { width: screenWidth, height, justifyContent: 'center', alignItems: 'center' },
          animatedStyle,
        ]}
      >
        <Image
          source={{ uri }}
          placeholder={placeholder}
          placeholderContentFit="contain"
          contentFit="contain"
          transition={260}
          cachePolicy="memory-disk"
          onProgress={onProgress}
          onLoad={onLoad}
          style={{ width: '100%', height: '100%' }}
        />
      </Animated.View>
    </GestureDetector>
  );
};

const MediaItem = ({
  uri,
  blurhash,
  height,
  isActive,
  onClose,
  onLongPress,
  onZoomChange,
}: {
  uri: string;
  blurhash?: string | null;
  height: number;
  isActive?: boolean;
  onClose: () => void;
  onLongPress: () => void;
  onZoomChange?: (zoomed: boolean) => void;
}) => {
  const isVideo = isVideoUrl(uri);
  const [videoLoading, setVideoLoading] = useState(true);

  // Blurred/pixelated preview: BlurHash if available, else a tiny low-res
  // transform of the image itself so a preview shows without a backfill.
  const placeholder = useMemo(() => {
    if (blurhash) return { blurhash };
    const lowRes = toLowResPreviewUrl(uri);
    return lowRes ? { uri: lowRes } : undefined;
  }, [blurhash, uri]);

  // Thin circular 0→100% download ring (image only). Rendered as a sibling of
  // the zoomable image so it stays centered while the photo is pinched/panned.
  const imgProgress = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const [ringMounted, setRingMounted] = useState(true);
  const unmountRing = useCallback(() => setRingMounted(false), []);
  const handleImgProgress = useCallback(
    (e: { loaded: number; total: number }) => {
      if (e.total <= 0) return;
      const next = Math.min(1, e.loaded / e.total);
      if (ringOpacity.value === 0 && next < 1) {
        ringOpacity.value = withTiming(1, { duration: 120 });
      }
      imgProgress.value = withTiming(next, { duration: 120 });
    },
    [imgProgress, ringOpacity],
  );
  const handleImgLoad = useCallback(() => {
    imgProgress.value = withTiming(1, { duration: 140 }, () => {
      ringOpacity.value = withTiming(0, { duration: 220 }, (done) => {
        if (done) runOnJS(unmountRing)();
      });
    });
  }, [imgProgress, ringOpacity, unmountRing]);

  const player = isVideo
    ? useVideoPlayer({ uri, useCaching: true }, (p) => { p.loop = true; p.muted = false; })
    : null;

  useEffect(() => {
    if (!isVideo || !player) return;
    const sub = player.addListener('statusChange', (payload) => {
      if (payload.status === 'readyToPlay') setVideoLoading(false);
    });
    return () => sub.remove();
  }, [player, isVideo]);

  useEffect(() => {
    if (isVideo && player) {
      if (isActive) player.play();
      else player.pause();
    }
  }, [isActive, isVideo, player]);

  if (isVideo) {
    return (
      <TouchableWithoutFeedback onPress={onClose} onLongPress={onLongPress}>
        <View style={{ width: screenWidth, height, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
          {videoLoading && (
            <View style={{ position: 'absolute', alignItems: 'center' }}>
              <CircularLoader size="large" color="white" />
            </View>
          )}
          {player && (
            <VideoView player={player} style={{ width: '100%', height: '100%' }} nativeControls contentFit="contain" />
          )}
        </View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <View style={{ width: screenWidth, height, backgroundColor: '#000' }}>
      <ZoomableImage
        uri={uri}
        placeholder={placeholder}
        height={height}
        onClose={onClose}
        onLongPress={onLongPress}
        onZoomChange={onZoomChange}
        onProgress={handleImgProgress}
        onLoad={handleImgLoad}
      />
      {ringMounted ? (
        <CircularProgress progress={imgProgress} opacity={ringOpacity} />
      ) : null}
    </View>
  );
};

export default function ImageViewer({
  visible,
  images,
  blurHashes,
  initialIndex,
  onClose,
  postId,
  postUserId,
  postContent = "",
}: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showFeedbackOverlay, setShowFeedbackOverlay] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();

  const [carouselScrollEnabled, setCarouselScrollEnabled] = useState(true);
  // Measured from the actual media area's onLayout rather than assumed from
  // Dimensions — a static Dimensions snapshot can be stale/wrong (esp. on
  // Android) and was previously making the media box the wrong size.
  const [mediaHeight, setMediaHeight] = useState(() => Dimensions.get("window").height);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setCarouselScrollEnabled(true);
    }
  }, [visible, initialIndex]);

  const isOwnPost = currentUser?.id === postUserId;

  // Same pattern as the underlying post-detail media: long-press surfaces
  // delete for the post owner, or the report overlay for everyone else.
  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOwnPost) {
      setShowActionSheet(true);
    } else {
      setShowFeedbackOverlay(true);
    }
  }, [isOwnPost]);

  const handleReportFromOverlay = useCallback(() => {
    setShowFeedbackOverlay(false);
    setShowReportModal(true);
  }, []);

  const handleConfirmDelete = async () => {
    try {
      await deletePost(postId);
      setShowDeleteConfirmation(false);
      onClose();
      feedEvents.emit('postDeleted', postId);
    } catch { setShowDeleteConfirmation(false); }
  };

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    setCurrentIndex(index);
  };

  const topInset = Platform.OS === "ios" ? (insets.top || 44) : (insets.top || 0) + 8;

  // Thin left-edge strip for an iOS-style edge-swipe-back gesture, kept as its
  // own gesture so it works regardless of which image is currently showing
  // and doesn't have to fight the carousel's own horizontal paging.
  const edgeBackGesture = Gesture.Pan()
    .onEnd((e) => {
      if (e.translationX > EDGE_BACK_SWIPE_THRESHOLD && Math.abs(e.translationY) < EDGE_BACK_SWIPE_THRESHOLD) {
        runOnJS(onClose)();
      }
    });

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>

          {/* Back button — always visible */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: 'absolute',
              top: topInset + 8,
              left: 16,
              zIndex: 20,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderRadius: 20,
              borderCurve: "continuous",
              padding: 7,
            }}
          >
            <ChevronLeft size={22} color="white" />
          </TouchableOpacity>

          {/* Image/video, true screen center */}
          <View
            style={{ flex: 1, justifyContent: 'center' }}
            onLayout={(e) => setMediaHeight(e.nativeEvent.layout.height)}
          >
            <ScrollView
              horizontal
              pagingEnabled
              scrollEnabled={carouselScrollEnabled}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              contentOffset={{ x: initialIndex * screenWidth, y: 0 }}
              scrollEventThrottle={16}
              style={{ height: mediaHeight }}
            >
              {images.map((mediaUri, index) => (
                <MediaItem
                  key={index}
                  uri={mediaUri}
                  blurhash={blurHashes?.[index]}
                  height={mediaHeight}
                  isActive={index === currentIndex}
                  onClose={onClose}
                  onLongPress={handleLongPress}
                  onZoomChange={(zoomed) => setCarouselScrollEnabled(!zoomed)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Left-edge swipe-back strip */}
          {carouselScrollEnabled && (
            <GestureDetector gesture={edgeBackGesture}>
              <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 24, zIndex: 15 }} />
            </GestureDetector>
          )}

          {/* Report overlay for long-press on someone else's post — must live
              inside this Modal's tree since it's a plain absolute-fill View,
              not its own native Modal. */}
          <PostFeedbackOverlay
            visible={showFeedbackOverlay}
            onClose={() => setShowFeedbackOverlay(false)}
            onReport={handleReportFromOverlay}
          />

        </View>
      </GestureHandlerRootView>

      {/* embedded: these render as absolute-fill overlays instead of nested
          native Modals — stacking a Modal inside this already-open one is
          unreliable on iOS (status bar / safe area math gets thrown off
          regardless of statusBarTranslucent). */}
      <PostActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        isOwnPost={isOwnPost}
        onDelete={() => { setShowActionSheet(false); setShowDeleteConfirmation(true); }}
        onReport={() => { setShowActionSheet(false); setShowReportModal(true); }}
        embedded
      />

      <DeleteConfirmationModal
        visible={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleConfirmDelete}
        postContent={postContent}
        embedded
      />

      {currentUser?.id && postUserId && (
        <ReportPostModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          postId={postId}
          postContent={postContent.substring(0, 50) + (postContent.length > 50 ? "..." : "")}
          postOwnerId={postUserId}
          currentUserId={currentUser.id}
          onReportSuccess={() => { setShowReportModal(false); onClose(); }}
          embedded
        />
      )}
    </Modal>
  );
}
