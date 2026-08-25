// components/icons/CategoriesIcon.tsx
import React from "react";
import Svg, { Rect } from "react-native-svg";

export default function CategoriesIcon({ size = 24, focused = false }) {
  const color = "#0A0A0A";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7" height="7" rx="1" fill={focused ? color : "none"} stroke={color} strokeWidth={2} />
      <Rect x="14" y="3" width="7" height="7" rx="1" fill={focused ? color : "none"} stroke={color} strokeWidth={2} />
      <Rect x="14" y="14" width="7" height="7" rx="1" fill={focused ? color : "none"} stroke={color} strokeWidth={2} />
      <Rect x="3" y="14" width="7" height="7" rx="1" fill={focused ? color : "none"} stroke={color} strokeWidth={2} />
    </Svg>
  );
}
