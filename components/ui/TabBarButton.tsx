// components/ui/TabBarButton.tsx
import { PlatformPressable } from "@react-navigation/elements";
import React from "react";

// Match React Navigation default tab button (PlatformPressable) so flex:1 / alignment stay correct.
// RNGH TouchableOpacity missed presses on iOS; plain Pressable + style callback broke horizontal flex.
const TabBarButton = React.forwardRef<any, any>((props, ref) => (
  <PlatformPressable ref={ref} {...props} />
));

TabBarButton.displayName = "TabBarButton";

export default TabBarButton;
