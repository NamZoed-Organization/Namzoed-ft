import CircularLoader from "@/components/ui/CircularLoader";
import { supabase } from "@/lib/supabase";
import { formatDisplayDate, getAgeFromDate, toISODate } from "@/utils/age";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

interface DateOfBirthPromptProps {
  visible: boolean;
  userId: string;
  /** Called after the date of birth has been saved successfully. */
  onSaved: (birthDate: string) => void;
  /** Called when the user chooses not to provide a date of birth. */
  onSkip: () => void;
}

/**
 * Optional date-of-birth collection for existing users who signed up before
 * we started collecting it. Providing a birth date lets us apply age-related
 * content restrictions, but the user can skip it and continue into the app.
 */
export default function DateOfBirthPrompt({
  visible,
  userId,
  onSaved,
  onSkip,
}: DateOfBirthPromptProps) {
  // Default the picker to 18 years ago so the spinner opens at a sensible spot.
  const eighteenYearsAgo = new Date();
  eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);

  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(Platform.OS === "ios");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDateChange = (_event: any, selected?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (selected) {
      setBirthDate(selected);
      setError(null);
    }
  };

  const handleSave = async () => {
    if (!birthDate) {
      setError("Please select your date of birth.");
      return;
    }

    const age = getAgeFromDate(birthDate);
    if (age < 0 || age > 120) {
      setError("Please select a valid date of birth.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const iso = toISODate(birthDate);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          birth_date: iso,
          age_verified: true,
          age_verification_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        setError(updateError.message || "Failed to save your date of birth.");
        return;
      }

      onSaved(iso);
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <View className="flex-1 bg-black/45 justify-center px-6">
        <View
          style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-white p-5">
          <View className="flex-row items-center mb-3">
            <Ionicons name="calendar" size={24} color="#094569" />
            <Text className="font-mbold text-gray-900 text-xl ml-2">
              Confirm Your Age
            </Text>
          </View>

          <Text className="text-sm text-gray-600 mb-4 leading-5">
            Sharing your date of birth lets us apply age-related content
            restrictions — for example, hiding adult health items from users
            under 18. This is optional; you can skip it and continue.
          </Text>

          <Pressable
            style={{ borderRadius: 8, borderCurve: "continuous" }}
            onPress={() => setShowPicker(true)}
            disabled={saving}
            className="border border-gray-300 px-4 py-3 flex-row items-center justify-between bg-white"
          >
            <Text
              className={`text-base ${birthDate ? "text-gray-800" : "text-gray-400"}`}
            >
              {birthDate ? formatDisplayDate(birthDate) : "Select date of birth"}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#6b7280" />
          </Pressable>

          {showPicker && (
            <DateTimePicker
              value={birthDate ?? eighteenYearsAgo}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}

          {error && (
            <Text className="text-red-600 text-sm mt-2">{error}</Text>
          )}

          <Pressable
            onPress={handleSave}
            disabled={saving}
            className={`mt-4 py-3 rounded-xl items-center ${
              saving ? "bg-gray-300" : "bg-primary"
            }`}
          >
            {saving ? (
              <CircularLoader color="#fff" />
            ) : (
              <Text className="text-white font-msemibold">Save & Continue</Text>
            )}
          </Pressable>

          <Pressable onPress={onSkip} disabled={saving} className="mt-2 py-3 items-center">
            <Text className="text-gray-500 font-msemibold">Skip for now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
