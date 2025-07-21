import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarShowLabel: false,
        tabBarStyle: {
          height: 70,
          backgroundColor: "#fff",
          borderTopWidth: 0,
        },
        header: () => (
          <SafeAreaView className="bg-background">
            <View className="flex-row items-center justify-between px-4 py-3 bg-background">
              <View className="flex-row items-center">
                <Image
                  source={require("@/assets/images/logo.png")}
                  className="w-8 h-8 mr-2"
                  resizeMode="contain"
                />
                <Text className="font-mbold text-lg text-primary">NamZoed</Text>
              </View>

              <View className="flex-row items-center gap-3">
                <View className="flex-row items-center">
                  <Ionicons name="location-outline" size={18} color="#666" />
                  <Text className="text-sm font-regular text-gray-600 ml-1">
                    Dzongkhag
                  </Text>
                </View>
                <FontAwesome5 name="user-circle" size={22} color="#444" />
              </View>
            </View>
          </SafeAreaView>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <View className="items-center justify-center">
              <Ionicons name="home-outline" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Categories",
          tabBarIcon: ({ color }) => (
            <View className="items-center justify-center">
              <MaterialIcons name="apps" size={24} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Cart",
          tabBarIcon: () => (
            <View className="w-16 h-16 rounded-full bg-white items-center justify-center -top-6 shadow-md shadow-black/20">
              <Ionicons name="cart-outline" size={28} color="#000" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => (
            <View className="items-center justify-center">
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={24}
                color={color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: "magic",
          tabBarIcon: ({ color }) => (
            <View className="items-center justify-center">
              <FontAwesome5 name="magic" size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="notif_counter"
        options={{
          href: null, // hides from the navigator
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          href: null, // hides from the navigator
        }}
      />
    </Tabs>
  );
}
