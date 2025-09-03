// components/ui/TopNavbar.tsx
import DetectDzongkhag from "@/components/DetectDzongkhag";
import {
  ChatIcon,
} from "@/components/icons/index";
import TabBarButton from "@/components/ui/TabBarButton";
import { useRouter } from "expo-router";
import { UserCircle } from "lucide-react-native";
import { Image, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export default function TopNavbar() {
  const router = useRouter();

  return (
    <SafeAreaView>
      <View className="flex-row items-center justify-between px-4 pt-6 bg-background">
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
            <ChatIcon/>
          </TabBarButton>

          <TabBarButton
            onPress={() => router.push("/profile")}
            android_ripple={null}
          >
            <UserCircle size={30} stroke="#444" />
          </TabBarButton>
        </View>
      </View>
    </SafeAreaView>
  );
}
