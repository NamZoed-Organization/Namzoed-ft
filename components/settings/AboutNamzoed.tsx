import {
  SettingsGroup,
  SettingsRow,
  SettingsScreen,
} from "@/components/settings/SettingsChrome";
import { openAppStoreForUpdate } from "@/utils/appUpdate";
import Constants from "expo-constants";
import React from "react";
import { Image, Platform, Text, View } from "react-native";

interface AboutNamzoedProps {
  onClose?: () => void;
  onNavigate?: (modal: string) => void;
}

const APP_VERSION = Constants.expoConfig?.version || "1.0.0";
const BUILD =
  Constants.expoConfig?.ios?.buildNumber ||
  String(Constants.expoConfig?.android?.versionCode ?? "");

export default function AboutNamzoed({ onClose, onNavigate }: AboutNamzoedProps) {
  return (
    <SettingsScreen title="About Namzoed" onClose={onClose}>
      {/* Identity block — logo, name, what version you're actually on. */}
      <View className="items-center pt-4 pb-7">
        <View
          style={{ width: 84, height: 84, borderRadius: 20, borderCurve: "continuous", overflow: "hidden" }}
          className="bg-white"
        >
          <Image
            source={require("../../assets/images/logo.png")}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
          />
        </View>
        <Text className="text-[19px] font-mbold text-gray-900 mt-3">Namzoed</Text>
        <Text className="text-[13px] text-gray-400 mt-1">
          Version {APP_VERSION}
          {BUILD ? ` (${BUILD})` : ""}
        </Text>
      </View>

      <SettingsGroup>
        {Platform.OS !== "web" && (
          <SettingsRow
            first
            label="Check for updates"
            description={Platform.OS === "ios" ? "Opens the App Store" : "Opens the Play Store"}
            onPress={() => void openAppStoreForUpdate()}
          />
        )}
        {Platform.OS !== "web" && (
          <SettingsRow
            label="Rate Namzoed"
            description="Leave a review on the store"
            onPress={() => void openAppStoreForUpdate()}
          />
        )}
        <SettingsRow
          first={Platform.OS === "web"}
          label="What's new"
          onPress={() => onNavigate?.("whatsNew")}
        />
      </SettingsGroup>

      <SettingsGroup label="Legal">
        <SettingsRow
          first
          label="Privacy policy"
          onPress={() => onNavigate?.("privacyPolicy")}
        />
        <SettingsRow
          label="Terms of service"
          onPress={() => onNavigate?.("termsOfService")}
        />
        <SettingsRow
          label="Seller policy"
          onPress={() => onNavigate?.("sellerPolicy")}
        />
      </SettingsGroup>
    </SettingsScreen>
  );
}
