import { PlatformPressable } from "@react-navigation/elements";
import React, { useRef } from "react";
import type { GestureResponderEvent } from "react-native";
import { feedEvents } from "@/utils/feedEvents";

// Feed tab: double-tap scroll-to-top, same press handling as default tab bar for layout.
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

  return <PlatformPressable ref={ref} {...rest} onPress={handlePress} />;
});

FeedTabButton.displayName = "FeedTabButton";

export default FeedTabButton;
