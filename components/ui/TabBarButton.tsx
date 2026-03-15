// components/ui/TabBarButton.tsx
import React from "react";
import { TouchableOpacity } from "react-native-gesture-handler";

// use any to avoid ref mismatch with React Navigation
const TabBarButton = React.forwardRef<any, any>((props, ref) => {
  return (
    <TouchableOpacity ref={ref} activeOpacity={0.7} {...props}>
      {props.children}
    </TouchableOpacity>
  );
});

TabBarButton.displayName = "TabBarButton";

export default TabBarButton;
