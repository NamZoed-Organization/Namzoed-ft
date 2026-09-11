/**
 * EditBusinessType
 *
 * Which of the service categories this business belongs to. It is not just a
 * label: the type decides which sections the business page shows — a taxi
 * service has no Products tab, a restaurant has a Menu — so changing it
 * reshapes the page, and it earns a screen rather than a sheet you can
 * fat-finger closed.
 *
 * A short list, so the options render inline as a white block of selectable
 * rows with a Check (UI_STANDARD.md § Choice fields), and Save commits —
 * tapping a row only selects. The sheet this replaced saved on tap, which
 * meant a mis-tap silently changed the shape of the profile with nothing to
 * undo it.
 *
 * Presentational, like every page in the Edit business stack: the ground and
 * the bottom inset belong to the layer that slides it.
 */

import CircularLoader from "@/components/ui/CircularLoader";
import { MODAL_RADIUS } from "@/constants/theme";
import { serviceCategories } from "@/data/servicecategory";
import { Check, ChevronLeft } from "lucide-react-native";
import React, { useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

interface EditBusinessTypeProps {
  /** The category slug currently saved, or null if never set. */
  value: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (slug: string) => void;
}

export default function EditBusinessType({
  value,
  saving,
  onClose,
  onSave,
}: EditBusinessTypeProps) {
  const [selected, setSelected] = useState<string | null>(value);
  const changed = selected != null && selected !== value;

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-4 pb-4 pt-2">
        <TouchableOpacity onPress={onClose} className="py-1 -ml-1">
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
          pointerEvents="none"
        >
          <Text className="text-xl font-medium text-gray-900">Business type</Text>
        </View>
        <TouchableOpacity
          onPress={() => selected && onSave(selected)}
          disabled={saving || !changed}
          className="py-1"
        >
          {saving ? (
            <CircularLoader color="#094569" size="small" />
          ) : (
            <Text className="text-xl font-medium" style={{ color: changed ? "#0369A1" : "#93C5FD" }}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 32 }}>
        <View
          style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", overflow: "hidden" }}
          className="bg-white"
        >
          {serviceCategories.map((category, index) => (
            <TouchableOpacity
              key={category.id}
              onPress={() => setSelected(category.slug)}
              activeOpacity={0.7}
              className={`px-4 py-4 flex-row items-center ${index > 0 ? "border-t border-gray-100" : ""}`}
            >
              <Text className="text-xl text-gray-900 flex-1">{category.name}</Text>
              {selected === category.slug && <Check size={20} color="#0369A1" />}
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-base text-gray-400 mt-3 px-1">
          This decides which sections your business page shows. Your services and products stay
          where they are.
        </Text>
      </ScrollView>
    </View>
  );
}
