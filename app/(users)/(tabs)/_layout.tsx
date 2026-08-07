import { CategoriesIcon, HomeIcon } from "@/components/icons/index";
import FeedTabButton from "@/components/ui/FeedTabButton";
import FloatingTabBar from "@/components/ui/FloatingTabBar";
import TabBarButton from "@/components/ui/TabBarButton";
import { TabBarScrollProvider } from "@/contexts/TabBarScrollContext";
import { useUser } from "@/contexts/UserContext";
import { Actions, Elements, Features, Screens, trackInteraction } from "@/lib/analyticsService";
import { clamp, useResponsive } from "@/utils/responsive";
import { isMongooseUser } from "@/utils/roleCheck";
import { Tabs, usePathname, useRouter } from "expo-router";
import { Plus, Store, Wrench } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";

const PATHNAME_TO_SCREEN: Record<string, string> = {
  "/": Screens.HOME,
  "/feed": Screens.FEED,
  "/marketplace": Screens.MARKETPLACE,
  "/categories": Screens.CATEGORIES,
  "/services": Screens.SERVICES,
};

export default function UsersTabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, isLoading: userLoading } = useUser();
  const prevPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (currentUser && isMongooseUser(currentUser.email)) {
      router.replace("/mongoose-dashboard");
    }
  }, [currentUser, userLoading, router]);

  // Track tab switches whenever the active pathname changes
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    const screen = PATHNAME_TO_SCREEN[pathname] ?? (pathname.replace(/^\//, "") || Screens.HOME);
    trackInteraction({
      userId: currentUser?.id,
      screen,
      feature: Features.TAB_SWITCH,
      element: Elements.TAB_HOME,
      action: Actions.TAP,
      metadata: { pathname },
    });
  }, [pathname, currentUser?.id]);
  const { ms } = useResponsive();
  const sideIconSize = clamp(ms(19), 18, 21);
  const plusCircleSize = clamp(ms(22), 20, 24) + 18;
  const plusIconSize = clamp(ms(22), 20, 24) + 6;

  return (
    <View className="flex-1 bg-background">
      <TabBarScrollProvider>
      <Tabs
        initialRouteName="index"
        backBehavior="history"
        safeAreaInsets={{ bottom: 0 }}
        // Pre-mount all screens so tab switching is always instant
        {...({ lazy: false } as any)}
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarActiveTintColor: "#094569",
          tabBarInactiveTintColor: "#6b7280",
          tabBarIconStyle: { height: 46 },
          animation: "none",
          tabBarBackground: () => null,
          tabBarStyle: {
            backgroundColor: "transparent",
            borderTopWidth: 0,
            borderTopColor: "transparent",
            elevation: 0,
            shadowOpacity: 0,
            shadowColor: "transparent",
          },
        }}
      >
        {/* Messages — mounted in the tab group for instant navigation; hidden from tab bar */}
        <Tabs.Screen name="messages" options={{ href: null }} />

        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarButton: (props) => (
              <TabBarButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => (
              <HomeIcon focused={focused} size={sideIconSize} />
            ),
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
            tabBarButton: (props) => (
              <FeedTabButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => (
              <View
                style={{
                  width: plusCircleSize,
                  height: plusCircleSize,
                  borderRadius: plusCircleSize / 2,
                  backgroundColor: "rgba(0, 0, 0, 0.06)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Plus
                  size={plusIconSize}
                  stroke={focused ? "#EDC06D" : "#0A0A0A"}
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
                stroke={focused ? "#EDC06D" : "#0A0A0A"}
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
                stroke={focused ? "#EDC06D" : "#0A0A0A"}
                strokeWidth={2}
              />
            ),
          }}
        />
      </Tabs>
      </TabBarScrollProvider>
    </View>
  );
}
