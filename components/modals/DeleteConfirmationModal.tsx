/**
 * "Delete this post?"
 *
 * It is `DialogCard` (§ Dialogs) — it asks one question, so it is a dialog,
 * and it used to be drawn as a bottom sheet: a bordered header with a red
 * `AlertCircle` beside a 20pt title, an italic quote of the post in a grey
 * box, a full-width red button with a `Trash2` inside it, and a "Cancel"
 * under a hairline. A sheet slides up from the edge because it offers a list
 * you can drag away; this offers two answers and waits for one.
 *
 * Red stays, because here the hue is the information (§ Dialogs) — it is
 * carried by the action that does the destroying and by the icon, not by a
 * border and a box as well.
 */

import DialogCard from "@/components/ui/DialogCard";
import * as Haptics from "expo-haptics";
import { Trash2 } from "lucide-react-native";
import React from "react";
import { Modal, Text, View } from "react-native";

interface DeleteConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  postContent: string;
  /** Skip the native `<Modal>` wrapper — set it when the caller already
   * presents a full-screen modal (`ImageViewer` does), since nesting one
   * native modal inside another is unreliable on iOS. Leave it off inside a
   * feed card, where a bare overlay would be confined to the card. */
  embedded?: boolean;
}

export default function DeleteConfirmationModal({
  visible,
  onClose,
  onConfirm,
  postContent,
  embedded,
}: DeleteConfirmationModalProps) {
  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onConfirm();
  };

  const preview =
    postContent.length > 50 ? `${postContent.slice(0, 50)}…` : postContent;

  const card = (
    <DialogCard
      visible={visible}
      onDismiss={onClose}
      title="Delete post"
      message="This cannot be undone."
      icon={<Trash2 size={22} color="#DC2626" strokeWidth={1.9} />}
      actions={[
        {
          label: "Cancel",
          style: "cancel",
          onPress: () =>
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
        },
        { label: "Delete", style: "destructive", onPress: handleConfirm },
      ]}
    >
      {/* Which post — the grey field shape, since the card is white. Not
          italic: it is a quotation, and the quote marks say so. */}
      {postContent ? (
        <View
          style={{
            backgroundColor: "#F5F5F5",
            borderRadius: 12,
            borderCurve: "continuous",
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginTop: 14,
          }}
        >
          <Text
            numberOfLines={2}
            style={{ fontSize: 14, lineHeight: 20, color: "#6B7280" }}
          >
            &ldquo;{preview}&rdquo;
          </Text>
        </View>
      ) : null}
    </DialogCard>
  );

  if (embedded) return card;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {card}
    </Modal>
  );
}
