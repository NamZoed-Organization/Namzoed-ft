import CommentsModal from "@/components/modals/CommentsModal";
import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";
import ImageViewer from "@/components/modals/ImageViewer";
import LikesListModal from "@/components/modals/LikesListModal";
import PostActionSheet from "@/components/modals/PostActionSheet";
import ReportPostModal from "@/components/modals/ReportPostModal";
import ReelsViewer from "@/components/ReelsViewer";
import ShareComposerModal from "@/components/modals/ShareComposerModal";
import TaggedItemsModal from "@/components/modals/TaggedItemsModal";
import PopupMessage from "@/components/ui/PopupMessage";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { ContentWarning } from "@/components/ContentWarning";
import { useUser } from "@/contexts/UserContext";
import {
    hasUserBookmarkedPost,
    togglePostBookmark,
} from "@/lib/bookmarkService";
import { getPostCommentCount } from "@/lib/commentsService";
import { followUser, isFollowing } from "@/lib/followService";
import {
    getFollowedLikers,
    getPostLikeCount,
    hasUserLikedPost,
    togglePostLike,
} from "@/lib/likesService";
import { RATIO_PORTRAIT } from "@/lib/postMediaDisplay";
import { deletePost, fetchVideoReels, VideoReel } from "@/lib/postsService";
import { getPostSaveCount, trackPostView } from "@/lib/viewTrackingService";
import { buildPostExternalSharePayload } from "@/lib/shareUtils";
import { playSound } from "@/lib/soundUtils";
import { PostData } from "@/types/post";
import { feedEvents } from "@/utils/feedEvents";
import { useAppRouter } from "@/utils/navigation";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Eye,
  EyeOff,
    Bookmark,
    Heart,
    MessageCircle,
    MoreHorizontal,
    Play,
    RotateCcw,
    Send,
    ShoppingBag,
    Tag,
    UserRound,
    Verified,
    Volume2,
    VolumeX,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Easing,
    FlatList,
    GestureResponderEvent,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleSheet,
    Text,
    type TextStyle,
    TouchableOpacity,
    TouchableWithoutFeedback,
    useWindowDimensions,
    View,
} from "react-native";
import AnimatedRN, {
    FadeIn,
    FadeOut,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

export { default as PostSkeleton } from "@/components/ui/PostSkeleton";

// Module-level cache for post interaction data so re-mounts don't re-fetch
const interactionCache = new Map<string, {
  isLiked: boolean;
  isBookmarked: boolean;
  likesCount: number;
  commentsCount: number;
  followedLikers: Array<{ id: string; name: string; avatar_url?: string | null }>;
}>();

interface FeedPostProps {
  post: PostData;
  isVisible?: boolean;
  isAuthorLive?: boolean;
}

const formatDate = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return diffSec <= 0 ? "now" : `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDays < 7) return `${diffDays}d`;

  const sameYear = now.getFullYear() === date.getFullYear();
  if (sameYear) {
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const TIMESTAMP_ROTATE_MS = 3000;

function TimestampLocationRotator({
  date,
  locationName,
  style,
}: {
  date: Date;
  locationName?: string | null;
  style?: TextStyle;
}) {
  const formatted = useMemo(() => formatDate(date), [date]);
  const trimmed = locationName?.trim() ?? "";
  const slide = useRef(new Animated.Value(0)).current;
  const [showLocation, setShowLocation] = useState(false);

  useEffect(() => {
    if (!trimmed) return;
    const id = setInterval(() => {
      setShowLocation((v) => !v);
    }, TIMESTAMP_ROTATE_MS);
    return () => clearInterval(id);
  }, [trimmed]);

  useEffect(() => {
    if (!trimmed) return;
    Animated.timing(slide, {
      toValue: showLocation ? 1 : 0,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [showLocation, trimmed, slide]);

  if (!trimmed) {
    return <Text style={style}>{formatted}</Text>;
  }

  const timeTranslateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });

  const locTranslateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  return (
    <View style={{ minHeight: 17, justifyContent: "center", overflow: "hidden" }}>
      <Animated.Text
        style={[
          style,
          {
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            transform: [{ translateY: timeTranslateY }],
          },
        ]}
        numberOfLines={1}
      >
        {formatted}
      </Animated.Text>
      <Animated.Text
        style={[
          style,
          {
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            transform: [{ translateY: locTranslateY }],
          },
        ]}
        numberOfLines={1}
      >
        {trimmed}
      </Animated.Text>
    </View>
  );
}

const isVideoUrl = (url: string): boolean => {
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
  const lowerUrl = url.toLowerCase();
  return (
    videoExtensions.some((ext) => lowerUrl.includes(ext)) ||
    lowerUrl.includes("post-videos")
  );
};

interface MediaCarouselProps {
  /** Full-bleed media width (window width — matches Instagram edge-to-edge). */
  frameWidth: number;
  images: string[];
  /** BlurHash per image, aligned with `images`. */
  blurHashes?: (string | null)[];
  onDoubleTapAt?: (x: number, y: number) => void;
  onImagePress?: (index: number) => void;
  /** Opens the fullscreen reels player for the tapped video URL. */
  onVideoPress?: (uri: string) => void;
  /** "Watch More" tapped from a video's end-of-playback overlay. */
  onWatchMorePress?: (uri: string) => void;
  isVisible?: boolean;
  hasTaggedItems: boolean;
  onTagPress: () => void;
}

function VideoLoadingShimmer({ frameWidth }: { frameWidth: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const translateX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-frameWidth, frameWidth],
  });

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.15)',
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: frameWidth * 0.45,
          height: 2,
          borderRadius: 1,
          backgroundColor: 'rgba(255,255,255,0.75)',
          transform: [{ translateX }],
        }}
      />
    </View>
  );
}

interface InlineVideoPlayerProps {
  uri: string;
  frameWidth: number;
  slideHeight: number;
  isVisible: boolean;
  onDoubleTapAt?: (x: number, y: number) => void;
  onExpand?: () => void;
  /** "Watch More" tapped from the end-of-video overlay — advance to the next reel. */
  onWatchMore?: () => void;
}

// Top-level wrapper: only mounts the heavy ExoPlayer-backed component when the
// slide is actually visible. This keeps memory bounded as the FlatList window
// holds several posts; without it, every video post in the window holds a
// live ExoPlayer instance and crashes older devices with java.lang.OutOfMemoryError
// in androidx.media3.exoplayer.ExoPlayerImplInternal.shouldContinueLoading.
// Mounting only while visible also gives autoplay-on-50%-visible and
// pause-on-scroll-out for free: the player (and its playback position) is
// created fresh each time the slide re-enters view, and torn down the
// moment it leaves — no explicit play()/pause() toggling needed for that.
const InlineVideoPlayer = React.memo(function InlineVideoPlayer({ uri, frameWidth, slideHeight, isVisible, onDoubleTapAt, onExpand, onWatchMore }: InlineVideoPlayerProps) {
  if (!isVisible) {
    return <View style={{ width: frameWidth, height: slideHeight, backgroundColor: "#000" }} />;
  }
  return (
    <ActiveVideoPlayer
      uri={uri}
      frameWidth={frameWidth}
      slideHeight={slideHeight}
      onDoubleTapAt={onDoubleTapAt}
      onExpand={onExpand}
      onWatchMore={onWatchMore}
    />
  );
});

interface ActiveVideoPlayerProps {
  uri: string;
  frameWidth: number;
  slideHeight: number;
  onDoubleTapAt?: (x: number, y: number) => void;
  onExpand?: () => void;
  onWatchMore?: () => void;
}

const ActiveVideoPlayer = React.memo(function ActiveVideoPlayer({ uri, frameWidth, slideHeight: videoH, onDoubleTapAt, onExpand, onWatchMore }: ActiveVideoPlayerProps) {
  const [isHolding, setIsHolding] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // Mounting this component already means the slide is ≥50% visible (see
  // InlineVideoPlayer above), so playback should start immediately —
  // autoplay-on-visible falls out of that, not from a separate visibility
  // effect here.
  const [shouldPlay, setShouldPlay] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const hasAutoUnmutedRef = useRef(false);
  const playOverlayOpacity = useRef(new Animated.Value(1)).current;
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef(0);
  const lastTapPosRef = useRef({ x: 0, y: 0 });
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerOpacity = useRef(new Animated.Value(0)).current;
  const timerVisible = useRef(false);
  const timerFadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timerLabel, setTimerLabel] = useState("");

  // Cache to disk so the same clip isn't re-downloaded across feed re-renders or
  // when opened in the fullscreen reels player. Looping is off here (unlike the
  // fullscreen reels player) so the clip actually reaches its end and the
  // "Watch More" / "Rewatch" overlay can appear, instead of silently restarting.
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = false;
    p.muted = true;
  });

  // Sync muted state to player
  useEffect(() => {
    if (!player) return;
    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    if (!player) return;
    if (shouldPlay && !isHolding && !hasEnded) {
      player.play();
    } else {
      player.pause();
    }
  }, [shouldPlay, isHolding, hasEnded, player]);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener("playToEnd", () => {
      setHasEnded(true);
    });
    return () => sub.remove();
  }, [player]);

  // Fade play-button overlay based on playing state
  useEffect(() => {
    Animated.timing(playOverlayOpacity, {
      toValue: isPlaying ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [isPlaying, playOverlayOpacity]);

  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      setCurrentTime(player.currentTime ?? 0);
      setDuration(player.duration ?? 0);
      setIsLoading(player.status === 'idle' || player.status === 'loading');
      setIsPlaying(player.playing ?? false);
    }, 200);
    return () => clearInterval(interval);
  }, [player]);

  // Show timer for 3s on mount (i.e. when slide becomes visible), then fade out.
  useEffect(() => {
    const secs = duration > 0
      ? Math.max(0, Math.ceil(duration - (player.currentTime ?? 0)))
      : null;
    const label = secs !== null
      ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`
      : "";
    setTimerLabel(label);

    timerVisible.current = true;
    timerOpacity.setValue(1);

    timerFadeTimeout.current = setTimeout(() => {
      Animated.timing(timerOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => {
        timerVisible.current = false;
      });
    }, 3000);

    return () => {
      if (timerFadeTimeout.current) {
        clearTimeout(timerFadeTimeout.current);
        timerFadeTimeout.current = null;
      }
    };
  }, []);

  // Capture the touch position only — used to place the double-tap heart.
  const handlePressIn = (event: GestureResponderEvent) => {
    lastTapPosRef.current = {
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
    };
  };

  // onPress (not onPressOut) so a vertical scroll over the video doesn't count
  // as a tap — RN cancels the press once the FlatList claims the scroll gesture.
  const handlePress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap — cancel the pending single-tap and fire the like heart.
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      onDoubleTapAt?.(lastTapPosRef.current.x, lastTapPosRef.current.y);
      lastTapRef.current = 0;
    } else {
      // Defer the single tap so a follow-up tap can register as a double tap.
      // A confirmed single tap opens the immersive fullscreen reels player.
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        onExpand?.();
      }, 280);
    }
  };

  const handleMutePress = () => {
    setIsMuted((prev) => !prev);
  };

  return (
    <View style={{ width: frameWidth, height: videoH }}>
      <TouchableWithoutFeedback onPressIn={handlePressIn} onPress={handlePress}>
        <View style={{ flex: 1 }}>
          <VideoView
            player={player}
            style={{ width: frameWidth, height: videoH }}
            contentFit="cover"
            nativeControls={false}
            fullscreenOptions={{ enable: false }}
          />
          {isLoading && <VideoLoadingShimmer frameWidth={frameWidth} />}
          <Animated.Text
            style={{
              position: "absolute",
              top: 10,
              right: 12,
              color: "#fff",
              fontSize: 13,
              fontWeight: "600",
              opacity: timerOpacity,
            }}
            pointerEvents="none"
          >
            {timerLabel}
          </Animated.Text>
          {/* Center play button (visible when paused, hidden once ended — the
              end-of-video overlay takes over at that point) */}
          {!hasEnded && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
                opacity: playOverlayOpacity,
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "rgba(0,0,0,0.55)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Play size={32} color="#fff" fill="#fff" />
              </View>
            </Animated.View>
          )}
        </View>
      </TouchableWithoutFeedback>
      {/* Mute/unmute icon — tappable, sits above gesture layer */}
      {!hasEnded && (
        <TouchableOpacity
          onPress={handleMutePress}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
          }}
        >
          <View
            style={{
              backgroundColor: "rgba(0,0,0,0.4)",
              borderRadius: 20,
              padding: 6,
            }}
          >
            {isMuted
              ? <VolumeX size={16} color="#fff" />
              : <Volume2 size={16} color="#fff" />}
          </View>
        </TouchableOpacity>
      )}
      {/* End-of-video overlay: both options drop straight into the fullscreen
          reels viewer — "Watch More" advances to the next reel, "Rewatch"
          reopens this same one from the start. */}
      {hasEnded && (
        <View style={styles.videoEndOverlay} pointerEvents="box-none">
          <TouchableOpacity
            style={[styles.videoEndButton, styles.videoEndButtonSolid]}
            activeOpacity={0.85}
            onPress={() => onWatchMore?.()}
          >
            <Play size={16} color="#0A0A0A" fill="#0A0A0A" />
            <Text style={styles.videoEndButtonTextSolid}>Watch More</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.videoEndButton, styles.videoEndButtonOutline]}
            activeOpacity={0.85}
            onPress={() => onExpand?.()}
          >
            <RotateCcw size={16} color="#fff" />
            <Text style={styles.videoEndButtonText}>Rewatch</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

