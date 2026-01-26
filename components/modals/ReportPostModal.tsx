import * as Haptics from 'expo-haptics';
import { AlertCircle, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { reportPost } from '@/lib/reportService';
import { feedEvents } from '@/utils/feedEvents';

interface ReportPostModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string;
  postContent: string;
  postOwnerId: string;
  currentUserId: string;
  onReportSuccess?: () => void;
}

const POST_REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment or Hate Speech' },
  { id: 'inappropriate', label: 'Inappropriate Content' },
  { id: 'misinformation', label: 'False Information' },
  { id: 'other', label: 'Other' }
];

export default function ReportPostModal({
  visible,
  onClose,
  postId,
  postContent,
  postOwnerId,
  currentUserId,
  onReportSuccess
}: ReportPostModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Vertical slide for drag-to-close
  const panY = useRef(new Animated.Value(0)).current;
  const screenHeight = Dimensions.get('window').height;

  // Pan Responder for Drag-to-Close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Activate if dragging down vertically more than horizontally
        return (
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx) &&
          gestureState.dy > 5
        );
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging downwards
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          // Drag threshold: 100px or 500px/s velocity
          Animated.timing(panY, {
            toValue: screenHeight,
            duration: 200,
            useNativeDriver: false,
          }).start(() => handleClose());
        } else {
          // Spring back to top
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: false,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  // Reset panY when modal becomes visible
  useEffect(() => {
    if (visible) {
      panY.setValue(0);
    }
  }, [visible, panY]);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Select Reason', 'Please select a reason for reporting');
      return;
    }

    if (!details.trim()) {
      Alert.alert('Provide Details', 'Please provide additional details');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);

    const result = await reportPost({
      reporter_id: currentUserId,
      target_id: postOwnerId,
      item_id: postId,
      reason: selectedReason,
      details: details.trim()
    });

    setSubmitting(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Emit event immediately to hide post from feed
      feedEvents.emit('postReported', postId);
      onReportSuccess?.();

      // Reset form
      setSelectedReason('');
      setDetails('');

      // Show success message
      Alert.alert(
        'Report Submitted',
        "Post reported and hidden from your feed. We'll review it soon.",
        [
          {
            text: 'OK',
            onPress: () => {
              onClose();
            }
          }
        ]
      );
    } else {
      Alert.alert('Error', result.error || 'Failed to submit report');
    }
  };

  const handleReasonSelect = (reasonId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedReason(reasonId);
  };

  const handleClose = () => {
    setSelectedReason('');
    setDetails('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-end"
        onPress={handleClose}
        activeOpacity={1}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <Animated.View
              className="bg-white rounded-t-3xl overflow-hidden shadow-xl w-full"
              style={{
                transform: [{ translateY: panY }],
              }}
            >
              {/* Drag Bar */}
              <View
                {...panResponder.panHandlers}
                className="w-full items-center justify-center py-3 bg-white"
              >
                <View className="w-16 h-1.5 bg-gray-300 rounded-full" />
              </View>

              {/* Header */}
              <View className="px-6 pt-2 pb-4 border-b border-gray-200">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <AlertCircle size={24} color="#EF4444" />
                    <Text className="text-xl font-mbold text-gray-900 ml-2">
                      Report Post
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleClose}
                    className="w-10 h-10 items-center justify-center"
                  >
                    <X size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <Text className="text-sm font-regular text-gray-600">
                  Report this post: "{postContent}"
                </Text>
              </View>

              {/* Content */}
              <ScrollView className="px-6 py-6 max-h-[500px]">
                {/* Reason Selection */}
                <Text className="text-base font-msemibold text-gray-900 mb-3">
                  Select Reason
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-6">
                  {POST_REPORT_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason.id}
                      onPress={() => handleReasonSelect(reason.id)}
                      className={`px-4 py-2.5 rounded-full border ${
                        selectedReason === reason.id
                          ? 'bg-red-50 border-red-500'
                          : 'bg-white border-gray-300'
                      }`}
                    >
                      <Text
                        className={`text-sm font-msemibold ${
                          selectedReason === reason.id
                            ? 'text-red-600'
                            : 'text-gray-700'
                        }`}
                      >
                        {reason.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Details Input */}
                <Text className="text-base font-msemibold text-gray-900 mb-3">
                  Additional Details
                </Text>
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Please provide more information about this report..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  className="bg-white border border-gray-300 rounded-2xl p-4 text-gray-900 font-regular text-base min-h-[120px]"
                  style={{ textAlignVertical: 'top' }}
                />
                <Text className="text-xs text-gray-500 mt-2 text-right">
                  {details.length}/500
                </Text>

                {/* Submit Button */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={submitting || !selectedReason || !details.trim()}
                  className={`mt-6 py-4 rounded-2xl ${
                    submitting || !selectedReason || !details.trim()
                      ? 'bg-gray-300'
                      : 'bg-red-500'
                  }`}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white text-center font-mbold text-base">
                      Submit Report
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </Animated.View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
