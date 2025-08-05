import { CategoriesIcon, ChatIcon, HomeIcon } from "@/components/icons/index";
import TabBarButton from "@/components/ui/TabBarButton";
import { Tabs, useRouter } from "expo-router";
import { ShoppingCart, Wrench } from "lucide-react-native";
import { View } from "react-native";

export default function TabLayout() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            height: 70,
            backgroundColor: "#fff",
            borderTopWidth: 0,
            position: "absolute",
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarButton: (props) => <TabBarButton {...props} android_ripple={null} />,
            tabBarIcon: ({ focused }) => <HomeIcon focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="categories/index"
          options={{
            title: "Categories",
            tabBarButton: (props) => <TabBarButton {...props} android_ripple={null} />,
            tabBarIcon: ({ focused }) => <CategoriesIcon focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            title: "Cart",
            tabBarButton: (props) => <TabBarButton {...props} android_ripple={null} />,
            tabBarIcon: ({ focused }) => (
              <View className="w-16 h-16 rounded-full bg-white items-center justify-center -top-6 shadow-md shadow-black/20">
                <ShoppingCart
                  size={28}
                  stroke={focused ? "#094569" : "#9ca3af"}
                  strokeWidth={2}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",
            tabBarButton: (props) => <TabBarButton {...props} android_ripple={null} />,
            tabBarIcon: ({ focused }) => <ChatIcon focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="services"
          options={{
            title: "Services",
            tabBarButton: (props) => <TabBarButton {...props} android_ripple={null} />,
            tabBarIcon: ({ focused }) => (
              <Wrench size={22} stroke={focused ? "#094569" : "#9ca3af"} strokeWidth={2} />
            ),
          }}
        />
        <Tabs.Screen
          name="notif_counter"
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
          name="categories/[slug]"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </View>
  );
}