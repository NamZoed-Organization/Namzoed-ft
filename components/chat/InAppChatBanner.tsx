import { useUnreadMessages } from "@/contexts/UnreadMessagesContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function InAppChatBanner() {
  const { banner, dismissBanner } = useUnreadMessages();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (banner) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [banner, opacity, translateY]);

  if (!banner) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 12,
        right: 12,
        zIndex: 9999,
        elevation: 50,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          dismissBanner();
          router.push(`/(users)/chat/${banner.senderId}`);
        }}
        className="rounded-2xl overflow-hidden"
      >
        <View className="bg-white/95 border border-gray-200 px-4 py-3 shadow-sm shadow-black/20">
          <View className="flex-row items-start">
            <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-3 mt-0.5">
              <Ionicons name="chatbubble" size={16} color="white" />
            </View>
            <View className="flex-1">
              <Text className="text-[13px] font-medium text-gray-500">
                New message
              </Text>
              <Text className="text-sm font-semibold text-gray-900 mt-0.5">
                {banner.senderName}
              </Text>
              <Text className="text-sm text-gray-700 mt-0.5" numberOfLines={1}>
                {banner.content}
              </Text>
            </View>
            <TouchableOpacity onPress={dismissBanner} className="ml-2 p-1">
              <Ionicons name="close" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
