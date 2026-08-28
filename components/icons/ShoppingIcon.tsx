// components/icons/ShoppingIcon.tsx
import React from "react";
import Svg, { Path } from "react-native-svg";

export default function ShoppingIcon({ size = 24, focused = false }) {
  const color = "#0A0A0A";
  const strapColor = focused ? "#FFFFFF" : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"
        fill={focused ? color : "none"}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 6h18"
        stroke={strapColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 10a4 4 0 0 1-8 0"
        stroke={strapColor}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
