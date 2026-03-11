// components/ui/TopNavbar.tsx
import DetectDzongkhag from "@/components/DetectDzongkhag";
import TabBarButton from "@/components/ui/TabBarButton";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useUnreadMessages } from "@/contexts/UnreadMessagesContext";
import { useUser } from "@/contexts/UserContext";
import { clamp, useResponsive } from "@/utils/responsive";
import { useRouter } from "expo-router";
import { Bell, Send, UserCircle } from "lucide-react-native";
import AuthPromptModal from "@/components/modals/AuthPromptModal";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Image, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

export default function TopNavbar() {
  const router = useRouter();
  const { currentUser } = useUser();
  const { unreadCount } = useUnreadMessages();
  const { unseenCount: notifUnseenCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const [imageLoadError, setImageLoadError] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const { ms, vs, wp } = useResponsive();
  const topInset = Math.max(insets.top, 0);
  const contentHeight =
    Platform.OS === "android" ? clamp(ms(48), 44, 56) : clamp(ms(44), 40, 52);
  const topSpacing =
    Platform.OS === "android" ? clamp(vs(16), 12, 22) : clamp(vs(10), 8, 16);
  const horizontalPadding = clamp(wp(4), 14, 24);
  const bottomPadding = clamp(vs(16), 14, 22);
  const logoSize = clamp(ms(40), 34, 46);
  const logoSpacing = clamp(ms(8), 6, 10);
  const titleSize = clamp(ms(16), 13, 19);
  const avatarSize = clamp(ms(30), 26, 36);
  const actionGap = clamp(ms(16), 12, 22);
  const sendIconSize = clamp(ms(20), 18, 24);
  const bellIconSize = clamp(ms(20), 18, 24);
  const badgeTextSize = clamp(ms(8), 7, 10);

  // Reset error state when avatar URL changes
  useEffect(() => {
    setImageLoadError(false);
  }, [currentUser?.avatar_url]);

  return (
    <View
      className="bg-[#f8f9fa]"
      style={{
        paddingTop: topInset + topSpacing,
        height: topInset + topSpacing + contentHeight,
        justifyContent: "center",
        paddingBottom: bottomPadding,
        paddingHorizontal: horizontalPadding,
      }}
    >
      <View
        className="flex-row items-center justify-between"
        style={{ height: contentHeight }}
      >
        <View className="flex-row items-center">
          <Image
            source={require("@/assets/images/logo.png")}
            style={{
              width: logoSize,
              height: logoSize,
              marginRight: logoSpacing,
            }}
            resizeMode="contain"
          />
          <Text
            className="font-mbold text-primary"
            style={{ fontSize: titleSize }}
          >
            Nam<Text className="text-secondary">Zoed</Text>
          </Text>
        </View>

        <View className="flex-row items-center" style={{ columnGap: actionGap }}>
          <DetectDzongkhag />

          <TabBarButton
            onPress={() => {
              if (!currentUser) { setAuthMessage("Sign in to view your messages"); setShowAuthModal(true); return; }
              router.push("/messages");
            }}
            android_ripple={null}
          >
            <View style={{ overflow: "visible" }}>
              <Send size={sendIconSize} color="#000" strokeWidth={2} />
              <AnimatedBadge count={unreadCount} badgeTextSize={badgeTextSize} />
            </View>
          </TabBarButton>

          <TabBarButton
            onPress={() => {
              if (!currentUser) { setAuthMessage("Sign in to view your notifications"); setShowAuthModal(true); return; }
              router.push("/notifications" as any);
            }}
            android_ripple={null}
          >
            <View style={{ overflow: "visible" }}>
              <Bell size={bellIconSize} color="#000" strokeWidth={2} />
              <AnimatedBadge count={notifUnseenCount} badgeTextSize={badgeTextSize} />
            </View>
          </TabBarButton>

          <TabBarButton
            onPress={() => {
              if (!currentUser) { setAuthMessage("Sign in to access your profile"); setShowAuthModal(true); return; }
              router.push("/profile");
            }}
            android_ripple={null}
          >
            {currentUser?.avatar_url && !imageLoadError ? (
              <Image
                source={{ uri: currentUser.avatar_url }}
                style={{
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                }}
                resizeMode="cover"
                onError={() => {
                  setImageLoadError(true);
                }}
              />
            ) : (
              <UserCircle size={avatarSize} stroke="#444" />
            )}
          </TabBarButton>
        </View>
      </View>

      <AuthPromptModal
        visible={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        message={authMessage}
      />
    </View>
  );
}
