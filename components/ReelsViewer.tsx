import CommentsModal from "@/components/modals/CommentsModal";
import ShareComposerModal from "@/components/modals/ShareComposerModal";
import BottomNavBar from "@/components/ui/BottomNavBar";
import { useUser } from "@/contexts/UserContext";
import { useBottomBarScroll } from "@/hooks/useBottomBarScroll";
import { useAppRouter } from "@/utils/navigation";
import { hasUserBookmarkedPost, togglePostBookmark } from "@/lib/bookmarkService";
import { followUser, isFollowing } from "@/lib/followService";
import PopupMessage from "@/components/ui/PopupMessage";
import { getPostCommentCount } from "@/lib/commentsService";
import { getPostLikeCount, hasUserLikedPost, togglePostLike } from "@/lib/likesService";
import { fetchVideoReels, VideoReel } from "@/lib/postsService";
import { buildPostExternalSharePayload } from "@/lib/shareUtils";
import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bookmark,
  Heart,
  MessageCircle,
  Play,
  Send,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Modal,
  PanResponder,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: WINDOW_HEIGHT, width: WINDOW_WIDTH } = Dimensions.get("window");
const SCRUBBER_TOUCH_HEIGHT = 28;

interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ReelsViewerProps {
  visible: boolean;
  onClose: () => void;
  /** Videos to show first (typically the tapped post's video(s)). */
  initialReels: VideoReel[];
  /** Index within initialReels to start on. */
  initialIndex?: number;
  /** On-screen rect of the tapped video in the feed, measured just before
   *  opening. The viewer expands from this rect to fullscreen on open, and
   *  collapses back to it on close, instead of just popping in/out. */
  sourceRect?: SourceRect | null;
}

interface ReelItemProps {
  reel: VideoReel;
  isActive: boolean;
  currentUserId?: string;
  /** Distance from the screen bottom for the overlay controls (clears the nav bar + scrubber). */
  controlsBottom: number;
  /** Distance from the screen bottom for this reel's own scrub bar. */
  scrubberBottom: number;
  /** Animated height of the video area — shrinks when the comments sheet opens. */
  videoHeight: Animated.Value;
  /** True while the comments sheet is open (video collapsed to the top region). */
  collapsed: boolean;
  onComment: (reel: VideoReel) => void;
  onShare: (reel: VideoReel) => void;
  /** Reports scrub-bar drag start/end so the viewer can suppress the swipe-to-dismiss gesture. */
  onScrubbingChange: (scrubbing: boolean) => void;
}

