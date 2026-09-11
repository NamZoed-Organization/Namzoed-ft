/**
 * VerifyToSellNotice
 *
 * Shown instead of the product form when someone without a verified work
 * profile tries to list on the shopping catalogue.
 *
 * The tone matters. This is not a rejection — the person is being pointed at
 * the surface that was built for them. Shopping is for licensed shops;
 * selling your own used things is what the marketplace is for, and most
 * people opening this form want the second one without knowing there's a
 * distinction. So it leads with the alternative, not with the refusal.
 *
 * The database enforces the same rule on insert
 * (`enforce_verified_seller_for_products`); this exists so nobody discovers
 * it after filling in a form.
 */

import { MODAL_RADIUS } from "@/constants/theme";
import { useAppRouter } from "@/utils/navigation";
import { ChevronLeft, ShoppingBag, Store } from "lucide-react-native";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface VerifyToSellNoticeProps {
  visible: boolean;
  onClose: () => void;
}

export default function VerifyToSellNotice({ visible, onClose }: VerifyToSellNoticeProps) {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();

  const go = (path: string) => {
    onClose();
    router.push(path as any);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View
        className="flex-1 bg-gray-50"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        <View className="flex-row items-center px-4 pb-4 pt-2">
          <TouchableOpacity onPress={onClose} className="py-1 -ml-1">
            <ChevronLeft size={28} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={{ paddingHorizontal: 24 }}>
          <Text className="text-xl font-medium text-gray-900">
            Where should this go?
          </Text>
          <Text className="text-base text-gray-400 mt-2">
            Shopping is for registered shops with a business license. Anything
            you own and want to pass on belongs in the marketplace.
          </Text>

          <TouchableOpacity
            onPress={() => go("/(users)/(tabs)/marketplace")}
            activeOpacity={0.7}
            style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", marginTop: 20 }}
            className="bg-white px-4 py-4 flex-row items-center"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                borderCurve: "continuous",
                backgroundColor: "#F5F5F5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShoppingBag size={20} color="#111" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text className="text-[15.5px] font-semibold text-[#111]">
                List in the marketplace
              </Text>
              <Text className="text-[13px] text-gray-400 mt-0.5">
                Second hand, rent, swap or free — no verification needed
              </Text>
            </View>
          </TouchableOpacity>

          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: "#f0f0f0",
              marginVertical: 20,
            }}
          />

          <TouchableOpacity
            onPress={() => go("/(users)/profile/work")}
            activeOpacity={0.7}
            style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous" }}
            className="bg-white px-4 py-4 flex-row items-center"
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                borderCurve: "continuous",
                backgroundColor: "#F5F5F5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Store size={20} color="#111" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text className="text-[15.5px] font-semibold text-[#111]">
                Verify your work profile
              </Text>
              <Text className="text-[13px] text-gray-400 mt-0.5">
                Upload your business license to open a shop
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
