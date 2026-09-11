import CircularLoader from '@/components/ui/CircularLoader';
import PopupMessage from '@/components/ui/PopupMessage';
import { MODAL_RADIUS } from '@/constants/theme';
import { reportUser } from '@/lib/reportService';
import * as Haptics from 'expo-haptics';
import { Check, ChevronLeft } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ReportUserModalProps {
  visible: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName: string;
  currentUserId: string;
  onReportSuccess?: () => void;
}

// Sentence case, like every other option list in the app. The ids are what
// reaches the database and are deliberately unchanged.
const REPORT_REASONS = [
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'scam', label: 'Scam or fraud' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'fake', label: 'Fake account' },
  { id: 'other', label: 'Other' },
];

const DETAILS_MAX_LENGTH = 500;

// A form screen, not a dialog — it asks for a choice and a paragraph, which
// is exactly what UI_STANDARD.md's form/multi-field rules describe. So it
// gets the grey ground with white blocks on it, a three-part header whose
// right-hand text action is the only way to submit, an inline block of
// selectable rows for the reason (never chips), and an unbordered field with
// its counter floating inside. What it replaced was a blurred white sheet
// with red pills and a full-width red button at the bottom.
export default function ReportUserModal({
  visible,
  onClose,
  targetUserId,
  targetUserName,
  currentUserId,
  onReportSuccess,
}: ReportUserModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; type: 'warning' | 'error'; title: string; message: string }>({
    visible: false, type: 'warning', title: '', message: '',
  });
  const [showSuccess, setShowSuccess] = useState(false);

  // Same rule as every other form here: the action is live only when there
  // is something complete to send.
  const canSubmit = !!selectedReason && details.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSubmitting(true);

    const result = await reportUser({
      reporter_id: currentUserId,
      target_id: targetUserId,
      reason: selectedReason,
      details: details.trim(),
    });

    setSubmitting(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedReason('');
      setDetails('');
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        onClose();
        onReportSuccess?.();
      }, 2500);
    } else {
      setPopup({
        visible: true,
        type: 'error',
        title: 'Report Failed',
        message: result.error || 'Failed to submit report. Please try again.',
      });
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
    <Modal
      visible={visible}
      animationType="slide"
      // Full-bleed to both edges — the grey ground has to reach the bottom of
      // the screen, not stop at Android's navigation bar. The insets below
      // are what keep the header and content clear.
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleClose}
    >
      <View
        className="flex-1 bg-gray-50"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      >
        {/* The profile underneath sets light-content for its cover; RN
            merges StatusBar props last-mounted-wins, so this screen has to
            set its own or the icons stay invisible on the grey. */}
        <StatusBar barStyle="dark-content" />

        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup(p => ({ ...p, visible: false }))}
        />
        <PopupMessage
          visible={showSuccess}
          type="white"
          title="Report Submitted"
          message="Thanks for letting us know. We'll review this account soon."
        />

        {/* Header — chevron back, centred title, one text action. */}
        <View className="flex-row items-center justify-between px-4 pb-4 pt-2">
          <TouchableOpacity onPress={handleClose} className="py-1 -ml-1">
            <ChevronLeft size={28} color="#374151" />
          </TouchableOpacity>
          <View
            style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, justifyContent: "center", alignItems: "center" }}
            pointerEvents="none"
          >
            <Text className="text-xl font-medium text-gray-900">Report</Text>
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
            className="py-1"
          >
            {submitting ? (
              <CircularLoader color="#094569" size="small" />
            ) : (
              <Text
                className="text-xl font-medium"
                style={{ color: canSubmit ? "#0369A1" : "#93C5FD" }}
              >
                Submit
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Reason — a short list, so it renders inline as selectable
                rows with a Check rather than opening a sheet. No label
                above it; the rows say what they are. */}
            <View
              style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", overflow: "hidden" }}
              className="bg-white"
            >
              {REPORT_REASONS.map((reason, index) => (
                <TouchableOpacity
                  key={reason.id}
                  onPress={() => handleReasonSelect(reason.id)}
                  activeOpacity={0.7}
                  className={`px-4 py-4 flex-row items-center ${index > 0 ? "border-t border-gray-100" : ""}`}
                >
                  <Text className="text-xl text-gray-900 flex-1">
                    {reason.label}
                  </Text>
                  {selectedReason === reason.id && (
                    <Check size={20} color="#0369A1" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Details — no border, counter inside the field, and enough
                bottom padding that the last line can't run under it. */}
            <View style={{ position: "relative", marginTop: 12 }}>
              <TextInput
                value={details}
                onChangeText={(text) => setDetails(text.slice(0, DETAILS_MAX_LENGTH))}
                placeholder="What happened?"
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={DETAILS_MAX_LENGTH}
                className="bg-white px-4 py-3 text-xl text-gray-900"
                style={{
                  borderRadius: MODAL_RADIUS,
                  borderCurve: "continuous",
                  minHeight: 160,
                  paddingBottom: 34,
                  textAlignVertical: "top",
                }}
              />
              <Text
                className="text-xl text-gray-400"
                style={{ position: "absolute", right: 12, bottom: 10 }}
              >
                {details.length}/{DETAILS_MAX_LENGTH}
              </Text>
            </View>

            <Text className="text-base text-gray-400 mt-3 px-1">
              Reports are anonymous — @{targetUserName} won&apos;t be told who
              reported them. Our team reviews every report.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
