/**
 * The camera and gallery buttons in the chat composer.
 *
 * It used to pick *and* send: the files went straight up and landed in the
 * thread as one message each, before anybody had said a word about them.
 * Now it only picks. What comes back goes into the composer
 * (`hooks/chat/usePendingAttachments.ts`), uploads while you type, and is
 * sent with whatever you write — one message, however many pictures.
 *
 * So this component has no upload, no insert and no optimistic message left
 * in it. All that is left is the permission, the picker and the button,
 * which is what it was always supposed to be.
 */

import PopupMessage from "@/components/ui/PopupMessage";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Modal, TouchableOpacity } from "react-native";

export interface PickedMedia {
  uri: string;
  type: "image" | "video";
}

interface ChatMultiMediaPickerProps {
  /** Handed the picked files; the composer owns everything after this. */
  onPicked: (media: PickedMedia[]) => void;
  /** How many more will fit in the composer right now. */
  remaining: number;
  /** 'gallery' (default) opens the photo library; 'camera' opens the camera. */
  mode?: "gallery" | "camera";
}

export default function ChatMultiMediaPicker({
  onPicked,
  remaining,
  mode = "gallery",
}: ChatMultiMediaPickerProps) {
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "warning" | "error";
    title: string;
    message: string;
  }>({ visible: false, type: "warning", title: "", message: "" });

  const showPopup = (type: "warning" | "error", title: string, message: string) =>
    setPopup({ visible: true, type, title, message });

  const handleMediaPick = async () => {
    if (remaining <= 0) {
      showPopup(
        "warning",
        "That's the lot",
        "Send these first, then pick some more.",
      );
      return;
    }

    try {
      let result: ImagePicker.ImagePickerResult;

      if (mode === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          showPopup(
            "warning",
            "Camera Access Needed",
            "Please allow camera access to take photos.",
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ["images", "videos"],
          allowsEditing: false,
          quality: 0.7,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          showPopup(
            "warning",
            "Gallery Access Needed",
            "Please allow access to your photo library to send images.",
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          allowsMultipleSelection: true,
          // Never offers room the composer does not have.
          selectionLimit: remaining,
          quality: 0.7,
        });
      }

      if (result.canceled || !result.assets?.length) return;

      onPicked(
        result.assets.map((asset) => ({
          uri: asset.uri,
          type: asset.type === "video" ? "video" : "image",
        })),
      );
    } catch (error) {
      console.error("❌ Media pick error:", error);
      showPopup("error", "Selection Error", "Could not load media. Please try again.");
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleMediaPick}
        className="mr-1 w-9 h-9 items-center justify-center"
      >
        <Ionicons
          name={mode === "camera" ? "camera-outline" : "image-outline"}
          size={21}
          color="#6b7280"
        />
      </TouchableOpacity>

      <Modal visible={popup.visible} transparent animationType="none" statusBarTranslucent>
        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup((p) => ({ ...p, visible: false }))}
        />
      </Modal>
    </>
  );
}
