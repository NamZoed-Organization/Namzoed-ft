import { CategoriesIcon, HomeIcon } from "@/components/icons/index";
import FeedTabButton from "@/components/ui/FeedTabButton";
import TabBarButton from "@/components/ui/TabBarButton";
import { Tabs, usePathname, useRouter } from "expo-router";
import { Plus, Store, Wrench } from "lucide-react-native";
import React from "react";
import { View } from "react-native";

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View className="flex-1 bg-background">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            height: 90,
            backgroundColor: "#fff",
            borderTopWidth: 0,
            position: "absolute",
            paddingTop: 8,
            paddingBottom: 12,
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
              <View className="w-16 h-16 rounded-full bg-white items-center justify-center -top-6 shadow-md shadow-black/20">
                <Plus
                  size={28}
                  stroke={focused ? "#094569" : "#9ca3af"}
                  strokeWidth={2}
                />
              </View>
            ),
          }}
        />
        {/* <Tabs.Screen
          name="live"
          options={{
            title: "Live",
            tabBarButton: (props) => (
              <TabBarButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => <LiveIcon focused={focused} />,
          }}
        /> */}
        {/* <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",
            tabBarButton: (props) => (
              <TabBarButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => (
              <ChatIcon
                focused={
                  focused ||
                  pathname.includes("/chat/") ||
                  pathname.includes("/mongoose-chat/")
                }
              />
            ),
          }}
        /> */}
        <Tabs.Screen
          name="marketplace/index"
          options={{
            title: "Marketplace",
            tabBarButton: (props) => (
              <TabBarButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => (
              <Store
                size={22}
                stroke={
                  focused ||
                  pathname.includes("/servicedetail/") ||
                  pathname.includes("/providerdetail/")
                    ? "#094569"
                    : "#9ca3af"
                }
                strokeWidth={2}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="services"
          options={{
            title: "Services",
            tabBarButton: (props) => (
              <TabBarButton {...props} android_ripple={null} />
            ),
            tabBarIcon: ({ focused }) => (
              <Wrench
                size={22}
                stroke={
                  focused ||
                  pathname.includes("/servicedetail/") ||
                  pathname.includes("/providerdetail/")
                    ? "#094569"
                    : "#9ca3af"
                }
                strokeWidth={2}
              />
            ),
          }}
        />

        <Tabs.Screen
          name="chat/[id]"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="profile/[id]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="mongoose-chat/[name]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="product/[id]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="providerdetail/[id]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="servicedetail/[slug]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="categories/[slug]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile/index"
          options={{
            href: null,
          }}
        />
         <Tabs.Screen
          name="marketplace/[id]"
          options={{
            href: null,
          }}
        />

        <Tabs.Screen
          name="messages"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}
