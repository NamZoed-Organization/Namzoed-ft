import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";
import PostActionSheet from "@/components/modals/PostActionSheet";
import ReportPostModal from "@/components/modals/ReportPostModal";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import { hasUserBookmarkedPost, togglePostBookmark } from "@/lib/bookmarkService";
import { getPostLikeCount, hasUserLikedPost, togglePostLike } from "@/lib/likesService";
import { deletePost } from "@/lib/postsService";
import { feedEvents } from "@/utils/feedEvents";
import { useAppRouter } from "@/utils/navigation";
import { VideoView, useVideoPlayer } from "expo-video";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, X } from "lucide-react-native";
import CircularProgress from "@/components/ui/CircularProgress";
import { toLowResPreviewUrl } from "@/lib/imagePreview";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Platform,
    ScrollView,
    Text,
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
  postContent?: string;
  username?: string;
  likes?: number;
  comments?: number;
  postId: string;
  postUserId: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const MEDIA_HEIGHT = screenHeight * 0.7;

const isVideoUrl = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext)) || lowerUrl.includes('post-videos');
};

// Zoomable image with pinch + pan (only when zoomed) + single-tap to toggle UI
const ZoomableImage = ({
  uri,
  placeholder,
  onToggleUI,
  onZoomChange,
  onProgress,
  onLoad,
}: {
  uri: string;
  placeholder?: { blurhash: string } | { uri: string };
  onToggleUI?: () => void;
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
    if (onToggleUI) runOnJS(onToggleUI)();
  });

  // When not zoomed: no pan — horizontal swipes pass through to the carousel ScrollView
  // When zoomed: add pan so the image can be moved around
  const composed = isZoomed
    ? Gesture.Race(tapGesture, Gesture.Simultaneous(pinchGesture, panGesture))
    : Gesture.Race(tapGesture, pinchGesture);

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
          { width: screenWidth, height: MEDIA_HEIGHT, justifyContent: 'center', alignItems: 'center' },
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
  index,
  isActive,
  onToggleUI,
  onZoomChange,
}: {
  uri: string;
  blurhash?: string | null;
  index: number;
  isActive?: boolean;
  onToggleUI?: () => void;
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
      <TouchableWithoutFeedback onPress={onToggleUI}>
        <View style={{ width: screenWidth, height: MEDIA_HEIGHT, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
          {videoLoading && (
            <View style={{ position: 'absolute', alignItems: 'center' }}>
              <ActivityIndicator size="large" color="white" />
              <Text style={{ color: 'white', marginTop: 12 }}>Loading video...</Text>
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
    <View style={{ width: screenWidth, height: MEDIA_HEIGHT, backgroundColor: '#000' }}>
      <ZoomableImage
        uri={uri}
        placeholder={placeholder}
        onToggleUI={onToggleUI}
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
  const insets = useSafeAreaInsets();
  const router = useAppRouter();

  const [carouselScrollEnabled, setCarouselScrollEnabled] = useState(true);

  // Tap-to-toggle UI (close button always visible)
  const showUIRef = useRef(true);
  const [showUI, setShowUI] = useState(true);
  const uiOpacity = useSharedValue(1);

  const toggleUI = useCallback(() => {
    const next = !showUIRef.current;
    showUIRef.current = next;
    setShowUI(next);
    uiOpacity.value = withTiming(next ? 1 : 0, { duration: 180 });
  }, [uiOpacity]);

  const uiAnimStyle = useAnimatedStyle(() => ({ opacity: uiOpacity.value }));

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setCarouselScrollEnabled(true);
      showUIRef.current = true;
      setShowUI(true);
      uiOpacity.value = 1;
    }
  }, [visible, initialIndex]);

  const isOwnPost = currentUser?.id === postUserId;

  const showErrorPopup = (msg: string) => {
    setPopupMessage(msg);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  useEffect(() => {
    if (!visible) return;
    const checkStatus = async () => {
      if (!currentUser?.id) return;
      const [liked, bookmarked, count] = await Promise.all([
        hasUserLikedPost(postId, currentUser.id),
        hasUserBookmarkedPost(postId, currentUser.id),
        getPostLikeCount(postId),
      ]);
      setIsLiked(liked);
      setIsBookmarked(bookmarked);
      setLikesCount(count);
    };
    checkStatus();
  }, [visible, currentUser?.id, postId]);

  const handleLike = async () => {
    if (!currentUser?.id) return;
    const prev = isLiked;
    const prevCount = likesCount;
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);
    try {
      const result = await togglePostLike(postId, currentUser.id, isLiked);
      if (!result.success) { setIsLiked(prev); setLikesCount(prevCount); }
      else { setIsLiked(result.isLiked); setLikesCount(result.likeCount); }
    } catch {
      setIsLiked(prev); setLikesCount(prevCount);
    }
  };

  const handleBookmark = async () => {
    if (!currentUser?.id) return;
    const prev = isBookmarked;
    setIsBookmarked(!isBookmarked);
    try {
      const result = await togglePostBookmark(postId, currentUser.id, isBookmarked);
      if (!result.success) setIsBookmarked(prev);
      else setIsBookmarked(result.isBookmarked);
    } catch { setIsBookmarked(prev); }
  };

  const handleMessage = () => {
    if (!currentUser?.id) { showErrorPopup("Please sign in to send messages"); return; }
    if (isOwnPost) { showErrorPopup("You cannot send a message to your own post"); return; }
    onClose();
    router.push(`/(users)/chat/${postUserId}` as any);
  };

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

          {/* ── Close button — always visible ── */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: 'absolute',
              top: topInset + 8,
              left: 16,
              zIndex: 20,
              backgroundColor: 'rgba(0,0,0,0.55)',
              borderRadius: 20,
              padding: 7,
            }}
          >
            <X size={22} color="white" />
          </TouchableOpacity>

          {/* ── Toggleable: top-right more button ──
              (page count lives in the bottom dots indicator, so no top counter) */}
          <Animated.View
            style={[uiAnimStyle, {
              position: 'absolute',
              top: topInset + 8,
              right: 16,
              zIndex: 15,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }]}
            pointerEvents={showUI ? 'box-none' : 'none'}
          >
            <TouchableOpacity
              onPress={() => setShowActionSheet(true)}
              style={{ backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: 7 }}
            >
              <MoreHorizontal size={22} color="white" />
            </TouchableOpacity>
          </Animated.View>

          {/* ── Main content ── */}
          <View style={{ flex: 1 }}>

            {/* Image carousel — centered in the space above the bottom controls */}
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <View style={{ height: MEDIA_HEIGHT }}>
                <ScrollView
                  horizontal
                  pagingEnabled
                  scrollEnabled={carouselScrollEnabled}
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={handleScroll}
                  contentOffset={{ x: initialIndex * screenWidth, y: 0 }}
                  scrollEventThrottle={16}
                  style={{ height: MEDIA_HEIGHT }}
                >
                  {images.map((mediaUri, index) => (
                    <MediaItem
                      key={index}
                      uri={mediaUri}
                      blurhash={blurHashes?.[index]}
                      index={index}
                      isActive={index === currentIndex}
                      onToggleUI={toggleUI}
                      onZoomChange={(zoomed) => setCarouselScrollEnabled(!zoomed)}
                    />
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* Bottom block — indicator, caption & controls pinned near the bottom */}
            <View style={{ paddingBottom: insets.bottom + 16 }}>

              {/* Dots indicator */}
              {images.length > 1 && (
                <Animated.View
                  style={[uiAnimStyle, { flexDirection: 'row', justifyContent: 'center', paddingBottom: 14 }]}
                  pointerEvents="none"
                >
                  {images.map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: 7, height: 7, borderRadius: 4, marginHorizontal: 3,
                        backgroundColor: i === currentIndex ? 'white' : 'rgba(255,255,255,0.35)',
                      }}
                    />
                  ))}
                </Animated.View>
              )}

              {/* Bottom row: 60% caption left, 40% controls right */}
              <Animated.View
                style={[uiAnimStyle, {
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                }]}
                pointerEvents={showUI ? 'box-none' : 'none'}
              >
                {/* Caption — 60% */}
                <View style={{ flex: 3, paddingRight: 12 }}>
                  {username && (
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 13, marginBottom: 3 }}>
                      {username}
                    </Text>
                  )}
                  {postContent ? (
                    <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 19 }} numberOfLines={3}>
                      {postContent}
                    </Text>
                  ) : null}
                </View>

                {/* Controls — 40%, horizontal, right-aligned, icons top-aligned so the like count sits below without shifting the heart */}
                <View style={{ flex: 2, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start', gap: 18 }}>
                  {/* Like */}
                  <TouchableOpacity
                    onPress={handleLike}
                    disabled={!currentUser?.id}
                    style={{ alignItems: 'center', justifyContent: 'flex-start' }}
                  >
                    <Heart
                      size={26}
                      color={isLiked ? "#e91e63" : "white"}
                      fill={isLiked ? "#e91e63" : "none"}
                      strokeWidth={1.5}
                    />
                    {likesCount > 0 && (
                      <Text style={{ color: isLiked ? '#e91e63' : 'white', fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                        {likesCount}
                      </Text>
                    )}
                  </TouchableOpacity>

                  {/* Bookmark */}
                  <TouchableOpacity onPress={handleBookmark} disabled={!currentUser?.id}>
                    <Bookmark
                      size={26}
                      color={isBookmarked ? "#60a5fa" : "white"}
                      fill={isBookmarked ? "#60a5fa" : "none"}
                      strokeWidth={1.5}
                    />
                  </TouchableOpacity>

                  {/* Message */}
                  <TouchableOpacity onPress={handleMessage}>
                    <MessageCircle size={26} color="white" strokeWidth={1.5} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>
          </View>

        </View>
      </GestureHandlerRootView>

      {/* Error popup */}
      <Modal visible={showError} transparent animationType="none" statusBarTranslucent>
        <TouchableWithoutFeedback onPress={() => setShowError(false)}>
          <View style={{ flex: 1 }}>
            <PopupMessage visible={showError} type="error" message={popupMessage} />
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <PostActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        isOwnPost={isOwnPost}
        onDelete={() => { setShowActionSheet(false); setShowDeleteConfirmation(true); }}
        onReport={() => { setShowActionSheet(false); setShowReportModal(true); }}
      />

      <DeleteConfirmationModal
        visible={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleConfirmDelete}
        postContent={postContent || ""}
      />

      {currentUser?.id && postUserId && (
        <ReportPostModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          postId={postId}
          postContent={postContent ? postContent.substring(0, 50) + (postContent.length > 50 ? "..." : "") : ""}
          postOwnerId={postUserId}
          currentUserId={currentUser.id}
          onReportSuccess={() => { setShowReportModal(false); onClose(); }}
        />
      )}
    </Modal>
  );
}
