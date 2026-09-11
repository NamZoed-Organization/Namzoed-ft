/**
 * A tagged product or service, previewed — and then, if you keep pulling,
 * opened.
 *
 * One sheet for both, because they are one gesture: the pictures, the
 * pull, and the screen it becomes are identical in shape, and only the
 * fetch and the content component differ. A second sheet for services
 * would be the same file with two words changed, and would start drifting
 * the first time either was touched.
 *
 * Tapping a tag used to push the product screen, which is a whole navigation
 * for a question that is usually "what is that, and how much". So this comes
 * up as a sheet over the post at **70% of the screen**, shows the pictures
 * and the price, and gets out of the way with a flick down. Nobody loses
 * their place in the feed to check a price.
 *
 * **The carousel says there is more than one picture by showing part of the
 * next one.** 80% of the sheet's width for the current image, the remaining
 * 20% is the edge of the next — a paging carousel that fills the frame
 * exactly looks like a single photograph until somebody happens to swipe it.
 * `snapToInterval` keeps it paging properly despite the inset.
 *
 * **Pulling up doesn't open another screen — this one becomes it.** There
 * is no second layout and no crossfade between two of them: the sheet
 * renders the *real* `ProductDetailContent` from the first frame, and hands
 * it the animated carousel through `heroSlot`. So the only thing that
 * changes on the way up is the pictures' own geometry — 80%-with-a-peek to
 * the full-bleed 100% the screen uses — while every word beneath them stays
 * exactly where it was. A preview that summarised the product in its own
 * words and then swapped to the screen's was a visible cut, however well
 * the two were faded; this has nothing to cut between.
 *
 * One gesture still drives all of it: the sheet's height, its corner radius,
 * the scrim, the carousel, and the fade-in of the screen's own floating
 * header once the sheet is tall enough to have a top of its own.
 *
 * Opened through `contexts/ProductPeekContext.tsx`, so the three places that
 * show a tag — the grid strip, the card on a post, and a pin on the picture
 * itself — all share one sheet rather than each mounting their own.
 */

