import {
  SettingsGroup,
  SettingsRow,
  SettingsScreen,
} from "@/components/settings/SettingsChrome";
import React from "react";
import { Linking } from "react-native";

interface SupportSettingsProps {
  onClose?: () => void;
  onNavigate?: (modal: string) => void;
}

export default function SupportSettings({ onClose, onNavigate }: SupportSettingsProps) {
  return (
    <SettingsScreen title="Help Center" onClose={onClose}>
      <SettingsGroup>
        <SettingsRow
          first
          label="Help articles"
          description="Answers to common questions"
          onPress={() => onNavigate?.("helpCenter")}
        />
        <SettingsRow
          label="How Namzoed works"
          description="Walkthroughs that run on the real screens"
          onPress={() => onNavigate?.("tutorials")}
        />
      </SettingsGroup>

      <SettingsGroup label="Get in touch">
        <SettingsRow
          first
          label="Contact us"
          onPress={() => void Linking.openURL("https://namzoed.com/support")}
        />
        <SettingsRow
          label="Send feedback"
          onPress={() => onNavigate?.("sendFeedback")}
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}
