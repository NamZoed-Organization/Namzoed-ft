// components/icons/HomeIcon.tsx
import { Image } from "expo-image";
import React from "react";
import Svg, { Path } from "react-native-svg";

export default function HomeIcon({ size = 24, focused = false }) {
  // Brand mark replaces the plain house glyph only while Home is the active
  // tab — moved here from the top bar (see components/ui/TopNavbar.tsx),
  // which no longer shows the logo/wordmark on any screen.
  if (focused) {
    return (
      <Image
        source={require("@/assets/images/logo.png")}
        style={{ width: size, height: size }}
        contentFit="contain"
      />
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        fill={focused ? "#0A0A0A" : "none"}
        stroke="#0A0A0A"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"
        fill="none"
        stroke={focused ? "#FFFFFF" : "#0A0A0A"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
