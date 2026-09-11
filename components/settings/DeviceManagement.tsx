import {
  SettingsGroup,
  SettingsRow,
  SettingsScreen,
} from "@/components/settings/SettingsChrome";
import { useUser } from "@/contexts/UserContext";
import * as Device from "expo-device";
import React from "react";
import { Alert, Platform, Text } from "react-native";

interface DeviceManagementProps {
  onClose?: () => void;
}

export default function DeviceManagement({ onClose }: DeviceManagementProps) {
  const { logout } = useUser();

  const deviceName =
    Device.deviceName ||
    [Device.brand, Device.modelName].filter(Boolean).join(" ") ||
    "This device";
  const osLabel = `${Device.osName ?? Platform.OS} ${Device.osVersion ?? ""}`.trim();

  const handleSignOut = () => {
    Alert.alert("Sign out of this device", "You'll need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void logout() },
    ]);
  };

  return (
    <SettingsScreen title="Devices" onClose={onClose}>
      <SettingsGroup label="This device">
        <SettingsRow
          first
          label={deviceName}
          description={`${osLabel} · signed in`}
        />
        <SettingsRow
          label="Sign out of this device"
          destructive
          onPress={handleSignOut}
        />
      </SettingsGroup>

      {/* Being straight about the limit rather than showing an empty
          "other devices" list: Supabase doesn't expose a session list to the
          client, so the app genuinely can't enumerate other sign-ins. */}
      <Text className="text-xs text-gray-400 px-3 leading-5">
        Namzoed can only see the device you&apos;re using right now. To sign out
        everywhere else, change your password — that ends every other session.
      </Text>
    </SettingsScreen>
  );
}
