import { useNotifications, type NotificationBanner } from "@/contexts/NotificationsContext";
import { playSound } from "@/lib/soundUtils";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, FeColorMatrix, FeTurbulence, Filter, Rect } from "react-native-svg";

// Replicates the grain texture that iOS's UIVisualEffectView adds to its blur
function AndroidGrainOverlay() {
  if (Platform.OS !== 'android') return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Filter id="notifBannerGrain" x="0%" y="0%" width="100%" height="100%">
            <FeTurbulence
              type="fractalNoise"
              baseFrequency={0.65}
              numOctaves={3}
              stitchTiles="stitch"
            />
            <FeColorMatrix type="saturate" values={0} />
          </Filter>
        </Defs>
        <Rect width="100%" height="100%" filter="url(#notifBannerGrain)" opacity={0.07} />
      </Svg>
    </View>
  );
}

// ─── small coloured icon per notification type ──────────────────────

function typeIconName(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "new_follower":    return "person-add";
    case "post_liked":     return "heart";
    case "post_commented": return "chatbubble";
    case "user_went_live": return "radio";
    case "new_post":       return "document-text";
    default:               return "notifications";
  }
}

function typeIconBg(type: string): string {
  switch (type) {
    case "new_follower":    return "#3b82f6";
    case "post_liked":     return "#ef4444";
    case "post_commented": return "#f59e0b";
    case "user_went_live": return "#8b5cf6";
    case "new_post":       return "#22c55e";
    default:               return "#6b7280";
  }
}

function typeLabel(type: string): string {
  switch (type) {
    case "new_follower":    return "New Follower";
    case "post_liked":     return "Post Liked";
    case "post_commented": return "New Comment";
    case "user_went_live": return "Live Now";
    case "new_post":       return "New Post";
    default:               return "Notification";
  }
}

// ─── banner component ──────────────────────────────────────────────────

export default function InAppNotificationBanner() {
  const { banner, dismissBanner } = useNotifications();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-200)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Slide in/out when banner changes
  useEffect(() => {
    if (banner) {
      void playSound('notification');
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -200,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [banner, opacity, translateY]);

  // Swipe-up pan responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 4,
      onPanResponderMove: (_, gs) => {
        // Only allow dragging upward
        if (gs.dy < 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy < -40 || gs.vy < -0.5) {
          // Swiped far enough — dismiss
          Animated.parallel([
            Animated.timing(translateY, {
              toValue: -200,
              duration: 180,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 160,
              useNativeDriver: true,
            }),
          ]).start(dismissBanner);
        } else {
          // Snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
          }).start();
        }
      },
    }),
  ).current;

  const handlePress = (b: NotificationBanner) => {
    dismissBanner();
    switch (b.type) {
      case "new_follower":
        router.push(`/(users)/profile/${b.actorId}` as any);
        break;
      case "post_liked":
      case "post_commented":
        if (b.referenceId) router.push(`/(users)/post/${b.referenceId}` as any);
        break;
      case "new_post":
        if (b.referenceId) router.push(`/(users)/post/${b.referenceId}` as any);
        else router.push(`/(users)/profile/${b.actorId}` as any);
        break;
      case "user_went_live":
        if (b.referenceId) router.push(`/(users)/(tabs)/feed?streamId=${b.referenceId}` as any);
        else router.push(`/(users)/profile/${b.actorId}` as any);
        break;
      default:
        router.push("/(users)/notifications" as any);
        break;
    }
  };

  if (!banner) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 10,
        left: 14,
        right: 14,
        zIndex: 9998,
        elevation: 49,
        opacity,
        transform: [{ translateY }],
      }}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={{
          borderRadius: 22,
          overflow: "hidden",
          // Fallback shadow
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
          elevation: 12,
        }}
      >
        {/* Grainy blur background */}
        <BlurView
          intensity={72}
          tint="dark"
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          style={{
            borderRadius: 22,
            overflow: "hidden",
            borderWidth: 0.5,
            borderColor: "rgba(255,255,255,0.15)",
          }}
        >
          {/* Tap-to-navigate area */}
          <View
            style={{ paddingHorizontal: 16, paddingTop: 22, paddingBottom: 12 }}
            onStartShouldSetResponder={() => false}
          >
            {/* Row: avatar + copy */}
            <View
              style={{ flexDirection: "row", alignItems: "flex-start" }}
              onTouchEnd={() => handlePress(banner)}
            >
              {/* Avatar with type badge */}
              <View style={{ position: "relative", marginRight: 12, marginTop: 2 }}>
                {banner.actorAvatarUrl ? (
                  <Image
                    source={{ uri: banner.actorAvatarUrl }}
                    style={{ width: 46, height: 46, borderRadius: 23 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 46, height: 46, borderRadius: 23,
                      backgroundColor: "rgba(255,255,255,0.15)",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Ionicons name="person" size={22} color="rgba(255,255,255,0.7)" />
                  </View>
                )}
                <View
                  style={{
                    position: "absolute", bottom: -2, right: -2,
                    width: 20, height: 20, borderRadius: 10,
                    backgroundColor: typeIconBg(banner.type),
                    alignItems: "center", justifyContent: "center",
                    borderWidth: 2, borderColor: "rgba(0,0,0,0.35)",
                  }}
                >
                  <Ionicons name={typeIconName(banner.type)} size={10} color="#fff" />
                </View>
              </View>

              {/* Copy */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: "rgba(255,255,255,0.55)",
                    textTransform: "uppercase",
                    letterSpacing: 0.6,
                    marginBottom: 2,
                  }}
                >
                  {typeLabel(banner.type)}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "rgba(255,255,255,0.95)",
                    lineHeight: 20,
                    fontWeight: "400",
                  }}
                  numberOfLines={3}
                >
                  {banner.actorName ? (
                    <Text style={{ fontWeight: "700" }}>{banner.actorName}</Text>
                  ) : null}
                  {banner.actorName
                    ? banner.body.startsWith(banner.actorName)
                      ? banner.body.slice(banner.actorName.length)
                      : ` ${banner.body}`
                    : banner.body}
                </Text>
              </View>
            </View>

            {/* Drag handle */}
            <View
              style={{
                alignItems: "center",
                paddingTop: 10,
                paddingBottom: 2,
              }}
            >
              <View
                style={{
                  width: 36, height: 4, borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.3)",
                }}
              />
            </View>
          </View>
          <AndroidGrainOverlay />
        </BlurView>
      </Animated.View>
    </Animated.View>
  );
}



