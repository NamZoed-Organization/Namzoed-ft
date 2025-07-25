// components/ui/TabBarButton.tsx
import React from "react";
import { Pressable } from "react-native";

// use any to avoid ref mismatch with React Navigation
const TabBarButton = React.forwardRef<any, any>((props, ref) => {
  return (
    <Pressable ref={ref} android_ripple={null} {...props}>
      {props.children}
    </Pressable>
  );
});

TabBarButton.displayName = "TabBarButton";

export default TabBarButton;
