import DialogCard from "@/components/ui/DialogCard";
import { LIGHT_DATE_PICKER_PROPS } from "@/constants/datePicker";
import { MODAL_RADIUS } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { formatDisplayDate, getAgeFromDate, toISODate } from "@/utils/age";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { Cake, ChevronRight } from "lucide-react-native";
import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

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
  // iOS shows the wheel inline inside this card; Android has no inline
  // picker here at all (see openPicker).
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

  // Android's picker is a native dialog owned by the activity window, so
  // rendering <DateTimePicker> inline here put it behind whatever window was
  // on top — tapping the field appeared to do nothing and there was no way
  // to pick a date at all. The imperative API presents the dialog itself,
  // above everything, and stays correct however this card is mounted.
  const openPicker = () => {
    if (Platform.OS !== "android") {
      setShowPicker(true);
      return;
    }
    DateTimePickerAndroid.open({
      value: birthDate ?? eighteenYearsAgo,
      mode: "date",
      maximumDate: new Date(),
      onChange: onDateChange,
    });
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
    <DialogCard
      visible={visible}
      // No scrim dismissal: skipping is a decision with a consequence
      // (age-restricted listings stay visible), so it is a button somebody
      // presses rather than something that happens by tapping past.
      title="Confirm your age"
      message="Your date of birth lets us hide age-restricted listings. It is optional, and it never appears on your profile."
      icon={<Cake size={22} color="#094569" strokeWidth={1.9} />}
      actions={[
        { label: "Not now", style: "cancel", onPress: saving ? undefined : onSkip },
        {
          label: saving ? "Saving…" : "Save",
          loading: saving,
          onPress: saving ? undefined : handleSave,
        },
      ]}
    >
      {/* The field wears the form screens' shape: white on the card, no
          border, MODAL_RADIUS — except it sits on white here, so it takes
          the grey instead. The field is still the lighter-or-different
          surface, which is what the rule is actually about. */}
      <Pressable
        onPress={openPicker}
        disabled={saving}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#F5F5F5",
          borderRadius: MODAL_RADIUS,
          borderCurve: "continuous",
          paddingHorizontal: 14,
          minHeight: 50,
          marginTop: 16,
        }}
      >
        <Text
          style={{ fontSize: 16, color: birthDate ? "#111" : "#9CA3AF" }}
        >
          {birthDate ? formatDisplayDate(birthDate) : "Date of birth"}
        </Text>
        <ChevronRight size={18} color="#C7C7CC" />
      </Pressable>

      {showPicker && Platform.OS === "ios" && (
        <View
          style={{
            marginTop: 10,
            backgroundColor: "#F5F5F5",
            borderRadius: MODAL_RADIUS,
            borderCurve: "continuous",
            overflow: "hidden",
          }}
        >
          <DateTimePicker
            value={birthDate ?? eighteenYearsAgo}
            mode="date"
            display="spinner"
            onChange={onDateChange}
            maximumDate={new Date()}
            {...LIGHT_DATE_PICKER_PROPS}
          />
        </View>
      )}

      {error ? (
        <Text
          style={{ fontSize: 13.5, lineHeight: 18, color: "#DC2626", marginTop: 10 }}
        >
          {error}
        </Text>
      ) : null}
    </DialogCard>
  );
}
