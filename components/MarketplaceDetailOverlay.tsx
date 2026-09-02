/**
 * MarketplaceDetailOverlay
 *
 * Tapping a listing tile in the Marketplace grid morphs that card into the
 * full listing-detail view (and swiping right morphs it back down into the
 * grid) instead of just navigating to /marketplace/[id] with a plain slide
 * transition — same treatment ProductDetailOverlay/PostDetailOverlay give
 * their own grids (see PostDetailOverlay's header comment for the two-phase
 * hero-grow-then-crossfade rationale, and for why this is built on
 * Reanimated shared values/worklets rather than the legacy Animated API).
 *
 * Marketplace's detail hero is a variable-height parallax carousel (each
 * image's own real aspect ratio, resolved async) rather than a fixed ratio
 * like posts/products — the hero here grows to MARKETPLACE_HERO_HEIGHT,
 * MarketplaceDetailContent's own existing at-rest height before any
 * per-image ratio resolves, and its own existing resize-to-real-ratio
 * animation continues seamlessly right after the crossfade, exactly as it
 * already does on every direct/deep-link open today.
 *
 * The edge-swipe-back gesture itself (including the "drop on the dome to
 * message the seller" behavior) is handled by ContextDrop — this component
 * only supplies what's listing-specific: the hero grow/shrink and the
 * "message the seller" target.
 *
 * /marketplace/[id] itself is untouched and still works for deep links/
 * shares — this is only the Marketplace-grid-tap path.
 */

import ContextDrop from "@/components/ContextDrop";
import MarketplaceDetailContent, { MARKETPLACE_HERO_HEIGHT, useMarketplaceContactSellerTarget } from "@/components/MarketplaceDetailContent";
import { useOptionalTabBarScroll } from "@/contexts/TabBarScrollContext";
import { useUser } from "@/contexts/UserContext";
import { MarketplaceItemWithUser } from "@/lib/postMarketPlace";
import { Image } from "expo-image";
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

interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface MarketplaceDetailOverlayProps {
  visible: boolean;
  onClose: () => void;
  item: MarketplaceItemWithUser | null;
  /** On-screen rect of the tapped grid card, measured just before opening. */
  sourceRect?: SourceRect | null;
}

type Phase = "opening" | "open" | "closing";

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get("window");
// The hero grows to full width, top-anchored (no header bar to clear here —
// marketplace's detail hero is full-bleed, not below a pinned header like
// posts/products), matching MarketplaceDetailContent's own top-of-scroll hero.
const MEDIA_TOP = 0;

const GROW_TIMING = { duration: 320, easing: Easing.out(Easing.cubic) };
const SHRINK_TIMING = { duration: 260, easing: Easing.out(Easing.cubic) };
const CROSSFADE_TIMING = { duration: 150 };
// Matches GridCard's own thumbnail corner radius — see PostDetailOverlay.
const GRID_CARD_RADIUS = 4;

function HeroFrame({ uri }: { uri: string }) {
  // Same uri the grid thumbnail (ProgressiveImage) just painted a frame ago —
  // matching its cachePolicy/recyclingKey means this fresh <Image> mount hits
  // the already-warm memory cache instead of re-decoding. transition={0}
  // because heroOpacity/contentOpacity already drive the crossfade (see
  // PostDetailOverlay's own HeroFrame for the full writeup).
  return (
    <Image
      source={{ uri }}
      style={{ width: "100%", height: "100%" }}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={uri}
      transition={0}
    />
  );
}

