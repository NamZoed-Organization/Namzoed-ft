import * as Haptics from 'expo-haptics';
import { AlertCircle, Trash2 } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface DeleteConfirmationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  postContent: string;
}

export default function DeleteConfirmationModal({
  visible,
  onClose,
  onConfirm,
  postContent
}: DeleteConfirmationModalProps) {
  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onConfirm();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // Truncate post content for preview
  const truncatedContent = postContent.length > 50
    ? postContent.substring(0, 50) + '...'
    : postContent;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={onClose}
        activeOpacity={1}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <View className="bg-white rounded-t-3xl">
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
                <View className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <Text className="text-sm text-gray-700 italic">
                    "{truncatedContent}"
                  </Text>
                </View>
              )}
            </View>

            {/* Buttons */}
            <View className="p-4">
              <TouchableOpacity
                className="bg-red-500 py-4 px-4 rounded-xl flex-row items-center justify-center mb-3"
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
    </Modal>
  );
}