// Instagram/UIPageControl-style shrinking dot window: up to 3 "normal" dots
// centered around the active one, tapering to a small then tiny dot on
// whichever side(s) still have more images. The normal window trails 2
// behind the active index, but reassigns any unused "before" slots forward
// when active is near the start (and mirrors near the end) so the 3 normal
// dots don't run out of room.
type DotTier = "normal" | "small" | "tiny";
interface DotEntry {
  index: number;
  tier: DotTier;
}
const DOT_SIZE: Record<DotTier, number> = { normal: 6, small: 4.5, tiny: 3 };

function getDotWindow(active: number, total: number): DotEntry[] {
  if (total <= 1) return [];
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => ({ index: i, tier: "normal" as const }));
  }

  let normalStart = active - 2;
  let normalEnd = active;
  if (normalStart < 0) {
    normalEnd += -normalStart;
    normalStart = 0;
  }
  if (normalEnd > total - 1) {
    normalStart -= normalEnd - (total - 1);
    normalEnd = total - 1;
    normalStart = Math.max(0, normalStart);
  }

  const dots: DotEntry[] = [];
  if (normalStart - 2 >= 0) dots.push({ index: normalStart - 2, tier: "tiny" });
  if (normalStart - 1 >= 0) dots.push({ index: normalStart - 1, tier: "small" });
  for (let i = normalStart; i <= normalEnd; i++) dots.push({ index: i, tier: "normal" });
  if (normalEnd + 1 <= total - 1) dots.push({ index: normalEnd + 1, tier: "small" });
  if (normalEnd + 2 <= total - 1) dots.push({ index: normalEnd + 2, tier: "tiny" });

  return dots;
}

