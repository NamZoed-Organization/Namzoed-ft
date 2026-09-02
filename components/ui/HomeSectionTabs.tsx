// Center nav in TopNavbar's home layout: "Explore" (the existing home feed —
// For You / Featured / Live / Norbu / Bidding) vs "Following" (posts from
// users the viewer follows). Plain text buttons with a small underline
// indicator on the active tab, RedNote-style.
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export type HomeSection = "explore" | "following";

const SECTIONS: { key: HomeSection; label: string }[] = [
  { key: "following", label: "Following" },
  { key: "explore", label: "Explore" },
];

export default function HomeSectionTabs({
  active,
  onChange,
}: {
  active: HomeSection;
  onChange: (section: HomeSection) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", columnGap: 24 }}>
      {SECTIONS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View style={{ alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: isActive ? "700" : "500",
                  color: isActive ? "#111827" : "#9CA3AF",
                }}
              >
                {label}
              </Text>
              {/* Absolutely positioned so it doesn't add to this View's
                  height — keeps the label itself vertically centered with
                  the hamburger/icon row instead of being pushed up by the
                  underline's layout space. */}
              <View
                style={{
                  position: "absolute",
                  bottom: -6,
                  height: 2,
                  width: isActive ? 22 : 0,
                  borderRadius: 1,
                  borderCurve: "continuous",
                  backgroundColor: "#094569",
                }}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
