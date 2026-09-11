/**
 * StarPicker
 *
 * Five tappable stars — the write counterpart to StarRating, and for the same
 * reason: the product review composer and the seller rating sheet each had to
 * ask the same question, and two copies is how two surfaces end up with two
 * golds and two tap targets.
 *
 * Uses the raw responder API rather than TouchableOpacity, because both
 * callers put it in a modal above a focused text input — see the note on the
 * capture phase below, which is the whole reason this isn't three lines.
 */

import * as Haptics from "expo-haptics";
import { Star } from "lucide-react-native";
import React from "react";
import { View } from "react-native";
import { RATING_GOLD } from "./StarRating";

const EMPTY = "#D1D5DB";

interface StarPickerProps {
  value: number;
  onChange: (n: number) => void;
  size?: number;
  /** Centred in a composer, left-aligned in a labelled dimension row. */
  align?: "center" | "flex-start";
  gap?: number;
}

export default function StarPicker({
  value,
  onChange,
  size = 34,
  align = "center",
  gap = 8,
}: StarPickerProps) {
  return (
    <View style={{ flexDirection: "row", gap, justifyContent: align }}>
      {[1, 2, 3, 4, 5].map((n) => (
        // Plain View + the raw responder API, not TouchableOpacity — with a
        // text input below focused, TouchableOpacity's onPress AND onPressIn
        // both still lost their first tap to the keyboard's dismiss
        // (something upstream — Modal/KeyboardAvoidingView/the gesture-handler
        // root this whole app is wrapped in — was resolving the touch as a
        // blur before Touchable's own JS-side responder negotiation got a
        // turn). onStartShouldSetResponderCapture claims the responder in the
        // CAPTURE phase, before any ancestor (or the keyboard-dismiss logic
        // racing it) gets a chance to react, and onResponderGrant fires
        // immediately once claimed — no negotiation delay, no dependency on
        // keyboardShouldPersistTaps working.
        <View
          key={n}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          onStartShouldSetResponderCapture={() => true}
          onStartShouldSetResponder={() => true}
          onResponderGrant={() => {
            void Haptics.selectionAsync();
            onChange(n);
          }}
        >
          <Star
            size={size}
            color={n <= value ? RATING_GOLD : EMPTY}
            fill={n <= value ? RATING_GOLD : "transparent"}
          />
        </View>
      ))}
    </View>
  );
}
