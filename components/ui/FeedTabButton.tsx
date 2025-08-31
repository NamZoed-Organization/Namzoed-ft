import React, { useRef } from "react";
import { Pressable } from "react-native";
import { feedEvents } from "@/utils/feedEvents";

// Custom tab button for feed that handles double-tap
const FeedTabButton = React.forwardRef<any, any>((props, ref) => {
  const lastTapTime = useRef<number>(0);

  const handlePress = () => {
    const currentTime = Date.now();
    
    if (currentTime - lastTapTime.current < 300) {
      // Double tap detected - emit scroll to top event
      feedEvents.emit('scrollToTop');
      console.log('Double tap detected on feed tab!');
    }
    
    lastTapTime.current = currentTime;
    
    // Call the original onPress
    if (props.onPress) {
      props.onPress();
    }
  };

  return (
    <Pressable 
      ref={ref} 
      android_ripple={null} 
      {...props}
      onPress={handlePress}
    >
      {props.children}
    </Pressable>
  );
});

FeedTabButton.displayName = "FeedTabButton";

export default FeedTabButton;