import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { supabase } from "@/lib/supabase";
import { uploadFileToSupabase } from "@/lib/uploadFile";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Modal, TouchableOpacity } from "react-native";

const MAX_ITEMS = 10;

export interface CommentReplyTarget {
  commentId: string;
  commentOwnerId: string;
}

export interface PendingCommentMedia {
  id: string;
  uri: string;
  type: "image" | "video";
  duration?: number;
}

interface UploadedCommentMedia {
  url: string;
  type: "image" | "video";
  duration?: number;
}

interface CommentMediaPickerProps {
  postId: string;
  /** When set, picked media attaches to a reply on this comment instead of a new top-level comment. */
  replyTarget?: CommentReplyTarget | null;
  /** How many items are already staged in the composer, so the picker can cap the total at MAX_ITEMS. */
  existingCount: number;
  /** Fires immediately with the picked items (no url yet) — the composer stages them right away. */
  onPicked: (items: PendingCommentMedia[]) => void;
  /** Fires per item once its background upload finishes. */
  onUploaded: (id: string, result: UploadedCommentMedia) => void;
  onFailed: (id: string) => void;
}

const uploadOne = async (
  media: PendingCommentMedia,
  replyTarget: CommentReplyTarget | null | undefined,
  postId: string,
): Promise<UploadedCommentMedia> => {
  const isVideo = media.type === "video";
  const folder = replyTarget ? `replies/${replyTarget.commentId}` : `posts/${postId}`;
  const ext = isVideo ? "mp4" : "jpg";
  const filePath = `${folder}/${media.id}_${Date.now()}.${ext}`;
  const mimeType = isVideo ? "video/mp4" : "image/jpeg";
  const bucket = isVideo ? "comment-videos" : "comment-images";

  await uploadFileToSupabase(media.uri, bucket, filePath, mimeType, true);
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return {
    url: urlData.publicUrl,
    type: media.type,
    duration: media.duration ? Math.round(media.duration) : undefined,
  };
};

/**
 * Image/video picker button for comments — reports picked items to the
 * composer immediately (so it can stage/preview them inline and keep the
 * keyboard up for a caption) and uploads each one in the background,
 * reporting per-item completion. Deliberately does not post anything or
 * open any UI of its own beyond the native picker — the composer that owns
 * the text field is what actually sends, once the user taps its own send
 * button.
 */
export default function CommentMediaPicker({
  postId,
  replyTarget,
  existingCount,
  onPicked,
  onUploaded,
  onFailed,
}: CommentMediaPickerProps) {
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
      showPopup("warning", "Limit reached", `You can attach up to ${MAX_ITEMS} items.`);
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

      const picked: PendingCommentMedia[] = result.assets.map((asset, idx) => ({
        id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        uri: asset.uri,
        type: asset.type === "video" ? "video" : "image",
        duration: asset.duration ?? undefined,
      }));

      onPicked(picked);

      await Promise.all(
        picked.map(async (m) => {
          try {
            const uploaded = await uploadOne(m, replyTarget, postId);
            onUploaded(m.id, uploaded);
          } catch (error) {
            console.error("❌ Comment media upload failed:", error);
            onFailed(m.id);
          }
        }),
      );
    } catch (error) {
      console.error("❌ Comment media pick error:", error);
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
