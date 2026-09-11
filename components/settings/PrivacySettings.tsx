import {
  SettingsGroup,
  SettingsScreen,
  SettingsSwitchRow,
} from "@/components/settings/SettingsChrome";
import { SettingsRow } from "@/components/settings/SettingsChrome";
import { useSafety } from "@/contexts/SafetyContext";
import React from "react";
import { Text } from "react-native";

interface PrivacySettingsProps {
  onClose?: () => void;
  onNavigate?: (modal: string) => void;
}

export default function PrivacySettings({ onClose, onNavigate }: PrivacySettingsProps) {
  const { safeView, setSafeView, isAdult } = useSafety();

  return (
    <SettingsScreen title="Privacy" onClose={onClose}>
      <SettingsGroup label="Content">
        <SettingsSwitchRow
          first
          label="Safe View"
          description={
            isAdult
              ? "Hides 18+ and sensitive content from your feed"
              : "Always on — only verified adults (18+) can turn this off"
          }
          value={safeView}
          disabled={!isAdult}
          onValueChange={(value) => {
            if (!isAdult) return;
            void setSafeView(value);
          }}
        />
      </SettingsGroup>

      {!isAdult && (
        <Text className="text-xs text-gray-400 px-3 pb-4 leading-5">
          Add your date of birth on Edit Profile → Birthday to unlock this.
        </Text>
      )}

      <SettingsGroup label="Policies">
        <SettingsRow
          first
          label="Community guidelines"
          onPress={() => onNavigate?.("communityGuidelines")}
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}