function CarouselDot({ tier, isActive }: { tier: DotTier; isActive: boolean }) {
  const size = useSharedValue(DOT_SIZE[tier]);
  const activeProgress = useSharedValue(isActive ? 1 : 0);

  useEffect(() => {
    size.value = withTiming(DOT_SIZE[tier], { duration: 180 });
  }, [tier, size]);

  useEffect(() => {
    activeProgress.value = withTiming(isActive ? 1 : 0, { duration: 180 });
  }, [isActive, activeProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: size.value,
    height: size.value,
    borderRadius: size.value / 2,
    backgroundColor: interpolateColor(
      activeProgress.value,
      [0, 1],
      ["rgba(0, 0, 0, 0.2)", "#094569"],
    ),
  }));

  return (
    <AnimatedRN.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={[{ marginHorizontal: 2.5 }, animatedStyle]}
    />
  );
}

function CarouselDots({ activeIndex, total }: { activeIndex: number; total: number }) {
  const dots = useMemo(() => getDotWindow(activeIndex, total), [activeIndex, total]);

  return (
    <View style={styles.dotsRow}>
      {dots.map(({ index, tier }) => {
        return (
          <CarouselDot key={index} tier={tier} isActive={index === activeIndex} />
        );
      })}
    </View>
  );
}

const MediaCarousel = React.memo(
  ({
    frameWidth,
    images,
    blurHashes,
    onDoubleTapAt,
    onImagePress,
    onVideoPress,
    onWatchMorePress,
    isVisible = true,
    hasTaggedItems,
    onTagPress,
  }: MediaCarouselProps) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const slideH = frameWidth / RATIO_PORTRAIT;

    const multipleMedia = images.length > 1;
    const lastTapRef = useRef(0);
    const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleImageTap = useCallback(
      (event: GestureResponderEvent, index: number) => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
          }
          onDoubleTapAt?.(
            event.nativeEvent.locationX,
            event.nativeEvent.locationY,
          );
        } else {
          singleTapTimerRef.current = setTimeout(() => {
            singleTapTimerRef.current = null;
            onImagePress?.(index);
          }, 300);
        }
        lastTapRef.current = now;
      },
      [onDoubleTapAt, onImagePress],
    );

    const handleScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const x = e.nativeEvent.contentOffset.x;
        const idx = Math.min(
          images.length - 1,
          Math.max(0, Math.round(x / frameWidth)),
        );
        setActiveIndex((prev) => (prev === idx ? prev : idx));
      },
      [frameWidth, images.length],
    );

    const renderItem = useCallback(
      ({ item, index }: { item: string; index: number }) => {
        const isVideo = isVideoUrl(item);
        const h = slideH;
        const w = frameWidth;

        if (isVideo) {
          return (
            <View
              style={{
                width: w,
                height: h,
                backgroundColor: "#000",
                overflow: "hidden",
              }}
            >
              <InlineVideoPlayer
                uri={item}
                frameWidth={w}
                slideHeight={h}
                isVisible={isVisible && activeIndex === index}
                onDoubleTapAt={onDoubleTapAt}
                onExpand={() => onVideoPress?.(item)}
                onWatchMore={() => onWatchMorePress?.(item)}
              />
            </View>
          );
        }

        return (
          <View
            style={{
              width: w,
              height: h,
              backgroundColor: "#000",
              overflow: "hidden",
            }}
          >
            <TouchableOpacity
              onPress={(e) => handleImageTap(e, index)}
              activeOpacity={1}
              style={{ width: w, height: h }}
            >
              <ProgressiveImage
                uri={item}
                blurhash={blurHashes?.[index]}
                style={{ width: w, height: h }}
                contentFit="cover"
                backgroundColor="#000"
                recyclingKey={item}
              />
            </TouchableOpacity>
          </View>
        );
      },
      [handleImageTap, isVisible, activeIndex, onDoubleTapAt, onVideoPress, frameWidth, slideH, blurHashes],
    );

    if (images.length === 0) return null;

    return (
      <View>
        {multipleMedia ? (
          <FlatList
            data={images}
            keyExtractor={(_, i) => i.toString()}
            renderItem={renderItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            directionalLockEnabled
            alwaysBounceVertical={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={{ height: slideH }}
          />
        ) : (
          renderItem({ item: images[0], index: 0 })
        )}

        {multipleMedia && (
          <View style={styles.mediaCounterPill}>
            <Text style={styles.mediaCounterText}>
              {activeIndex + 1}/{images.length}
            </Text>
          </View>
        )}

        {hasTaggedItems && (
          <TouchableOpacity
            onPress={onTagPress}
            style={styles.tagButton}
            activeOpacity={0.8}
          >
            <Tag size={12} color="#fff" />
          </TouchableOpacity>
        )}

        {multipleMedia && <CarouselDots activeIndex={activeIndex} total={images.length} />}
      </View>
    );
  },
);

