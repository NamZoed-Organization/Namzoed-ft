/**
 * SheetAction
 *
 * One action in a bottom sheet: a round tile with its label underneath,
 * rather than a full-width row with an icon and a description
 * (UI_STANDARD.md § Sheets).
 *
 * Every tile is the same grey circle holding the same weight and colour of
 * lucide icon — a sheet is one surface, so it gets one icon colour. Severity
 * is carried by the confirmation that follows, and a brand by its label, not
 * by a red or a green circle. A row of tinted pastel circles is what the
 * Icons rule means by "reads as a toy".
 *
 * Rows of these are left-aligned with SHEET_TILE_GAP between them — never
 * spread with `justify-between`, which stretches a row of two across the
 * whole sheet.
 */

import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

export const SHEET_TILE_GAP = 20;
export const SHEET_TILE_WIDTH = 64;
/** Pass to the lucide icon, with `size={22} strokeWidth={1.8}`. */
export const SHEET_ICON = "#111";

interface SheetActionProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export default function SheetAction({
  icon,
  label,
  onPress,
  disabled,
}: SheetActionProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={{
        width: SHEET_TILE_WIDTH,
        alignItems: "center",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 999,
          borderCurve: "continuous",
          backgroundColor: "#F5F5F5",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <Text
        className="mt-2 text-[13px] font-medium text-[#111]"
        numberOfLines={1}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
