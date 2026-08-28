import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { supabase } from "@/lib/supabase";
import { uploadFileToSupabase } from "@/lib/uploadFile";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Modal, TouchableOpacity } from "react-native";

const MAX_ITEMS = 6;

export interface PendingReviewMedia {
  id: string;
  uri: string;
  type: "image" | "video";
  duration?: number;
}

interface UploadedReviewMedia {
  url: string;
  type: "image" | "video";
  duration?: number;
}

interface ReviewMediaPickerProps {
  productId: string;
  userId: string;
  /** How many items are already staged in the composer, so the picker can cap the total at MAX_ITEMS. */
  existingCount: number;
  /** Fires immediately with the picked items (no url yet) — the composer stages them right away. */
  onPicked: (items: PendingReviewMedia[]) => void;
  /** Fires per item once its background upload finishes. */
  onUploaded: (id: string, result: UploadedReviewMedia) => void;
  onFailed: (id: string) => void;
}

const uploadOne = async (
  media: PendingReviewMedia,
  productId: string,
  userId: string,
): Promise<UploadedReviewMedia> => {
  const isVideo = media.type === "video";
  const filePath = `${productId}/${userId}/${media.id}_${Date.now()}.${isVideo ? "mp4" : "jpg"}`;
  const mimeType = isVideo ? "video/mp4" : "image/jpeg";
  const bucket = isVideo ? "review-videos" : "review-images";

  await uploadFileToSupabase(media.uri, bucket, filePath, mimeType, true);
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return {
    url: urlData.publicUrl,
    type: media.type,
    duration: media.duration ? Math.round(media.duration) : undefined,
  };
};

/**
 * Image/video picker button for the review composer — same "stage
 * immediately, upload in the background, report per-item completion"
 * pattern as CommentMediaPicker (components/comments/CommentMediaPicker.tsx),
 * just targeting the review-images/review-videos buckets and a
 * productId/userId folder instead of a comment/reply's own folder.
 */
export default function ReviewMediaPicker({
  productId,
  userId,
  existingCount,
  onPicked,
  onUploaded,
  onFailed,
}: ReviewMediaPickerProps) {
  const [isPickerBusy, setIsPickerBusy] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; type: "warning" | "error"; title: string; message: string }>({
    visible: false,
    type: "warning",
    title: "",
    message: "",
  });

  const showPopup = (type: "warning" | "error", title: string, message: string) =>
    setPopup({ visible: true, type, title, message });

  const handleMediaPick = async () => {
    if (isPickerBusy) return;
    const remaining = MAX_ITEMS - existingCount;
    if (remaining <= 0) {
      showPopup("warning", "Limit reached", `You can attach up to ${MAX_ITEMS} photos/videos.`);
      return;
    }

    setIsPickerBusy(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showPopup("warning", "Gallery Access Needed", "Please allow access to your photo library to attach media.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: remaining > 1,
        selectionLimit: remaining,
        quality: 0.7,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const picked: PendingReviewMedia[] = result.assets.map((asset, idx) => ({
        id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        uri: asset.uri,
        type: asset.type === "video" ? "video" : "image",
        duration: asset.duration ?? undefined,
      }));

      onPicked(picked);

      await Promise.all(
        picked.map(async (m) => {
          try {
            const uploaded = await uploadOne(m, productId, userId);
            onUploaded(m.id, uploaded);
          } catch (error) {
            console.error("❌ Review media upload failed:", error);
            onFailed(m.id);
          }
        }),
      );
    } catch (error) {
      console.error("❌ Review media pick error:", error);
      showPopup("error", "Selection Error", "Could not load media. Please try again.");
    } finally {
      setIsPickerBusy(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleMediaPick}
        disabled={isPickerBusy}
        style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {isPickerBusy ? (
          <CircularLoader size="small" color="#6b7280" />
        ) : (
          <Ionicons name="image-outline" size={22} color="#6b7280" />
        )}
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
