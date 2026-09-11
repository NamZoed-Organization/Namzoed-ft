/**
 * What stands in for something this reader may not see.
 *
 * A list can simply leave a restricted item out, but a *detail* screen
 * cannot: somebody has followed a link, a share, a search result or a
 * notification and is looking at a screen. Rendering the thing anyway is the
 * hole; rendering nothing is a screen that looks broken. So this says what
 * happened, in one sentence, and points at the only two things that change
 * it — the Safe View switch, and verifying an age.
 *
 * It never says what the content *is*. "Hidden by Safe View" is the whole
 * message; describing what is behind it would defeat the point of hiding it.
 */

import { MODAL_RADIUS } from "@/constants/theme";
import { useAppRouter } from "@/utils/navigation";
import { ChevronLeft, EyeOff } from "lucide-react-native";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RestrictedContentGate({
  onBack,
  /** Why it is hidden, so the way out is the right one. */
  reason,
}: {
  onBack: () => void;
  reason: "safeView" | "age";
}) {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();

  const body =
    reason === "safeView"
      ? "Safe View is on, and this is marked as mature. You can turn it off in Privacy settings."
      : "This is marked for adults. Confirming your date of birth is what opens it.";

  return (
    <View
      className="flex-1 bg-[#FAFBFC]"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center px-4 pb-4 pt-2">
        <TouchableOpacity onPress={onBack} className="py-1 -ml-1">
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
      </View>

      <View className="flex-1 items-center justify-center px-10">
        <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
          <EyeOff size={26} color="#9CA3AF" strokeWidth={1.8} />
        </View>
        <Text className="text-[17px] font-semibold text-gray-900 text-center">
          Hidden by Safe View
        </Text>
        <Text className="text-[15px] leading-6 text-gray-400 mt-2 text-center">
          {body}
        </Text>

        <TouchableOpacity
          onPress={() =>
            router.push(
              (reason === "safeView"
                ? "/(users)/settings?modal=privacy"
                : "/(users)/settings?modal=editBirthday") as any,
            )
          }
          activeOpacity={0.85}
          style={{
            marginTop: 20,
            backgroundColor: "#094569",
            paddingHorizontal: 20,
            paddingVertical: 11,
            borderRadius: MODAL_RADIUS,
            borderCurve: "continuous",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
            {reason === "safeView" ? "Open Privacy settings" : "Add your birthday"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
