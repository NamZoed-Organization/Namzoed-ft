// Path: app/(users)/norbu-wallet.tsx
//
// Placeholder destination for the Hamburger menu's "Norbu Wallet" entry —
// replaces the old "Norbu" tab that used to live in Home's tab row.

import TopNavbar from "@/components/ui/TopNavbar";
import { useAppRouter } from "@/utils/navigation";
import { ChevronLeft, Wallet } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function NorbuWalletScreen() {
  const router = useAppRouter();

  return (
    <View className="flex-1 bg-background">
      <TopNavbar />

      <View className="px-4 pt-3">
        <TouchableOpacity
          style={{ borderRadius: 12, borderCurve: "continuous" }}
          onPress={() => router.back()}
          activeOpacity={0.8}
          className="w-10 h-10 bg-gray-100 items-center justify-center"
        >
          <ChevronLeft size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <View className="flex-1 items-center justify-center px-8">
        <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-4">
          <Wallet size={28} color="#094569" />
        </View>
        <Text className="text-[22px] font-mbold text-gray-900 mb-1">
          Norbu Wallet
        </Text>
        <Text className="text-base font-semibold text-primary">
          Coming Soon
        </Text>
      </View>
    </View>
  );
}
