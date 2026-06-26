import CommentsModal from "@/components/modals/CommentsModal";
import ShareComposerModal from "@/components/modals/ShareComposerModal";
import BottomNavBar from "@/components/ui/BottomNavBar";
import { useUser } from "@/contexts/UserContext";
import { useAppRouter } from "@/utils/navigation";
import { hasUserBookmarkedPost, togglePostBookmark } from "@/lib/bookmarkService";
import { getPostCommentCount } from "@/lib/commentsService";
import { getPostLikeCount, hasUserLikedPost, togglePostLike } from "@/lib/likesService";
import { fetchVideoReels, VideoReel } from "@/lib/postsService";
import { buildPostExternalSharePayload } from "@/lib/shareUtils";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Haptics from "expo-haptics";
import {
  Bookmark,
  Heart,
  MessageCircle,
  Play,
  Share2,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get("window");

interface ReelsViewerProps {
  visible: boolean;
  onClose: () => void;
  /** Videos to show first (typically the tapped post's video(s)). */
  initialReels: VideoReel[];
  /** Index within initialReels to start on. */
  initialIndex?: number;
}

interface ReelItemProps {
  reel: VideoReel;
  isActive: boolean;
  currentUserId?: string;
  /** Distance from the screen bottom for the overlay controls (clears the nav bar). */
  controlsBottom: number;
  /** Animated height of the video area — shrinks when the comments sheet opens. */
  videoHeight: Animated.Value;
  /** True while the comments sheet is open (video collapsed to the top region). */
  collapsed: boolean;
  onComment: (reel: VideoReel) => void;
  onShare: (reel: VideoReel) => void;
}

function ReelItem({
  reel,
  isActive,
  currentUserId,
  controlsBottom,
  videoHeight,
  collapsed,
  onComment,
  onShare,
}: ReelItemProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  // Fill the screen by default; fall back to letterbox only for videos that are
  // notably wider than the screen (square / landscape), like Instagram Reels.
  const [contentFit, setContentFit] = useState<"cover" | "contain">("cover");
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  const statsLoaded = useRef(false);
  const lastTapRef = useRef(0);
  const singleTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playOverlayOpacity = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0)).current;

  // `useCaching` persists the download to disk (ExoPlayer SimpleCache / iOS asset
  // cache) so reopening the same reel plays instantly with no re-download.
  const player = useVideoPlayer({ uri: reel.uri, useCaching: true }, (p) => {
    p.loop = true;
    // Pre-buffer a few seconds so swiping to this reel starts without a stall.
    p.bufferOptions = { preferredForwardBufferDuration: 5, minBufferForPlayback: 1 };
  });

  // Play only the active reel; pause + rewind the others to free decoders.
  useEffect(() => {
    if (!player) return;
    if (isActive) {
      player.play();
      setIsPlaying(true);
    } else {
      player.pause();
      try {
        player.currentTime = 0;
      } catch {}
      setIsPlaying(false);
    }
  }, [isActive, player]);

  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      setIsLoading(player.status === "idle" || player.status === "loading");
    }, 250);
    return () => clearInterval(interval);
  }, [player]);

  // Pick contentFit from the video's real dimensions once the track loads.
  useEffect(() => {
    if (!player) return;
    const screenAspect = WINDOW_WIDTH / WINDOW_HEIGHT;
    const decide = (size?: { width: number; height: number } | null) => {
      if (!size?.width || !size?.height) return;
      const videoAspect = size.width / size.height;
      // Cover (fill) for portrait & near-fullscreen ratios; contain otherwise.
      setContentFit(videoAspect <= screenAspect * 1.3 ? "cover" : "contain");
    };
    decide(player.videoTrack?.size);
    const sub = player.addListener("sourceLoad", (payload: any) => {
      decide(payload?.availableVideoTracks?.[0]?.size ?? player.videoTrack?.size);
    });
    const sub2 = player.addListener("videoTrackChange", (payload: any) => {
      decide(payload?.videoTrack?.size ?? player.videoTrack?.size);
    });
    return () => {
      sub.remove();
      sub2.remove();
    };
  }, [player]);

  // Load interaction stats when the reel first becomes active.
  useEffect(() => {
    if (!isActive || statsLoaded.current) return;
    statsLoaded.current = true;
    (async () => {
      try {
        const [count, comments, liked, bookmarked] = await Promise.all([
          getPostLikeCount(reel.postId),
          getPostCommentCount(reel.postId),
          currentUserId
            ? hasUserLikedPost(reel.postId, currentUserId)
            : Promise.resolve(false),
          currentUserId
            ? hasUserBookmarkedPost(reel.postId, currentUserId)
            : Promise.resolve(false),
        ]);
        setLikeCount(count);
        setCommentCount(comments);
        setIsLiked(liked);
        setIsBookmarked(bookmarked);
      } catch (e) {
        console.warn("Failed to load reel stats", e);
      }
    })();
  }, [isActive, currentUserId, reel.postId]);

  useEffect(() => {
    Animated.timing(playOverlayOpacity, {
      toValue: isPlaying ? 0 : 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [isPlaying, playOverlayOpacity]);

  const popHeart = useCallback(() => {
    heartScale.setValue(0);
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 4,
      }),
      Animated.timing(heartScale, {
        toValue: 0,
        duration: 250,
        delay: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, [heartScale]);

  const handleLike = useCallback(async () => {
    if (!currentUserId) return;
    const prevLiked = isLiked;
    const prevCount = likeCount;
    setIsLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const result = await togglePostLike(reel.postId, currentUserId, prevLiked);
      if (!result.success) {
        setIsLiked(prevLiked);
        setLikeCount(prevCount);
      } else {
        setIsLiked(result.isLiked);
        setLikeCount(result.likeCount);
      }
    } catch {
      setIsLiked(prevLiked);
      setLikeCount(prevCount);
    }
  }, [currentUserId, isLiked, likeCount, reel.postId]);

  const handleBookmark = useCallback(async () => {
    if (!currentUserId) return;
    const prev = isBookmarked;
    setIsBookmarked(!prev);
    try {
      const result = await togglePostBookmark(reel.postId, currentUserId, prev);
      if (!result.success) setIsBookmarked(prev);
      else setIsBookmarked(result.isBookmarked);
    } catch {
      setIsBookmarked(prev);
    }
  }, [currentUserId, isBookmarked, reel.postId]);

  const togglePlay = useCallback(() => {
    if (!player) return;
    if (player.playing) {
      player.pause();
      setIsPlaying(false);
    } else {
      player.play();
      setIsPlaying(true);
    }
  }, [player]);

  const handleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (singleTapTimer.current) {
        clearTimeout(singleTapTimer.current);
        singleTapTimer.current = null;
      }
      lastTapRef.current = 0;
      if (!isLiked) handleLike();
      popHeart();
    } else {
      lastTapRef.current = now;
      singleTapTimer.current = setTimeout(() => {
        singleTapTimer.current = null;
        togglePlay();
      }, 280);
    }
  }, [handleLike, isLiked, popHeart, togglePlay]);

  return (
    <View style={styles.itemContainer}>
      {/* Video area — shrinks to the top region while the comments sheet is open */}
      <Animated.View style={{ width: WINDOW_WIDTH, height: videoHeight }}>
        <TouchableWithoutFeedback onPress={handleTap}>
          <View style={StyleSheet.absoluteFill}>
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit={collapsed ? "contain" : contentFit}
              nativeControls={false}
              fullscreenOptions={{ enable: false }}
            />
            {isLoading && (
              <View style={styles.loaderOverlay} pointerEvents="none">
                <ActivityIndicator size="large" color="#fff" />
              </View>
            )}

            {/* Center play affordance when paused */}
            <Animated.View
              pointerEvents="none"
              style={[styles.centerPlay, { opacity: playOverlayOpacity }]}
            >
              <View style={styles.centerPlayBg}>
                <Play size={34} color="#fff" fill="#fff" />
              </View>
            </Animated.View>

            {/* Double-tap heart */}
            <Animated.View
              pointerEvents="none"
              style={[styles.centerPlay, { transform: [{ scale: heartScale }] }]}
            >
              <Heart size={110} color="#fff" fill="#e91e63" />
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Right action rail — hidden while comments cover the bottom */}
      <View
        style={[
          styles.actionRail,
          { bottom: controlsBottom, opacity: collapsed ? 0 : 1 },
        ]}
        pointerEvents={collapsed ? "none" : "box-none"}
      >
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Heart
            size={32}
            color={isLiked ? "#e91e63" : "#fff"}
            fill={isLiked ? "#e91e63" : "none"}
          />
          {likeCount > 0 && <Text style={styles.actionLabel}>{likeCount}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment(reel)}>
          <MessageCircle size={31} color="#fff" />
          {commentCount > 0 && (
            <Text style={styles.actionLabel}>{commentCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleBookmark}>
          <Bookmark
            size={31}
            color="#fff"
            fill={isBookmarked ? "#fff" : "none"}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onShare(reel)}>
          <Share2 size={30} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom caption — tap to open the comments drawer (Instagram-style) */}
      {!collapsed && (
        <TouchableOpacity
          style={[styles.captionBox, { bottom: controlsBottom }]}
          activeOpacity={0.7}
          onPress={() => onComment(reel)}
        >
          <View style={styles.captionHeader}>
            {reel.avatarUrl ? (
              <Image source={{ uri: reel.avatarUrl }} style={styles.captionAvatar} />
            ) : (
              <View style={[styles.captionAvatar, styles.captionAvatarFallback]}>
                <Text style={styles.captionAvatarText}>
                  {(reel.username || "U").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.captionUsername} numberOfLines={1}>
              {reel.username}
            </Text>
          </View>
          {reel.content ? (
            <Text style={styles.captionText} numberOfLines={2}>
              {reel.content}
            </Text>
          ) : null}
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function ReelsViewer({
  visible,
  onClose,
  initialReels,
  initialIndex = 0,
}: ReelsViewerProps) {
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();
  const router = useAppRouter();
  const flatListRef = useRef<FlatList<VideoReel>>(null);

  // Lift the reel controls above the bottom navigation bar.
  const NAV_BAR_HEIGHT = 56;
  const controlsBottom = insets.bottom + NAV_BAR_HEIGHT + 14;

  const [reels, setReels] = useState<VideoReel[]>(initialReels);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const cursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const seenUris = useRef<Set<string>>(new Set());

  // Comments + share state lifted to the viewer.
  const [commentReel, setCommentReel] = useState<VideoReel | null>(null);
  const [shareReel, setShareReel] = useState<VideoReel | null>(null);

  // Fraction of the screen the video keeps when the comments sheet opens.
  const REELS_VIDEO_RATIO = 0.46;
  const videoHeight = useRef(new Animated.Value(WINDOW_HEIGHT)).current;

  // Shrink the video into the top region while comments are open, restore on close.
  useEffect(() => {
    Animated.spring(videoHeight, {
      toValue: commentReel ? WINDOW_HEIGHT * REELS_VIDEO_RATIO : WINDOW_HEIGHT,
      useNativeDriver: false,
      damping: 22,
      stiffness: 200,
      mass: 0.9,
    }).start();
  }, [commentReel, videoHeight]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    try {
      const { reels: more, nextCursor, hasMore } = await fetchVideoReels(
        cursorRef.current,
      );
      cursorRef.current = nextCursor;
      hasMoreRef.current = hasMore;
      const fresh = more.filter((r) => !seenUris.current.has(r.uri));
      fresh.forEach((r) => seenUris.current.add(r.uri));
      if (fresh.length > 0) {
        setReels((prev) => [...prev, ...fresh]);
      } else if (hasMore) {
        // Page had only duplicates — keep paging.
        loadingRef.current = false;
        loadMore();
        return;
      }
    } catch (e) {
      console.warn("Failed to load more reels", e);
    } finally {
      loadingRef.current = false;
    }
  }, []);

  // Reset + seed when (re)opened.
  useEffect(() => {
    if (!visible) return;
    seenUris.current = new Set(initialReels.map((r) => r.uri));
    cursorRef.current = null;
    hasMoreRef.current = true;
    setReels(initialReels);
    setCurrentIndex(initialIndex);
    if (initialIndex > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
    // Prefetch the endless stream of system videos.
    loadMore();
  }, [visible, initialReels, initialIndex, loadMore]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const itemHeight = WINDOW_HEIGHT;

  const shareReelPayload = useMemo(() => {
    if (!shareReel) return null;
    return buildPostExternalSharePayload({
      id: shareReel.postId,
      author: shareReel.username,
      content: shareReel.content,
      imageUrl: undefined,
    });
  }, [shareReel]);

  // Pull-down-from-the-top to dismiss (iOS overscroll). Android uses the system
  // back gesture/button via the Modal's onRequestClose.
  const DISMISS_PULL = 90;
  const lastOffsetY = useRef(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
        listener: (e: any) => {
          lastOffsetY.current = e?.nativeEvent?.contentOffset?.y ?? 0;
        },
      }),
    [scrollY],
  );
  const handleScrollEndDrag = useCallback(() => {
    if (lastOffsetY.current < -DISMISS_PULL) onClose();
  }, [onClose]);
  const dismissOpacity = scrollY.interpolate({
    inputRange: [-220, -40, 0],
    outputRange: [0.25, 1, 1],
    extrapolate: "clamp",
  });
  const dismissScale = scrollY.interpolate({
    inputRange: [-220, 0],
    outputRange: [0.9, 1],
    extrapolate: "clamp",
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={styles.container}>
        <Animated.View
          style={{ flex: 1, opacity: dismissOpacity, transform: [{ scale: dismissScale }] }}
        >
          <FlatList
            ref={flatListRef}
            data={reels}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <ReelItem
                reel={item}
                isActive={index === currentIndex}
                currentUserId={currentUser?.id}
                controlsBottom={controlsBottom}
                videoHeight={videoHeight}
                collapsed={!!commentReel}
                onComment={setCommentReel}
                onShare={setShareReel}
              />
            )}
            scrollEnabled={!commentReel}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={itemHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            onScroll={onScroll}
            scrollEventThrottle={16}
            onScrollEndDrag={handleScrollEndDrag}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            onEndReached={loadMore}
            onEndReachedThreshold={1.5}
            removeClippedSubviews
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            getItemLayout={(_, index) => ({
              length: itemHeight,
              offset: itemHeight * index,
              index,
            })}
            ListFooterComponent={
              hasMoreRef.current ? (
                <View style={[styles.footer, { height: 0 }]} />
              ) : null
            }
          />
        </Animated.View>

        {/* Grab handle hinting pull-down-to-dismiss (replaces the close button) */}
        <View pointerEvents="none" style={[styles.grabHandleWrap, { top: insets.top + 8 }]}>
          <View style={styles.grabHandle} />
        </View>

        {/* App bottom navigation, kept visible over the reels */}
        <BottomNavBar
          onTabPress={(href) => {
            onClose();
            router.push(href as any);
          }}
        />
      </View>

      {commentReel && (
        <CommentsModal
          visible={!!commentReel}
          onClose={() => setCommentReel(null)}
          postId={commentReel.postId}
          postOwnerId={commentReel.userId}
          embedded
          sheetTopRatio={REELS_VIDEO_RATIO}
          headerContent={
            commentReel.content ? (
              <View style={styles.descHeader}>
                <View style={styles.captionHeader}>
                  {commentReel.avatarUrl ? (
                    <Image
                      source={{ uri: commentReel.avatarUrl }}
                      style={styles.descAvatar}
                    />
                  ) : (
                    <View style={[styles.descAvatar, styles.captionAvatarFallback]}>
                      <Text style={styles.captionAvatarText}>
                        {(commentReel.username || "U").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.descUsername} numberOfLines={1}>
                    {commentReel.username}
                  </Text>
                </View>
                <Text style={styles.descText}>{commentReel.content}</Text>
              </View>
            ) : null
          }
        />
      )}

      {shareReel && shareReelPayload && (
        <ShareComposerModal
          visible={!!shareReel}
          onClose={() => setShareReel(null)}
          heading="Share video"
          sharePayload={shareReelPayload}
          inAppContextParams={{
            context_product_id: shareReel.postId,
            context_product_title: `${shareReel.username || "User"}'s video`,
            context_product_price: "",
            context_product_image: "",
            context_source: "post",
          }}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  itemContainer: {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    backgroundColor: "#000",
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  centerPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  centerPlayBg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  grabHandleWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 50,
  },
  grabHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  actionRail: {
    position: "absolute",
    right: 12,
    alignItems: "center",
    gap: 22,
  },
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  captionBox: {
    position: "absolute",
    left: 16,
    right: 80,
  },
  captionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  captionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#333",
  },
  captionAvatarFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#094569",
  },
  captionAvatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  captionUsername: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    flexShrink: 1,
  },
  captionText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 14,
    lineHeight: 19,
  },
  descHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  descAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e5e7eb",
  },
  descUsername: {
    color: "#111",
    fontWeight: "700",
    fontSize: 14,
    flexShrink: 1,
  },
  descText: {
    color: "#374151",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  footer: {
    width: "100%",
  },
});
