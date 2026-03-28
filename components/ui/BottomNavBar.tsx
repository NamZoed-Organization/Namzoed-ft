import { CategoriesIcon, HomeIcon } from "@/components/icons/index";
import { clamp, useResponsive } from "@/utils/responsive";
import { useAppRouter } from "@/utils/navigation";
import { usePathname } from "expo-router";
import { Plus, Store, Wrench } from "lucide-react-native";
import React from "react";
import { Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function BottomNavBar() {
  const router = useAppRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { ms, vs } = useResponsive();

  const fabSize = clamp(ms(62), 56, 70);
  const fabOffset = clamp(vs(24), 20, 30);
  const plusSize = clamp(ms(28), 24, 32);
  const sideIconSize = clamp(ms(22), 20, 26);

  const paddingBottom =
    Platform.OS === "android"
      ? Math.max(insets.bottom - 10, 4)
      : Math.max(insets.bottom, 4) - 10;

  const tabs = [
    {
      key: "index",
      href: "/",
      icon: (focused: boolean) => <HomeIcon focused={focused} />,
      isFab: false,
    },
    {
      key: "categories",
      href: "/categories",
      icon: (focused: boolean) => (
        <CategoriesIcon focused={focused || pathname.includes("/categories/")} />
      ),
      isFab: false,
    },
    {
      key: "feed",
      href: "/feed",
      icon: (focused: boolean) => (
        <View
          style={{
            width: fabSize,
            height: fabSize,
            borderRadius: fabSize / 2,
            top: -fabOffset,
            backgroundColor: "#fff",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#000",
            shadowOpacity: 0.2,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}
        >
          <Plus
            size={plusSize}
            stroke={focused ? "#094569" : "#9ca3af"}
            strokeWidth={2}
          />
        </View>
      ),
      isFab: true,
    },
    {
      key: "marketplace",
      href: "/marketplace",
      icon: (focused: boolean) => (
        <Store
          size={sideIconSize}
          stroke={focused ? "#094569" : "#9ca3af"}
          strokeWidth={2}
        />
      ),
      isFab: false,
    },
    {
      key: "services",
      href: "/services",
      icon: (focused: boolean) => (
        <Wrench
          size={sideIconSize}
          stroke={focused ? "#094569" : "#9ca3af"}
          strokeWidth={2}
        />
      ),
      isFab: false,
    },
  ];

  return (
    <View
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderTopWidth: 0,
        elevation: 0,
        shadowOpacity: 0,
        paddingBottom,
        paddingTop: 5,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        {tabs.map((tab) => {
          const focused = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Pressable
              key={tab.key}
              android_ripple={null}
              onPress={() => router.push(tab.href as any)}
              style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            >
              {tab.icon(focused)}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
