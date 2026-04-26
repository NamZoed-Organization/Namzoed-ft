import { CategoriesIcon, HomeIcon } from "@/components/icons/index";
import FeedTabButton from "@/components/ui/FeedTabButton";
import TabBarButton from "@/components/ui/TabBarButton";
import { useUser } from "@/contexts/UserContext";
import { clamp, useResponsive } from "@/utils/responsive";
import { isMongooseUser } from "@/utils/roleCheck";
import { BottomTabBar } from "@react-navigation/bottom-tabs";
import { Tabs, usePathname, useRouter } from "expo-router";
import { Plus, Store, Wrench } from "lucide-react-native";
import React, { useEffect } from "react";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function UsersTabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, isLoading: userLoading } = useUser();

  useEffect(() => {
    if (userLoading) return;
    if (currentUser && isMongooseUser(currentUser.email)) {
      router.replace("/mongoose-dashboard");
    }
  }, [currentUser, userLoading, router]);
  const insets = useSafeAreaInsets();
  const { ms, vs } = useResponsive();
  const fabSize = clamp(ms(62), 56, 70);
  const fabOffset = clamp(vs(24), 20, 30);
  const plusSize = clamp(ms(28), 24, 32);
  const sideIconSize = clamp(ms(22), 20, 24);

  // Same pattern as MongooseWorkerNavBar — full insets.bottom with platform minimum,
  // no division. Ensures the bar always clears the Android nav bar and iOS home indicator.
  const tabBarBottomPad = Platform.OS === "android"
    ? Math.max(insets.bottom, 12)
    : Math.max(insets.bottom, 8);

  return (
    <View className="flex-1 bg-background">
      <Tabs
        initialRouteName="index"
        backBehavior="history"
        safeAreaInsets={{ bottom: 0 }}
        // Pre-mount all screens so tab switching is always instant
        {...({ lazy: false } as any)}
        tabBar={(props) => (
          <View
            style={{
              backgroundColor: "#fff",
              borderTopWidth: 0,
              borderTopColor: "transparent",
              elevation: Platform.OS === "android" ? 8 : 0,
              shadowOpacity: 0,
              shadowColor: "transparent",
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              width: "100%",
              zIndex: 100,
              paddingBottom: tabBarBottomPad,
              paddingTop: 5,
            }}
          >
            {/* Pass bottom:0 insets so BottomTabBar adds zero padding of its own */}
            <BottomTabBar
              {...props}
              insets={{ ...props.insets, bottom: 0 }}
              style={{
                width: "100%",
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
          tabBarShowLabel: true,
          tabBarActiveTintColor: "#094569",
          tabBarInactiveTintColor: "#6b7280",
          tabBarLabelStyle: { fontSize: 10, fontWeight: "500", marginTop: 2 },
          animation: "none",
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
        {/* Messages — mounted in the tab group for instant navigation; hidden from tab bar */}
        <Tabs.Screen
          name="messages"
          options={{ href: null }}
        />

        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarButton: (props) => (
              <TabBarButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => <HomeIcon focused={focused} size={sideIconSize} />,
          }}
        />

        <Tabs.Screen
          name="categories/index"
          options={{
            title: "Shop",
            tabBarButton: (props) => (
              <TabBarButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => (
              <CategoriesIcon
                focused={focused || pathname.includes("/categories/")}
                size={sideIconSize}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="feed"
          options={{
            title: "Feed",
            tabBarShowLabel: false,
            tabBarLabel: () => null,
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
                  stroke={focused ? "#EDC06D" : "#6b7280"}
                  strokeWidth={2}
                />
              </View>
            ),
          }}
        />

        <Tabs.Screen
          name="marketplace/index"
          options={{
            title: "Market",
            tabBarButton: (props) => (
              <TabBarButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => (
              <Store
                size={sideIconSize}
                stroke={focused ? "#EDC06D" : "#6b7280"}
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
                stroke={focused ? "#EDC06D" : "#6b7280"}
                strokeWidth={2}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
