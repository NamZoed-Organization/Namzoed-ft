/**
 * PostDetailOverlay
 *
 * Tapping a post in the Home "For You" grid morphs that card into the full
 * post-detail view (and swiping right morphs it back down into the grid)
 * instead of just navigating to /post/[id] with a plain slide transition.
 *
 * Two-phase hero transition rather than ReelsViewer's single windowed-crop
 * approach: ReelsViewer can get away with resizing a mask around IDENTICAL
 * content (the same video, in-feed vs fullscreen), but a post-detail screen
 * genuinely differs from its grid thumbnail (header, caption, comments —
 * not just a bigger image), so there's a real content swap partway through.
 * That swap is masked with a quick crossfade at the moment the growing
 * thumbnail reaches fullscreen, rather than pretending it isn't happening.
 *
 * Driven entirely by Reanimated shared values/worklets (not React Native's
 * legacy Animated API) — same reasoning as ContextDrop itself (see that
 * file's header comment): every value here, including the backdrop, now
 * runs on the UI thread with no native-driver restrictions to work around,
 * so the whole grow/crossfade/shrink stays smooth regardless of what the JS
 * thread is doing while FeedPost mounts or unmounts.
 *
 * The hero grows via a scaleX/scaleY transform (see heroStyle below), which
 * does visibly stretch the image for the brief moment its aspect ratio
 * doesn't match the grid cell it grew from — animating its real
 * top/left/width/height instead (so contentFit="cover" could re-crop
 * correctly every frame) was tried, but costs far more than it fixes: an
 * Image's native view has to redo its crop/paint on every single layout
 * change, and it can't keep up at animation framerates, producing dropped
 * frames that flash to black. A transform is pure UI-thread compositing —
 * no such cost — so the mild stretch stays the lesser evil.
 *
 * The edge-swipe-back gesture itself (including the "drop on the dome to
 * message the author" behavior) is handled by ContextDrop — this component
 * only supplies what's post-specific: the hero grow/shrink, view tracking,
 * and the "message the author" target.
 *
 * /post/[id] itself is untouched and still works for deep links/shares —
 * this is only the Home-grid-tap path.
 */

import ContextDrop, { ContextDropTarget } from "@/components/ContextDrop";
import { isVideoUrl } from "@/components/PostGridCard";
import FeedPost from "@/components/FeedPost";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { useUser } from "@/contexts/UserContext";
import { RATIO_PORTRAIT } from "@/lib/postMediaDisplay";
import { trackPostView } from "@/lib/viewTrackingService";
import { PostData } from "@/types/post";
import { useAppRouter } from "@/utils/navigation";
import { feedEvents } from "@/utils/feedEvents";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { MessageCircle } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Dimensions, Platform, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#094569";

interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PostDetailOverlayProps {
  visible: boolean;
  onClose: () => void;
  post: PostData | null;
  /** On-screen rect of the tapped grid card, measured just before opening. */
  sourceRect?: SourceRect | null;
}

type Phase = "opening" | "open" | "closing";

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get("window");

const GROW_TIMING = { duration: 320, easing: Easing.out(Easing.cubic) };
const SHRINK_TIMING = { duration: 260, easing: Easing.out(Easing.cubic) };
const CROSSFADE_TIMING = { duration: 150 };
// Matches GridCard/PostGridCard's own thumbnail corner radius — the hero
// eases from that down to 0 as it grows, so it reads as the tapped card
// itself flattening out into fullscreen rather than a plain rectangle
// popping in from nowhere.
const GRID_CARD_RADIUS = 4;