function ReelItem({
  reel,
  isActive,
  currentUserId,
  controlsBottom,
  scrubberBottom,
  videoHeight,
  collapsed,
  onComment,
  onShare,
  onScrubbingChange,
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
  // null = not checked yet (or this is the viewer's own reel) — the follow
  // pill only ever renders once we know for sure the viewer doesn't already
  // follow this author.
  const [isFollowingAuthor, setIsFollowingAuthor] = useState<boolean | null>(null);
  const [followBusy, setFollowBusy] = useState(false);
  const [showFollowedPopup, setShowFollowedPopup] = useState(false);
  const followedPopupTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (followedPopupTimeout.current) clearTimeout(followedPopupTimeout.current);
    };
  }, []);

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
    // Frequent enough for a smooth scrubber without flooding the JS bridge.
    p.timeUpdateEventInterval = 0.25;
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

  // This reel's own scrub bar — local to this item (not lifted to the
  // viewer) so it scrolls away with the reel itself instead of staying
  // fixed on screen.
  const [scrubTime, setScrubTime] = useState(0);
  const [scrubDuration, setScrubDuration] = useState(0);

  useEffect(() => {
    if (!player || !isActive) return;
    const sub = player.addListener("timeUpdate", (payload: { currentTime: number }) => {
      setScrubTime(payload.currentTime);
      setScrubDuration(player.duration || 0);
    });
    return () => sub.remove();
  }, [player, isActive]);

  const handleScrubSeek = useCallback(
    (time: number) => {
      if (!player) return;
      try {
        player.currentTime = time;
      } catch {}
    },
    [player],
  );

  // Scrub "focus state": pauses playback and hides the caption/action icons
  // while dragging, like Instagram/TikTok. Remembers whether the video was
  // actually playing beforehand so a manually-paused video stays paused
  // after you let go, instead of always resuming.
  const [isScrubbing, setIsScrubbing] = useState(false);
  const wasPlayingBeforeScrubRef = useRef(true);

  const handleItemScrubbingChange = useCallback(
    (scrubbing: boolean) => {
      setIsScrubbing(scrubbing);
      if (scrubbing) {
        wasPlayingBeforeScrubRef.current = player?.playing ?? false;
        player?.pause();
      } else if (wasPlayingBeforeScrubRef.current) {
        player?.play();
      }
      onScrubbingChange(scrubbing);
    },
    [player, onScrubbingChange],
  );

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
        const [count, comments, liked, bookmarked, following] = await Promise.all([
          getPostLikeCount(reel.postId),
          getPostCommentCount(reel.postId),
          currentUserId
            ? hasUserLikedPost(reel.postId, currentUserId)
            : Promise.resolve(false),
          currentUserId
            ? hasUserBookmarkedPost(reel.postId, currentUserId)
            : Promise.resolve(false),
          currentUserId && currentUserId !== reel.userId
            ? isFollowing(currentUserId, reel.userId)
            : Promise.resolve(true),
        ]);
        setLikeCount(count);
        setCommentCount(comments);
        setIsLiked(liked);
        setIsBookmarked(bookmarked);
        setIsFollowingAuthor(following);
      } catch (e) {
        console.warn("Failed to load reel stats", e);
      }
    })();
  }, [isActive, currentUserId, reel.postId, reel.userId]);

  const handleFollowAuthor = useCallback(async () => {
    if (!currentUserId || followBusy) return;
    setFollowBusy(true);
    const prev = isFollowingAuthor;
    setIsFollowingAuthor(true);
    try {
      const result = await followUser(currentUserId, reel.userId);
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
  }, [currentUserId, reel.userId, isFollowingAuthor, followBusy]);

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
              <Heart size={110} color="#e91e63" fill="#e91e63" />
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Right action rail — hidden while comments cover the bottom, or
          while scrubbing (Instagram/TikTok-style focus state) */}
      <View
        style={[
          styles.actionRail,
          { bottom: controlsBottom + 48, opacity: collapsed || isScrubbing ? 0 : 1 },
        ]}
        pointerEvents={collapsed || isScrubbing ? "none" : "box-none"}
      >
        <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
          <Heart
            size={28}
            strokeWidth={1.5}
            color={isLiked ? "#e91e63" : "#fff"}
            fill={isLiked ? "#e91e63" : "none"}
          />
          {likeCount > 0 && <Text style={styles.actionLabel}>{likeCount}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onComment(reel)}>
          <MessageCircle size={27} strokeWidth={1.5} color="#fff" />
          {commentCount > 0 && (
            <Text style={styles.actionLabel}>{commentCount}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={handleBookmark}>
          <Bookmark
            size={27}
            strokeWidth={1.5}
            color="#fff"
            fill={isBookmarked ? "#fff" : "none"}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn} onPress={() => onShare(reel)}>
          <Send size={26} strokeWidth={1.5} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Bottom caption — tap to open the comments drawer (Instagram-style) */}
      {!collapsed && !isScrubbing && (
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
            {isFollowingAuthor === false && (
              <TouchableOpacity
                style={styles.followPill}
                activeOpacity={0.75}
                disabled={followBusy}
                onPress={handleFollowAuthor}
              >
                <Text style={styles.followPillText}>Follow</Text>
              </TouchableOpacity>
            )}
          </View>
          {reel.content ? (
            <Text style={styles.captionText} numberOfLines={2}>
              {reel.content}
            </Text>
          ) : null}
        </TouchableOpacity>
      )}

      {/* This reel's own scrub bar — part of the item itself (scrolls away
          with it), sits below the caption/action icons, above the nav bar. */}
      {!collapsed && isActive && (
        <VideoScrubber
          videoUri={reel.uri}
          currentTime={scrubTime}
          duration={scrubDuration}
          onSeek={handleScrubSeek}
          onScrubbingChange={handleItemScrubbingChange}
          bottom={scrubberBottom}
        />
      )}

      <PopupMessage
        visible={showFollowedPopup}
        type="success"
        title="Followed"
        message={`You followed ${reel.username}`}
      />
    </View>
  );
}

function formatScrubTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const PREVIEW_WIDTH = 64;
const PREVIEW_HEIGHT = 110;
const PREVIEW_SIDE_MARGIN = 8;
const PREVIEW_SEEK_THROTTLE_MS = 120;

interface VideoScrubberProps {
  /** Same source as the main player — used to spin up a small muted preview player. */
  videoUri: string;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  /** Fires true on drag start, false on release/cancel — lets the viewer
   *  suppress the swipe-to-dismiss gesture while this is active. */
  onScrubbingChange: (scrubbing: boolean) => void;
  /** Distance from the screen bottom — sits right above the floating bar. */
  bottom: number;
}

/** Instagram/TikTok-style scrub bar: full width, enlarges while dragging,
 *  and shows a small frame-preview thumbnail above the bar with the current
 *  time overlaid on it. Seeks the active reel on release. */
function VideoScrubber({
  videoUri,
  currentTime,
  duration,
  onSeek,
  onScrubbingChange,
  bottom,
}: VideoScrubberProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragTime, setDragTime] = useState(0);
  // Screen-absolute X of the touch, used to position the preview thumbnail —
  // tracked independently of the bar's own width/bounds so it keeps working
  // no matter how far the finger has drifted from the bar itself.
  const [previewX, setPreviewX] = useState(0);
  const touchPadRef = useRef<View>(null);
  const padPageXRef = useRef(0);
  const widthRef = useRef(WINDOW_WIDTH);
  const barHeight = useRef(new Animated.Value(2.5)).current;

  const displayTime = isDragging ? dragTime : currentTime;
  const progress = duration > 0 ? Math.min(1, Math.max(0, displayTime / duration)) : 0;

  // Small muted, paused player dedicated to the drag preview — only ever
  // mounted for the active reel (this component only renders then), so it
  // doesn't add a player per off-screen item.
  const previewPlayer = useVideoPlayer({ uri: videoUri, useCaching: true }, (p) => {
    p.muted = true;
  });
  const lastPreviewSeekRef = useRef(0);
  const seekPreview = useCallback(
    (time: number) => {
      const now = Date.now();
      if (now - lastPreviewSeekRef.current < PREVIEW_SEEK_THROTTLE_MS) return;
      lastPreviewSeekRef.current = now;
      try {
        previewPlayer.currentTime = time;
      } catch {}
    },
    [previewPlayer],
  );

  // PanResponder.create() below runs exactly once (it's inside useRef, never
  // recreated), so its callback closures are frozen to whatever `duration`/
  // `onSeek`/`onScrubbingChange` looked like on that very first render —
  // back when `duration` was still 0 (no timeUpdate event had fired yet).
  // Without this ref, every scrub would keep computing `t = 0` forever and
  // seek to the start no matter where you touch. Reading through a ref
  // that's refreshed every render keeps the responder's callbacks looking
  // at live values instead.
  const latestRef = useRef({ duration, onSeek, onScrubbingChange });
  latestRef.current = { duration, onSeek, onScrubbingChange };

  // Uses gestureState.moveX/moveY — the touch's absolute screen position —
  // rather than the touch event's locationX (relative to whichever view is
  // currently under the finger). Once the responder is granted, RN keeps
  // delivering move events regardless of where on screen the finger drifts
  // to, so as long as the *position* math is screen-absolute rather than
  // relative to the bar's own bounds, dragging works at any height, not
  // just directly on the thin line.
  const seekAtPageX = useCallback(
    (pageX: number) => {
      const w = widthRef.current || WINDOW_WIDTH;
      const relativeX = pageX - padPageXRef.current;
      const clamped = Math.min(w, Math.max(0, relativeX));
      const d = latestRef.current.duration;
      const t = d > 0 ? (clamped / w) * d : 0;
      setDragTime(t);
      setPreviewX(pageX);
      seekPreview(t);
      return t;
    },
    [seekPreview],
  );

  const scrubResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // Capture too, so a parent's own responder (the swipe-to-dismiss
      // gesture) can never intercept a touch that starts on the scrubber.
      onStartShouldSetPanResponderCapture: () => true,
      // Once granted, never hand the responder back — without this, the
      // parent paging FlatList (or the outer swipe-to-dismiss responder)
      // can reclaim the gesture the moment the finger drags far enough
      // away from the bar's own bounds (e.g. straight up), which is
      // exactly the "drag at any height" case that must keep working
      // until the finger actually lifts.
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        setIsDragging(true);
        latestRef.current.onScrubbingChange(true);
        Animated.timing(barHeight, { toValue: 6, duration: 120, useNativeDriver: false }).start();
        seekAtPageX(gestureState.moveX || evt.nativeEvent.pageX);
      },
      onPanResponderMove: (evt, gestureState) => {
        seekAtPageX(gestureState.moveX || evt.nativeEvent.pageX);
      },
      onPanResponderRelease: (evt, gestureState) => {
        const t = seekAtPageX(gestureState.moveX || evt.nativeEvent.pageX);
        latestRef.current.onSeek(t);
        Animated.timing(barHeight, { toValue: 2.5, duration: 160, useNativeDriver: false }).start();
        setIsDragging(false);
        latestRef.current.onScrubbingChange(false);
      },
      onPanResponderTerminate: () => {
        Animated.timing(barHeight, { toValue: 2.5, duration: 160, useNativeDriver: false }).start();
        setIsDragging(false);
        latestRef.current.onScrubbingChange(false);
      },
    }),
  ).current;

  // A tall gradient zone (not a flat rectangle) covering the full width from
  // well above the scrub bar down to the very bottom of the screen. The
  // blur itself is masked to fade out gradually toward the top — rather
  // than an abrupt intensity cutoff — so where it meets the video is never
  // a visible seam, plus a matching dark scrim on top for the same soft
  // vignette depth. Mirrors Instagram/short-form video players.
  const gradientZoneHeight = bottom + SCRUBBER_TOUCH_HEIGHT + Math.round(WINDOW_HEIGHT * 0.16);

  const previewLeft = Math.min(
    WINDOW_WIDTH - PREVIEW_SIDE_MARGIN - PREVIEW_WIDTH,
    Math.max(PREVIEW_SIDE_MARGIN, previewX - PREVIEW_WIDTH / 2),
  );

  return (
    <>
      <MaskedView
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: gradientZoneHeight,
        }}
        maskElement={
          <LinearGradient
            colors={["transparent", "transparent", "rgba(0,0,0,0.55)", "#000"]}
            locations={[0, 0.35, 0.72, 1]}
            style={{ flex: 1 }}
          />
        }
      >
        <BlurView tint="dark" intensity={99} style={{ flex: 1 }} />
      </MaskedView>
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", "rgba(0,0,0,0.5)"]}
        locations={[0.35, 1]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: gradientZoneHeight,
        }}
      />

      {isDragging && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: previewLeft,
            bottom: bottom + SCRUBBER_TOUCH_HEIGHT + 14,
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
            borderRadius: 8,
            overflow: "hidden",
            borderWidth: 1.5,
            borderColor: "rgba(255,255,255,0.85)",
            backgroundColor: "#000",
          }}
        >
          <VideoView
            player={previewPlayer}
            style={{ flex: 1 }}
            contentFit="cover"
            nativeControls={false}
          />
          <View style={styles.previewTimeOverlay}>
            <Text style={styles.previewTimeText}>{formatScrubTime(displayTime)}</Text>
          </View>
        </View>
      )}

      <View
        style={[
          styles.scrubberWrap,
          { bottom, left: WINDOW_WIDTH * 0.025, right: WINDOW_WIDTH * 0.025 },
        ]}
      >
        <View
          ref={touchPadRef}
          style={styles.scrubberTouchPad}
          onLayout={() => {
            touchPadRef.current?.measureInWindow((x, _y, width) => {
              padPageXRef.current = x;
              widthRef.current = width;
            });
          }}
          {...scrubResponder.panHandlers}
        >
          <Animated.View style={[styles.scrubberBar, { height: barHeight }]}>
            <View style={styles.scrubberTrackBg} />
            <View style={[styles.scrubberFill, { width: `${progress * 100}%` }]} />
          </Animated.View>
        </View>
      </View>
    </>
  );
}

