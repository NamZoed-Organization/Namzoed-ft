// components/icons/CategoriesIcon.tsx
import React from "react";
import Svg, { Rect } from "react-native-svg";

export default function CategoriesIcon({ size = 24, focused = false }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7" height="7" rx="1" stroke={focused ? "#EDC06D" : "#000000ff"} strokeWidth={2} />
      <Rect x="14" y="3" width="7" height="7" rx="1" stroke={"#000000ff"} strokeWidth={2} />
      <Rect x="14" y="14" width="7" height="7" rx="1" stroke={focused ? "#EDC06D" : "#000000ff"} strokeWidth={2} />
      <Rect x="3" y="14" width="7" height="7" rx="1" stroke={"#000000ff"} strokeWidth={2} />
    </Svg>
  );
}