const HEADER_HEIGHT = 56;
const HEART_BTN_X = 26;
const FLY_SIZE = 72;
const FLY_DURATION = 700;

interface FlyingHeartProps {
  startX: number;
  startY: number;
  heartTargetY: number;
  onDone: () => void;
}

function FlyingHeart({ startX, startY, heartTargetY, onDone }: FlyingHeartProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  // Physics: solve for initial y-velocity so the parabola lands exactly at endY
  const T = FLY_DURATION / 1000;
  const g = 2600; // gravity px/s² — higher = sharper downward arc
  const endX = HEART_BTN_X;
  const endY = heartTargetY;
  const vx = (endX - startX) / T;
  const vy = (endY - startY - 0.5 * g * T * T) / T; // negative = initially upward

  // Sample the parabola at STEPS+1 evenly-spaced points for interpolation
  const STEPS = 28;
  const inputRange = Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS);
  const xOutputRange = inputRange.map(p => {
    const t = p * T;
    return startX + vx * t - FLY_SIZE / 2;
  });
  const yOutputRange = inputRange.map(p => {
    const t = p * T;
    return startY + vy * t + 0.5 * g * t * t - FLY_SIZE / 2;
  });

  const translateX = progress.interpolate({ inputRange, outputRange: xOutputRange });
  const translateY = progress.interpolate({ inputRange, outputRange: yOutputRange });
  const rotation = rotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-22deg', '0deg', '22deg'],
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(progress, {
        toValue: 1,
        duration: FLY_DURATION,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.15, useNativeDriver: true, damping: 4, stiffness: 320 }),
        Animated.timing(scale, { toValue: 0.18, duration: 430, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(470),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(rotate, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: -0.6, duration: 120, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 0.3, duration: 100, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]),
    ]).start(() => onDone());
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: FLY_SIZE,
        height: FLY_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        transform: [{ translateX }, { translateY }, { scale }, { rotate: rotation }],
      }}
    >
      <Heart size={FLY_SIZE} color="#e91e63" fill="#e91e63" />
    </Animated.View>
  );
}

interface MiniAvatarRowProps {
  users: Array<{ id: string; name: string; avatar_url?: string | null }>;
  totalLikes: number;
  onPress: () => void;
}

const MiniAvatarRow = React.memo(({ users, totalLikes, onPress }: MiniAvatarRowProps) => {
  if (users.length === 0 || totalLikes === 0) return null;

  const remaining = totalLikes - users.length;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}
      activeOpacity={0.7}
    >
      <View style={{ flexDirection: "row", marginRight: 8 }}>
        {users.slice(0, 3).map((u, i) => (
          <View
            key={u.id}
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              borderWidth: 2,
              borderColor: "#fff",
              marginLeft: i > 0 ? -8 : 0,
              zIndex: 3 - i,
              overflow: "hidden",
              backgroundColor: "#094569",
            }}
          >
            {u.avatar_url ? (
              <Image source={{ uri: u.avatar_url }} style={{ width: "100%", height: "100%" }} cachePolicy="memory-disk" />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 8, fontWeight: "bold" }}>
                  {u.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>
      <Text style={{ fontSize: 12, color: "#374151" }}>
        {"Liked by "}
        <Text style={{ fontWeight: "600" }}>{users[0].name}</Text>
        {remaining > 0 && (
          <>
            {" and "}
            <Text style={{ fontWeight: "600" }}>
              {remaining.toLocaleString()} {remaining === 1 ? "other" : "others"}
            </Text>
          </>
        )}
      </Text>
    </TouchableOpacity>
  );
});

