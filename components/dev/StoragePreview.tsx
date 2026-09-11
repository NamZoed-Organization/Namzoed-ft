/**
 * StoragePreview  (dev only)
 *
 * The Storage screen on fixtures, because its whole job is to render numbers
 * that only exist on a phone that has been used for weeks. On a fresh build
 * every row reads "None" and the bar is an empty track — which is a state
 * worth checking, and the only one you can otherwise get to.
 *
 * It drives the REAL `DataStorageView`, so it breaks when the screen changes.
 * Clearing here only edits the fixture; nothing touches a cache.
 *
 * Three states, because they are the three that look different:
 * a well-used phone, a fresh install, and one store dwarfing the rest.
 */

import { DataStorageView } from "@/components/settings/DataStorage";
import type { StorageKey, StorageReport } from "@/lib/storageManager";
import React, { useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

const MB = 1024 * 1024;

const DETAIL: Record<StorageKey, string> = {
  photos: "Pictures from the feed, grids and profiles. They come back as you scroll.",
  videos: "Reels and clips kept so scrolling back doesn't download them twice.",
  setlog:
    "Your own recordings, kept here so this phone never downloads back what it filmed. Clearing this re-downloads them.",
  appData: "The last feed, so the grid paints before the network answers.",
};

const LABEL: Record<StorageKey, string> = {
  photos: "Photos",
  videos: "Videos",
  setlog: "Setlog clips",
  appData: "Feed & search data",
};

const report = (sizes: Record<StorageKey, number>): StorageReport => {
  const categories = (Object.keys(LABEL) as StorageKey[]).map((key) => ({
    key,
    label: LABEL[key],
    detail: DETAIL[key],
    bytes: sizes[key],
    reDownloads: key === "setlog",
  }));
  return {
    categories,
    total: categories.reduce((sum, c) => sum + c.bytes, 0),
  };
};

/** Deliberately uneven. A preview where the four are similar hides the one
 *  thing the bar has to survive: the feed cache is three megabytes against a
 *  gigabyte of pictures, and its segment still has to be visible. */
const PRESETS = {
  used: report({ photos: 842 * MB, videos: 318 * MB, setlog: 211 * MB, appData: 3 * MB }),
  fresh: report({ photos: 0, videos: 0, setlog: 0, appData: 0 }),
  lopsided: report({ photos: 1931 * MB, videos: 12 * MB, setlog: 0, appData: 1 * MB }),
};

type Preset = keyof typeof PRESETS;

export default function StoragePreview({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [preset, setPreset] = useState<Preset>("used");
  const [limits, setLimits] = useState({ photos: 512 * MB, videos: 512 * MB });
  const [busy, setBusy] = useState<StorageKey | "all" | null>(null);

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
        <DataStorageView
          report={PRESETS[preset]}
          limits={limits}
          busy={busy}
          onClose={onClose}
          onSetLimit={(key, bytes) =>
            setLimits((prev) => ({ ...prev, [key]: bytes }))
          }
          // Shows the spinner in the row that was tapped and then leaves the
          // fixture alone — the point is the busy state, not the arithmetic.
          onClear={(key) => {
            setBusy(key);
            setTimeout(() => setBusy(null), 900);
          }}
        />

        <View className="border-t border-gray-100 bg-white px-3 pt-2.5 pb-6 flex-row flex-wrap">
          {(Object.keys(PRESETS) as Preset[]).map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => setPreset(key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                borderCurve: "continuous",
                marginRight: 8,
                backgroundColor: preset === key ? "#094569" : "#F5F5F5",
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "600",
                  color: preset === key ? "#fff" : "#6B7280",
                }}
              >
                {key === "used" ? "Well used" : key === "fresh" ? "Fresh install" : "One store dominates"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}
