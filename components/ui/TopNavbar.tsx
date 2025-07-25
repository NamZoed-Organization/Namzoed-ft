// components/ui/TopNavbar.tsx

import TabBarButton from "@/components/ui/TabBarButton";
import { useRouter } from "expo-router";
import { MapPin, UserCircle } from "lucide-react-native";
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

        <View className="flex-row items-center justify-between gap-10">
          <TabBarButton
            onPress={() => console.log("Dzongkhag tapped")}
            android_ripple={null}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <MapPin size={18} stroke="#666" />
            <Text className="text-sm font-regular text-gray-600 ml-1">
              Dzongkhag
            </Text>
          </TabBarButton>

          <TabBarButton onPress={() => router.push("/profile")} android_ripple={null}>
            <UserCircle size={30} stroke="#444" />
          </TabBarButton>
        </View>
      </View>
    </SafeAreaView>
  );
}
