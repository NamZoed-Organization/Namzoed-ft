/**
 * The parts a listing form is made of, so the two of them cannot drift.
 *
 * Putting a product on the catalogue and putting a thing on the marketplace
 * are the same act with different questions, and they were previously two
 * modals that agreed on nothing: one had a full-width green button at the
 * bottom, the other a header action; one bordered its fields, the other
 * didn't; one used a `<Picker>`. Everything here is § Form screens, once:
 * grey ground, white fields with no borders, `text-xl` input, the primary
 * action as the header's only text action, and a choice as a row that opens
 * a sheet rather than an inline picker that cannot match on both platforms.
 *
 * Nothing here knows what a product or a listing is. That is the point —
 * the two screens supply the questions, this supplies the answers to "what
 * does a form look like in this app".
 */

import ChoiceSheet from "@/components/ui/ChoiceSheet";
import ImagePickerSheet from "@/components/ui/ImagePickerSheet";
import CircularLoader from "@/components/ui/CircularLoader";
import { MODAL_RADIUS } from "@/constants/theme";
import * as ImagePicker from "expo-image-picker";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react-native";
import React from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** § Form screens — the ground these sit on, lighter than the settings grey. */
export const FORM_BACKGROUND = "#F9FAFB";
const ACTION_ACTIVE = "#0369A1";
const ACTION_IDLE = "#93C5FD";

// ── The screen ──────────────────────────────────────────────────────────

