import { CategoriesIcon, HomeIcon } from "@/components/icons/index";
import FeedTabButton from "@/components/ui/FeedTabButton";
import TabBarButton from "@/components/ui/TabBarButton";
import { clamp, useResponsive } from "@/utils/responsive";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import { Tabs, usePathname } from "expo-router";
import { Plus, Store, Wrench } from "lucide-react-native";
import React from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UsersTabsLayout() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { ms, vs } = useResponsive();
  const fabSize = clamp(ms(62), 56, 70);
  const fabOffset = clamp(vs(24), 20, 30);
  const plusSize = clamp(ms(28), 24, 32);
  const sideIconSize = clamp(ms(22), 20, 26);

  return (
    <View className="flex-1 bg-background">
      <Tabs
        safeAreaInsets={{ bottom: 0 }}
        tabBar={(props) => (
          <View
            style={{
              backgroundColor: "#fff",
              borderTopWidth: 0,
              borderTopColor: "transparent",
              elevation: 0,
              shadowOpacity: 0,
              shadowColor: "transparent",
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              paddingBottom: Platform.OS === "android" ? Math.max(insets.bottom, 12) : Math.max(insets.bottom, 4) - 10,
              paddingTop: 5,
            }}
          >
            {/* Pass bottom:0 insets so BottomTabBar adds zero padding of its own */}
            <BottomTabBar
              {...props}
              insets={{ ...props.insets, bottom: 0 }}
              style={{
                borderTopWidth: 0,
                borderTopColor: "transparent",
                elevation: 0,
                shadowOpacity: 0,
                backgroundColor: "#fff",
              }}
            />
          </View>
        )}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarIndicatorStyle: { height: 0 },
          tabBarBackground: () => null,
          tabBarStyle: {
            backgroundColor: "#fff",
            borderTopWidth: 0,
            borderTopColor: "transparent",
            elevation: 0,
            shadowOpacity: 0,
            shadowColor: "transparent",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarButton: (props) => (
              <TabBarButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => <HomeIcon focused={focused} />,
          }}
        />

        <Tabs.Screen
          name="categories/index"
          options={{
            title: "Categories",
            tabBarButton: (props) => (
              <TabBarButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => (
              <CategoriesIcon
                focused={focused || pathname.includes("/categories/")}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="feed"
          options={{
            title: "Feed",
            tabBarButton: (props) => (
              <FeedTabButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => (
              <View
                className="rounded-full bg-white items-center justify-center shadow-md shadow-black/20"
                style={{
                  width: fabSize,
                  height: fabSize,
                  borderRadius: fabSize / 2,
                  top: -fabOffset,
                }}
              >
                <Plus
                  size={plusSize}
                  stroke={focused ? "#094569" : "#9ca3af"}
                  strokeWidth={2}
                />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="marketplace/index"
          options={{
            title: "Marketplace",
            tabBarButton: (props) => (
              <TabBarButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => (
              <Store
                size={sideIconSize}
                stroke={focused ? "#094569" : "#9ca3af"}
                strokeWidth={2}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="services/index"
          options={{
            title: "Services",
            tabBarButton: (props) => (
              <TabBarButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => (
              <Wrench
                size={sideIconSize}
                stroke={focused ? "#094569" : "#9ca3af"}
                strokeWidth={2}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
