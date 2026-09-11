// Path: app/(users)/norbu-wallet.tsx
//
// Placeholder destination for the Hamburger menu's "Norbu Wallet" entry —
// replaces the old "Norbu" tab that used to live in Home's tab row.

import Mascot from "@/components/ui/Mascot";
import { useAppRouter } from "@/utils/navigation";
import { ChevronLeft } from "lucide-react-native";
import React from "react";
import { StatusBar, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function NorbuWalletScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();

  return (
    // No TopNavbar here — this screen is reached from a specific card or
    // drawer entry, so its own back chevron is the only navigation it
    // needs. Without the navbar it owns the top inset itself.
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Black status-bar icons: this screen is light, and it can be pushed
          from the profile, which sets light-content for its dark cover —
          the last-mounted StatusBar wins in RN, so pin it explicitly. */}
      <StatusBar barStyle="dark-content" />

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

      {/* A wallet that does not exist yet is a promise, not an apology —
          so the mongoose is delighted about it rather than a grey icon in a
          circle being sorry (§ The mascot). */}
      <View className="flex-1 items-center justify-center px-8">
        <Mascot mood="superexcited" size={148} />
        <Text className="text-[22px] font-mbold text-gray-900 mt-4 mb-1">
          Norbu Wallet
        </Text>
        <Text className="text-base font-semibold text-primary">
          Coming Soon
        </Text>
        <Text className="text-sm text-gray-400 mt-2 text-center leading-5">
          One place for what you earn and what you spend on Namzoed.
        </Text>
      </View>
    </View>
  );
}