export default function MarketplaceDetailOverlay({ visible, onClose, item, sourceRect }: MarketplaceDetailOverlayProps) {
  const { currentUser } = useUser();
  // Optional: mounted both from (tabs)-group screens and (potentially) plain
  // stack screens outside TabBarScrollProvider's subtree — see
  // ProductDetailOverlay's identical comment.
  const setTabBarHidden = useOptionalTabBarScroll()?.setTabBarHidden ?? (() => {});
  const rect = sourceRect ?? { x: 0, y: 0, width: WINDOW_WIDTH, height: WINDOW_HEIGHT };
  const mediaHeight = MARKETPLACE_HERO_HEIGHT;

  const [phase, setPhase] = useState<Phase>("opening");
  const phaseRef = useRef<Phase>("opening");
  const closingRef = useRef(false);

  // See PostDetailOverlay for the full writeup of these values.
  const progress = useSharedValue(0);
  const heroProgress = useSharedValue(0);
  const heroOpacity = useSharedValue(1);
  const contentOpacity = useSharedValue(0);
  const backingOpacity = useSharedValue(1);
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
    setTabBarHidden(true);

    progress.value = withTiming(1, GROW_TIMING);
    heroProgress.value = withTiming(1, GROW_TIMING, (finished) => {
      "worklet";
      if (!finished) return;
      runOnJS(setPhaseBoth)("open");
      heroOpacity.value = withTiming(0, CROSSFADE_TIMING);
      contentOpacity.value = withTiming(1, CROSSFADE_TIMING, (finished2) => {
        "worklet";
        if (finished2) backingOpacity.value = withTiming(0, CROSSFADE_TIMING);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const commitClose = useCallback((after?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setTabBarHidden(false);
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

  useEffect(() => {
    if (Platform.OS !== "android" || !visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      commitClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, commitClose]);

  // Base "Message Seller" target, then wrap onDrop so dropping on the dome
  // shrinks the overlay back to the grid FIRST — see ProductDetailOverlay's
  // identical comment for why (otherwise chat pushes on top of a
  // still-fully-open overlay).
  const baseSellerTarget = useMarketplaceContactSellerTarget(item, currentUser?.id);
  const contactSellerTarget = useMemo(() => {
    if (!baseSellerTarget) return null;
    return { ...baseSellerTarget, onDrop: () => commitClose(baseSellerTarget.onDrop) };
  }, [baseSellerTarget, commitClose]);

  const heroUri = item?.images?.[0];

  // See PostDetailOverlay's own header comment for why this is a transform
  // (scaleX/scaleY + translate), not a real top/left/width/height animation
  // — the latter was tried and made things worse (dropped frames flashing
  // to black from the Image having to re-crop on every layout change).
  const heroScaleX = rect.width / WINDOW_WIDTH;
  const heroScaleY = rect.height / mediaHeight;
  const heroTranslateX = rect.x + rect.width / 2 - WINDOW_WIDTH / 2;
  const heroTranslateY = rect.y + rect.height / 2 - (MEDIA_TOP + mediaHeight / 2);

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
    <View style={[StyleSheet.absoluteFill, { zIndex: 200, elevation: 200 }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff" }, backdropStyle]} />

      {/* Opaque backing pinned to the settled media rect — see
          PostDetailOverlay's own copy of this view for why it's needed
          (masks the single frame where the incoming image/hero texture
          hasn't painted yet during the crossfade). */}
      {heroUri && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              top: MEDIA_TOP,
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
              top: MEDIA_TOP,
              left: 0,
              width: WINDOW_WIDTH,
              height: mediaHeight,
              overflow: "hidden",
              backgroundColor: "#000",
            },
            heroStyle,
          ]}
        >
          <HeroFrame uri={heroUri} />
        </Animated.View>
      )}

      <Animated.View
        pointerEvents={phase === "open" ? "auto" : "none"}
        style={[StyleSheet.absoluteFill, contentWrapperStyle]}
      >
        <ContextDrop enabled={phase === "open"} onDismiss={commitClose} target={contactSellerTarget} dragX={dragX}>
          {item && (
            <MarketplaceDetailContent
              item={item}
              onBack={() => commitClose()}
              onNavigateAway={(navigate) => commitClose(navigate)}
            />
          )}
        </ContextDrop>
      </Animated.View>
    </View>
  );
}
