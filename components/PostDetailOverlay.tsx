/**
 * PostDetailOverlay
 *
 * Tapping a post in the Home "For You" grid morphs that card into the full
 * post-detail view (and swiping right morphs it back down into the grid)
 * instead of just navigating to /post/[id] with a plain slide transition.
 *
 * There is a real content swap partway through — a post-detail screen
 * genuinely differs from its grid thumbnail (header, caption, comments, not
 * just a bigger image) — but it is not staged as one. The crossfade is
 * derived from the grow's own progress rather than chained after it, so the
 * two overlap: the detail content is already fading up while the hero is
 * still travelling, and the whole thing reads as a single ~300ms motion
 * instead of grow-then-swap. Chaining them (grow 320ms, settle, THEN
 * crossfade 150ms) is what made this feel slow and stepped — the eye reads
 * the pause between the two as the transition being over, then something
 * else starting.
 *
 * Driven entirely by Reanimated shared values/worklets (not React Native's
 * legacy Animated API) — same reasoning as ContextDrop itself (see that
 * file's header comment): every value here, including the backdrop, now
 * runs on the UI thread with no native-driver restrictions to work around,
 * so the whole grow/crossfade/shrink stays smooth regardless of what the JS
 * thread is doing while FeedPost mounts or unmounts.
 *
 * The hero morphs on transforms only — animating its real
 * top/left/width/height (so contentFit="cover" could re-crop every frame)
 * was tried and costs far more than it fixes: an Image's native view redoes
 * its crop/paint on every layout change and can't keep up at animation
 * framerates, producing dropped frames that flash to black.
 *
 * But a single non-uniform scaleX/scaleY visibly STRETCHES the photo for the
 * whole grow whenever the grid cell's aspect doesn't match the detail
 * media's — which, with a waterfall grid sized by real media ratio, is
 * almost always. So the transform is split across two layers instead:
 *
 *   - the outer wrapper carries the non-uniform scale, and with
 *     overflow:hidden it is purely the CLIP WINDOW — the shape of the hole
 *     the photo is seen through;
 *   - the inner layer counter-scales that away and applies a single uniform
 *     scale, so the photo itself is only ever scaled evenly.
 *
 * The result is what RedNote does and what a stretch can't fake: the image
 * never distorts, and what changes during the morph is how much of it you
 * can see. Both layers are pure UI-thread compositing, so this costs nothing
 * over the single-transform version it replaces.
 *
 * The edge-swipe-back gesture itself (including the "drop on the dome to
 * message the author" behavior) is handled by ContextDrop — this component
 * only supplies what's post-specific: the hero grow/shrink, view tracking,
 * and the "message the author" target.
 *
 * /post/[id] itself is untouched and still works for deep links/shares —
 * this is only the Home-grid-tap path.
 */

import TutorialAnchor from "@/components/tutorial/TutorialAnchor";
import { useTutorial } from "@/contexts/TutorialContext";
import { TUTORIAL_SCREENS } from "@/lib/tutorialTours";
import ContextDrop, {
  CONTENT_TOP_SHRINK,
  CONTEXT_DROP_THRESHOLD,
  ContextDropTarget,
} from "@/components/ContextDrop";
import { isVideoUrl } from "@/components/PostGridCard";
import GridThumbnail from "@/components/ui/GridThumbnail";
import FeedPost from "@/components/FeedPost";
import { useOptionalTabBarScroll } from "@/contexts/TabBarScrollContext";
import { useUser } from "@/contexts/UserContext";
import { RATIO_PORTRAIT } from "@/lib/postMediaDisplay";
import { recordView } from "@/lib/historyService";
import { trackPostView } from "@/lib/viewTrackingService";
import { PostData } from "@/types/post";
import { useAppRouter } from "@/utils/navigation";
import { beginNavHandoff } from "@/utils/navHandoff";
import { feedEvents } from "@/utils/feedEvents";
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

// Deliberately short, and decelerating: a hero transition is read as direct
// manipulation — the card you touched moving — so it wants to arrive quickly
// and settle, not glide.
const GROW_TIMING = { duration: 300, easing: Easing.out(Easing.cubic) };
const SHRINK_TIMING = { duration: 250, easing: Easing.out(Easing.cubic) };

