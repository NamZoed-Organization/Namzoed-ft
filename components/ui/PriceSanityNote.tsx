/**
 * The line under a price field when the price looks wrong for the thing.
 *
 * A line, not a block: it appears while somebody is mid-form and disappears
 * as soon as the number is plausible, and a coloured panel that comes and
 * goes under a field makes the whole form jump. Amber rather than red —
 * nothing is broken and nothing is being refused, the seller is being told
 * something they probably already know they got wrong (§ Colour).
 *
 * Renders nothing at all when there is nothing to say, which is most of the
 * time. See lib/priceSanity.ts for when that is.
 */

import type { PriceCheck } from "@/lib/priceSanity";
import { AlertTriangle } from "lucide-react-native";
import React from "react";
import { Text, View } from "react-native";

const WARN = "#B45309";

export default function PriceSanityNote({ check }: { check: PriceCheck }) {
  if (!check.message) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 6,
        marginTop: 6,
      }}
    >
      <AlertTriangle size={13} color={WARN} strokeWidth={2} style={{ marginTop: 2 }} />
      <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 17, color: WARN }}>
        {check.message}
      </Text>
    </View>
  );
}
