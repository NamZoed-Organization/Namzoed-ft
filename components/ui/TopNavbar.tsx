// components/ui/TopNavbar.tsx
import DetectDzongkhag from "@/components/DetectDzongkhag";
import TabBarButton from "@/components/ui/TabBarButton";
import { useUnreadMessages } from "@/contexts/UnreadMessagesContext";
import { useUser } from "@/contexts/UserContext";
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
  const topInset = Math.max(insets.top, 0);
  const contentHeight = Platform.OS === "android" ? 48 : 44;
  const topSpacing = Platform.OS === "android" ? 16 : 10;

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
      className="px-4 bg-[#f8f9fa]"
      style={{
        paddingTop: topInset + topSpacing,
        height: topInset + topSpacing + contentHeight,
        justifyContent: "center",
        paddingBottom: 8,
      }}
    >
      <View className="flex-row items-center justify-between h-[44px]">
        <View className="flex-row items-center">
          <Image
            source={require("@/assets/images/logo.png")}
            className="w-10 h-10 mr-2"
            resizeMode="contain"
          />
          <Text className="font-mbold text-xl text-primary">
            Nam<Text className="text-secondary">Zoed</Text>
          </Text>
        </View>

        <View className="flex-row items-center gap-4">
          <DetectDzongkhag />

          <TabBarButton
            onPress={() => router.push("/messages")}
            android_ripple={null}
          >
            <View>
              <Send size={20} color="#000" strokeWidth={2} />
              {unreadCount > 0 && (
                <>
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      bottom: -4,
                      right: -8,
                      minWidth: 12,
                      height: 12,
                      paddingHorizontal: 2,
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
                    <Text className="text-white text-[8px] font-bold">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Text>
                  </Animated.View>
                  <Animated.View
                    pointerEvents="none"
                    style={{
                      position: "absolute",
                      bottom: -4,
                      right: -6,
                      width: 8,
                      height: 8,
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
                className="w-[30px] h-[30px] rounded-full"
                resizeMode="cover"
                onError={() => {
                  setImageLoadError(true);
                }}
              />
            ) : (
              <UserCircle size={30} stroke="#444" />
            )}
          </TabBarButton>
        </View>
      </View>
    </View>
  );
}
