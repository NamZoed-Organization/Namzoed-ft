import ImageViewer from "@/components/modals/ImageViewer";
import CommentsModal from "@/components/modals/CommentsModal";
import DeleteConfirmationModal from "@/components/modals/DeleteConfirmationModal";
import LikesListModal from "@/components/modals/LikesListModal";
import PostActionSheet from "@/components/modals/PostActionSheet";
import ReportPostModal from "@/components/modals/ReportPostModal";
import TaggedItemsModal from "@/components/modals/TaggedItemsModal";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import {
    hasUserBookmarkedPost,
    togglePostBookmark,
} from "@/lib/bookmarkService";
import { getPostCommentCount } from "@/lib/commentsService";
import {
    getFollowedLikers,
    getPostLikeCount,
    hasUserLikedPost,
    togglePostLike,
} from "@/lib/likesService";
import { deletePost } from "@/lib/postsService";
import { playSound } from "@/lib/soundUtils";
import { PostData } from "@/types/post";
import { feedEvents } from "@/utils/feedEvents";
import { LinearGradient } from "expo-linear-gradient";
import { useAppRouter } from "@/utils/navigation";
import { useVideoPlayer, VideoView } from "expo-video";
import {
    Bookmark,
    Copy,
    Heart,
    MessageCircle,
    MoreHorizontal,
    ShoppingBag,
    Tag,
    UserRound,
    Verified,
    Volume2,
    VolumeX,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import {
    Animated,
    Dimensions,
    Easing,
    FlatList,
    GestureResponderEvent,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

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

const isVideoUrl = (url: string): boolean => {
  const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
  const lowerUrl = url.toLowerCase();
  return (
    videoExtensions.some((ext) => lowerUrl.includes(ext)) ||
    lowerUrl.includes("post-videos")
  );
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const MEDIA_ASPECT = 4 / 5;
const MEDIA_HEIGHT = SCREEN_WIDTH * MEDIA_ASPECT;

interface MediaCarouselProps {
  images: string[];
  onDoubleTapAt?: (x: number, y: number) => void;
  onImagePress?: (index: number) => void;
  isVisible?: boolean;
  hasTaggedItems: boolean;
  onTagPress: () => void;
}

function VideoLoadingShimmer() {
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
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
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
          width: SCREEN_WIDTH * 0.45,
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
  isVisible: boolean;
  onDoubleTapAt?: (x: number, y: number) => void;
}

const InlineVideoPlayer = React.memo(function InlineVideoPlayer({ uri, isVisible, onDoubleTapAt }: InlineVideoPlayerProps) {
  const [isHolding, setIsHolding] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef(0);
  const lastTapPosRef = useRef({ x: 0, y: 0 });
  const muteIconOpacity = useRef(new Animated.Value(1)).current;
  const muteIconTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerOpacity = useRef(new Animated.Value(0)).current;
  const timerVisible = useRef(false);
  const timerFadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timerLabel, setTimerLabel] = useState("");

  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });

  // Sync muted state to player
  useEffect(() => {
    if (!player) return;
    player.muted = isMuted;
  }, [isMuted, player]);

  // Flash mute icon briefly on toggle
  const showMuteIcon = () => {
    if (muteIconTimeout.current) clearTimeout(muteIconTimeout.current);
    muteIconOpacity.setValue(1);
    muteIconTimeout.current = setTimeout(() => {
      Animated.timing(muteIconOpacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }, 1200);
  };

  // Show mute icon on mount (video starts muted)
  useEffect(() => {
    showMuteIcon();
    return () => {
      if (muteIconTimeout.current) clearTimeout(muteIconTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (!player) return;
    if (isVisible && !isHolding) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible, isHolding, player]);

  useEffect(() => {
    if (!player || !isVisible) return;
    const interval = setInterval(() => {
      setCurrentTime(player.currentTime ?? 0);
      setDuration(player.duration ?? 0);
      setIsLoading(player.status === 'idle' || player.status === 'loading');
    }, 250);
    return () => clearInterval(interval);
  }, [player, isVisible]);

  // Show timer for 3s on each visibility entry, then fade out
  useEffect(() => {
    if (!isVisible) {
      // Reset so it shows again next time
      timerOpacity.stopAnimation();
      timerOpacity.setValue(0);
      timerVisible.current = false;
      if (timerFadeTimeout.current) {
        clearTimeout(timerFadeTimeout.current);
        timerFadeTimeout.current = null;
      }
      return;
    }

    // Capture current remaining when becoming visible
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
  }, [isVisible]);

  const handlePressIn = (event: GestureResponderEvent) => {
    lastTapPosRef.current = {
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
    };
    holdTimeoutRef.current = setTimeout(() => {
      setIsHolding(true);
    }, 150);
  };

  const handlePressOut = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (!isHolding) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // Double tap
        onDoubleTapAt?.(lastTapPosRef.current.x, lastTapPosRef.current.y);
      } else {
        // Single tap: toggle mute
        setIsMuted((prev) => {
          showMuteIcon();
          return !prev;
        });
      }
      lastTapRef.current = now;
    }
    setIsHolding(false);
  };

  return (
    <View style={{ width: SCREEN_WIDTH, height: MEDIA_HEIGHT }}>
      <TouchableWithoutFeedback onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <View style={{ flex: 1 }}>
          <VideoView
            player={player}
            style={{ width: SCREEN_WIDTH, height: MEDIA_HEIGHT }}
            contentFit="cover"
            nativeControls={false}
            fullscreenOptions={{ enable: false }}
          />
          {isLoading && <VideoLoadingShimmer />}
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
          {/* Mute/unmute icon */}
          <Animated.View
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              backgroundColor: "rgba(0,0,0,0.4)",
              borderRadius: 20,
              padding: 6,
              opacity: muteIconOpacity,
            }}
            pointerEvents="none"
          >
            {isMuted
              ? <VolumeX size={16} color="#fff" />
              : <Volume2 size={16} color="#fff" />}
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </View>
  );
});