function FeedPost({ post, isVisible = true, isAuthorLive: isAuthorLiveProp }: FeedPostProps) {
  const { width: frameWidth } = useWindowDimensions();
  const feedMediaHeight = frameWidth / RATIO_PORTRAIT;
  const heartTargetY = HEADER_HEIGHT + feedMediaHeight + 22;

  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes);
  const [commentsCount, setCommentsCount] = useState(post.comments);
  const [followedLikers, setFollowedLikers] = useState<
    Array<{ id: string; name: string; avatar_url?: string | null }>
  >([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showError, setShowError] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [showTaggedItems, setShowTaggedItems] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showLikesList, setShowLikesList] = useState(false);
  const [showShareComposer, setShowShareComposer] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);
  const [reelsVisible, setReelsVisible] = useState(false);
  const [reelsInitial, setReelsInitial] = useState<VideoReel[]>([]);
  const [reelsIndex, setReelsIndex] = useState(0);
  const [reelsSourceRect, setReelsSourceRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const mediaContainerRef = useRef<View>(null);
  const [flyingHearts, setFlyingHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [isContentRevealed, setIsContentRevealed] = useState(post.contentRating === "general" || !post.contentRating);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [captionOverflows, setCaptionOverflows] = useState(false);
  const [captionMeasured, setCaptionMeasured] = useState(false);
  const flyHeartId = useRef(0);

  const hasTaggedProducts = (post.tagged_products?.length ?? 0) > 0;
  const hasTaggedAccounts = (post.tagged_accounts?.length ?? 0) > 0;
  const hasTaggedItems = hasTaggedProducts || hasTaggedAccounts;
  const { currentUser } = useUser();
  const router = useAppRouter();

  const isOwnPost = currentUser?.id === post.userId;
  const isAuthorLive = isAuthorLiveProp ?? false;
  const needsContentWarning = !!post.contentRating && post.contentRating !== "general";

  // null = not checked yet — the follow pill next to the author's name only
  // ever renders once we know for sure the viewer doesn't already follow them.
  const [isFollowingAuthor, setIsFollowingAuthor] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [showFollowedPopup, setShowFollowedPopup] = useState(false);
  const followedPopupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!currentUser?.id || isOwnPost) return;
    isFollowing(currentUser.id, post.userId).then(setIsFollowingAuthor);
  }, [currentUser?.id, post.userId, isOwnPost]);

  useEffect(() => {
    return () => {
      if (followedPopupTimeout.current) clearTimeout(followedPopupTimeout.current);
    };
  }, []);

  const handleFollowAuthor = useCallback(async () => {
    if (!currentUser?.id || followBusy) return;
    setFollowBusy(true);
    const prev = isFollowingAuthor;
    setIsFollowingAuthor(true);
    try {
      const result = await followUser(currentUser.id, post.userId);
      if (!result.success) {
        setIsFollowingAuthor(prev);
      } else {
        setShowFollowedPopup(true);
        if (followedPopupTimeout.current) clearTimeout(followedPopupTimeout.current);
        followedPopupTimeout.current = setTimeout(() => setShowFollowedPopup(false), 1800);
      }
    } catch {
      setIsFollowingAuthor(prev);
    } finally {
      setFollowBusy(false);
    }
  }, [currentUser?.id, post.userId, isFollowingAuthor, followBusy]);

  // ── Private engagement stats (only shown to post owner) ──────────────
  const [viewCount, setViewCount] = useState<number>(post.view_count ?? 0);
  const [saveCount, setSaveCount] = useState<number>(0);
  const viewTrackedRef = useRef(false);

  // Track a view when the post becomes visible in the feed (once per mount)
  useEffect(() => {
    if (!isVisible) return;
    if (!currentUser?.id) return;
    if (viewTrackedRef.current) return;
    viewTrackedRef.current = true;
    trackPostView(post.id, currentUser.id, post.userId).catch(() => {
      // Reset so it can be retried if the insert failed transiently
      viewTrackedRef.current = false;
    });
  }, [isVisible, currentUser?.id, post.id, post.userId]);

  // Load save count for own posts (once on mount)
  useEffect(() => {
    if (!isOwnPost) return;
    getPostSaveCount(post.id).then(setSaveCount).catch(() => {});
  }, [isOwnPost, post.id]);

  useEffect(() => {
    setIsContentRevealed(!needsContentWarning);
  }, [post.id, post.contentRating, needsContentWarning]);

  // Keep interaction cache in sync when user interacts
  const updateCache = useCallback((updates: Partial<NonNullable<ReturnType<typeof interactionCache.get>>>) => {
    const existing = interactionCache.get(post.id);
    if (existing) {
      interactionCache.set(post.id, { ...existing, ...updates });
    }
  }, [post.id]);

  const showErrorPopup = useCallback((message: string) => {
    setPopupMessage(message);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  }, []);

  useEffect(() => {
    const userId = currentUser?.id;
    if (!userId) return;

    // Use cached data if available (avoids re-fetching on FlashList remount)
    const cached = interactionCache.get(post.id);
    if (cached) {
      setIsBookmarked(cached.isBookmarked);
      setIsLiked(cached.isLiked);
      setLikesCount(cached.likesCount);
      setCommentsCount(cached.commentsCount);
      setFollowedLikers(cached.followedLikers);
      return;
    }

    const load = async () => {
      const [bookmarked, liked, likeCount, commentCount] = await Promise.all([
        hasUserBookmarkedPost(post.id, userId),
        hasUserLikedPost(post.id, userId),
        getPostLikeCount(post.id),
        getPostCommentCount(post.id),
      ]);
      setIsBookmarked(bookmarked);
      setIsLiked(liked);
      setLikesCount(likeCount);
      setCommentsCount(commentCount);

      const fLikers = await getFollowedLikers(post.id, userId, 3);
      setFollowedLikers(fLikers);

      // Cache the result
      interactionCache.set(post.id, {
        isLiked: liked,
        isBookmarked: bookmarked,
        likesCount: likeCount,
        commentsCount: commentCount,
        followedLikers: fLikers,
      });
    };

    load();
  }, [currentUser?.id, post.id]);

  const handleLike = async () => {
    if (!currentUser?.id) {
      showErrorPopup("Please sign in to like posts");
      return;
    }

    const previousLiked = isLiked;
    const previousCount = likesCount;
    if (!isLiked) void playSound('like');
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

    try {
      const result = await togglePostLike(post.id, currentUser.id, isLiked);
      if (!result.success) {
        setIsLiked(previousLiked);
        setLikesCount(previousCount);
        showErrorPopup("Failed to update like. Please try again.");
      } else {
        setIsLiked(result.isLiked);
        setLikesCount(result.likeCount);
        updateCache({ isLiked: result.isLiked, likesCount: result.likeCount });
      }
    } catch {
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
      showErrorPopup("Failed to update like. Please try again.");
    }
  };

  const handleDoubleTapLike = async () => {
    if (!currentUser?.id || isLiked) return;
    void playSound('like');
    setIsLiked(true);
    setLikesCount(prev => prev + 1);
    try {
      const result = await togglePostLike(post.id, currentUser.id, false);
      if (!result.success) {
        setIsLiked(false);
        setLikesCount(prev => prev - 1);
      } else {
        setIsLiked(result.isLiked);
        setLikesCount(result.likeCount);
        updateCache({ isLiked: result.isLiked, likesCount: result.likeCount });
      }
    } catch {
      setIsLiked(false);
      setLikesCount(prev => prev - 1);
    }
  };

  const handleDoubleTapAt = (x: number, y: number) => {
    handleDoubleTapLike();
    const id = ++flyHeartId.current;
    setFlyingHearts(prev => [...prev, { id, x, y: y + HEADER_HEIGHT }]);
  };

  const removeFlyingHeart = (id: number) => {
    setFlyingHearts(prev => prev.filter(h => h.id !== id));
  };

  const handleBookmark = async () => {
    if (!currentUser?.id) {
      showErrorPopup("Please sign in to save posts");
      return;
    }

    const previousBookmarked = isBookmarked;
    setIsBookmarked(!isBookmarked);

    try {
      const result = await togglePostBookmark(post.id, currentUser.id, isBookmarked);
      if (!result.success) {
        setIsBookmarked(previousBookmarked);
        showErrorPopup("Failed to save post. Please try again.");
      } else {
        setIsBookmarked(result.isBookmarked);
        updateCache({ isBookmarked: result.isBookmarked });
      }
    } catch {
      setIsBookmarked(previousBookmarked);
      showErrorPopup("Failed to save post. Please try again.");
    }
  };

  const handleSharePost = () => {
    setShowShareComposer(true);
  };

  const buildPostVideoReels = useCallback(
    (videoUrls: string[]): VideoReel[] =>
      videoUrls.map((videoUri, i) => ({
        id: `${post.id}::${i}`,
        uri: videoUri,
        postId: String(post.id),
        userId: String(post.userId),
        username: post.username || "Unknown",
        avatarUrl: post.profilePic ?? null,
        content: post.content || "",
        createdAt: (post.date instanceof Date ? post.date : new Date(post.date)).toISOString(),
      })),
    [post.id, post.userId, post.username, post.profilePic, post.content, post.date],
  );

  // Measures the on-screen video frame so the viewer can expand from it
  // instead of just popping in fullscreen. Falls back to opening immediately
  // (no measured rect → ReelsViewer just fills the screen) if the ref isn't
  // attached yet for some reason.
  const openReelsViewer = useCallback((reels: VideoReel[], index: number) => {
    const openReels = () => {
      setReelsInitial(reels);
      setReelsIndex(index);
      setReelsVisible(true);
    };
    if (mediaContainerRef.current) {
      mediaContainerRef.current.measureInWindow((x, y, width, height) => {
        setReelsSourceRect({ x, y, width, height });
        openReels();
      });
    } else {
      setReelsSourceRect(null);
      openReels();
    }
  }, []);

  // Open the fullscreen reels player at the tapped video. The viewer then loads
  // an endless stream of every video in the system.
  const handleVideoPress = useCallback(
    (uri: string) => {
      const videoUrls = (post.images || []).filter(isVideoUrl);
      if (videoUrls.length === 0) return;
      const startIndex = Math.max(0, videoUrls.indexOf(uri));
      openReelsViewer(buildPostVideoReels(videoUrls), startIndex);
    },
    [post.images, buildPostVideoReels, openReelsViewer],
  );

  // "Watch More" from the end-of-video overlay: jump straight to the next
  // video, either another one in this same post, or — if this was the last
  // one — a fresh batch pulled from the global reels stream, so it's
  // actually new content rather than looping back to what just ended.
  const handleWatchMoreReels = useCallback(
    async (uri: string) => {
      const videoUrls = (post.images || []).filter(isVideoUrl);
      if (videoUrls.length === 0) return;
      const tappedIndex = Math.max(0, videoUrls.indexOf(uri));

      if (tappedIndex + 1 < videoUrls.length) {
        openReelsViewer(buildPostVideoReels(videoUrls), tappedIndex + 1);
        return;
      }

      try {
        const { reels } = await fetchVideoReels(null, 8);
        const fresh = reels.filter((r) => r.uri !== uri);
        if (fresh.length > 0) {
          openReelsViewer(fresh, 0);
          return;
        }
      } catch {
        // Fall through to reopening this same reel if the fetch fails.
      }
      openReelsViewer(buildPostVideoReels(videoUrls), tappedIndex);
    },
    [post.images, buildPostVideoReels, openReelsViewer],
  );

  const postSharePayload = useMemo(
    () =>
      buildPostExternalSharePayload({
        id: String(post.id),
        author: post.username,
        content: post.content,
        imageUrl: post.images?.[0],
      }),
    [post.id, post.username, post.content, post.images],
  );

  const handleDeletePress = () => {
    setShowActionSheet(false);
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deletePost(post.id);
      setShowDeleteConfirmation(false);
      feedEvents.emit("postDeleted", post.id);
    } catch (error) {
      console.error("Error deleting post:", error);
      setShowDeleteConfirmation(false);
    }
  };

  const handleReportPress = () => {
    setShowActionSheet(false);
    setShowReportModal(true);
  };

  const navigateToProfile = () => {
    if (isOwnPost) {
      router.push("/(users)/profile" as any);
    } else {
      router.push(`/(users)/profile/${post.userId}` as any);
    }
  };

  return (
    <View style={{ backgroundColor: "#fff" }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={navigateToProfile}
          style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
          activeOpacity={0.7}
        >
          {isAuthorLive ? (
            <LinearGradient
              colors={["#FF0080", "#FF3B30", "#FF8C00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.liveRing}
            >
              <View style={styles.liveAvatarInner}>
                {post.profilePic ? (
                  <Image source={{ uri: post.profilePic }} style={styles.avatarImg} cachePolicy="memory-disk" />
                ) : (
                  <Text style={styles.avatarFallback}>
                    {post.username?.charAt(0) || "U"}
                  </Text>
                )}
              </View>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            </LinearGradient>
          ) : (
            <View style={styles.avatar}>
              {post.profilePic ? (
                <Image source={{ uri: post.profilePic }} style={styles.avatarImg} cachePolicy="memory-disk" />
              ) : (
                <Text style={styles.avatarFallback}>
                  {post.username?.charAt(0) || "U"}
                </Text>
              )}
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.username}>{post.username || "Unknown"}</Text>
              {post.isVerified && <Verified size={14} color="#094569" />}
            </View>
            <TimestampLocationRotator
              date={post.date}
              locationName={post.locationName}
              style={styles.timestamp}
            />
          </View>
        </TouchableOpacity>
        {isFollowingAuthor === false && (
          <TouchableOpacity
            style={styles.headerFollowPill}
            activeOpacity={0.75}
            disabled={followBusy}
            onPress={handleFollowAuthor}
          >
            <Text style={styles.headerFollowPillText}>Follow</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setShowActionSheet(true)}>
          <MoreHorizontal size={20} color="#666" />
        </TouchableOpacity>
      </View>
      <PopupMessage
        visible={showFollowedPopup}
        type="success"
        title="Followed"
        message={`You followed ${post.username || "this user"}`}
      />

      {/* Media */}
      {post.images.length > 0 && (
        <View ref={mediaContainerRef} collapsable={false} style={{ position: "relative" }}>
          <MediaCarousel
            frameWidth={frameWidth}
            images={post.images}
            blurHashes={post.blurHashes}
            onDoubleTapAt={handleDoubleTapAt}
            isVisible={isVisible}
            hasTaggedItems={hasTaggedItems}
            onTagPress={() => setShowTaggedItems(true)}
            onImagePress={(i) => {
              setImageViewerIndex(i);
              setImageViewerVisible(true);
            }}
            onVideoPress={handleVideoPress}
            onWatchMorePress={handleWatchMoreReels}
          />
          {/* Content Warning Overlay for sensitive/18+ posts */}
          {needsContentWarning && !isContentRevealed && (
            <ContentWarning
              contentRating={post.contentRating}
              onDismiss={() => setIsContentRevealed(true)}
            />
          )}
        </View>
      )}

      {/* Text-only warning prompt */}
      {post.images.length === 0 && needsContentWarning && !isContentRevealed && (
        <TouchableOpacity
          style={styles.textOnlyWarningCard}
          onPress={() => setIsContentRevealed(true)}
          activeOpacity={0.85}
        >
          <EyeOff size={30} color="#fff" strokeWidth={2.2} />
          <Text style={styles.textOnlyWarningTitle}>Sensitive Content</Text>
          <Text style={styles.textOnlyWarningBody}>Tap to view this post</Text>
        </TouchableOpacity>
      )}

      {/* Action Bar */}
      {(!needsContentWarning || isContentRevealed) && <View style={styles.actionBar}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity onPress={handleLike} style={styles.actionBtn}>
            <Heart
              size={24}
              color={isLiked ? "#e91e63" : "#262626"}
              fill={isLiked ? "#e91e63" : "none"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowComments(true)}
            style={styles.actionBtn}
          >
            <MessageCircle size={24} color="#262626" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSharePost} style={styles.actionBtn}>
            <Send size={24} color="#262626" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleBookmark}>
          <Bookmark
            size={24}
            color="#262626"
            fill={isBookmarked ? "#262626" : "none"}
          />
        </TouchableOpacity>
      </View>}

      {/* Likes */}
      {(!needsContentWarning || isContentRevealed) && <View style={styles.likesSection}>
        {followedLikers.length > 0 ? (
          <MiniAvatarRow
            users={followedLikers}
            totalLikes={likesCount}
            onPress={() => setShowLikesList(true)}
          />
        ) : likesCount > 0 ? (
          <TouchableOpacity onPress={() => setShowLikesList(true)}>
            <Text style={styles.likeCount}>
              {likesCount.toLocaleString()} {likesCount === 1 ? "like" : "likes"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>}

      {/* Private stats — view count + save count, only visible to the post owner */}
      {isOwnPost && (!needsContentWarning || isContentRevealed) && (viewCount > 0 || saveCount > 0) && (
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingBottom: 4, gap: 12 }}>
          {viewCount > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Eye size={13} color="#9CA3AF" strokeWidth={1.8} />
              <Text style={{ fontSize: 12, color: "#9CA3AF", fontWeight: "500" }}>
                {viewCount.toLocaleString()} {viewCount === 1 ? "view" : "views"}
              </Text>
            </View>
          )}
          {saveCount > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Bookmark size={13} color="#9CA3AF" strokeWidth={1.8} fill="none" />
              <Text style={{ fontSize: 12, color: "#9CA3AF", fontWeight: "500" }}>
                {saveCount.toLocaleString()} {saveCount === 1 ? "save" : "saves"}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Caption */}
      {post.content && (!needsContentWarning || isContentRevealed) ? (
        <View style={styles.captionSection}>
          {/* Off-screen full-text measurer — determines whether the caption
              overflows a single line, since numberOfLines clips the layout
              reported to onTextLayout once it's actually limiting lines. */}
          {!captionMeasured && (
            <Text
              style={[styles.captionText, styles.captionMeasurer]}
              onTextLayout={(e) => {
                setCaptionOverflows(e.nativeEvent.lines.length > 1);
                setCaptionMeasured(true);
              }}
            >
              <Text style={styles.captionUsername}>{post.username || "Unknown"}</Text>
              {"  "}
              {post.content}
            </Text>
          )}
          <TouchableOpacity
            activeOpacity={captionExpanded ? 0.6 : 1}
            disabled={!captionExpanded}
            onPress={() => setCaptionExpanded(false)}
          >
            <Text style={styles.captionText} numberOfLines={captionExpanded ? undefined : 1}>
              <Text style={styles.captionUsername}>{post.username || "Unknown"}</Text>
              {"  "}
              {post.content}
            </Text>
          </TouchableOpacity>
          {captionOverflows && !captionExpanded && (
            <TouchableOpacity
              onPress={() => setCaptionExpanded(true)}
              activeOpacity={0.6}
              style={styles.captionMoreOverlay}
            >
              <Text style={styles.captionMoreText}>...more</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Tagged strip — shown when post has no media (tag icon already appears on media carousel) */}
      {hasTaggedItems && post.images.length === 0 && (
        <TouchableOpacity
          onPress={() => setShowTaggedItems(true)}
          activeOpacity={0.8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 6,
            marginHorizontal: 12,
            marginTop: 8,
            marginBottom: 2,
          }}
        >
          {(post.tagged_products ?? []).slice(0, 3).map((p: any) => (
            <View
              key={p.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#eff6ff",
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: "#bfdbfe",
              }}
            >
              <ShoppingBag size={12} color="#094569" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#094569", marginLeft: 5 }} numberOfLines={1}>
                {p.name}
              </Text>
            </View>
          ))}
          {(post.tagged_accounts ?? []).slice(0, 3).map((a: any) => (
            <View
              key={a.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#eef2ff",
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderWidth: 1,
                borderColor: "#e0e7ff",
              }}
            >
              <UserRound size={12} color="#6366f1" />
              <Text style={{ fontSize: 12, fontWeight: "600", color: "#6366f1", marginLeft: 5 }} numberOfLines={1}>
                {a.name}
              </Text>
            </View>
          ))}
          {(post.tagged_products ?? []).length + (post.tagged_accounts ?? []).length > 6 && (
            <View style={{ backgroundColor: "#f3f4f6", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "600" }}>
                +{(post.tagged_products ?? []).length + (post.tagged_accounts ?? []).length - 6} more
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* View Comments */}
      {commentsCount > 0 && (
        <TouchableOpacity
          onPress={() => setShowComments(true)}
          style={styles.viewComments}
        >
          <Text style={styles.viewCommentsText}>
            View all {commentsCount} {commentsCount === 1 ? "comment" : "comments"}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.separator} />

      {/* Modals — lazy-rendered to avoid mounting heavy components in every post */}
      {showTaggedItems && (
        <TaggedItemsModal
          visible={showTaggedItems}
          onClose={() => setShowTaggedItems(false)}
          products={post.tagged_products}
          accounts={post.tagged_accounts}
        />
      )}

      {showComments && (
        <CommentsModal
          visible={showComments}
          onClose={() => setShowComments(false)}
          postId={post.id}
          postOwnerId={post.userId}
          onCommentCountChange={(count) => { setCommentsCount(count); updateCache({ commentsCount: count }); }}
        />
      )}

      {showLikesList && (
        <LikesListModal
          visible={showLikesList}
          onClose={() => setShowLikesList(false)}
          postId={post.id}
        />
      )}

      <PostActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        isOwnPost={isOwnPost}
        onDelete={handleDeletePress}
        onReport={handleReportPress}
      />

      {showDeleteConfirmation && (
        <DeleteConfirmationModal
          visible={showDeleteConfirmation}
          onClose={() => setShowDeleteConfirmation(false)}
          onConfirm={handleConfirmDelete}
          postContent={post.content}
        />
      )}

      {showReportModal && currentUser?.id && post.userId && (
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
          onReportSuccess={() => setShowReportModal(false)}
        />
      )}

      {showError && (
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
      )}

      <ShareComposerModal
        visible={showShareComposer}
        onClose={() => setShowShareComposer(false)}
        heading="Share post"
        sharePayload={postSharePayload}
        inAppContextParams={{
          context_product_id: String(post.id),
          context_product_title: `${post.username || "User"}'s post`,
          context_product_price: "",
          context_product_image: post.images?.[0] || "",
          context_source: "post",
          context_caption: post.content || "",
          context_date: post.date ? post.date.toISOString() : "",
          context_location: post.locationName || "",
          context_username: post.username || "",
          context_verified: post.isVerified ? "true" : "",
        }}
      />

      <ReelsViewer
        visible={reelsVisible}
        initialReels={reelsInitial}
        initialIndex={reelsIndex}
        sourceRect={reelsSourceRect}
        onClose={() => setReelsVisible(false)}
      />

      <ImageViewer
        visible={imageViewerVisible}
        images={post.images}
        blurHashes={post.blurHashes}
        initialIndex={imageViewerIndex}
        onClose={() => setImageViewerVisible(false)}
        postId={String(post.id)}
        postUserId={String(post.userId)}
        postContent={post.content}
        username={post.username}
        likes={likesCount}
        comments={commentsCount}
      />

      {flyingHearts.map(h => (
        <FlyingHeart
          key={h.id}
          startX={h.x}
          startY={h.y}
          heartTargetY={heartTargetY}
          onDone={() => removeFlyingHeart(h.id)}
        />
      ))}
    </View>
  );
}

export default React.memo(FeedPost, (prev, next) =>
  prev.post.id === next.post.id &&
  prev.isVisible === next.isVisible &&
  prev.isAuthorLive === next.isAuthorLive &&
  prev.post.view_count === next.post.view_count &&
  prev.post.locationName === next.post.locationName &&
  prev.post.images.length === next.post.images.length &&
  prev.post.images.every((u, i) => u === next.post.images[i])
);

const styles = StyleSheet.create({
  videoEndOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  videoEndButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 24,
    minWidth: 170,
  },
  videoEndButtonSolid: {
    backgroundColor: "#fff",
  },
  videoEndButtonOutline: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.8)",
  },
  videoEndButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  videoEndButtonTextSolid: {
    color: "#0A0A0A",
    fontSize: 15,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  headerFollowPill: {
    borderWidth: 1.2,
    borderColor: "#094569",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginRight: 10,
  },
  headerFollowPillText: {
    color: "#094569",
    fontWeight: "700",
    fontSize: 13,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    color: "#6B7280",
    fontWeight: "600",
    fontSize: 15,
  },
  liveRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  liveAvatarInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "white",
  },
  liveBadge: {
    position: "absolute",
    bottom: -4,
    alignSelf: "center",
    backgroundColor: "#FF3B30",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: "white",
  },
  liveBadgeText: {
    color: "white",
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  username: {
    fontWeight: "600",
    color: "#262626",
    fontSize: 14,
  },
  timestamp: {
    color: "#9CA3AF",
    fontSize: 12,
    marginTop: 1,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  mediaCounterPill: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mediaCounterText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  tagButton: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  actionBtn: {
    marginRight: 16,
  },
  likesSection: {
    paddingHorizontal: 14,
    minHeight: 4,
  },
  likeCount: {
    fontWeight: "700",
    fontSize: 13,
    color: "#262626",
  },
  textOnlyWarningCard: {
    marginHorizontal: 14,
    marginTop: 10,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  textOnlyWarningTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginTop: 10,
    marginBottom: 6,
  },
  textOnlyWarningBody: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  captionSection: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  captionText: {
    fontSize: 13,
    color: "#262626",
    lineHeight: 20,
  },
  captionUsername: {
    fontWeight: "700",
  },
  captionMeasurer: {
    position: "absolute",
    opacity: 0,
    left: 0,
    right: 0,
    top: 0,
    zIndex: -1,
  },
  captionMoreOverlay: {
    position: "absolute",
    // captionSection has paddingHorizontal: 14 — absolute children anchor to
    // the parent's outer edge in RN (padding is ignored), so this has to
    // repeat that inset manually to land flush with the text and the
    // bookmark button below, instead of sitting 14px further right.
    right: 14,
    bottom: 0,
    height: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingLeft: 6,
  },
  captionMoreText: {
    fontSize: 13,
    color: "#8e8e8e",
    fontWeight: "600",
  },
  viewComments: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  viewCommentsText: {
    fontSize: 13,
    color: "#9CA3AF",
  },
  separator: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginTop: 12,
  },
});
