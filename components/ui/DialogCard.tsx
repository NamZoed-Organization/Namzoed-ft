/**
 * The one dialog in this app.
 *
 * A white card on a scrim: the same white the groups, sheets and fields use
 * (§ Grounds), the same 18 radius the groups use, the same continuous
 * curve. Nothing else.
 *
 * What that replaced was a frosted glass panel with a blur, a diagonal
 * "liquid glass" sheen gradient over it, and a four-sided border faking a
 * bevel — a lighter top edge, mid-grey sides, a dark bottom. None of that
 * appears anywhere else in the app. The blur belongs to things that float
 * *over live content* — the tab bar, the camera's menus — where seeing what
 * is behind them is the point. A dialog sits over a still screen and asks a
 * question; frosting it only makes the question harder to read.
 *
 * ## Actions
 *
 * **One filled action, at most** (§ People lists). Two filled buttons side
 * by side is two things claiming to be the answer. The quiet one is
 * `#F5F5F5` with grey text, not an outlined pill.
 *
 * One action fills the width. Two sit side by side, the filled one on the
 * right where a thumb lands. Three or more stack, because three pills in a
 * row are three unreadable labels.
 */

import { MODAL_RADIUS } from "@/constants/theme";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type DialogActionStyle = "default" | "cancel" | "destructive";

export interface DialogAction {
  label: string;
  onPress?: () => void;
  style?: DialogActionStyle;
  loading?: boolean;
}

/** § Groups and rows — a dialog is a group with a question in it. */
const CARD_RADIUS = 18;
const BRAND = "#094569";
const DESTRUCTIVE = "#DC2626";

function ActionButton({
  action,
  onDismiss,
  full,
}: {
  action: DialogAction;
  onDismiss?: () => void;
  full?: boolean;
}) {
  const quiet = action.style === "cancel";
  const destructive = action.style === "destructive";
  return (
    <Pressable
      onPress={() => {
        action.onPress?.();
        onDismiss?.();
      }}
      disabled={action.loading}
      style={{
        flex: full ? undefined : 1,
        alignSelf: full ? "stretch" : undefined,
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: MODAL_RADIUS,
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: quiet ? "#F5F5F5" : destructive ? DESTRUCTIVE : BRAND,
        opacity: action.loading ? 0.6 : 1,
      }}
    >
      <Text
        numberOfLines={1}
        style={{
          fontSize: 15.5,
          fontWeight: "600",
          color: quiet ? "#6B7280" : "#fff",
        }}
      >
        {action.label}
      </Text>
    </Pressable>
  );
}

export default function DialogCard({
  visible,
  icon,
  title,
  message,
  actions,
  onDismiss,
  children,
}: {
  visible: boolean;
  /** A 44pt tile's worth, or nothing — plenty of dialogs need no picture. */
  icon?: React.ReactNode;
  title: string;
  message?: string;
  actions?: DialogAction[];
  /** Tapping the scrim. Omit to make the dialog answerable only by its own
   *  buttons — for a question that must actually be answered. */
  onDismiss?: () => void;
  /** Anything between the message and the actions: a field, a picker. */
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const stacked = (actions?.length ?? 0) > 2;

  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(140)}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "rgba(0,0,0,0.35)",
        zIndex: 50,
      }}
    >
      {onDismiss && (
        <Pressable
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0 }}
          onPress={onDismiss}
        />
      )}

      {/* A dialog can hold a field — the phone prompt does — and a card
          centred in the screen is exactly where the keyboard lands. This
          lifts it instead. `box-none` so the empty space around the card
          still reaches the scrim underneath. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <Animated.View
          entering={ZoomIn.springify().damping(18).mass(0.6)}
          exiting={ZoomOut.duration(140)}
          style={{
            width: "100%",
            maxWidth: 340,
            backgroundColor: "#fff",
            borderRadius: CARD_RADIUS,
            borderCurve: "continuous",
            padding: 20,
            // A shadow, not a bevel: it says the card is above the screen,
            // where the border said it was made of glass.
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.16,
            shadowRadius: 24,
            elevation: 16,
          }}
        >
          {icon && (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderCurve: "continuous",
                backgroundColor: "#F5F5F5",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              {icon}
            </View>
          )}

          {/* Left-aligned, like every other block of text in the app. Centred
            copy is a poster; this is a sentence somebody has to read and
            act on. */}
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827" }}>
            {title}
          </Text>

          {message ? (
            <Text
              style={{
                fontSize: 15,
                lineHeight: 21,
                color: "#6B7280",
                marginTop: 6,
              }}
            >
              {message}
            </Text>
          ) : null}

          {children}

          {actions && actions.length > 0 && (
            <View
              style={{
                flexDirection: stacked ? "column" : "row",
                gap: 10,
                marginTop: 20,
              }}
            >
              {actions.map((action, index) => (
                <ActionButton
                  key={`${action.label}-${index}`}
                  action={action}
                  onDismiss={onDismiss}
                  full={stacked || actions.length === 1}
                />
              ))}
            </View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}
