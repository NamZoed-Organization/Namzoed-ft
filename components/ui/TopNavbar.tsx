// components/ui/TopNavbar.tsx
import DetectDzongkhag from "@/components/DetectDzongkhag";
import { ChatIcon } from "@/components/icons/index";
import TabBarButton from "@/components/ui/TabBarButton";
import { useUser } from "@/contexts/UserContext";
import { useRouter } from "expo-router";
import { UserCircle } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TopNavbar() {
  const router = useRouter();
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();
  const [imageLoadError, setImageLoadError] = useState(false);

  // Reset error state when avatar URL changes
  useEffect(() => {
    setImageLoadError(false);
  }, [currentUser?.avatar_url]);

  return (
    <View
      className="flex-row items-center justify-between px-4 py-6 bg-[#f8f9fa]"
      style={{ paddingTop: insets.top + 24 }}
    >
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
          onPress={() => router.push("/messages")}
          android_ripple={null}
        >
          <ChatIcon />
        </TabBarButton>

        <TabBarButton
          onPress={() => router.push("/profile")}
          android_ripple={null}
        >
          {currentUser?.avatar_url && !imageLoadError ? (
            <Image
              source={{ uri: currentUser.avatar_url }}
              className="w-[30px] h-[30px] rounded-full"
              resizeMode="cover"
              onError={() => {
                setImageLoadError(true);
              }}
            />
          ) : (
            <UserCircle size={30} stroke="#444" />
          )}
        </TabBarButton>
      </View>
    </View>
  );
}
