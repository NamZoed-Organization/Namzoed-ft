/**
 * ProfilePreviewTrigger
 *
 * The island. Wrap an avatar in this and that avatar *becomes* the expanding
 * element — there is no overlay, no second copy, and nothing new appears on
 * press. The expanded profile UI is already mounted inside this view from the
 * first frame, clipped away by the avatar's own bounds; holding it simply
 * grows those bounds until the UI is no longer clipped.
 *
 *   <ProfilePreviewTrigger userId={...} name={...}>
 *     ...the existing avatar markup, untouched...
 *   </ProfilePreviewTrigger>
 *
 * The children stay the real avatar throughout. They are translated and
 * scaled into the card's avatar slot as it opens — the same view the whole
 * time, never swapped for a duplicate drawn somewhere else.
 *
 * Holding OPENS it; lifting your finger leaves it up. The next tap anywhere
 * dismisses it, caught by ProfilePreviewProvider — an avatar buried in a
 * comment row has no way to hear about a tap on the other side of the
 * screen.
 *
 * Two beats, overlapping (UI_STANDARD.md § Hold to peek a profile): width
 * first, so the circle stretches into a pill with the avatar pinned exactly
 * where the finger is and only the container's edges moving; then height, as
 * the pill opens into the card and the avatar rides down onto the cover's
 * lower edge.
 *
 * ── The cost of being embedded ──────────────────────────────────────────
 * Because this expands in place rather than in a layer above the app, it is
 * subject to whatever its ancestors do. A ScrollView or FlatList clips its
 * children, so an avatar near the edge of a scrolling list will have the card
 * clipped at that edge. The direction logic below picks whichever way has
 * more room, which handles the common cases; it cannot escape a clip
 * entirely, because React Native has no portal for native views. That is the
 * deliberate trade for the card genuinely being the avatar.
 */

import ProfilePreviewCard, {
  AVATAR_LEFT,
  AVATAR_RING,
  AVATAR_SIZE,
  AVATAR_TOP,
  CARD_RADIUS,
  CARD_W,
  ProfilePreviewBackground,
  previewCardHeight,
  useProfilePreviewData,
} from "@/components/profile/ProfilePreviewCard";
import { useOptionalProfilePreview } from "@/contexts/ProfilePreviewContext";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Dimensions, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const HOLD_MS = 320;
const OPEN_SPRING = { damping: 20, stiffness: 220, mass: 0.7 };
const CLOSE_TIMING = { duration: 170 };

const WIDTH_PHASE: readonly [number, number] = [0, 0.55];
const HEIGHT_PHASE: readonly [number, number] = [0.3, 1];
const CONTENT_PHASE: readonly [number, number] = [0.5, 0.95];

interface ProfilePreviewTriggerProps {
  /** Omit (or pass null) to disable — e.g. the signed-in user's own avatar. */
  userId?: string | null;
  name?: string | null;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export default function ProfilePreviewTrigger({
  userId,
  name,
  children,
  style,
}: ProfilePreviewTriggerProps) {
  const preview = useOptionalProfilePreview();
  const id = useId();
  const ref = useRef<View>(null);
  const enabled = !!userId;

  // Natural size of the avatar being wrapped — the island's collapsed state.
  // Measured off the avatar layer, NOT off the placeholder: the shell is
  // absolutely positioned, so it contributes nothing to the placeholder's
  // size, which would collapse to zero and take the avatar's slot in the row
  // with it.
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [open, setOpen] = useState(false);
  // Stays true through the closing animation, so the clip and the card's
  // ground survive the shrink instead of vanishing on the first frame of it.
  const [expanded, setExpanded] = useState(false);
  // Which way there's room to grow, decided once at open time from where this
  // avatar actually sits on screen.
  const [dir, setDir] = useState<{ left: boolean; up: boolean }>({ left: false, up: false });

  const { profile, provider, hasWorkCard } = useProfilePreviewData(userId ?? null, open);
  const cardH = previewCardHeight(hasWorkCard);

  const progress = useSharedValue(0);

  // Only one island open at a time.
  useEffect(() => {
    if (!preview) return;
    if (open && preview.open?.key !== id) setOpen(false);
  }, [preview, preview?.open?.key, open, id]);

  useEffect(() => {
    if (open) {
      setExpanded(true);
      progress.value = withSpring(1, OPEN_SPRING);
      return;
    }
    progress.value = withTiming(0, CLOSE_TIMING);
    const t = setTimeout(() => setExpanded(false), CLOSE_TIMING.duration);
    return () => clearTimeout(t);
  }, [open, progress]);

  const beginPeek = useCallback(() => {
    if (!userId) return;
    ref.current?.measureInWindow((x, y, w, h) => {
      if (!w || !h) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Prefer opening UPWARD, which is the opposite of what looks natural
      // and is the only thing that renders correctly inside a list. Rows are
      // siblings painted in order, so a card growing down out of row N is
      // covered by row N+1, while one growing up covers rows painted before
      // it. Falls back to downward when there isn't room above.
      const fitsUp = y + h - cardH >= 8;
      setDir({
        left: x + CARD_W > SCREEN_W - 8,
        up: fitsUp,
      });
      preview?.setOpen({ key: id, userId });
      setOpen(true);
    });
  }, [userId, cardH, preview, id]);



  // The gesture object must be STABLE. GestureDetector cancels whatever is in
  // flight when its handler is swapped, and every input to this callback
  // changes at exactly the wrong moment: opening publishes to the context,
  // which hands back a new context value, which changes the callback, which
  // rebuilds the gesture, which cancels the hold that just opened it — the
  // card cancelling itself the instant it appeared. The fetch landing and
  // changing the card's height did the same thing a moment later.
  //
  // So the callback goes through a ref and the gesture depends on nothing but
  // whether it's enabled at all.
  const beginRef = useRef(beginPeek);
  beginRef.current = beginPeek;

  const callBegin = useCallback(() => beginRef.current(), []);

  const gesture = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activateAfterLongPress(HOLD_MS)
        .maxPointers(1)
        // Claiming the touch outright would swallow the plain tap that opens
        // the profile, and losing to an ancestor scroll would make the peek
        // impossible inside a comment list — so it only competes once the
        // long press has already activated it, and having activated, a finger
        // straying off the avatar doesn't end it.
        .shouldCancelWhenOutside(false)
        // Nothing on release: the card stays up once opened, and the next
        // tap anywhere puts it away (the provider's catcher). Closing here is
        // what made it a hold-to-peek; it is a hold-to-open now.
        .onStart(() => {
          "worklet";
          runOnJS(callBegin)();
        }),
    [enabled, callBegin],
  );

