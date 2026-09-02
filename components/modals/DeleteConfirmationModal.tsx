import * as Haptics from 'expo-haptics';
import { AlertCircle, Trash2 } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface DeleteConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  postContent: string;
  /** Render as a plain absolute-fill overlay instead of a native Modal — use
   * when the caller is already presenting a full-screen Modal, since nesting
   * a native Modal inside an open one is unreliable (status bar / safe area
   * math gets miscalculated on iOS regardless of statusBarTranslucent). */
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

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  // Truncate post content for preview
  const truncatedContent = postContent.length > 50
    ? postContent.substring(0, 50) + '...'
    : postContent;

  const content = (
    <Pressable
      className="flex-1 bg-black/50 justify-end"
      onPress={onClose}
      activeOpacity={1}
    >
      <Pressable onPress={(e) => e.stopPropagation()}>
        <View
          style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: "continuous" }} className="bg-white">
          {/* Header */}
          <View className="p-6 border-b border-gray-200">
            <View className="flex-row items-center mb-3">
              <AlertCircle size={24} color="#EF4444" />
              <Text className="text-xl font-semibold text-gray-900 ml-2">
                Delete Post
              </Text>
            </View>
            <Text className="text-sm text-gray-600 mb-2">
              Are you sure you want to delete this post? This action cannot be undone.
            </Text>
            {postContent && (
              <View
                style={{ borderRadius: 8, borderCurve: "continuous" }} className="mt-3 p-3 bg-gray-50">
                <Text className="text-sm text-gray-700 italic">
                  "{truncatedContent}"
                </Text>
              </View>
            )}
          </View>

          {/* Buttons */}
          <View className="p-4">
            <TouchableOpacity
              style={{ borderRadius: 12, borderCurve: "continuous" }}
              className="bg-red-500 py-4 px-4 flex-row items-center justify-center mb-3"
              onPress={handleConfirm}
            >
              <Trash2 size={20} color="#FFFFFF" />
              <Text className="ml-2 text-white font-semibold text-base">
                Delete Post
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="py-4 px-4 flex-row items-center justify-center border-t border-gray-100"
              onPress={handleCancel}
            >
              <Text className="text-base text-gray-600">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Pressable>
  );

  if (embedded) {
    if (!visible) return null;
    return <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>{content}</View>;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={false}
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
}