export function FormScreen({
  title,
  actionLabel,
  onBack,
  onAction,
  canAct,
  busy,
  children,
}: {
  title: string;
  actionLabel: string;
  onBack: () => void;
  onAction: () => void;
  /** "There is something to save" — pale and inert until there is. */
  canAct: boolean;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: FORM_BACKGROUND, paddingTop: insets.top }}>
      {/* Forced, not inherited: the screen underneath may have set
          light-content, and RN merges StatusBar props last-mounted-wins. */}
      <StatusBar barStyle="dark-content" />

      <View className="flex-row items-center justify-between px-4 pb-4 pt-2">
        <TouchableOpacity onPress={onBack} className="py-1 -ml-1" disabled={busy}>
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>

        {/* Absolutely centred against the row's full height — a bare
            absolute Text drifts against its sibling buttons. */}
        <View
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
          pointerEvents="none"
          className="items-center justify-center"
        >
          <Text className="text-xl font-medium text-gray-900">{title}</Text>
        </View>

        <TouchableOpacity
          onPress={onAction}
          disabled={!canAct || busy}
          className="py-1"
        >
          {busy ? (
            <CircularLoader color="#094569" size="small" />
          ) : (
            <Text
              className="text-xl font-medium"
              style={{ color: canAct ? ACTION_ACTIVE : ACTION_IDLE }}
            >
              {actionLabel}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: insets.bottom + 48,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Fields ──────────────────────────────────────────────────────────────

/** A field, on the grey. No label above it (§ Form screens) — the
 *  placeholder carries it — and no border: white against grey is the
 *  separation. */
export function Field({
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  maxLength,
  /** Shown bottom-right *inside* the field, never above it. */
  counter,
  prefix,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric";
  maxLength?: number;
  counter?: boolean;
  /** A currency mark, sitting in the field rather than in the placeholder. */
  prefix?: string;
}) {
  return (
    <View
      style={{
        position: "relative",
        marginTop: 12,
        backgroundColor: "#fff",
        borderRadius: MODAL_RADIUS,
        borderCurve: "continuous",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        {prefix != null && (
          <Text
            className="text-xl text-gray-500"
            style={{ paddingLeft: 16, paddingTop: 14 }}
          >
            {prefix}
          </Text>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline={multiline}
          keyboardType={keyboardType}
          maxLength={maxLength}
          className="text-xl text-gray-900"
          style={{
            flex: 1,
            paddingHorizontal: prefix != null ? 8 : 16,
            paddingTop: 14,
            // Room for the counter, so the last line cannot run under it.
            paddingBottom: counter ? 34 : 14,
            minHeight: multiline ? 120 : undefined,
            textAlignVertical: multiline ? "top" : "center",
          }}
        />
      </View>
      {counter && maxLength != null && (
        <Text
          className="text-xl text-gray-400"
          style={{ position: "absolute", right: 12, bottom: 10 }}
        >
          {maxLength - value.length}
        </Text>
      )}
    </View>
  );
}

/** A choice is a row that opens a sheet — never an inline `<Picker>`, which
 *  cannot be made to match on both platforms (§ Multi-field screens). */
export function ChoiceField({
  value,
  placeholder,
  options,
  title,
  onSelect,
}: {
  value: string | null;
  placeholder: string;
  options: { value: string; label: string }[];
  title: string;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const label = options.find((o) => o.value === value)?.label ?? null;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOpen(true)}
        style={{
          marginTop: 12,
          backgroundColor: "#fff",
          borderRadius: MODAL_RADIUS,
          borderCurve: "continuous",
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        <Text
          className="text-xl flex-1"
          style={{ color: label ? "#111827" : "#9CA3AF" }}
          numberOfLines={1}
        >
          {label ?? placeholder}
        </Text>
        <ChevronRight size={20} color="#9CA3AF" />
      </TouchableOpacity>

      <ChoiceSheet
        visible={open}
        title={title}
        options={options}
        selected={value ?? ""}
        onSelect={(v) => onSelect(v)}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

/**
 * The pictures.
 *
 * First one is the cover and says so, because that is the only thing about
 * this field somebody can get wrong without noticing — every grid in the app
 * shows image one and nothing else.
 */
export function PhotoField({
  uris,
  max,
  onAdd,
  onRemove,
}: {
  uris: string[];
  max: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
}) {
  return (
    <View
      style={{
        marginTop: 12,
        backgroundColor: "#fff",
        borderRadius: MODAL_RADIUS,
        borderCurve: "continuous",
        padding: 12,
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {uris.map((uri, index) => (
          <View key={`${uri}-${index}`} style={{ marginRight: 10 }}>
            <Image
              source={{ uri }}
              style={{ width: 84, height: 84, borderRadius: 10 }}
            />
            {index === 0 && (
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  bottom: 0,
                  right: 0,
                  backgroundColor: "rgba(17,24,39,0.6)",
                  borderBottomLeftRadius: 10,
                  borderBottomRightRadius: 10,
                  borderCurve: "continuous",
                  paddingVertical: 3,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
                  Cover
                </Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => onRemove(index)}
              hitSlop={8}
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                width: 22,
                height: 22,
                borderRadius: 11,
                borderCurve: "continuous",
                backgroundColor: "#111827",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={13} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        ))}

        {uris.length < max && (
          <TouchableOpacity
            onPress={onAdd}
            activeOpacity={0.8}
            style={{
              width: 84,
              height: 84,
              borderRadius: 10,
              borderCurve: "continuous",
              borderWidth: 1.5,
              borderColor: "#E5E7EB",
              borderStyle: "dashed",
              backgroundColor: "#F9FAFB",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={22} color="#9CA3AF" strokeWidth={2} />
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * Camera or library, then one picture back.
 *
 * Both forms need exactly this and nothing more, so it lives here rather
 * than being written twice with two different permission messages. Failure
 * is silent on purpose: a denied permission is already an OS dialog the
 * person just answered, and a second alert restating it is the app arguing.
 */
export function PhotoPicker({
  visible,
  onClose,
  onPicked,
}: {
  visible: boolean;
  onClose: () => void;
  onPicked: (uri: string) => void;
}) {
  const take = async (from: "camera" | "library") => {
    try {
      const permission =
        from === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;

      const result =
        from === "camera"
          ? await ImagePicker.launchCameraAsync({ quality: 0.9 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.9,
            });
      if (!result.canceled && result.assets?.[0]) onPicked(result.assets[0].uri);
    } catch {
      // Nothing to say that the OS has not already said.
    }
  };

  return (
    <ImagePickerSheet
      visible={visible}
      onClose={onClose}
      onCameraPress={() => take("camera")}
      onGalleryPress={() => take("library")}
    />
  );
}

/** Explanatory copy goes *below* what it explains, never above it as a
 *  label (§ Multi-field screens). */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-base text-gray-400 mt-3 px-1 leading-5">{children}</Text>
  );
}