const MediaCarousel = React.memo(
  ({ images, onDoubleTapAt, onImagePress, isVisible = true, hasTaggedItems, onTagPress }: MediaCarouselProps) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const multipleMedia = images.length > 1;
    const lastTapRef = useRef(0);
    const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleImageTap = useCallback((event: GestureResponderEvent, index: number) => {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        // double tap — cancel pending single-tap and trigger like
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        onDoubleTapAt?.(event.nativeEvent.locationX, event.nativeEvent.locationY);
      } else {
        // potential single tap — wait to confirm it's not a double
        singleTapTimerRef.current = setTimeout(() => {
          singleTapTimerRef.current = null;
          onImagePress?.(index);
        }, 300);
      }
      lastTapRef.current = now;
    }, [onDoubleTapAt, onImagePress]);

    const handleScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const x = e.nativeEvent.contentOffset.x;
        const idx = Math.round(x / SCREEN_WIDTH);
        setActiveIndex(idx);
      },
      []
    );

    const renderItem = useCallback(
      ({ item, index }: { item: string; index: number }) => {
        const isVideo = isVideoUrl(item);

        if (isVideo) {
          return (
            <InlineVideoPlayer
              uri={item}
              isVisible={isVisible && activeIndex === index}
              onDoubleTapAt={onDoubleTapAt}
            />
          );
        }

        return (
          <TouchableOpacity
            onPress={(e) => handleImageTap(e, index)}
            activeOpacity={1}
            style={{ width: SCREEN_WIDTH, height: MEDIA_HEIGHT }}
          >
            <Image
              source={{ uri: item }}
              style={{ width: "100%", height: "100%", backgroundColor: "#F3F4F6" }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          </TouchableOpacity>
        );
      },
      [handleImageTap, isVisible, activeIndex, onDoubleTapAt]
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
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={{ height: MEDIA_HEIGHT }}
          />
        ) : (
          renderItem({ item: images[0], index: 0 })
        )}

        {multipleMedia && (
          <View style={styles.stackIcon}>
            <Copy size={14} color="#fff" />
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

        {multipleMedia && (
          <View style={styles.dotsContainer}>
            {images.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === activeIndex ? styles.dotActive : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  }
);

const HEADER_HEIGHT = 56;
const HEART_BTN_X = 26;
const HEART_BTN_Y = HEADER_HEIGHT + MEDIA_HEIGHT + 22;
const FLY_SIZE = 72;
const FLY_DURATION = 700;

interface FlyingHeartProps {
  startX: number;
  startY: number;
  onDone: () => void;
}

function FlyingHeart({ startX, startY, onDone }: FlyingHeartProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  // Physics: solve for initial y-velocity so the parabola lands exactly at endY
  const T = FLY_DURATION / 1000;
  const g = 2600; // gravity px/s² — higher = sharper downward arc
  const endX = HEART_BTN_X;
  const endY = HEART_BTN_Y;
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
  const [flyingHearts, setFlyingHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const flyHeartId = useRef(0);

  const hasTaggedProducts = (post.tagged_products?.length ?? 0) > 0;
  const hasTaggedAccounts = (post.tagged_accounts?.length ?? 0) > 0;
  const hasTaggedItems = hasTaggedProducts || hasTaggedAccounts;
  const { currentUser } = useUser();
  const router = useAppRouter();

  const isOwnPost = currentUser?.id === post.userId;
  const isAuthorLive = isAuthorLiveProp ?? false;

  const formattedDate = useMemo(() => formatDate(post.date), [post.date]);

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
            <Text style={styles.timestamp}>{formattedDate}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowActionSheet(true)}>
          <MoreHorizontal size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Media */}
      {post.images.length > 0 && (
        <MediaCarousel
          images={post.images}
          onDoubleTapAt={handleDoubleTapAt}
          onImagePress={(index) => setPreviewIndex(index)}
          isVisible={isVisible}
          hasTaggedItems={hasTaggedItems}
          onTagPress={() => setShowTaggedItems(true)}
        />
      )}

      {/* Action Bar */}
      <View style={styles.actionBar}>
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
        </View>
        <TouchableOpacity onPress={handleBookmark}>
          <Bookmark
            size={24}
            color="#262626"
            fill={isBookmarked ? "#262626" : "none"}
          />
        </TouchableOpacity>
      </View>

      {/* Likes */}
      <View style={styles.likesSection}>
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
      </View>

      {/* Caption */}
      {post.content ? (
        <View style={styles.captionSection}>
          <Text style={styles.captionText}>
            <Text style={styles.captionUsername}>{post.username || "Unknown"}</Text>
            {"  "}
            {post.content}
          </Text>
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

      {showActionSheet && (
        <PostActionSheet
          visible={showActionSheet}
          onClose={() => setShowActionSheet(false)}
          isOwnPost={isOwnPost}
          onDelete={handleDeletePress}
          onReport={handleReportPress}
        />
      )}

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
      {flyingHearts.map(h => (
        <FlyingHeart key={h.id} startX={h.x} startY={h.y} onDone={() => removeFlyingHeart(h.id)} />
      ))}

      {/* Fullscreen Image Viewer */}
      <ImageViewer
        visible={previewIndex !== null}
        images={post.images}
        initialIndex={previewIndex ?? 0}
        onClose={() => setPreviewIndex(null)}
        postContent={post.content}
        username={post.username}
        likes={likesCount}
        comments={commentsCount}
        postId={post.id}
        postUserId={post.userId}
      />
    </View>
  );
}

export default React.memo(FeedPost, (prev, next) =>
  prev.post.id === next.post.id &&
  prev.isVisible === next.isVisible &&
  prev.isAuthorLive === next.isAuthorLive
);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
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
  stackIcon: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 6,
    padding: 6,
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
  dotsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: "#094569",
  },
  dotInactive: {
    backgroundColor: "rgba(255,255,255,0.5)",
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