import ProductDetailContent from "@/components/ProductDetailContent";
import ServiceDetailContent from "@/components/ServiceDetailContent";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import CircularLoader from "@/components/ui/CircularLoader";
import { MODAL_RADIUS } from "@/constants/theme";
import { fetchProductById, type ProductWithUser } from "@/lib/productsService";
import {
  fetchProviderServiceById,
  type ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { useAppRouter } from "@/utils/navigation";
import { ShoppingBag, X } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  BackHandler,
  Dimensions,
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN = Dimensions.get("window");
/** How much of the screen the preview covers before anybody drags it. */
const PEEK_RATIO = 0.7;
/** The slice of the frame the *next* picture occupies at rest. */
const NEXT_PEEK = 0.2;
const SPRING = { duration: 260, easing: Easing.out(Easing.cubic) };

export type PeekKind = "product" | "service";

export default function ProductPeekSheet({
  productId,
  kind = "product",
  onClose,
}: {
  /** `null` closes it. */
  productId: string | null;
  kind?: PeekKind;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useAppRouter();
  const [product, setProduct] = useState<ProductWithUser | null>(null);
  const [service, setService] = useState<ProviderServiceWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  /** Crossfaded in at the top of the travel — the real screen's content. */
  const [opened, setOpened] = useState(false);
  /** The opened screen is scrolled to its own top, so a downward drag there
   *  means "close" rather than "scroll up past the beginning". */
  const [atTop, setAtTop] = useState(true);

  const peekTop = SCREEN.height * (1 - PEEK_RATIO);
  /** 0 = the 70% preview, 1 = the full screen. */
  const expand = useSharedValue(0);
  const startExpand = useSharedValue(0);
  /** Slides the whole sheet away on dismiss. */
  const dismiss = useSharedValue(1);

  useEffect(() => {
    if (!productId) return;
    let alive = true;
    setProduct(null);
    setService(null);
    setOpened(false);
    setAtTop(true);
    setLoading(true);
    expand.value = 0;
    dismiss.value = 0;
    dismiss.value = withTiming(1, SPRING);

    const load =
      kind === "service"
        ? fetchProviderServiceById(productId).then(
            (v) => alive && setService(v),
          )
        : fetchProductById(productId).then((v) => alive && setProduct(v));

    load.catch(() => {}).finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [dismiss, expand, kind, productId]);

  const close = useCallback(() => {
    dismiss.value = withTiming(0, SPRING, (finished) => {
      "worklet";
      if (finished) runOnJS(onClose)();
    });
  }, [dismiss, onClose]);

  // Back closes the preview rather than the screen behind it.
  useEffect(() => {
    if (!productId) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [close, productId]);

  /** Crossing the top of the travel is what "opened" means — held in React
   *  because the content it swaps in is a component, not a style. */
  const settle = useCallback((full: boolean) => setOpened(full), []);

  /**
   * While this is a preview, a vertical drag *anywhere* opens it.
   *
   * The content underneath does not scroll until the sheet is a screen —
   * scrolling inside a 70% window is reading through a letterbox, and it
   * left the pull-up feeling like a second, hidden gesture you had to find
   * on the pictures. Now the first upward movement is the transition,
   * which is what the sheet looks like it should do.
   *
   * Once open the gesture inverts: the scroller has the vertical, and this
   * only takes over again at the top of it (`onScroll` below), where a
   * downward drag means "put it back" rather than "scroll up past the
   * beginning".
   */
  const drag = Gesture.Pan()
    // Vertical is the sheet's, horizontal is the carousel's. Without this
    // the pan swallows every swipe between pictures — the two gestures
    // start identically and the outer one wins by default.
    .activeOffsetY([-10, 10])
    .failOffsetX([-14, 14])
    .enabled(!opened || atTop)
    .onStart(() => {
      "worklet";
      startExpand.value = expand.value;
    })
    .onUpdate((e) => {
      "worklet";
      // Up is positive expansion; the travel is the height the sheet gains.
      const next = startExpand.value - e.translationY / peekTop;
      expand.value = Math.min(1, Math.max(-0.4, next));
    })
    .onEnd((e) => {
      "worklet";
      // A flick decides on its own; otherwise the halfway line does.
      const flingUp = e.velocityY < -600;
      const flingDown = e.velocityY > 700;

      if (flingDown && expand.value < 0.35) {
        runOnJS(close)();
        return;
      }
      if (expand.value < -0.12) {
        runOnJS(close)();
        return;
      }
      const target = flingUp || expand.value > 0.45 ? 1 : 0;
      expand.value = withTiming(target, SPRING);
      runOnJS(settle)(target === 1);
    });

  // ── The geometry, all from one value ──────────────────────────────────

  /**
   * **Nothing in this transition animates a layout property.**
   *
   * It used to animate the sheet's `top`, the carousel's `paddingHorizontal`,
   * and every picture's `width`, `height`, `marginRight` and `borderRadius` —
   * so each frame re-laid out a horizontal scroller full of images, and the
   * whole thing juddered. Everything below is a transform or an opacity,
   * which the UI thread can apply without asking the layout engine anything.
   *
   * The sheet is full-height and *translated* down to its resting place
   * rather than positioned there: the bottom third simply hangs off the
   * screen while it is a preview.
   */
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY:
          interpolate(expand.value, [0, 1], [peekTop, 0], Extrapolation.CLAMP) +
          interpolate(dismiss.value, [0, 1], [SCREEN.height, 0]),
      },
    ],
    // One view, one property — cheap enough to keep, and the corner
    // squaring off is most of what says "this is a screen now".
    borderTopLeftRadius: interpolate(expand.value, [0, 1], [MODAL_RADIUS + 8, 0]),
    borderTopRightRadius: interpolate(expand.value, [0, 1], [MODAL_RADIUS + 8, 0]),
  }));

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: dismiss.value * interpolate(expand.value, [0, 1], [0.45, 0.9]),
  }));

  /**
   * The peek is the layout; opening it is a scale.
   *
   * The pictures are laid out at the *preview's* size — 80% of the screen
   * each, centred, so the next one's edge takes the remaining 20% — and the
   * whole row is scaled up by 1/0.8 as the sheet opens, which lands the
   * centred picture exactly full-bleed and pushes its neighbours off the
   * edges.
   *
   * It is this way round because a ScrollView clips to its own frame:
   * scaling *down* from a full-width layout shrinks the clip too, so the
   * next picture has nowhere to show and the peek disappears — which is
   * exactly what happened the first time. Laying out at the peek size keeps
   * the clip full-width at rest, where the peek has to be visible, and the
   * scale only ever grows past it.
   */
  const carouselStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          expand.value,
          [0, 1],
          [1, 1 / (1 - NEXT_PEEK)],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  /**
   * Grown from the top-left corner, not the middle.
   *
   * The picture is flush with the sheet's top and left edges in both
   * states, so the corner it grows from is the one corner that must not
   * move. A centred scale would slide it left and up out of the sheet on
   * the way open, and the scroll offset — which lives inside the scaled
   * container and therefore scales with it — keeps every other picture
   * aligned for free.
   */
  const CAROUSEL_ORIGIN = { transformOrigin: "0% 0%" } as const;

  /**
   * The room the screen's floating header needs is always reserved; while
   * this is a preview the content simply rides up over it.
   *
   * Growing a spacer's `height` was the honest way to do it and the
   * expensive one — it re-laid out the entire scroller beneath. A translate
   * looks identical and costs nothing.
   */
  const headerRoom = insets.top + 56;
  const contentLiftStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          expand.value,
          [0, 1],
          [-headerRoom, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  /** The grab bar floats *over* the picture now that the picture reaches
   *  the sheet's top edge — it is a hint, not a strip of chrome, and it
   *  goes as the sheet stops being a sheet. */
  const handleBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0, 0.5], [0.9, 0], Extrapolation.CLAMP),
  }));

  /** The preview's own close button, gone by the time the screen's back
   *  button has arrived — never both, never neither. */
  const closeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expand.value, [0, 0.45], [1, 0], Extrapolation.CLAMP),
  }));

  if (!productId) return null;

  const item = kind === "service" ? service : product;
  const images = (item?.images ?? []).filter(Boolean);
  /** The preview's own size. The scale above grows it to full-bleed. */
  const itemSize = SCREEN.width * (1 - NEXT_PEEK);
  // No side padding: the picture is flush with the sheet's edges, and the
  // 20% showing on the right is the next one rather than the sheet's white.

  /**
   * The hero the detail screen borrows.
   *
   * It sits inside that screen's own scroller rather than above it, so the
   * pictures and everything written under them are one surface — scrolling
   * past the pictures in the sheet behaves exactly as it does on the screen,
   * because it *is* the screen. The drag that opens the sheet lives here
   * too: vertical on the pictures moves the sheet, horizontal moves the
   * carousel, and the content below scrolls on its own either way.
   */
  const hero = (
    <Animated.View style={contentLiftStyle}>
        {/* The header's room is always reserved so its arrival pushes
            nothing; while this is a preview the content rides up over it
            entirely, and the picture reaches the sheet's own top edge. */}
        <View style={{ height: headerRoom }} />

        <Animated.View style={[CAROUSEL_ORIGIN, carouselStyle]}>
          {loading && images.length === 0 ? (
            <View style={{ height: itemSize, alignItems: "center", justifyContent: "center" }}>
              <CircularLoader color="#094569" />
            </View>
          ) : images.length > 0 ? (
            <ScrollView
              horizontal
              // Not `pagingEnabled`: a page here is narrower than the frame,
              // which is the whole point of the peek. Snapping is in layout
              // space, which the scale never touches, so it keeps working
              // at every point of the transition.
              snapToInterval={itemSize}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
            >
              {images.map((uri, i) => (
                <View
                  key={`${uri}-${i}`}
                  style={{ width: itemSize, height: itemSize, backgroundColor: "#111" }}
                >
                  <ProgressiveImage
                    uri={uri}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    showProgress={false}
                    recyclingKey={uri}
                    priority={i === 0 ? "high" : "normal"}
                  />
                </View>
              ))}
            </ScrollView>
          ) : (
            <View
              style={{
                height: itemSize,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#F3F4F6",
              }}
            >
              <ShoppingBag size={28} color="#9CA3AF" strokeWidth={1.6} />
            </View>
          )}
        </Animated.View>
    </Animated.View>
  );

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent>
      <StatusBar barStyle={opened ? "dark-content" : "light-content"} />
      <View style={{ flex: 1 }}>
        <Animated.View
          style={[
            { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "#000" },
            scrimStyle,
          ]}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
        </Animated.View>

        <Animated.View
          style={[
            {
              // Full height, always — the sheet is *translated* to its
              // resting place rather than positioned there, so opening it
              // costs a transform instead of a re-layout. While it is a
              // preview its bottom third simply hangs off the screen.
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: SCREEN.height,
              backgroundColor: "#fff",
              borderCurve: "continuous",
              overflow: "hidden",
            },
            sheetStyle,
          ]}
        >
          {/* The drag is on the whole sheet, not just the pictures. While
              this is a preview the content does not scroll, so a vertical
              drag anywhere on it is the transition — hunting for the one
              strip that responded was the old behaviour and it read as a
              hidden gesture. */}
          <GestureDetector gesture={drag}>
            <View style={{ flex: 1 }}>
          {/* The product screen itself, from the first frame — the sheet
              only lends it a hero that can change size. Nothing here is a
              preview-shaped copy of anything, so there is nothing to swap
              when the sheet finishes opening. */}
          {kind === "service" && service && (
            <View style={{ flex: 1 }}>
              <ServiceDetailContent
                service={service}
                onBack={close}
                heroSlot={hero}
                // The sheet owns the vertical until it is the screen.
                scrollEnabled={opened}
                onScrollOffset={(y) => setAtTop(y <= 2)}
                topInset={0}
                showHeader={opened}
                ownsStatusBar={opened}
                onNavigateAway={(navigate) => {
                  onClose();
                  navigate();
                }}
              />
            </View>
          )}

          {kind === "product" && product && (
            <View style={{ flex: 1 }}>
              <ProductDetailContent
                product={product}
                onBack={close}
                heroSlot={hero}
                // The sheet owns the vertical until it is the screen.
                scrollEnabled={opened}
                onScrollOffset={(y) => setAtTop(y <= 2)}
                // Always zero: the room the header needs is made by the
                // hero's own top strip, continuously, rather than by this
                // padding switching at the end of the travel.
                topInset={0}
                showHeader={opened}
                // While this is a sheet over a dark scrim, the light icons
                // are the sheet's call, not the screen's.
                ownsStatusBar={opened}
                onNavigateAway={(navigate) => {
                  onClose();
                  navigate();
                }}
              />
            </View>
          )}

          {/* A white bar over the top of the picture: the only thing left
              saying "this can be dragged", now that nothing is inset. */}
          {!opened && (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: 10,
                  left: 0,
                  right: 0,
                  alignItems: "center",
                },
                handleBarStyle,
              ]}
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  borderCurve: "continuous",
                  backgroundColor: "rgba(255,255,255,0.9)",
                }}
              />
            </Animated.View>
          )}

          {/* The preview's own way out, fading as the screen's own back
              button takes over. */}
          {!opened && (
            <Animated.View
              style={[
                { position: "absolute", right: 14, top: 14 },
                closeStyle,
              ]}
            >
              <TouchableOpacity
                onPress={close}
                hitSlop={10}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  borderCurve: "continuous",
                  backgroundColor: "rgba(17,24,39,0.45)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} color="#fff" strokeWidth={2.4} />
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* A product that could not be loaded still has a way through. */}
          {!loading && !item && (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text style={{ fontSize: 15, color: "#9CA3AF", textAlign: "center" }}>
                {kind === "service" ? "This service" : "This product"} couldn&apos;t
                be loaded.
              </Text>
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  router.push(
                    (kind === "service"
                      ? `/(users)/servicedetail/${productId}`
                      : `/(users)/product/${productId}`) as any,
                  );
                }}
                style={{ marginTop: 12 }}
              >
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#0369A1" }}>
                  Open the full screen
                </Text>
              </TouchableOpacity>
            </View>
          )}

            </View>
          </GestureDetector>
        </Animated.View>
      </View>
    </Modal>
  );
}
