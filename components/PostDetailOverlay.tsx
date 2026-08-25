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
import { Animated, BackHandler, Dimensions, Easing, Platform, StyleSheet, View } from "react-native";
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

function HeroFrame({ uri }: { uri: string }) {
  const isVideo = isVideoUrl(uri);
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.muted = true;
    p.loop = false;
  });
  if (isVideo) {
    return <VideoView player={player} style={{ width: "100%", height: "100%" }} nativeControls={false} contentFit="cover" />;
  }
  return <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />;
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

  const progress = useRef(new Animated.Value(0)).current; // 0 = rect, 1 = fullscreen (hero bounds)
  const heroOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  // Shared with ContextDrop (see dragX prop there) — the white backdrop
  // below fades out as this grows, so the real Home screen underneath
  // shows through while dragging instead of a flat white/grey fill.
  const dragX = useRef(new Animated.Value(0)).current;

  const setPhaseBoth = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  useEffect(() => {
    if (!visible) return;
    closingRef.current = false;
    progress.setValue(0);
    heroOpacity.setValue(1);
    contentOpacity.setValue(0);
    dragX.setValue(0);
    setPhaseBoth("opening");
    // A real navigated screen would sit outside the tab group and hide the
    // floating nav automatically — FloatingTabBar renders in its own layer
    // (via the Tabs navigator), so it needs to be told explicitly.
    setTabBarHidden(true);

    Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (!finished) return;
      setPhaseBoth("open");
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
        Animated.timing(contentOpacity, { toValue: 1, duration: 150, useNativeDriver: false }),
      ]).start();
    });
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

    const shrink = () => {
      setPhaseBoth("closing");
      Animated.timing(progress, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          onClose();
          after?.();
        }
      });
    };

    if (phaseRef.current === "open") {
      Animated.parallel([
        Animated.timing(contentOpacity, { toValue: 0, duration: 150, useNativeDriver: false }),
        Animated.timing(heroOpacity, { toValue: 1, duration: 150, useNativeDriver: false }),
      ]).start(({ finished }) => {
        if (finished) shrink();
      });
    } else {
      shrink();
    }
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

  if (!visible) return null;

  const heroUri = post?.images?.[0];
  // Fades the white backdrop down toward mostly-transparent as ContextDrop's
  // drag grows, so the real Home screen shows through behind the shrinking/
  // dragging content instead of staying hidden under a flat white fill —
  // ContextDrop's own grey scrim then dims whatever's revealed underneath.
  const dragReveal = dragX.interpolate({ inputRange: [0, WINDOW_WIDTH * 0.4], outputRange: [1, 0.08], extrapolate: "clamp" });
  const backdropOpacity = Animated.multiply(progress, dragReveal);

  return (
    // zIndex/elevation is only meaningful among siblings sharing this same
    // parent (index.tsx's own tree) — FloatingTabBar renders in a different
    // layer entirely (see setTabBarHidden above), so this doesn't need to
    // out-stack it, just the screen's own content.
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 200 }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff", opacity: backdropOpacity }]} />

      {heroUri && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: progress.interpolate({ inputRange: [0, 1], outputRange: [rect.y, mediaTop] }),
            left: progress.interpolate({ inputRange: [0, 1], outputRange: [rect.x, 0] }),
            width: progress.interpolate({ inputRange: [0, 1], outputRange: [rect.width, WINDOW_WIDTH] }),
            height: progress.interpolate({ inputRange: [0, 1], outputRange: [rect.height, mediaHeight] }),
            overflow: "hidden",
            opacity: heroOpacity,
            backgroundColor: "#000",
          }}
        >
          <HeroFrame uri={heroUri} />
        </Animated.View>
      )}

      <Animated.View
        pointerEvents={phase === "open" ? "auto" : "none"}
        style={[StyleSheet.absoluteFill, { opacity: contentOpacity }]}
      >
        <ContextDrop enabled={phase === "open"} onDismiss={commitClose} target={contactAuthorTarget} dragX={dragX}>
          {post && <FeedPost post={post} isVisible onBack={() => commitClose()} />}
        </ContextDrop>
      </Animated.View>
    </View>
  );
}
