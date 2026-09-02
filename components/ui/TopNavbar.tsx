// components/ui/TopNavbar.tsx
import AuthPromptModal from "@/components/modals/AuthPromptModal";
import HamburgerMenu from "@/components/modals/HamburgerMenu";
import TabBarButton from "@/components/ui/TabBarButton";
import { useUnreadMessages } from "@/contexts/UnreadMessagesContext";
import { useUser } from "@/contexts/UserContext";
import { useTrendingSubcategories } from "@/hooks/useTrendingSubcategories";
import { clamp, useResponsive } from "@/utils/responsive";
import { useAppRouter } from "@/utils/navigation";
import { useFocusEffect } from "@react-navigation/native";
import { usePathname } from "expo-router";
import { Menu, Search, Send, UserCircle } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image as ExpoImage } from "expo-image";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import ReanimatedAnimated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Rotating trending-topic placeholder for the expanded search bar ────
const ROTATE_INTERVAL_MS = 2600;
const ROTATE_OUT_MS = 220;
const ROTATE_IN_MS = 280;

function RotatingSearchPlaceholder({ items }: { items: string[] }) {
  const rotating = items.length > 1;
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!rotating) return;
    setIndex(0);
    opacity.setValue(1);
    translateY.setValue(0);

    const id = setInterval(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: ROTATE_OUT_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setIndex((i) => (i + 1) % items.length);
        translateY.setValue(8);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: ROTATE_IN_MS,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: ROTATE_IN_MS,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
    // items compared by identity on purpose, same as the animatedPlaceholders
    // contract this replaces (components/modals/SearchBar.tsx, now retired).
  }, [rotating, items, opacity, translateY]);

  // The static "Search" label on the right already covers the empty state,
  // so this side just stays blank until trending topics have loaded.
  if (items.length === 0) return null;

  return (
    <Animated.Text
      numberOfLines={1}
      style={{
        fontSize: 14,
        color: "#9CA3AF",
        opacity,
        transform: [{ translateY }],
      }}
    >
      {items[index]}
    </Animated.Text>
  );
}

// ─── Animated badge that collapses to a small dot after 3 s ─────────
function AnimatedBadge({
  count,
  badgeTextSize,
  bgColor = "#f8f9fa",
}: {
  count: number;
  badgeTextSize: number;
  bgColor?: string;
}) {
  const [showText, setShowText] = useState(true);
  const anim = useRef(new Animated.Value(1)).current; // 1 = full, 0 = dot
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset whenever count changes (new message arrives → show number again)
  const reset = useCallback(() => {
    setShowText(true);
    anim.setValue(1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => setShowText(false));
    }, 3000);
  }, [anim]);

  useEffect(() => {
    if (count > 0) reset();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [count, reset]);

  if (count <= 0) return null;

  // All interpolations driven by the same `anim` value (1 → 0)
  // so width and height shrink uniformly — no oblate warp.
  const size = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [8, 16],
  });
  const px = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 3],
  });
  // Text fades out in the first half of the animation
  const textOpacity = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0, 1],
  });
  // Text scales down slightly for a polished feel
  const textScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: -4,
        right: -6,
        minWidth: size,
        width: size,
        height: size,
        paddingHorizontal: px,
        borderRadius: 999,
        borderCurve: "continuous",
        backgroundColor: "#ef4444",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {showText && (
        <Animated.Text
          style={{
            color: "white",
            fontSize: badgeTextSize,
            fontWeight: "700",
            lineHeight: 14,
            opacity: textOpacity,
            transform: [{ scale: textScale }],
          }}
        >
          {count > 99 ? "99+" : count}
        </Animated.Text>
      )}
    </Animated.View>
  );
}

