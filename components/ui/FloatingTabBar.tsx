import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { BottomTabBar, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PILL_HEIGHT = 56;
// Full capsule ends (radius = half height) — but rendered with Apple's
// continuous corner (superellipse) via borderCurve, not a plain circular
// arc, so the curve eases into the straight top/bottom edge smoothly
// instead of the abrupt curvature kink a plain circle has at that seam.
// Android has no equivalent and just falls back to a normal circular corner.
const PILL_RADIUS = PILL_HEIGHT / 2;
const PILL_SIDE_MARGIN = 48;
const PILL_MIN_WIDTH = 260;
const PILL_MAX_WIDTH = 340;
const FLOAT_GAP = 6;
const BLUR_INTENSITY = 50;
const ANDROID_BACKGROUND = "rgba(255, 255, 255, 0.77)";

export default function FloatingTabBar(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { pillScale, tabBarHidden } = useTabBarScroll();

  const pillWidth = Math.min(
    PILL_MAX_WIDTH,
    Math.max(PILL_MIN_WIDTH, screenWidth - PILL_SIDE_MARGIN * 2)
  );

  // useAnimatedStyle must run every render (rules of hooks) — the
  // tabBarHidden early-out has to come after it, not before.
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pillScale.value }],
  }));

  if (tabBarHidden) return null;

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
            borderRadius: PILL_RADIUS,
            borderCurve: "continuous",
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
            borderRadius: PILL_RADIUS,
            borderCurve: "continuous",
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
          {/* Liquid-glass sheen — a soft light highlight arcing across the top,
              like light catching the curve of glass. Fades to nothing by mid-pill
              so it reads as a highlight, not a tint. */}
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255, 255, 255, 0.5)", "rgba(255, 255, 255, 0)"]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.6, y: 0.7 }}
            style={StyleSheet.absoluteFill}
          />
          <BottomTabBar
            {...props}
            insets={{ ...props.insets, bottom: 0 }}
            style={{
              width: pillWidth,
              height: PILL_HEIGHT,
              borderTopWidth: 0,
              elevation: 0,
              shadowOpacity: 0,
              backgroundColor: "transparent",
            }}
          />
        </View>
      </Animated.View>
    </View>
  );
}