// Where the hero hands over to the real content, as a fraction of the grow.
// The two ranges overlap so neither layer is ever fully absent: content
// starts arriving at 55%, the hero is gone by 92%, and the swap lands while
// the motion is still going rather than after it stops.
const CONTENT_FADE_IN = [0.55, 0.9];
const HERO_FADE_OUT = [0.62, 0.92];
// Matches GridCard/PostGridCard's own thumbnail corner radius — the hero
// eases from that down to 0 as it grows, so it reads as the tapped card
// itself flattening out into fullscreen rather than a plain rectangle
// popping in from nowhere.
const GRID_CARD_RADIUS = 4;

function HeroFrame({ uri, blurhash, width }: { uri: string; blurhash?: string | null; width: number }) {
  // The same component the tapped tile drew, at the tile's own width — so the
  // same resized URL (or poster), which the memory cache already holds. The
  // grow costs no download, and a video hero no longer spins up a second
  // player. transition={0} because the hero/content crossfade already drives
  // the fade; letting expo-image fade in on top of that read as the image
  // "reloading" mid-grow.
  return (
    <GridThumbnail
      uri={uri}
      isVideo={isVideoUrl(uri)}
      width={width}
      blurhash={blurhash}
      transition={0}
    />
  );
}

export default function PostDetailOverlay({ visible, onClose, post, sourceRect }: PostDetailOverlayProps) {
  const { currentUser } = useUser();
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  // Optional: this overlay is opened from the Home grid (inside the (tabs)
  // group, where the floating pill has to be told to hide) and from profile
  // grids pushed alongside it, which sit outside that subtree and have no
  // floating tab bar to hide in the first place.
  const tabBarScroll = useOptionalTabBarScroll();
  const setTabBarHidden = tabBarScroll?.setTabBarHidden;
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
  const closingRef = useRef(false);

  const progress = useSharedValue(0); // 0 = rect, 1 = fullscreen (hero bounds) — drives the backdrop
  const heroProgress = useSharedValue(0); // drives the hero's own grow/shrink size
  // Shared with ContextDrop (see dragX prop there) — the white backdrop
  // below fades out as this grows, so the real Home screen underneath
  // shows through while dragging instead of a flat white/grey fill.
  const dragX = useSharedValue(0);
  // The vertical half of the same drag (only ever non-zero past ContextDrop's
  // 30% threshold), and how much of that drag the hero should still be
  // carrying. Both exist for one reason: a gesture dismiss hands over to the
  // hero from wherever the finger left the content, not from the middle of
  // the screen.
  const dragY = useSharedValue(0);
  const dragSettle = useSharedValue(1);

  const setPhaseBoth = useCallback((p: Phase) => setPhase(p), []);

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    progress.value = 0;
    heroProgress.value = 0;
    dragX.value = 0;
    dragY.value = 0;
    dragSettle.value = 1;
    setPhaseBoth("opening");
    // A real navigated screen would sit outside the tab group and hide the
    // floating nav automatically — FloatingTabBar renders in its own layer
    // (via the Tabs navigator), so it needs to be told explicitly.
    setTabBarHidden?.(true);

    progress.value = withTiming(1, GROW_TIMING);
    // The only animation driving the open. Every crossfade below is derived
    // from this one value, so the swap is a function of where the motion is
    // rather than a separate step queued behind it — and the reverse falls
    // out for free when it runs back down to 0 on close.
    heroProgress.value = withTiming(1, GROW_TIMING, (finished) => {
      "worklet";
      if (finished) runOnJS(setPhaseBoth)("open");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // View tracking parity with /post/[id] — fires once per open, skips self-views.
  useEffect(() => {
    if (!visible || !post || !currentUser?.id || currentUser.id === post.userId) return;
    trackPostView(post.id, currentUser.id, post.userId).catch(() => {});
    recordView("post", post.id, currentUser.id, post.userId);
  }, [visible, post, currentUser?.id]);

  const commitClose = useCallback((after?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setTabBarHidden?.(false);
    setPhaseBoth("closing");

    // Running heroProgress back down replays the whole thing in reverse —
    // content fades out and the hero fades back in as the shrink passes back
    // through the same crossfade window it came up through. The old version
    // crossfaded to the hero FIRST and only then started shrinking, which is
    // why closing felt like it stalled for a beat before anything moved.
    // Releases whatever drag the content was left holding, so the hero eases
    // from the dragged position back to the card instead of teleporting. Note
    // this settles a MULTIPLIER, not dragX itself: dragX still feeds the
    // backdrop's dragReveal below, and animating it back to 0 would brighten
    // the white backdrop again on the way out.
    dragSettle.value = withTiming(0, SHRINK_TIMING);
    progress.value = withTiming(0, SHRINK_TIMING);
    heroProgress.value = withTiming(0, SHRINK_TIMING, (finished) => {
      "worklet";
      if (finished) {
        runOnJS(onClose)();
        if (after) runOnJS(after)();
      }
    });
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
      // The chat screen is a heavy mount and the stack does not animate, so
      // without this the drop lands on a screen that just sits there — see
      // utils/navHandoff.ts. Chat itself ends it once it is really open.
      beginNavHandoff();
      // The same fields the share sheet hands over — the composer's card
      // is the full one now (§ Feedback and motion), and a drop that filled
      // in three of its lines and left the rest blank was the same card
      // looking broken.
      router.push({
        pathname: "/(users)/chat/[id]",
        params: {
          id: String(authorId),
          context_product_id: String(targetPost.id),
          context_product_title: `${targetPost.username || "User"}'s post`,
          context_product_image: targetPost.images?.[0] || "",
          context_source: "post",
          context_caption: targetPost.content || "",
          context_date: targetPost.date ? targetPost.date.toISOString() : "",
          context_location: targetPost.locationName || "",
          context_username: targetPost.username || "",
          context_verified: targetPost.isVerified ? "true" : "",
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

  /**
   * The one gesture in the app with no button anywhere, so it is the one
   * thing nobody discovers on their own — taught here, on a post that is
   * actually open, with a finger drawn doing the drag (lib/tutorialTours.ts).
   */
  const { arrive, notify } = useTutorial();
  useEffect(() => {
    if (visible && phase === "open") arrive(TUTORIAL_SCREENS.POST_DETAIL);
  }, [arrive, phase, visible]);

  const heroUri = post?.images?.[0];

  // FLIP-style transform math: the hero is laid out ONCE at its final bounds
  // and never re-laid-out — heroProgress scales/translates it to sit exactly
  // over the source rect at 0 and settle to identity at 1. (See the header
  // for why this is transforms rather than an actual layout animation.)
  const heroScaleX = rect.width / WINDOW_WIDTH;
  const heroScaleY = rect.height / mediaHeight;
  const heroTranslateX = rect.x + rect.width / 2 - WINDOW_WIDTH / 2;
  const heroTranslateY = rect.y + rect.height / 2 - (mediaTop + mediaHeight / 2);
  // The photo's own uniform scale at progress 0. The outer wrapper's clip
  // window is rect.width x rect.height by then, and a `cover` fill of that
  // window needs the photo scaled by whichever axis is the tighter fit —
  // exactly the scale the grid card was already drawing it at. Interpolating
  // this to 1 alongside the wrapper is what keeps the photo undistorted
  // while its visible window changes shape underneath it.
  const heroImageScale = Math.max(heroScaleX, heroScaleY);

  // Fades the white backdrop down toward mostly-transparent as ContextDrop's
  // drag grows, so the real Home screen shows through behind the shrinking/
  // dragging content instead of staying hidden under a flat white fill —
  // ContextDrop's own grey scrim then dims whatever's revealed underneath.
  const dragReveal = useDerivedValue(() =>
    interpolate(dragX.value, [0, WINDOW_WIDTH * 0.4], [1, 0.08], Extrapolation.CLAMP),
  );
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value * dragReveal.value }));

  // Where ContextDrop has actually left the content: dragged in X (and, past
  // its threshold, Y), and pushed down by its own top shrink as the content
  // pulls in from the screen edges. The hero and its backing both ride this,
  // so a gesture dismiss hands over from where the finger left off instead of
  // snapping back to centre first. dragSettle eases it away over the shrink;
  // on the back-button path there is no drag and all of this is zero, which
  // is why that one already looked right.
  const carry = useDerivedValue(() => {
    const shrink = interpolate(
      dragX.value,
      [0, CONTEXT_DROP_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      x: dragX.value * dragSettle.value,
      y: (dragY.value + shrink * CONTENT_TOP_SHRINK) * dragSettle.value,
    };
  });

  // Opaque through the whole swap window, gone once the content has fully
  // arrived — otherwise a later ContextDrop drag shrinks the content away
  // and reveals this as a black box sized to the image. It has to travel with
  // the hero, or a gesture close paints it at the centre while the hero is
  // still out at the finger.
  const backingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      heroProgress.value,
      [0, 0.45, 0.96, 1],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    ),
    transform: [
      { translateX: interpolate(heroProgress.value, [0, 1], [heroTranslateX, 0]) + carry.value.x },
      { translateY: interpolate(heroProgress.value, [0, 1], [heroTranslateY, 0]) + carry.value.y },
      { scaleX: interpolate(heroProgress.value, [0, 1], [heroScaleX, 1]) },
      { scaleY: interpolate(heroProgress.value, [0, 1], [heroScaleY, 1]) },
    ],
  }));

  // Outer layer: the clip window. Non-uniform on purpose — this is the shape
  // of the hole, not the photo.
  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, HERO_FADE_OUT, [1, 0], Extrapolation.CLAMP),
    borderRadius: interpolate(heroProgress.value, [0, 1], [GRID_CARD_RADIUS, 0], Extrapolation.CLAMP),
    borderCurve: "continuous",
    transform: [
      { translateX: interpolate(heroProgress.value, [0, 1], [heroTranslateX, 0]) + carry.value.x },
      { translateY: interpolate(heroProgress.value, [0, 1], [heroTranslateY, 0]) + carry.value.y },
      { scaleX: interpolate(heroProgress.value, [0, 1], [heroScaleX, 1]) },
      { scaleY: interpolate(heroProgress.value, [0, 1], [heroScaleY, 1]) },
    ],
  }));

  // Inner layer: divides the wrapper's non-uniform scale back out and applies
  // one uniform scale of its own, so whatever the window is doing, the photo
  // inside it is only ever scaled evenly. Transforms multiply down the tree,
  // so the photo's true on-screen scale is (wrapper x inner) = heroImageScale
  // on both axes.
  const heroImageStyle = useAnimatedStyle(() => {
    const wrapperX = interpolate(heroProgress.value, [0, 1], [heroScaleX, 1]);
    const wrapperY = interpolate(heroProgress.value, [0, 1], [heroScaleY, 1]);
    const uniform = interpolate(heroProgress.value, [0, 1], [heroImageScale, 1]);
    return {
      transform: [
        { scaleX: uniform / wrapperX },
        { scaleY: uniform / wrapperY },
      ],
    };
  });

  const contentWrapperStyle = useAnimatedStyle(() => ({
    opacity: interpolate(heroProgress.value, CONTENT_FADE_IN, [0, 1], Extrapolation.CLAMP),
  }));

  if (!visible) return null;

  return (
    // zIndex/elevation is only meaningful among siblings sharing this same
    // parent (index.tsx's own tree) — FloatingTabBar renders in a different
    // layer entirely (see setTabBarHidden above), so this doesn't need to
    // out-stack it, just the screen's own content.
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 200 }]}>
      {/* The gesture's "control" is the whole surface, so the anchor is a
          measuring frame that takes no touches — the spotlight then has no
          scrim to draw and the post stays entirely usable while the finger
          hint shows where the drag starts. */}
      <TutorialAnchor
        id="contextdrop.surface"
        radius={0}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff" }, backdropStyle]} />

      {/* Opaque backing pinned to the settled media rect, directly behind the
          hero/content swap, and held opaque across the whole crossfade
          window (see backingStyle) — exactly while both image layers are
          mid-fade and whichever one is arriving hasn't necessarily uploaded
          its first texture yet. Without it, that single missed frame lets
          the white backdrop above show through right at the image's rect, on
          both platforms and for both photo and video posts, since decoding a
          frame is slower than the plain views crossfading around it. */}
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
          <Animated.View style={[{ width: "100%", height: "100%" }, heroImageStyle]}>
            <HeroFrame uri={heroUri} blurhash={post?.blurHashes?.[0]} width={rect.width} />
          </Animated.View>
        </Animated.View>
      )}

      <Animated.View
        pointerEvents={phase === "open" ? "auto" : "none"}
        style={[StyleSheet.absoluteFill, contentWrapperStyle]}
      >
        <ContextDrop
          enabled={phase === "open"}
          onDismiss={commitClose}
          target={contactAuthorTarget}
          dragX={dragX}
          dragY={dragY}
          // The tutorial's first step ends when the dome is actually
          // reached, which is the only proof the gesture was understood.
          onReveal={() => notify("contextdrop.revealed")}
        >
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