export default function ReelsViewer({
  visible,
  onClose,
  initialReels,
  initialIndex = 0,
  sourceRect,
}: ReelsViewerProps) {
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();
  const router = useAppRouter();
  const flatListRef = useRef<FlatList<VideoReel>>(null);

  // Lift the reel controls above the bottom navigation bar, and the scrub
  // bar above that in turn — each reel's own scrubber sits right above the
  // nav bar, with the caption/action icons pushed further up to clear it.
  const NAV_BAR_HEIGHT = 56;
  const scrubberBottom = insets.bottom + NAV_BAR_HEIGHT + 0;
  const controlsBottom = scrubberBottom + SCRUBBER_TOUCH_HEIGHT + 10;

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

  const scrollY = useRef(new Animated.Value(0)).current;
  const { scale: bottomBarScale, onScroll: onBottomBarScroll } = useBottomBarScroll();
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: false,
        listener: (e: any) => {
          onBottomBarScroll(e);
        },
      }),
    [scrollY, onBottomBarScroll],
  );

  // Expand-from/collapse-to-source-rect transition, driven by a single 0..1
  // value: 1 = fullscreen (open), 0 = collapsed down to the tapped video's
  // on-screen rect in the feed (closed). Opens by animating 0→1.
  //
  // The swipe-to-dismiss gesture is kept deliberately separate from this:
  // while dragging, the whole fullscreen video just slides left-to-right
  // as one rigid block (plain `swipeX` offset, no shrinking) — like
  // Instagram's reel swipe. transitionProgress only moves once the drag is
  // released and committed, animating the slid content the rest of the way
  // down into the feed post's rect. Releasing below the threshold just
  // slides the video back to center; transitionProgress never engages.
  const rect: SourceRect = sourceRect ?? { x: 0, y: 0, width: WINDOW_WIDTH, height: WINDOW_HEIGHT };
  const transitionProgress = useRef(new Animated.Value(0)).current;
  const swipeX = useRef(new Animated.Value(0)).current;
  const COMMIT_THRESHOLD_DX = WINDOW_WIDTH * 0.4;

  // Explicit guard rather than relying on PanResponder's nested-responder
  // negotiation: while the (per-item) video scrubber is being dragged, the
  // outer swipe-to-dismiss must never activate, even though both gestures
  // start out as a horizontal drag and could otherwise be ambiguous.
  const isScrubbingRef = useRef(false);
  // Mirrored into state (refs alone don't trigger a re-render) so the
  // paging FlatList's `scrollEnabled` can also react — dragging the
  // scrubber must lock out swiping to the next/prev reel too, not just
  // the swipe-to-dismiss gesture.
  const [isScrubbingUI, setIsScrubbingUI] = useState(false);
  const handleScrubbingChange = useCallback((scrubbing: boolean) => {
    isScrubbingRef.current = scrubbing;
    setIsScrubbingUI(scrubbing);
  }, []);

  // The Modal instance persists across visible=false→true toggles (it just
  // renders null while hidden), so this both replays the open animation and
  // guards against the last dismiss's state carrying over — the video would
  // otherwise render at the tiny closed size (or fully offscreen) with only
  // its audio audible.
  useEffect(() => {
    if (visible) {
      transitionProgress.setValue(0);
      swipeX.setValue(0);
      Animated.timing(transitionProgress, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  }, [visible, transitionProgress, swipeX]);

  const cancelSwipe = () => {
    Animated.timing(swipeX, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const commitClose = () => {
    // Slide the rest of the way back to center while shrinking into the
    // rect at the same time, so the two motions land together instead of
    // snapping the slide back first.
    Animated.parallel([
      Animated.timing(swipeX, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(transitionProgress, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start(onClose);
  };

  const swipeResponder = useRef(
    PanResponder.create({
      // Raised from 8 to 18 so a light touch/tiny wobble doesn't immediately
      // start dragging the reel — needs a clearer, deliberate horizontal drag.
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        !isScrubbingRef.current &&
        gesture.dx > 18 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_evt, gesture) => {
        swipeX.setValue(Math.max(0, gesture.dx));
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dx > COMMIT_THRESHOLD_DX || gesture.vx > 0.6) {
          commitClose();
        } else {
          cancelSwipe();
        }
      },
      onPanResponderTerminate: cancelSwipe,
    }),
  ).current;

  // Outer clip window: width is always the full screen width — feed videos
  // are already edge-to-edge, so only height ever animates (grows from the
  // rect's height to fullscreen height). `left` only ever carries the live
  // drag offset, never a rect-based inset, so the video never narrows.
  const frameTop = transitionProgress.interpolate({ inputRange: [0, 1], outputRange: [rect.y, 0] });
  const frameLeft = swipeX;
  const frameHeight = transitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [rect.height, WINDOW_HEIGHT],
  });

  // Inner content: always native fullscreen size — never scaled, so the
  // video is never stretched or squeezed. Only its vertical position moves,
  // shifting by half the "missing" height so the frame's overflow:hidden
  // crops it evenly from the top and bottom as the frame shrinks, rather
  // than pinning one edge. Purely a function of transitionProgress — the
  // live drag offset lives on the frame's `left`, not here, so dragging
  // never crops or resizes the video, only slides it.
  const contentTranslateY = transitionProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-(WINDOW_HEIGHT - rect.height) / 2, 0],
  });

  // Backdrop is fully opaque at rest (identical to the old fullscreen look)
  // and fades as either (a) the video is dragged aside, exposing the strip
  // of screen behind it, or (b) it's collapsing into the feed post on
  // commit — the Modal is transparent, so whatever's already mounted
  // underneath (the feed, at the post that was open before this reel went
  // fullscreen) shows through directly, not a fake copy.
  const dragReveal = swipeX.interpolate({
    inputRange: [0, COMMIT_THRESHOLD_DX],
    outputRange: [1, 0.15],
    extrapolate: "clamp",
  });
  const backdropOpacity = Animated.multiply(transitionProgress, dragReveal);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={commitClose}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={styles.container}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: backdropOpacity }]}
        />
        <Animated.View
          style={{
            position: "absolute",
            top: frameTop,
            left: frameLeft,
            width: WINDOW_WIDTH,
            height: frameHeight,
            overflow: "hidden",
            backgroundColor: "#000",
          }}
          {...swipeResponder.panHandlers}
        >
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: WINDOW_WIDTH,
              height: WINDOW_HEIGHT,
              transform: [{ translateY: contentTranslateY }],
            }}
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
                scrubberBottom={scrubberBottom}
                videoHeight={videoHeight}
                collapsed={!!commentReel}
                onComment={setCommentReel}
                onShare={setShareReel}
                onScrubbingChange={handleScrubbingChange}
              />
            )}
            scrollEnabled={!commentReel && !isScrubbingUI}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            snapToInterval={itemHeight}
            snapToAlignment="start"
            decelerationRate="fast"
            onScroll={onScroll}
            scrollEventThrottle={16}
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
        </Animated.View>

        {/* App bottom navigation, kept visible over the reels */}
        <BottomNavBar
          onTabPress={(href) => {
            onClose();
            router.push(href as any);
          }}
          scale={bottomBarScale}
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
    // No backgroundColor here — the animated backdrop View handles it, so
    // it can fade out during the dismiss-swipe and reveal the feed behind.
  },
  scrubberWrap: {
    position: "absolute",
    // left/right set inline per-instance (2.5% margin each side)
    zIndex: 65,
  },
  previewTimeOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 3,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  previewTimeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  scrubberTouchPad: {
    height: SCRUBBER_TOUCH_HEIGHT,
    justifyContent: "center",
  },
  scrubberBar: {
    width: "100%",
    borderRadius: 3,
    overflow: "hidden",
  },
  scrubberTrackBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  scrubberFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "#fff",
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
  followPill: {
    borderWidth: 1.2,
    borderColor: "#fff",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  followPillText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
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
