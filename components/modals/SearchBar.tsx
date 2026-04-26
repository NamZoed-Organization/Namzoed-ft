import { useAppRouter } from "@/utils/navigation";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";

/**
 * Trigger button that navigates to the global search screen.
 * The value/onChangeText props are kept for API compatibility with parent
 * components that manage their own local filter state.
 */
export default function SearchBar({
  value,
  onChangeText,
  placeholder = "Search",
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  const router = useAppRouter();

  return (
    <TouchableOpacity
      className="flex-row items-center rounded-full px-4 py-2 border border-gray-200"
      activeOpacity={0.9}
      onPress={() => router.push("/(users)/search" as any)}
    >
      <Ionicons name="search" size={18} color="#888" style={{ marginRight: 8 }} />
      <TextInput
        pointerEvents="none"
        editable={false}
        className="flex-1 font-regular text-sm text-gray-800"
        style={{ paddingVertical: 0 }}
        placeholder={placeholder}
        placeholderTextColor="#888"
        value={value}
      />
    </TouchableOpacity>
  );
}
