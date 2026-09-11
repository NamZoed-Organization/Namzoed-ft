/**
 * The shell every auth screen wears: sign in, sign up, forgot password.
 *
 * They are three views of one moment — "prove who you are" — and they used
 * to be three separate designs: one on white, one on the app background,
 * each with its own back button in its own place, its own field styling and
 * its own icon set. Sitting one tap apart, that drift is visible in a
 * single screenshot.
 *
 * They follow § Form screens, which is the closest thing in the standard to
 * what they are: **grey ground, white fields**. The field being lighter
 * than the page is the whole separation — no borders, and no white screen
 * with grey fields, which is the inverse these screens used to have.
 *
 * ## The one departure, stated on purpose
 *
 * § Header says the primary action lives in the header and never as a
 * full-width button at the foot. That rule is about content screens, where
 * a header exists and the content is the point. An auth screen has no
 * header, no content, and exactly one thing to do — putting "Sign in" in a
 * corner as text would be hiding the only reason the screen exists. So here
 * the primary action is a full-width filled button, and it is still **one**
 * filled thing per screen, which is the rule underneath that one.
 */

import { MODAL_RADIUS } from "@/constants/theme";
import CircularLoader from "@/components/ui/CircularLoader";
import { Check, ChevronLeft } from "lucide-react-native";
import React from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** § Grounds — the form-screen grey, behind the status bar as well. */
export const AUTH_BACKGROUND = "#F9FAFB";
export const AUTH_INSET = 24;

/** § Colour — the brand, and the action blue beside it. */
const BRAND = "#094569";
const ACTION = "#0369A1";

