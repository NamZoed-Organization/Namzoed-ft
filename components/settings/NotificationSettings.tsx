import {
  SettingsGroup,
  SettingsScreen,
  SettingsSwitchRow,
} from "@/components/settings/SettingsChrome";
import SetlogPromptSettings from "@/components/settings/SetlogPromptSettings";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_CATEGORIES,
  NotificationPrefs,
  fetchNotificationPrefs,
  saveNotificationPrefs,
} from "@/lib/notificationPrefs";
import React, { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

interface NotificationSettingsProps {
  onClose?: () => void;
}

export default function NotificationSettings({ onClose }: NotificationSettingsProps) {
  const { currentUser } = useUser();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "warning" | "error";
    title: string;
    message: string;
  }>({
    visible: false, type: "success", title: "", message: "",
  });

  const showMessage = useCallback(
    (type: "success" | "warning" | "error", title: string, message: string) => {
      setPopup({ visible: true, type, title, message });
    },
    [],
  );

  useEffect(() => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchNotificationPrefs(currentUser.id)
      .then((loaded) => {
        if (!cancelled) setPrefs(loaded);
      })
      .catch((error) => console.error("Failed to load notification prefs:", error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  // Optimistic: the switch moves immediately and rolls back if the write
  // fails, rather than lagging a round trip behind the finger.
  const update = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!currentUser?.id) return;
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try {
      await saveNotificationPrefs(currentUser.id, next);
    } catch (error) {
      console.error("Failed to save notification prefs:", error);
      setPrefs(previous);
      setPopup({
        visible: true,
        type: "error",
        title: "Not Saved",
        message: "Couldn't save that. Please try again.",
      });
      setTimeout(() => setPopup((p) => ({ ...p, visible: false })), 2500);
    }
  };

  return (
    <SettingsScreen title="Notifications" onClose={onClose}>
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup((p) => ({ ...p, visible: false }))}
      />

      {loading ? (
        <View className="items-center justify-center pt-24">
          <CircularLoader color="#094569" />
        </View>
      ) : (
        <>
          <SettingsGroup>
            <SettingsSwitchRow
              first
              label="Allow notifications"
              description="Turn everything off in one go"
              value={prefs.enabled}
              onValueChange={(value) => update("enabled", value)}
            />
          </SettingsGroup>

          {/* Categories stay visible but inert when the master switch is
              off, so it's clear what would come back on rather than the
              list vanishing. */}
          <SettingsGroup label="What you're notified about">
            {NOTIFICATION_CATEGORIES.map((category, index) => (
              <SettingsSwitchRow
                key={category.key}
                first={index === 0}
                label={category.label}
                description={category.description}
                value={prefs.enabled && prefs[category.key]}
                disabled={!prefs.enabled}
                onValueChange={(value) => update(category.key, value)}
              />
            ))}
          </SettingsGroup>

          {/* Setlog's hourly prompt is its own opt-in with its own window,
              stored in `setlog_prefs` rather than the categories above — but
              this is where somebody looks when a notification is missing, so
              it belongs on this screen too (§ Setlog). */}
          <SetlogPromptSettings onMessage={showMessage} />

          <Text className="text-xs text-gray-400 px-3 leading-5">
            Namzoed also needs notification permission from your phone. If you
            turned it off there, these switches won&apos;t bring it back — allow it
            in your device settings first.
          </Text>
        </>
      )}
    </SettingsScreen>
  );
}
