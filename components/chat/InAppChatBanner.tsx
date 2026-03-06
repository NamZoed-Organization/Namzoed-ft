import { useUnreadMessages } from "@/contexts/UnreadMessagesContext";
import { playReceiveSound, triggerReceiveHaptic } from "@/utils/chatSounds";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Image, PanResponder, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, FeColorMatrix, FeTurbulence, Filter, Rect } from "react-native-svg";

const REPLY_META_SUFFIX = "[/reply-meta]";

// Replicates the grain texture that iOS's UIVisualEffectView adds to its blur
function AndroidGrainOverlay() {
  if (Platform.OS !== 'android') return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Filter id="chatBannerGrain" x="0%" y="0%" width="100%" height="100%">
            <FeTurbulence
              type="fractalNoise"
              baseFrequency={0.65}
              numOctaves={3}
              stitchTiles="stitch"
            />
            <FeColorMatrix type="saturate" values={0} />
          </Filter>
        </Defs>
        <Rect width="100%" height="100%" filter="url(#chatBannerGrain)" opacity={0.07} />
      </Svg>
    </View>
  );
}

function stripReplyMeta(content: string): string {
  if (content.startsWith("[reply-meta]") && content.includes(REPLY_META_SUFFIX)) {
    const idx = content.indexOf(REPLY_META_SUFFIX);
    const text = content.slice(idx + REPLY_META_SUFFIX.length).trim();
    return text.length > 0 ? `replied: ${text}` : "Replied to a message";
  }
  return content;
}

export default function InAppChatBanner() {
  const { banner, dismissBanner } = useUnreadMessages();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (banner) {
      void playReceiveSound();
      void triggerReceiveHaptic();

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 18,
          stiffness: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      return;
    }

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: -120,
        damping: 18,
        stiffness: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  }, [banner, opacity, translateY]);

  // Swipe-up pan responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderMove: (_, gs) => {
        if (gs.dy < 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -40 || gs.vy < -0.5) {
          Animated.parallel([
            Animated.timing(translateY, { toValue: -120, duration: 180, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
          ]).start(dismissBanner);
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }).start();
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      pointerEvents={banner ? "box-none" : "none"}
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
      {...panResponder.panHandlers}
    >
      {banner && (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => {
            const senderId = banner.senderId;
            dismissBanner();
            if (senderId) {
              router.push(`/(users)/chat/${senderId}`);
            }
          }}
          className="rounded-2xl overflow-hidden"
        >
          <BlurView intensity={72} tint="light" style={{ borderRadius: 16, overflow: 'hidden' }} experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}>
            <View
              style={{
                paddingHorizontal: 14,
                paddingTop: 14,
                paddingBottom: 8,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.55)',
                borderRadius: 16,
              }}
            >
              <View className="flex-row items-start">
                {banner.senderAvatarUrl ? (
                  <Image
                    source={{ uri: banner.senderAvatarUrl }}
                    className="w-8 h-8 rounded-full mr-3 mt-0.5"
                  />
                ) : (
                  <View className="w-8 h-8 rounded-full bg-primary items-center justify-center mr-3 mt-0.5">
                    <Ionicons name="person" size={16} color="white" />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900 mt-0.5">
                    {banner.senderName || "New message"}
                  </Text>
                  <Text
                    className="text-sm text-gray-700 mt-0.5"
                    numberOfLines={1}
                  >
                    {stripReplyMeta(banner.content)}
                  </Text>
                </View>
              </View>

              {/* Drag handle */}
              <View style={{ alignItems: "center", paddingTop: 8, paddingBottom: 2 }}>
                <View
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: "rgba(0,0,0,0.18)",
                  }}
                />
              </View>
            </View>
            <AndroidGrainOverlay />
          </BlurView>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}