export function AuthScreen({
  children,
  onBack,
  footer,
}: {
  children: React.ReactNode;
  /** Present on the screens that were pushed onto sign-in. */
  onBack?: () => void;
  /** Pinned under the scroll area — the "no account? sign up" line. */
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: AUTH_BACKGROUND }}>
      {/* A screen mounted underneath may have set light-content, and RN
          merges StatusBar props last-mounted-wins (§ Form screens). */}
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, paddingTop: insets.top }}
      >
        {/* § Header — a chevron and nothing else. There is no title: the
            screen's own heading is right underneath and repeating it in a
            bar would be the same word twice. */}
        <View style={{ height: 44, justifyContent: "center", paddingHorizontal: 12 }}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={{ padding: 4, alignSelf: "flex-start" }}>
              <ChevronLeft size={28} color="#374151" />
            </TouchableOpacity>
          )}
        </View>

        <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              paddingHorizontal: AUTH_INSET,
              paddingBottom: 24,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Pressable>

        {footer != null && (
          <View
            style={{
              paddingHorizontal: AUTH_INSET,
              paddingBottom: insets.bottom + 12,
              paddingTop: 4,
            }}
          >
            {footer}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * The mark and the greeting.
 *
 * One colour, not two. The old heading split "Welcome" and "Back!" across
 * the brand navy and the accent gold on separate lines, which is colour
 * carrying hierarchy — the thing § Icons and § People lists rule out
 * everywhere else in the app. Weight and size do it here.
 */
export function AuthHeading({
  title,
  subtitle,
  showLogo = true,
}: {
  title: string;
  subtitle?: string;
  showLogo?: boolean;
}) {
  return (
    <View style={{ marginBottom: 28 }}>
      {showLogo && (
        <Image
          source={require("@/assets/images/logo.png")}
          style={{ width: 56, height: 56, marginBottom: 20 }}
          resizeMode="contain"
        />
      )}
      <Text style={{ fontSize: 30, fontWeight: "700", color: "#111827", letterSpacing: -0.5 }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ fontSize: 16, lineHeight: 22, color: "#6B7280", marginTop: 8 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A field.
 *
 * White on the grey, no border, `MODAL_RADIUS` with the continuous curve.
 * The icon column is fixed so a row of fields lines up whether or not each
 * one has an icon, and it is `#9CA3AF` — secondary, one weight, one colour
 * (§ Icons), rather than the two icon sets at two weights these screens
 * were carrying between them.
 */
export function AuthField({
  icon,
  accessory,
  style,
  ...props
}: TextInputProps & {
  icon?: React.ReactNode;
  accessory?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#fff",
          borderRadius: MODAL_RADIUS,
          borderCurve: "continuous",
          paddingHorizontal: 14,
          minHeight: 52,
        },
        style,
      ]}
    >
      {icon ? <View style={{ width: 26 }}>{icon}</View> : null}
      <TextInput
        placeholderTextColor="#9CA3AF"
        {...props}
        style={{
          flex: 1,
          fontSize: 16,
          color: "#111",
          paddingVertical: Platform.OS === "android" ? 10 : 14,
        }}
      />
      {accessory}
    </View>
  );
}

/**
 * A one-time code, one box per digit.
 *
 * White boxes on the grey like every other field here — the borders they
 * used to carry are what § Form screens takes out, and the box that has a
 * digit in it is marked by the digit, not by a heavier outline.
 *
 * It takes the screen's existing state and refs rather than owning them:
 * the focus-advance and backspace behaviour already exists on the screen
 * that uses this, and moving it in here would be rewriting working logic to
 * change how it looks.
 */
export function AuthCodeField({
  values,
  refs,
  onChangeDigit,
  onKeyPressDigit,
}: {
  values: string[];
  refs: React.RefObject<TextInput | null>[];
  onChangeDigit: (index: number, value: string) => void;
  onKeyPressDigit?: (index: number, event: any) => void;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
      {values.map((value, index) => (
        <TextInput
          key={index}
          ref={refs[index]}
          value={value}
          onChangeText={(next) => onChangeDigit(index, next)}
          onKeyPress={
            onKeyPressDigit ? (e) => onKeyPressDigit(index, e) : undefined
          }
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          style={{
            width: 60,
            height: 64,
            backgroundColor: "#fff",
            borderRadius: MODAL_RADIUS,
            borderCurve: "continuous",
            textAlign: "center",
            fontSize: 26,
            fontWeight: "700",
            color: "#111827",
          }}
        />
      ))}
    </View>
  );
}

/**
 * A quiet line under a field — a rule that has to be met, and whether it is.
 *
 * A `Check` when satisfied rather than a red bullet that never changes: a
 * requirement that cannot tell you it has been met is a requirement you
 * re-read every time. Red is this app's destructive colour (§ Colour), and
 * "your password needs six characters" is not a destructive event.
 */
export function AuthHint({ met, children }: { met: boolean; children: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <Check size={15} color={met ? "#059669" : "#D1D5DB"} strokeWidth={2.6} />
      <Text style={{ fontSize: 13.5, color: met ? "#059669" : "#9CA3AF" }}>
        {children}
      </Text>
    </View>
  );
}

/** The one filled thing on the screen. */
export function AuthButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const off = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      activeOpacity={0.85}
      style={{
        backgroundColor: BRAND,
        borderRadius: MODAL_RADIUS,
        borderCurve: "continuous",
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        minHeight: 54,
        // Dimmed rather than greyed: the button keeps its colour so it is
        // still recognisably the way forward while it is not yet usable.
        opacity: off ? 0.45 : 1,
      }}
    >
      {loading ? (
        <CircularLoader color="#fff" size="small" />
      ) : (
        <Text style={{ fontSize: 16.5, fontWeight: "700", color: "#fff" }}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

/** A second-tier button: white on the grey, for the OAuth providers. */
export function AuthSecondaryButton({
  label,
  icon,
  onPress,
  disabled,
  loading,
  dark,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Apple's mark has to sit on black, by their own guidelines. */
  dark?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        backgroundColor: dark ? "#000" : "#fff",
        borderRadius: MODAL_RADIUS,
        borderCurve: "continuous",
        paddingVertical: 14,
        minHeight: 50,
        opacity: disabled || loading ? 0.5 : 1,
      }}
    >
      {loading ? (
        <CircularLoader color={dark ? "#fff" : BRAND} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={{
              fontSize: 15.5,
              fontWeight: "600",
              color: dark ? "#fff" : "#111827",
            }}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/** "or" between the password form and the providers — a rule with a word
 *  in it, rather than a sentence pretending to be a divider. */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 }}>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#E5E7EB" }} />
      <Text style={{ fontSize: 14, color: "#9CA3AF" }}>{label}</Text>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#E5E7EB" }} />
    </View>
  );
}

/** The quiet line at the foot: "No account? Sign up". */
export function AuthFooterLink({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{ paddingVertical: 8 }}>
      <Text style={{ fontSize: 15, color: "#6B7280", textAlign: "center" }}>
        {prompt}{" "}
        <Text style={{ color: ACTION, fontWeight: "700" }}>{action}</Text>
      </Text>
    </TouchableOpacity>
  );
}
