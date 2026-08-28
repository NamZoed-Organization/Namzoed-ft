import { HomeIcon, ShoppingIcon } from "@/components/icons/index";
import MongooseWorkerNavBar from "@/components/ui/MongooseWorkerNavBar";
import { useUser } from "@/contexts/UserContext";
import { clamp, useResponsive } from "@/utils/responsive";
import { useAppRouter } from "@/utils/navigation";
import { isMongooseUser } from "@/utils/roleCheck";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { usePathname } from "expo-router";
import { Plus } from "lucide-react-native";
import React from "react";
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PILL_HEIGHT = 56;
const PILL_SIDE_MARGIN = 48;
const PILL_MIN_WIDTH = 260;
const PILL_MAX_WIDTH = 340;
const FLOAT_GAP = 6;
const BLUR_INTENSITY = 50;
const ANDROID_BACKGROUND = "rgba(255, 255, 255, 0.77)";

export default function BottomNavBar({
  onTabPress,
  scale,
}: {
  /** Intercept tab presses (e.g. to close an overlay before navigating). */
  onTabPress?: (href: string) => void;
  /** Reanimated shared value (1 = full size, <1 = shrunk) from useBottomBarScroll. */
  scale?: SharedValue<number>;
} = {}) {
  const { currentUser } = useUser();
  const router = useAppRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { ms } = useResponsive();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale ? scale.value : 1 }],
  }));

  if (isMongooseUser(currentUser?.email)) {
    return <MongooseWorkerNavBar />;
  }

  const sideIconSize = clamp(ms(19), 18, 21);
  const plusCircleSize = clamp(ms(22), 20, 24) + 18;
  const plusIconSize = clamp(ms(22), 20, 24) + 6;
  const pillWidth = Math.min(
    PILL_MAX_WIDTH,
    Math.max(PILL_MIN_WIDTH, screenWidth - PILL_SIDE_MARGIN * 2)
  );

  const tabs = [
    {
      key: "index",
      href: "/",
      icon: (focused: boolean) => <HomeIcon focused={focused} size={sideIconSize} />,
    },
    {
      key: "categories",
      href: "/categories",
      icon: (focused: boolean) => (
        <ShoppingIcon
          focused={focused || pathname.includes("/categories/")}
          size={sideIconSize}
        />
      ),
    },
    {
      key: "feed",
      href: "/feed",
      icon: () => (
        <View
          style={{
            width: plusCircleSize,
            height: plusCircleSize,
            borderRadius: plusCircleSize / 2,
            backgroundColor: "#EDC06D",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Plus size={plusIconSize} stroke="#0A0A0A" strokeWidth={2} />
        </View>
      ),
    },
    {
      key: "marketplace",
      href: "/marketplace",
      icon: (focused: boolean) => (
        <Ionicons
          name={focused ? "storefront" : "storefront-outline"}
          size={sideIconSize}
          color="#0A0A0A"
        />
      ),
    },
    {
      key: "services",
      href: "/services",
      icon: (focused: boolean) => (
        <Ionicons
          name={focused ? "construct" : "construct-outline"}
          size={sideIconSize}
          color="#0A0A0A"
        />
      ),
    },
  ];

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: Math.max(insets.bottom - 16, 0) + FLOAT_GAP,
        alignItems: "center",
        zIndex: 100,
      }}
    >
      <Animated.View
        style={[
          {
            width: pillWidth,
            height: PILL_HEIGHT,
            borderRadius: PILL_HEIGHT / 2,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          },
          animatedStyle,
        ]}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            borderRadius: PILL_HEIGHT / 2,
            overflow: "hidden",
            borderWidth: StyleSheet.hairlineWidth,
            borderTopColor: "rgba(255, 255, 255, 0.55)",
            borderLeftColor: "rgba(255, 255, 255, 0.25)",
            borderRightColor: "rgba(255, 255, 255, 0.25)",
            borderBottomColor: "rgba(0, 0, 0, 0.08)",
            backgroundColor: Platform.OS === "ios" ? "transparent" : ANDROID_BACKGROUND,
          }}
        >
          {Platform.OS === "ios" && (
            <BlurView
              tint="systemChromeMaterial"
              intensity={BLUR_INTENSITY}
              style={StyleSheet.absoluteFill}
            />
          )}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255, 255, 255, 0.5)", "rgba(255, 255, 255, 0)"]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.6, y: 0.7 }}
            style={StyleSheet.absoluteFill}
          />
          {tabs.map((tab) => {
            const focused =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Pressable
                key={tab.key}
                android_ripple={null}
                onPress={() =>
                  onTabPress ? onTabPress(tab.href) : router.push(tab.href as any)
                }
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {tab.icon(focused)}
              </Pressable>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}
