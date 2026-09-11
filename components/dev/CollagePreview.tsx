/**
 * CollagePreview  (dev only)
 *
 * The collage's arrangement on fixtures, because the thing that decides it —
 * the mix of aspect ratios in a day — takes a day of shooting to produce,
 * and the awkward mixes are the ones you would never get on purpose. Six
 * portraits in a landscape frame, one panorama among squares, a single tall
 * photo: those are where a layout either holds or falls apart, and none of
 * them turn up while you are testing with four snaps of your desk.
 *
 * It drives the REAL `DayCollage`, so it breaks when the collage changes.
 *
 * **What it shows and what it does not.** The cells are empty wells at their
 * true shapes, not photographs, so this answers "is the arrangement right" —
 * are the ratios exact, do rows span the block, is the mat even, does the
 * stamp still fit the smallest cell — and deliberately not "is it pretty",
 * which only real photographs can answer. A fixture that pasted stock images
 * into cells would crop them to the cell and hide the one bug this screen
 * exists to catch.
 */

import DayCollage, {
  COLLAGE_FORMATS,
  type CollageFormat,
} from "@/components/setlog/DayCollage";
import type { SetlogClip } from "@/lib/setlogService";
import React, { useState } from "react";
import { Dimensions, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

const SCREEN_W = Dimensions.get("window").width;

/** Aspect mixes, named for the trap each one sets. */
const MIXES: Record<string, number[]> = {
  "Phone day": [3 / 4, 3 / 4, 4 / 3, 3 / 4, 1, 3 / 4, 4 / 3],
  "All portrait": [3 / 4, 3 / 4, 3 / 4, 3 / 4, 3 / 4, 3 / 4],
  "All landscape": [4 / 3, 3 / 2, 4 / 3, 16 / 9, 3 / 2],
  "One panorama": [3 / 4, 1, 16 / 9, 3 / 4, 1],
  "Single photo": [3 / 4],
  Two: [3 / 4, 4 / 3],
  Twelve: Array.from({ length: 12 }, (_, i) => [3 / 4, 4 / 3, 1, 9 / 16][i % 4]),
};

type MixName = keyof typeof MIXES;

const clips = (aspects: number[]) =>
  aspects.map((_, i) => {
    // 08:00 onwards, so the stamps read like a real morning.
    const at = new Date(2026, 8, 11, 8 + i, (i * 17) % 60).toISOString();
    return {
      id: `fixture-${i}`,
      createdAt: at,
      title: i % 3 === 0 ? "morning" : null,
      url: null,
    } as unknown as SetlogClip & { url: string | null };
  });

const Chip = ({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={{
      paddingHorizontal: 11,
      paddingVertical: 6,
      borderRadius: 999,
      borderCurve: "continuous",
      marginRight: 7,
      marginBottom: 7,
      backgroundColor: on ? "#094569" : "#F1F1F1",
    }}
  >
    <Text style={{ fontSize: 12.5, fontWeight: "600", color: on ? "#fff" : "#6B7280" }}>
      {label}
    </Text>
  </TouchableOpacity>
);

export default function CollagePreview({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [mix, setMix] = useState<MixName>("Phone day");
  const [format, setFormat] = useState<CollageFormat>("portrait");
  const [background, setBackground] = useState("#111827");
  const [showStamp, setShowStamp] = useState(true);

  const aspects = MIXES[mix];
  const photos = clips(aspects);
  const aspectMap = Object.fromEntries(
    photos.map((p, i) => [p.id, aspects[i]]),
  );

  const frame = COLLAGE_FORMATS[format];
  const scale = (SCREEN_W - 48) / frame.width;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
        <View className="flex-row items-center justify-between px-4 pt-14 pb-2">
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827" }}>
            Collage — aspect mixes
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: "#0369A1" }}>
              Done
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 8 }}>
          <View
            style={{
              width: SCREEN_W - 48,
              height: frame.height * scale,
              overflow: "hidden",
            }}
          >
            <View style={{ transform: [{ scale }], transformOrigin: "top left" }}>
              <DayCollage
                day="2026-09-11"
                photos={photos}
                aspects={aspectMap}
                format={format}
                background={background}
                showStamp={showStamp}
                watermark
              />
            </View>
          </View>

          <Text style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 10, lineHeight: 18 }}>
            {aspects.length} cells at {aspects.map((a) => a.toFixed(2)).join(", ")} —
            the block should reach all four edges with no background band, rows
            should share a height, and the gaps should be even. A band only
            belongs here when filling would have cost more than MAX_CROP, which
            is the single-tall-photo case.
          </Text>
        </ScrollView>

        <View className="border-t border-gray-100 bg-white px-3 pt-2.5 pb-6">
          <View className="flex-row flex-wrap">
            {(Object.keys(MIXES) as MixName[]).map((k) => (
              <Chip key={k} label={k} on={mix === k} onPress={() => setMix(k)} />
            ))}
          </View>
          <View className="flex-row flex-wrap">
            {(Object.keys(COLLAGE_FORMATS) as CollageFormat[]).map((k) => (
              <Chip
                key={k}
                label={COLLAGE_FORMATS[k].label}
                on={format === k}
                onPress={() => setFormat(k)}
              />
            ))}
            {["#111827", "#FFFFFF"].map((b) => (
              <Chip
                key={b}
                label={b === "#FFFFFF" ? "White" : "Ink"}
                on={background === b}
                onPress={() => setBackground(b)}
              />
            ))}
            <Chip
              label="Stamp"
              on={showStamp}
              onPress={() => setShowStamp((v) => !v)}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
