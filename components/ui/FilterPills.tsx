/**
 * A row of filter pills (§ Tabs and pills).
 *
 * One component rather than a copy per screen: the Messages tab and the
 * Setlog tab sit one tap apart and their filter rows are directly above one
 * another, so two hand-maintained versions would drift by two points of
 * padding in a way that shows in a single screenshot.
 *
 * White on the grey, brand blue filled when on, one always selected. A
 * scroller rather than a fixed row — four labels at this size are within a
 * few points of the width on a small phone, and past it at a large text
 * size, and a filter you cannot reach is worse than one you have to nudge.
 */

import * as Haptics from "expo-haptics";
import React from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";

export interface FilterPillOption<T extends string> {
  value: T;
  label: string;
}

export default function FilterPills<T extends string>({
  options,
  value,
  onChange,
  inset = 16,
  paddingBottom = 12,
}: {
  options: FilterPillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  inset?: number;
  paddingBottom?: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      style={{ flexGrow: 0, paddingBottom }}
      contentContainerStyle={{
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: inset,
      }}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            activeOpacity={0.7}
            onPress={() => {
              // Tapping the live pill is a no-op, so it neither buzzes nor
              // re-renders.
              if (active) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(option.value);
            }}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: active ? "#094569" : "#fff",
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: active ? "#fff" : "#6B7280",
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
