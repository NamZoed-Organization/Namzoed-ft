// components/ui/TabBarButton.tsx
import React from "react";
import { Pressable } from "react-native";

// Use RN Pressable instead of PlatformPressable to eliminate the ~100-150ms
// built-in press delay that PlatformPressable adds (ripple/highlight timing).
// No default style — callers / BottomTabBar pass `flex: 1` through `style` as
// needed. Setting it here would break content-sized usages like TopNavbar
// where each button should size to its icon, not expand.
const TabBarButton = React.forwardRef<any, any>((props, ref) => (
  <Pressable ref={ref} {...props} />
));

TabBarButton.displayName = "TabBarButton";

export default TabBarButton;
