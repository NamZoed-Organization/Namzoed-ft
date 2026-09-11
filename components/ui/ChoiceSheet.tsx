/**
 * One choice, as the app's sheet (§ Sheets).
 *
 * A labelled group, one row per option, a check on the live one — the shape
 * every "pick one of these" in the app uses. It lived inside the Setlog
 * settings screen until the same picker was needed by Settings ›
 * Notifications, which sets the same hourly window from a second door: two
 * copies of a sheet is how the check ends up on the left in one of them.
 */

import BottomSheetModal from "@/components/modals/BottomSheetModal";
import { Check } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ChoiceSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeight="62%">
      {(close) => (
        <View style={{ paddingHorizontal: 12, paddingTop: 4 }}>
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: "#111827",
              textAlign: "center",
              paddingBottom: 14,
            }}
          >
            {title}
          </Text>
          <View
            style={{
              backgroundColor: "#fff",
              borderRadius: 18,
              borderCurve: "continuous",
              overflow: "hidden",
            }}
          >
            {options.map((option, i) => (
              <TouchableOpacity
                key={option.value}
                activeOpacity={0.7}
                onPress={() => {
                  onSelect(option.value);
                  close();
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                {i > 0 && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 16,
                      right: 0,
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: "#f0f0f0",
                    }}
                  />
                )}
                <Text style={{ fontSize: 17, color: "#111" }}>{option.label}</Text>
                {option.value === selected && (
                  <Check size={19} color="#0369A1" strokeWidth={2.2} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </BottomSheetModal>
  );
}
