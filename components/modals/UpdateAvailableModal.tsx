import PopupMessage from "@/components/ui/PopupMessage";
import { openAppStoreForUpdate } from "@/utils/appUpdate";
import React, { useEffect } from "react";
import { BackHandler, Platform } from "react-native";

interface UpdateAvailableModalProps {
  visible: boolean;
  forceUpdate: boolean;
  message: string;
  onDismiss?: () => void;
}

/**
 * Soft "update available" nudge (dismissible) or hard "force update" block
 * (no dismiss, swallows the Android back button) driven by useAppUpdateCheck.
 */
export default function UpdateAvailableModal({
  visible,
  forceUpdate,
  message,
  onDismiss,
}: UpdateAvailableModalProps) {
  useEffect(() => {
    if (!visible || !forceUpdate || Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, [visible, forceUpdate]);

  if (!visible) return null;

  return (
    <PopupMessage
      visible={visible}
      type="warning"
      title={forceUpdate ? "Update Required" : "Update Available"}
      message={message}
      onHide={forceUpdate ? undefined : onDismiss}
      actions={
        forceUpdate
          ? [
              {
                label: "Update Now",
                onPress: () => void openAppStoreForUpdate(),
                style: "default",
              },
            ]
          : [
              { label: "Later", style: "cancel" },
              {
                label: "Update Now",
                onPress: () => void openAppStoreForUpdate(),
                style: "default",
              },
            ]
      }
    />
  );
}
