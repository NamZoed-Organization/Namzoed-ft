
// components/icons/ChatIcon.tsx
import React from "react";
import Svg, { Path } from "react-native-svg";

export default function ChatIcon({ size = 24, focused = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
        stroke={focused ? "#094569" : "#000000ff"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M8 12h.01" stroke={focused ? "#EDC06D" : "#000000ff"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M12 12h.01" stroke={focused ? "#EDC06D" : "#000000ff"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 12h.01" stroke={focused ? "#EDC06D" : "#000000ff"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
