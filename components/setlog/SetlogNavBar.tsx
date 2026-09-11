/**
 * Setlog's own bottom bar.
 *
 * The app's floating pill is hidden on this tab (see `setTabBarHidden` in
 * the Messages screen) and this stands in its place, so the geometry is
 * copied from `components/ui/FloatingTabBar.tsx` deliberately — same
 * height, same continuous-corner capsule, same blur, same float off the
 * home indicator. Two bars in one app that sit in the same place and look
 * almost alike is worse than either one alone.
 *
 * Three things, and the third is not like the other two: **Your Logs** and
 * **Squad Logs** are places, and **Camera** is an act. It shows as filled
 * rather than selected, because you never end up "on" it — you come back
 * from it. That is also why the plus row above the feed is gone: a screen
 * with a camera button in its navigation does not need a second one in its
 * list.
 */

import TutorialAnchor from "@/components/tutorial/TutorialAnchor";
import { BlurView } from "expo-blur";
import { Camera, Layers, User } from "lucide-react-native";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** All from FloatingTabBar — see the note above. */
const PILL_HEIGHT = 56;
const PILL_RADIUS = PILL_HEIGHT / 2;
const PILL_SIDE_MARGIN = 32;
const PILL_MIN_WIDTH = 260;
const PILL_MAX_WIDTH = 360;
const FLOAT_GAP = 6;
const BLUR_INTENSITY = 50;
const ANDROID_BACKGROUND = "rgba(255, 255, 255, 0.77)";

/** How much room the bar needs above the content it floats over. */
export const SETLOG_NAV_HEIGHT = PILL_HEIGHT + FLOAT_GAP;

export type SetlogNavKey = "mine" | "squad";

export default function SetlogNavBar({
  active,
  onSelect,
  onCamera,
}: {
  active: SetlogNavKey;
  onSelect: (key: SetlogNavKey) => void;
  onCamera: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const pillWidth = Math.min(
    PILL_MAX_WIDTH,
    Math.max(PILL_MIN_WIDTH, screenWidth - PILL_SIDE_MARGIN * 2),
  );

  const items: { key: SetlogNavKey; label: string; icon: typeof User }[] = [
    { key: "mine", label: "Your Logs", icon: User },
    { key: "squad", label: "Squad Logs", icon: Layers },
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
      <View
        style={{
          width: pillWidth,
          height: PILL_HEIGHT,
          borderRadius: PILL_RADIUS,
          borderCurve: "continuous",
          overflow: "hidden",
          // The same shadow the app's own pill carries, so the two read as
          // one family rather than one floating and one pasted on.
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        {Platform.OS === "ios" ? (
          <BlurView intensity={BLUR_INTENSITY} tint="light" style={StyleSheet.absoluteFill} />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: ANDROID_BACKGROUND },
            ]}
          />
        )}

        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 6,
          }}
        >
          {items.map((item) => {
            const on = active === item.key;
            const Icon = item.icon;
            return (
              <TutorialAnchor
                key={item.key}
                id={`setlog.${item.key}`}
                radius={14}
                style={{ flex: 1 }}
              >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onSelect(item.key)}
                style={{ alignItems: "center", justifyContent: "center" }}
              >
                <Icon
                  size={20}
                  color={on ? "#094569" : "#6b7280"}
                  strokeWidth={on ? 2.2 : 1.8}
                />
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 11,
                    fontWeight: on ? "700" : "500",
                    color: on ? "#094569" : "#6b7280",
                    marginTop: 3,
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
              </TutorialAnchor>
            );
          })}

          {/* The act, not a place. Filled, so it never looks like the tab
              you are currently on. */}
          <TutorialAnchor id="setlog.camera" radius={22} style={{ marginRight: 4 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onCamera}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderCurve: "continuous",
                backgroundColor: "#094569",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={21} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </TutorialAnchor>
        </View>
      </View>
    </View>
  );
}