  // First measurement only. An avatar doesn't resize, and taking later ones
  // would feed the animation back into itself: the ring the open state adds
  // grows an auto-sized box, which would re-report a larger "natural" size
  // mid-morph and make the whole thing jump.
  const onAvatarLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!width || !height) return;
    setSize((prev) => prev ?? { w: width, h: height });
  }, []);

  const natural = size ?? { w: AVATAR_SIZE, h: AVATAR_SIZE };
  // Until the avatar has reported its size there is nothing to drive an
  // animation from, so the island renders exactly as the avatar would on its
  // own — auto-sized, unclipped, untransformed.
  const measured = size !== null;

  // The island itself. Grows out of the avatar's own frame; `left`/`top` go
  // negative when it has to open leftward or upward, which is how it escapes
  // its own corner without a separate branch anywhere else.
  const shellStyle = useAnimatedStyle(() => {
    const wp = interpolate(progress.value, WIDTH_PHASE, [0, 1], Extrapolation.CLAMP);
    const hp = interpolate(progress.value, HEIGHT_PHASE, [0, 1], Extrapolation.CLAMP);
    return {
      left: dir.left ? interpolate(wp, [0, 1], [0, natural.w - CARD_W]) : 0,
      top: dir.up ? interpolate(hp, [0, 1], [0, natural.h - cardH]) : 0,
      width: interpolate(wp, [0, 1], [natural.w, CARD_W]),
      height: interpolate(hp, [0, 1], [natural.h, cardH]),
      // Radius tracks the HEIGHT, so it stays a true pill for as long as the
      // height is still the avatar's, and only squares off as it opens.
      borderRadius: interpolate(hp, [0, 1], [natural.h / 2, CARD_RADIUS]),
    };
  });

  // The real avatar, translated and scaled into the card's slot. Its
  // horizontal term is "stay where the finger is" (undoing the shell's own
  // leftward growth) blended into "sit in the slot" — which is exactly why it
  // looks pinned while the pill stretches.
  const avatarStyle = useAnimatedStyle(() => {
    const wp = interpolate(progress.value, WIDTH_PHASE, [0, 1], Extrapolation.CLAMP);
    const hp = interpolate(progress.value, HEIGHT_PHASE, [0, 1], Extrapolation.CLAMP);

    const pinnedX = dir.left ? interpolate(wp, [0, 1], [0, CARD_W - natural.w]) : 0;
    const pinnedY = dir.up ? interpolate(hp, [0, 1], [0, cardH - natural.h]) : 0;

    const scale = interpolate(hp, [0, 1], [1, AVATAR_SIZE / natural.w]);
    const targetX = pinnedX * (1 - hp) + AVATAR_LEFT * hp;
    const targetY = pinnedY * (1 - hp) + AVATAR_TOP * hp;

    // RN scales about a view's centre, so the translation has to place the
    // scaled box's top-left at the target rather than the box's origin.
    return {
      transform: [
        { translateX: targetX + (natural.w * scale) / 2 - natural.w / 2 },
        { translateY: targetY + (natural.h * scale) / 2 - natural.h / 2 },
        { scale },
      ],
      borderRadius: natural.w / 2,
    };
  });

  // The ring is its own overlay rather than a border on the avatar's box.
  // A border on a box with an explicit size insets the content box, so
  // fixed-size children get laid out from the border inward — which pushed
  // the avatar down and to the right of its own rounded edge. An overlay
  // can't move anything.
  //
  // Its width is divided by the scale because a border is drawn in local
  // coordinates and then scaled with everything else: a flat 3 would land as
  // 4.7 on a 36pt avatar growing into the 56pt slot.
  const ringStyle = useAnimatedStyle(() => {
    const hp = interpolate(progress.value, HEIGHT_PHASE, [0, 1], Extrapolation.CLAMP);
    return {
      borderWidth: interpolate(hp, [0, 1], [0, AVATAR_RING / (AVATAR_SIZE / natural.w)]),
      borderRadius: natural.w / 2,
    };
  });

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, CONTENT_PHASE, [0, 1], Extrapolation.CLAMP),
  }));

  // The cover comes in with the shape, not with the type, so the pill is
  // already the person's colour while it is still stretching. It has to fade
  // rather than simply exist, because at rest the shell doesn't clip — an
  // opaque card-sized layer would spill across the row.
  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.14], [0, 1], Extrapolation.CLAMP),
  }));

  if (!enabled || !preview) {
    return (
      <View style={style} ref={ref}>
        {children}
      </View>
    );
  }

  return (
    // A placeholder holding the avatar's exact slot in the row, so the island
    // can grow out of flow without pushing its neighbours around. Its size is
    // the avatar's measured size — the shell inside is absolute and would
    // otherwise leave this collapsed to nothing.
    <View
      style={[
        style,
        size ? { width: size.w, height: size.h } : null,
        // On the PLACEHOLDER, not the shell: zIndex only orders siblings, and
        // the placeholder is the sibling of everything else in the row. The
        // shell is its only child, so elevating that orders it against
        // nothing.
        //
        // STATIC, never toggled on open. Changing zIndex reorders native
        // subviews, and reordering a subtree cancels any touch inside it —
        // so raising this at the moment the hold activated killed the very
        // gesture that raised it. The island is collapsed and overlaps
        // nothing at rest, so being permanently on top costs nothing.
        { zIndex: 1 },
      ]}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View
          ref={ref}
          collapsable={false}
          style={[
            {
              position: "absolute",
              left: 0,
              top: 0,
              borderCurve: "continuous",
              // Only clip, paint a ground, and out-stack the row while the
              // card is actually up. At rest the island has to be visually
              // indistinguishable from the bare avatar — a permanent clip
              // would cut off anything the avatar draws outside its own box
              // (FeedPost's LIVE badge, for one), and a permanent white
              // ground would show through a transparent avatar.
              overflow: expanded ? "hidden" : "visible",
              // No ground of its own: the cover layer above is the card's
              // background, and a white one underneath would flash at the
              // corners while the radius is still easing.
              backgroundColor: "transparent",
            },
            // Nothing to animate from until the avatar has reported its size:
            // until then this renders exactly as the bare avatar would.
            measured ? shellStyle : null,
          ]}
        >
          {/* Mounted from the first frame and simply clipped away — this is
              the hidden UI the morph reveals, not something that appears. */}
          <Animated.View
            style={[{ position: "absolute", left: 0, top: 0 }, backgroundStyle]}
            pointerEvents="none"
          >
            <ProfilePreviewBackground
              userId={userId ?? null}
              profile={profile}
              hasWorkCard={hasWorkCard}
            />
          </Animated.View>
          <Animated.View
            style={[{ position: "absolute", left: 0, top: 0 }, contentStyle]}
            pointerEvents="none"
          >
            <ProfilePreviewCard
              fallbackName={name}
              profile={profile}
              provider={provider}
              hasWorkCard={hasWorkCard}
            />
          </Animated.View>

          {/* The avatar you are holding — the same view throughout, sized by
              its own children and measured from here. */}
          <Animated.View
            onLayout={onAvatarLayout}
            style={[
              { borderCurve: "continuous" },
              // Pinned to the measured size once known.
              measured ? { width: natural.w, height: natural.h } : null,
              measured ? avatarStyle : null,
            ]}
          >
            {children}
            {/* The ring, over the avatar rather than around it — see
                ringStyle. Absolutely positioned, so it contributes nothing to
                layout and cannot displace what it rings. */}
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  borderColor: "#fff",
                  borderCurve: "continuous",
                },
                ringStyle,
              ]}
            />
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
