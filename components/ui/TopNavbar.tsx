// components/ui/TopNavbar.tsx
import DetectDzongkhag from "@/components/DetectDzongkhag";
import TabBarButton from "@/components/ui/TabBarButton";
import { useUnreadMessages } from "@/contexts/UnreadMessagesContext";
import { useUser } from "@/contexts/UserContext";
import { clamp, useResponsive } from "@/utils/responsive";
import { useRouter } from "expo-router";
import { Send, UserCircle } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Animated, AppState, Image, Platform, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TopNavbar() {
  const router = useRouter();
  const { currentUser } = useUser();
  const { unreadCount } = useUnreadMessages();
  const insets = useSafeAreaInsets();
  const [imageLoadError, setImageLoadError] = useState(false);
  const [showUnreadCount, setShowUnreadCount] = useState(true);
  const badgeModeAnim = useRef(new Animated.Value(1)).current;
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
  const badgeSize = clamp(ms(12), 10, 16);
  const badgeDotSize = clamp(ms(8), 6, 10);
  const badgeTextSize = clamp(ms(8), 7, 10);
  const badgeBottom = -Math.round(clamp(ms(4), 3, 5));
  const badgeRight = -Math.round(clamp(ms(8), 6, 10));

  // Reset error state when avatar URL changes
  useEffect(() => {
    setImageLoadError(false);
  }, [currentUser?.avatar_url]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const startCountWindow = () => {
      setShowUnreadCount(true);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        setShowUnreadCount(false);
      }, 5000);
    };

    startCountWindow();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        startCountWindow();
      }
    });

    return () => {
      subscription.remove();
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    Animated.timing(badgeModeAnim, {
      toValue: showUnreadCount ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [showUnreadCount, badgeModeAnim]);

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
            onPress={() => router.push("/messages")}
            android_ripple={null}
          >
            <View>
              <Send size={sendIconSize} color="#000" strokeWidth={2} />
              {unreadCount > 0 && (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      bottom: badgeBottom,
                      right: badgeRight,
                      minWidth: badgeSize,
                      height: badgeSize,
                      paddingHorizontal: clamp(ms(2), 1, 4),
                      borderRadius: 999,
                      backgroundColor: "#ef4444",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: badgeModeAnim,
                      transform: [
                        {
                          scale: badgeModeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.75, 1],
                          }),
                        },
                      ],
                    }}
                  >
                    <Text
                      className="text-white font-bold"
                      style={{ fontSize: badgeTextSize }}
                    >
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </Animated.View>
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      bottom: badgeBottom,
                      right: -Math.round(clamp(ms(6), 4, 8)),
                      width: badgeDotSize,
                      height: badgeDotSize,
                      borderRadius: 999,
                      backgroundColor: "#ef4444",
                      opacity: badgeModeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0],
                      }),
                      transform: [
                        {
                          scale: badgeModeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 0.75],
                          }),
                        },
                      ],
                    }}
                  />
                </>
              )}
            </View>
          </TabBarButton>

          <TabBarButton
            onPress={() => router.push("/profile")}
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
    </View>
  );
}