function HeroFrame({ uri, blurhash }: { uri: string; blurhash?: string | null }) {
  const isVideo = isVideoUrl(uri);
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.muted = true;
    p.loop = false;
  });
  if (isVideo) {
    return <VideoView player={player} style={{ width: "100%", height: "100%" }} nativeControls={false} contentFit="cover" />;
  }
  // Same uri the grid thumbnail (ProgressiveImage) just painted a frame ago —
  // matching its cachePolicy/recyclingKey means this fresh <Image> mount hits
  // the already-warm memory cache instead of re-decoding, and the blurhash
  // placeholder covers the gap if it somehow doesn't. transition={0} because
  // heroOpacity/contentOpacity above already drive the crossfade; letting
  // expo-image fade in on top of that read as the image "reloading" mid-grow.
  return (
    <Image
      source={{ uri }}
      placeholder={blurhash ? { blurhash } : undefined}
      placeholderContentFit="cover"
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={uri}
      transition={0}
    />
  );
}

export default function PostDetailOverlay({ visible, onClose, post, sourceRect }: PostDetailOverlayProps) {
  const { currentUser } = useUser();
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { setTabBarHidden } = useTabBarScroll();
  const rect = sourceRect ?? { x: 0, y: 0, width: WINDOW_WIDTH, height: WINDOW_HEIGHT };
  // The hero grows to where FeedPost's own detail-mode media actually sits
  // (below its floating header, at its fixed feed aspect ratio) — not to
  // fullscreen — so the crossfade into the real content is a same-size swap
  // instead of a grow-to-fullscreen-then-snap-down.
  const mediaTop = insets.top + 56;
  const mediaHeight = WINDOW_WIDTH / RATIO_PORTRAIT;

  const postRef = useRef(post);
  postRef.current = post;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const [phase, setPhase] = useState<Phase>("opening");
  const phaseRef = useRef<Phase>("opening");
  const closingRef = useRef(false);

  const progress = useSharedValue(0); // 0 = rect, 1 = fullscreen (hero bounds) — drives the backdrop
  const heroProgress = useSharedValue(0); // drives the hero's own grow/shrink size
  const heroOpacity = useSharedValue(1);
  const contentOpacity = useSharedValue(0);
  // Multiplies into the opaque backing's opacity below (see that view for
  // why the backing exists at all). heroProgress alone keeps the backing
  // opaque for the ENTIRE "open" phase, not just the brief crossfade right
  // after opening/before closing — so once ContextDrop starts shrinking
  // FeedPost's content inward, the backing (a static rect pinned to the
  // media bounds, never itself shrunk or dragged) shows through the gap as
  // a black box sized to the image. Fading this to 0 once the opening
  // crossfade settles removes the backing exactly while it'd otherwise be
  // exposed by a drag, and setting it back to 1 the instant commitClose
  // starts restores it in time for the closing crossfade it actually exists
  // to protect.
  const backingOpacity = useSharedValue(1);
  // Shared with ContextDrop (see dragX prop there) — the white backdrop
  // below fades out as this grows, so the real Home screen underneath
  // shows through while dragging instead of a flat white/grey fill.
  const dragX = useSharedValue(0);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    progress.value = 0;
    heroProgress.value = 0;
    heroOpacity.value = 1;
    contentOpacity.value = 0;
    backingOpacity.value = 1;
    dragX.value = 0;
    setPhaseBoth("opening");
    // A real navigated screen would sit outside the tab group and hide the
    // floating nav automatically — FloatingTabBar renders in its own layer
    // (via the Tabs navigator), so it needs to be told explicitly.
    setTabBarHidden(true);

    progress.value = withTiming(1, GROW_TIMING);
    // The content crossfade only starts once the grow has ACTUALLY finished
    // settling (not overlapped with its tail) — content fading in while the
    // hero is still visibly resizing made any residual size mismatch (and
    // the brief window before its first frame paints) much more noticeable.
    heroProgress.value = withTiming(1, GROW_TIMING, (finished) => {
      "worklet";
      if (!finished) return;
      runOnJS(setPhaseBoth)("open");
      heroOpacity.value = withTiming(0, CROSSFADE_TIMING);
      contentOpacity.value = withTiming(1, CROSSFADE_TIMING, (finished2) => {
        "worklet";
        // Content now fully covers the backing — drop it so a later
        // ContextDrop drag doesn't reveal it as a black box behind the
        // shrinking content (restored to 1 again in commitClose).
        if (finished2) backingOpacity.value = withTiming(0, CROSSFADE_TIMING);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // View tracking parity with /post/[id] — fires once per open, skips self-views.
  useEffect(() => {
    if (!visible || !post || !currentUser?.id || currentUser.id === post.userId) return;
    trackPostView(post.id, currentUser.id, post.userId).catch(() => {});
  }, [visible, post, currentUser?.id]);

  const commitClose = useCallback((after?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setTabBarHidden(false);
    // Back to opaque in time for the closing crossfade below, which relies
    // on the backing the same way the opening one does (see backingOpacity's
    // declaration above).
    backingOpacity.value = 1;

    const shrink = () => {
      setPhaseBoth("closing");
      progress.value = withTiming(0, SHRINK_TIMING);
      heroProgress.value = withTiming(0, SHRINK_TIMING, (finished) => {
        "worklet";
        if (finished) {
          runOnJS(onClose)();
          if (after) runOnJS(after)();
        }
      });
    };

    if (phaseRef.current === "open") {
      contentOpacity.value = withTiming(0, CROSSFADE_TIMING);
      heroOpacity.value = withTiming(1, CROSSFADE_TIMING, (finished) => {
        "worklet";
        if (finished) runOnJS(shrink)();
      });
    } else {
      shrink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, setTabBarHidden]);

  // Close automatically if this post gets deleted out from under the overlay.
  useEffect(() => {
    if (!visible || !post) return;
    const handler = (deletedId: string) => {
      if (deletedId === post.id) commitClose();
    };
    feedEvents.on("postDeleted", handler);
    return () => feedEvents.off("postDeleted", handler);
  }, [visible, post, commitClose]);

  // No <Modal> here (see render below — this is a plain in-tree overlay so
  // the real Home screen stays mounted and visible behind it), so Android's
  // hardware back button needs its own handler instead of Modal's
  // onRequestClose.
  useEffect(() => {
    if (Platform.OS !== "android" || !visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      commitClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, commitClose]);

  const handleContactAuthor = useCallback(() => {
    const targetPost = postRef.current;
    if (!targetPost) return;
    const authorId = targetPost.userId;
    if (currentUserRef.current?.id === authorId) return;
    commitClose(() => {
      router.push({
        pathname: "/(users)/chat/[id]",
        params: {
          id: String(authorId),
          context_product_id: String(targetPost.id),
          context_product_title: targetPost.content || "Shared post",
          context_product_image: targetPost.images?.[0] || "",
          context_source: "post",
        },
      } as any);
    });
  }, [commitClose, router]);

  const canMessageAuthor = !!post && currentUser?.id !== post.userId;
  const contactAuthorTarget = useMemo<ContextDropTarget | null>(() => {
    if (!canMessageAuthor) return null;
    return {
      label: "Contact Author",
      armedLabel: "Drop to Contact Author",
      icon: <MessageCircle size={18} color="#fff" fill="none" />,
      armedIcon: <MessageCircle size={18} color={PRIMARY} fill={PRIMARY} />,
      onDrop: handleContactAuthor,
    };
  }, [canMessageAuthor, handleContactAuthor]);

  const heroUri = post?.images?.[0];

  // FLIP-style transform math for the hero: the Animated.View below is laid
  // out ONCE at its final (fullscreen-hero) bounds and never re-laid-out —
  // heroProgress instead scales/translates it to visually match the source
  // rect at 0 and settle to identity (the final bounds) at 1. A real
  // top/left/width/height animation was tried instead (so contentFit=cover
  // could re-crop correctly every frame instead of the non-uniform scale
  // stretching the image) but made things measurably worse: resizing an
  // Image's actual layout forces its native view to redo cropping/painting
  // every single frame, and it can't keep up — producing exactly the
  // dropped-to-black flashes reported here. A transform is a pure
  // UI-thread compositing operation with no such cost, so it stays on
  // transform despite the (much milder, brief) stretch that comes with it.
  const heroScaleX = rect.width / WINDOW_WIDTH;
  const heroScaleY = rect.height / mediaHeight;
  const heroTranslateX = rect.x + rect.width / 2 - WINDOW_WIDTH / 2;
  const heroTranslateY = rect.y + rect.height / 2 - (mediaTop + mediaHeight / 2);

  // Fades the white backdrop down toward mostly-transparent as ContextDrop's
  // drag grows, so the real Home screen shows through behind the shrinking/
  // dragging content instead of staying hidden under a flat white fill —
  // ContextDrop's own grey scrim then dims whatever's revealed underneath.
  const dragReveal = useDerivedValue(() =>
    interpolate(dragX.value, [0, WINDOW_WIDTH * 0.4], [1, 0.08], Extrapolation.CLAMP),
  );
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * dragReveal.value }));
  const backingStyle = useAnimatedStyle(() => ({ opacity: heroProgress.value * backingOpacity.value }));
  const heroStyle = useAnimatedStyle(() => ({
    opacity: heroOpacity.value,
    borderRadius: interpolate(heroProgress.value, [0, 1], [GRID_CARD_RADIUS, 0], Extrapolation.CLAMP),
    borderCurve: "continuous",
    transform: [
      { translateX: interpolate(heroProgress.value, [0, 1], [heroTranslateX, 0]) },
      { translateY: interpolate(heroProgress.value, [0, 1], [heroTranslateY, 0]) },
      { scaleX: interpolate(heroProgress.value, [0, 1], [heroScaleX, 1]) },
      { scaleY: interpolate(heroProgress.value, [0, 1], [heroScaleY, 1]) },
    ],
  }));
  const contentWrapperStyle = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  if (!visible) return null;

  return (
    // zIndex/elevation is only meaningful among siblings sharing this same
    // parent (index.tsx's own tree) — FloatingTabBar renders in a different
    // layer entirely (see setTabBarHidden above), so this doesn't need to
    // out-stack it, just the screen's own content.
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 200 }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff" }, backdropStyle]} />

      {/* Opaque backing pinned to the settled media rect, directly behind the
          hero/content swap. Driven by heroProgress (not heroOpacity) so it
          stays fully opaque through BOTH crossfade windows (open: right
          after grow finishes; close: right before shrink starts) — exactly
          when heroOpacity/contentOpacity are mid-fade and whichever image
          layer is coming in hasn't necessarily uploaded its first texture
          yet. Without this, that single missed frame let the white backdrop
          above show through right at the image's rect, on both platforms
          and both image/video posts, since decoding/uploading a photo or
          video frame is slower than the plain views crossfading around it. */}
      {heroUri && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: mediaTop,
              left: 0,
              width: WINDOW_WIDTH,
              height: mediaHeight,
              backgroundColor: "#000",
            },
            backingStyle,
          ]}
        />
      )}

      {heroUri && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: mediaTop,
              left: 0,
              width: WINDOW_WIDTH,
              height: mediaHeight,
              overflow: "hidden",
              backgroundColor: "#000",
            },
            heroStyle,
          ]}
        >
          <HeroFrame uri={heroUri} blurhash={post?.blurHashes?.[0]} />
        </Animated.View>
      )}

      <Animated.View
        pointerEvents={phase === "open" ? "auto" : "none"}
        style={[StyleSheet.absoluteFill, contentWrapperStyle]}
      >
        <ContextDrop enabled={phase === "open"} onDismiss={commitClose} target={contactAuthorTarget} dragX={dragX}>
          {post && (
            <FeedPost
              post={post}
              isVisible
              onBack={() => commitClose()}
              onNavigateAway={(navigate) => commitClose(navigate)}
            />
          )}
        </ContextDrop>
      </Animated.View>
    </View>
  );
}
