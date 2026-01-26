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

interface PostActionSheetProps {
  visible: boolean;
  onClose: () => void;
  isOwnPost: boolean;
  onDelete?: () => void;
  onReport?: () => void;
}

export default function PostActionSheet({
  visible,
  onClose,
  isOwnPost,
  onDelete,
  onReport
}: PostActionSheetProps) {
  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete?.();
  };

  const handleReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReport?.();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

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
            <View className="p-4 border-b border-gray-200">
              <Text className="text-lg font-semibold text-center">
                {isOwnPost ? 'Post Options' : 'Report Post'}
              </Text>
            </View>
            <View className="p-4">
              {isOwnPost ? (
                <TouchableOpacity
                  className="flex-row items-center py-4 px-2"
                  onPress={handleDelete}
                >
                  <Trash2 size={24} color="#EF4444" />
                  <Text className="ml-4 text-base text-red-600 font-medium">
                    Delete Post
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  className="flex-row items-center py-4 px-2"
                  onPress={handleReport}
                >
                  <AlertCircle size={24} color="#EF4444" />
                  <Text className="ml-4 text-base text-red-600 font-medium">
                    Report Post
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="flex-row items-center justify-center py-4 px-2 border-t border-gray-100 mt-2"
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
