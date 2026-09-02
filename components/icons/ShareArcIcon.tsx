// components/icons/ShareArcIcon.tsx
import React from "react";
import Svg, { Path } from "react-native-svg";

interface ShareArcIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/**
 * Tabler's "share-3" glyph (TbShare3 in react-icons/tb) — an arrow arcing up
 * out of a curved path, rebuilt on react-native-svg since react-icons itself
 * renders DOM <svg> tags and isn't usable in React Native. Path data copied
 * verbatim from tabler-icons so it's pixel-identical to TbShare3.
 */
export default function ShareArcIcon({
  size = 24,
  color = "currentColor",
  strokeWidth = 2,
}: ShareArcIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 4v4c-6.575 1.028 -9.02 6.788 -10 12c-.037 .206 5.384 -5.962 10 -6v4l8 -7l-8 -7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
