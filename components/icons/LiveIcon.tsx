// components/icons/LiveIcon.tsx
import React from "react";
import Svg, { Circle, Path } from "react-native-svg";

export default function LiveIcon({ size = 24, focused = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Camera body */}
      <Path
        d="M23 7l-7 5 7 5V7z"
        stroke={focused ? "#094569" : "#9ca3af"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? "#EDC06D" : "none"}
      />
      <Path
        d="M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z"
        stroke={focused ? "#094569" : "#9ca3af"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Live indicator dot */}
      {focused && (
        <Circle
          cx="18"
          cy="6"
          r="3"
          fill="#ef4444"
          stroke="white"
          strokeWidth={1}
        />
      )}
    </Svg>
  );
}
