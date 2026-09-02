import * as Haptics from 'expo-haptics';
import { AlertCircle, CornerUpLeft, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import ActionSheetModal from '../ui/ActionSheetModal';

interface CommentActionSheetProps {
  visible: boolean;
  onClose: () => void;
  isOwnComment: boolean;
  onReply?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
}

/** Reply + Delete (own comment/reply) or Reply + Report (someone else's). */
export default function CommentActionSheet({
  visible,
  onClose,
  isOwnComment,
  onReply,
  onDelete,
  onReport,
}: CommentActionSheetProps) {
  const handleReply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReply?.();
  };

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onDelete?.();
  };

  const handleReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onReport?.();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  return (
    <ActionSheetModal visible={visible} onClose={onClose}>
      <View
        style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: "continuous" }} className="bg-white">
        <View className="p-4">
          <TouchableOpacity
            className="flex-row items-center py-4 px-2"
            onPress={handleReply}
          >
            <CornerUpLeft size={22} color="#374151" />
            <Text className="ml-4 text-base text-gray-800 font-medium">
              Reply
            </Text>
          </TouchableOpacity>
          {isOwnComment ? (
            <TouchableOpacity
              className="flex-row items-center py-4 px-2"
              onPress={handleDelete}
            >
              <Trash2 size={22} color="#EF4444" />
              <Text className="ml-4 text-base text-red-600 font-medium">
                Delete
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              className="flex-row items-center py-4 px-2"
              onPress={handleReport}
            >
              <AlertCircle size={22} color="#EF4444" />
              <Text className="ml-4 text-base text-red-600 font-medium">
                Report
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
    </ActionSheetModal>
  );
}