export default function TopNavbar({
  centerContent,
}: {
  /** Optional content centered between the hamburger and the icon group
   *  (e.g. the Home screen's Explore/Following tabs). Hidden while the
   *  search field is expanding to avoid overlapping it. */
  centerContent?: React.ReactNode;
}) {
  const router = useAppRouter();
  const pathname = usePathname();
  const { currentUser } = useUser();
  const { unreadCount } = useUnreadMessages();
  const insets = useSafeAreaInsets();
  const [imageLoadError, setImageLoadError] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [showDrawer, setShowDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Measured so centerContent can be centered in the actual gap between the
  // hamburger and the icon group, instead of across the full row (which
  // would drift into the icons once their combined width is uneven).
  const [leftWidth, setLeftWidth] = useState(0);
  const [rightWidth, setRightWidth] = useState(0);
  // Trending topics for the expanded search bar's rotating placeholder —
  // same shared source the Categories tab and Search screen already use.
  const { trending } = useTrendingSubcategories();
  const trendingLabels = React.useMemo(
    () =>
      trending.map(
        (t) => t.subcategoryName.charAt(0).toUpperCase() + t.subcategoryName.slice(1),
      ),
    [trending],
  );
  const { ms, vs, wp } = useResponsive();
  const topInset = Math.max(insets.top, 0);
  const contentHeight =
    Platform.OS === "android" ? clamp(ms(48), 44, 56) : clamp(ms(44), 40, 52);
  const topSpacing =
    Platform.OS === "android" ? clamp(vs(16), 12, 22) : clamp(vs(10), 8, 16);
  const horizontalPadding = clamp(wp(4), 14, 24);
  const bottomPadding = clamp(vs(16), 14, 22);
  const avatarSize = clamp(ms(30), 26, 36);
  const actionGap = clamp(ms(16), 12, 22);
  const sendIconSize = clamp(ms(20), 18, 24);
  const menuIconSize = clamp(ms(22), 20, 26);
  const badgeTextSize = clamp(ms(8), 7, 10);

  // Reset error state when avatar URL changes
  useEffect(() => {
    setImageLoadError(false);
  }, [currentUser?.avatar_url]);

  const handleHeaderPress = useCallback(
    ({
      signedOutMessage,
      route,
    }: {
      signedOutMessage: string;
      route: "/messages" | "/profile";
    }) => {
      if (!currentUser) {
        setAuthMessage(signedOutMessage);
        setShowAuthModal(true);
        return;
      }

      router.push(route as any);
    },
    [currentUser, router],
  );

  // Reset back to the icon row whenever this screen loses focus — covers
  // both the search-screen push below and any other way of navigating away
  // mid-expand, so returning here never shows a stale expanded state.
  useFocusEffect(
    useCallback(() => {
      return () => setSearchOpen(false);
    }, []),
  );

  // Plays the expand visual briefly, then hands off to the real full-screen
  // search (app/(users)/search.tsx already autofocuses its own input, so the
  // keyboard stays up continuously through the transition).
  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setTimeout(() => router.push("/search" as any), 200);
  }, [router]);

  // Screens without centerContent (Shopping/Marketplace/Services — no
  // Explore/Following-style tabs) would otherwise leave a dead gap between
  // the hamburger and the icon group, so the search field fills it as an
  // always-expanded "Search" bar instead of a plain icon.
  const hasCenterTabs = !!centerContent;

  return (
    <View
      className="bg-[#f8f9fa]"
      style={{
        paddingTop: topInset + topSpacing,
        height: topInset + topSpacing + contentHeight,
        justifyContent: "center",
        paddingBottom: bottomPadding,
        paddingHorizontal: horizontalPadding,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#E5E7EB",
      }}
    >
      <View
        className="flex-row items-center justify-between"
        style={{ height: contentHeight }}
      >
        <View onLayout={(e) => setLeftWidth(e.nativeEvent.layout.width)}>
          <TabBarButton onPress={() => setShowDrawer(true)} android_ripple={null}>
            <Menu size={menuIconSize} color="#000" strokeWidth={2} />
          </TabBarButton>
        </View>

        {hasCenterTabs && !searchOpen && leftWidth > 0 && rightWidth > 0 && (
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: leftWidth,
              right: rightWidth,
              top: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {centerContent}
          </View>
        )}

        {!hasCenterTabs && (
          <TabBarButton
            onPress={() => router.push("/search" as any)}
            android_ripple={null}
            style={{
              flex: 1,
              marginHorizontal: actionGap,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "#fff",
                borderRadius: 999,
                borderCurve: "continuous",
                paddingHorizontal: 14,
                height: contentHeight * 0.82,
              }}
            >
              <View style={{ flex: 1, marginRight: 8 }}>
                <RotatingSearchPlaceholder items={trendingLabels} />
              </View>
              <Text style={{ fontSize: 14, color: "#9CA3AF" }}>Search</Text>
            </View>
          </TabBarButton>
        )}

        <ReanimatedAnimated.View
          layout={LinearTransition.duration(220)}
          onLayout={(e) => {
            if (!searchOpen) setRightWidth(e.nativeEvent.layout.width);
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            columnGap: actionGap,
            ...(searchOpen ? { flex: 1, marginLeft: actionGap } : null),
          }}
        >
          {searchOpen ? (
            // Purely a transitional visual — real typing happens on the
            // pushed /search screen a beat later, so this never needs its
            // own input, cancel button, or exit animation.
            <ReanimatedAnimated.View
              key="search"
              entering={FadeIn.duration(180)}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#fff",
                borderRadius: 999,
                borderCurve: "continuous",
                paddingHorizontal: 12,
                height: contentHeight * 0.82,
              }}
            >
              <Search size={16} color="#888" />
              <Text style={{ marginLeft: 8, fontSize: 14, color: "#9CA3AF" }}>Search</Text>
            </ReanimatedAnimated.View>
          ) : (
            <ReanimatedAnimated.View
              key="icons"
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
              style={{ flexDirection: "row", alignItems: "center", columnGap: actionGap }}
            >
              {hasCenterTabs && (
                <TabBarButton onPress={openSearch} android_ripple={null}>
                  <Search size={sendIconSize} color="#000" strokeWidth={2} />
                </TabBarButton>
              )}

              <TabBarButton
                onPress={() =>
                  handleHeaderPress({
                    signedOutMessage: "Sign in to view your messages",
                    route: "/messages",
                  })
                }
                android_ripple={null}
              >
                <View style={{ overflow: "visible" }}>
                  <Send size={sendIconSize} color="#000" strokeWidth={2} />
                  <AnimatedBadge count={unreadCount} badgeTextSize={badgeTextSize} />
                </View>
              </TabBarButton>

              <TabBarButton
                onPress={() =>
                  handleHeaderPress({
                    signedOutMessage: "Sign in to access your profile",
                    route: "/profile",
                  })
                }
                android_ripple={null}
              >
                {currentUser?.avatar_url && !imageLoadError ? (
                  <ExpoImage
                    source={{ uri: currentUser.avatar_url }}
                    style={{
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: avatarSize / 2,
                    }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    onError={() => {
                      setImageLoadError(true);
                    }}
                  />
                ) : (
                  <UserCircle size={avatarSize} stroke="#444" />
                )}
              </TabBarButton>
            </ReanimatedAnimated.View>
          )}
        </ReanimatedAnimated.View>
      </View>

      <AuthPromptModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        message={authMessage}
      />

      {showDrawer && (
        <HamburgerMenu visible={showDrawer} onClose={() => setShowDrawer(false)} />
      )}
    </View>
  );
}
