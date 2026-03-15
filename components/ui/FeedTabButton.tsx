import React, { useRef } from "react";
import { TouchableOpacity } from "react-native-gesture-handler";
import { feedEvents } from "@/utils/feedEvents";

// Custom tab button for feed that handles double-tap
const FeedTabButton = React.forwardRef<any, any>((props, ref) => {
  const lastTapTime = useRef<number>(0);

  const handlePress = () => {
    const currentTime = Date.now();
    
    if (currentTime - lastTapTime.current < 300) {
      // Double tap detected - emit scroll to top event
      feedEvents.emit('scrollToTop');
    }
    
    lastTapTime.current = currentTime;
    
    // Call the original onPress
    if (props.onPress) {
      props.onPress();
    }
  };

  return (
    <TouchableOpacity
      ref={ref}
      activeOpacity={0.7}
      {...props}
      onPress={handlePress}
    >
      {props.children}
    </TouchableOpacity>
  );
});

FeedTabButton.displayName = "FeedTabButton";

export default FeedTabButton;