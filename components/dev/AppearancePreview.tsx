/**
 * AppearancePreview  (dev only)
 *
 * Settings › Appearance on fixtures, because the one thing that changes its
 * layout — which early-access badges you own — is not something you can give
 * yourself to look at. Badges are awarded by a backfill against specific
 * accounts, so on any normal test account the screen has exactly one state:
 * the empty one.
 *
 * It drives the REAL `AppearanceView`, so it breaks when the screen changes.
 * Selecting a badge here only edits the fixture; nothing is written.
 *
 * Four states, because they are the ones that look different: nobody's
 * account, one badge (where the "pick which one" line must not appear), all
 * four (where it must), and the moment a selection is saving.
 */

import { AppearanceView } from "@/components/settings/AppearanceManager";
import type { EarlyAccessBadgeType } from "@/lib/earlyAccessService";
import React, { useState } from "react";
import { Modal, Text, TouchableOpacity, View } from "react-native";

const PRESETS: Record<
  string,
  { badgeIds: string[]; active: EarlyAccessBadgeType; saving: string | null; loading?: boolean }
> = {
  none: { badgeIds: [], active: null, saving: null },
  one: { badgeIds: ["tester"], active: "tester", saving: null },
  all: {
    badgeIds: ["founding", "waitlist", "tester", "genesis"],
    active: "founding",
    saving: null,
  },
  saving: {
    badgeIds: ["founding", "waitlist", "tester", "genesis"],
    active: "founding",
    saving: "genesis",
  },
  loading: { badgeIds: [], active: null, saving: null, loading: true },
};

type Preset = keyof typeof PRESETS;

const LABEL: Record<string, string> = {
  none: "No badges",
  one: "One badge",
  all: "All four",
  saving: "Saving",
  loading: "Loading",
};

export default function AppearancePreview({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [preset, setPreset] = useState<Preset>("all");
  // Local, so switching a background here never touches the real setting.
  const [bg, setBg] = useState("default");
  const [active, setActive] = useState<EarlyAccessBadgeType>(null);

  const fixture = PRESETS[preset];
  const shown = active ?? fixture.active;

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
        <AppearanceView
          badgeIds={fixture.badgeIds}
          activeBadge={shown}
          savingId={fixture.saving}
          loading={fixture.loading ?? false}
          globalChatBg={bg}
          onSelectBadge={(id) => setActive(id as NonNullable<EarlyAccessBadgeType>)}
          onSelectBg={setBg}
          onClose={onClose}
        />

        <View className="border-t border-gray-100 bg-white px-3 pt-2.5 pb-6 flex-row flex-wrap">
          {(Object.keys(PRESETS) as Preset[]).map((key) => (
            <TouchableOpacity
              key={key}
              onPress={() => {
                setPreset(key);
                setActive(null);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                borderCurve: "continuous",
                marginRight: 8,
                marginBottom: 8,
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
                {LABEL[key]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Modal>
  );
}
