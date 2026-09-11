import {
  SettingsGroup,
  SettingsRow,
  SettingsScreen,
} from "@/components/settings/SettingsChrome";
import React from "react";
import { Linking, Platform, Text } from "react-native";

interface GeneralSettingsProps {
  onClose?: () => void;
  onNavigate?: (modal: string) => void;
}

export default function GeneralSettings({ onClose, onNavigate }: GeneralSettingsProps) {
  return (
    <SettingsScreen title="General" onClose={onClose}>
      <SettingsGroup>
        <SettingsRow
          first
          label="Text size"
          description="Follows your phone's text size"
          value={Platform.OS === "ios" ? "iOS Settings" : "System Settings"}
          onPress={() => void Linking.openSettings()}
        />
        <SettingsRow
          label="Appearance"
          description="Chat bubbles and backgrounds"
          onPress={() => onNavigate?.("appearance")}
        />
      </SettingsGroup>

      {/* Honest about where text size actually lives: Namzoed's text already
          scales with the system setting, so sending people there beats a
          second slider that only some screens would obey. */}
      <Text className="text-xs text-gray-400 px-3 leading-5">
        Namzoed&apos;s text scales with the size you&apos;ve set for your phone, so
        changing it there changes it here too.
      </Text>
    </SettingsScreen>
  );
}
