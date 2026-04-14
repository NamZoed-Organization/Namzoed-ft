import React, { useRef } from "react";
import { Pressable } from "react-native";
import type { GestureResponderEvent } from "react-native";
import { feedEvents } from "@/utils/feedEvents";

// Feed tab: double-tap scroll-to-top. Uses RN Pressable instead of
// PlatformPressable to eliminate the ~100-150ms built-in press delay.
const FeedTabButton = React.forwardRef<any, any>((props, ref) => {
  const lastTapTime = useRef(0);
  const { onPress, ...rest } = props;

  const handlePress = (e: GestureResponderEvent) => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      feedEvents.emit("scrollToTop");
    }
    lastTapTime.current = now;
    onPress?.(e);
  };

  return <Pressable ref={ref} {...rest} onPress={handlePress} />;
});

FeedTabButton.displayName = "FeedTabButton";

export default FeedTabButton;
