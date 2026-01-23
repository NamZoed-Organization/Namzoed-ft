// components/ui/TopNavbar.tsx
import DetectDzongkhag from "@/components/DetectDzongkhag";
import {
  ChatIcon,
} from "@/components/icons/index";
import TabBarButton from "@/components/ui/TabBarButton";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "expo-router";
import { UserCircle } from "lucide-react-native";
import React from "react";
import { Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export default function TopNavbar() {
  const router = useRouter();
  const { currentUser } = useUser();

  return (
    <SafeAreaView>
      <View className="flex-row items-center justify-between px-4 py-6 bg-background">
        <View className="flex-row items-center">
          <Image
            source={require("@/assets/images/logo.png")}
            className="w-10 h-10 mr-2"
            resizeMode="contain"
          />
          <Text className="font-mbold text-xl text-primary">
            Nam<Text className="text-secondary">Zoed</Text>
          </Text>
        </View>

        <View className="flex-row items-center gap-4">
          <DetectDzongkhag />
          
          <TabBarButton
            onPress={() => router.push("/(users)/messages")}
            android_ripple={null}
          >
            <ChatIcon/>
          </TabBarButton>

          <TabBarButton
            onPress={() => router.push("/(users)/profile")}
            android_ripple={null}
          >
            {currentUser?.avatar_url ? (
              <Image
                source={{ uri: currentUser.avatar_url }}
                className="w-[30px] h-[30px] rounded-full"
                resizeMode="cover"
              />
            ) : (
              <UserCircle size={30} stroke="#444" />
            )}
          </TabBarButton>
        </View>
      </View>
    </SafeAreaView>
  );
}
