import { reportUser } from '@/lib/reportService';
import PopupMessage from '@/components/ui/PopupMessage';
import CircularLoader from '@/components/ui/CircularLoader';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { AlertCircle, X } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

interface ReportUserModalProps {
  visible: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName: string;
  currentUserId: string;
  onReportSuccess?: () => void;
}

const REPORT_REASONS = [
  { id: 'inappropriate', label: 'Inappropriate Content' },
  { id: 'scam', label: 'Scam or Fraud' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'fake', label: 'Fake Account' },
  { id: 'other', label: 'Other' }
];

export default function ReportUserModal({
  visible,
  onClose,
  targetUserId,
  targetUserName,
  currentUserId,
  onReportSuccess
}: ReportUserModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; type: 'warning' | 'error'; title: string; message: string }>({ visible: false, type: 'warning', title: '', message: '' });
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      setPopup({ visible: true, type: 'warning', title: 'Select Reason', message: 'Please select a reason for reporting' });
      return;
    }

    if (!details.trim()) {
      setPopup({ visible: true, type: 'warning', title: 'Provide Details', message: 'Please provide additional details' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSubmitting(true);

    const result = await reportUser({
      reporter_id: currentUserId,
      target_id: targetUserId,
      reason: selectedReason,
      details: details.trim()
    });

    setSubmitting(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset form
      setSelectedReason('');
      setDetails('');

      // Show success popup
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        onReportSuccess?.();
      }, 2500);
    } else {
      setPopup({ visible: true, type: 'error', title: 'Error', message: result.error || 'Failed to submit report' });
    }
  };

  const handleReasonSelect = (reasonId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedReason(reasonId);
  };

  const handleClose = () => {
    setSelectedReason('');
    setDetails('');
    onClose();
  };

  return (
    <>
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <Animated.View
          entering={SlideInDown.springify()}
          exiting={SlideOutDown}
        >
          <KeyboardAvoidingView
            behavior="padding"
          >
            <BlurView
              style={{ borderTopLeftRadius: 24, borderTopRightRadius: 24, borderCurve: "continuous" }} intensity={90} tint="light" className="overflow-hidden">
              {/* Header */}
              <View className="px-6 pt-6 pb-4 border-b border-gray-200">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <AlertCircle size={24} color="#EF4444" />
                    <Text className="text-xl font-mbold text-gray-900 ml-2">
                      Report User
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
                  Report @{targetUserName} for violating community guidelines
                </Text>
              </View>

              {/* Content */}
              <ScrollView className="px-6 py-6 max-h-[500px]">
                {/* Reason Selection */}
                <Text className="text-base font-msemibold text-gray-900 mb-3">
                  Select Reason
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-6">
                  {REPORT_REASONS.map((reason) => (
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
                  className="bg-white border border-gray-300 p-4 text-gray-900 font-regular text-base min-h-[120px]"
                  style={{ textAlignVertical: 'top', borderRadius: 16, borderCurve: "continuous" }}
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
                    <CircularLoader color="#fff" />
                  ) : (
                    <Text className="text-white text-center font-mbold text-base">
                      Submit Report
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </BlurView>
          </KeyboardAvoidingView>
        </Animated.View>
        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup(p => ({ ...p, visible: false }))}
        />
      </View>
    </Modal>

    {/* Success Popup */}
    <Modal
      visible={showSuccess}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
    >
      <PopupMessage
        visible={showSuccess}
        type="white"
        title="Report Submitted"
        message="Thanks for letting us know. We'll review this user soon."
      />
    </Modal>
    </>
  );
}
