import * as Haptics from 'expo-haptics';
import { AlertCircle } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { reportComment } from '@/lib/reportService';
import PopupMessage from '@/components/ui/PopupMessage';
import CircularLoader from '@/components/ui/CircularLoader';
import BottomSheetModal from './BottomSheetModal';

interface ReportCommentModalProps {
  visible: boolean;
  onClose: () => void;
  commentId: string;
  commentOwnerId: string;
  currentUserId: string;
  onReportSuccess?: () => void;
}

const COMMENT_REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment or Hate Speech' },
  { id: 'inappropriate', label: 'Inappropriate Content' },
  { id: 'other', label: 'Other' },
];

export default function ReportCommentModal({
  visible,
  onClose,
  commentId,
  commentOwnerId,
  currentUserId,
  onReportSuccess,
}: ReportCommentModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; type: 'warning' | 'error'; message: string }>({
    visible: false,
    type: 'warning',
    message: '',
  });

  const reset = () => {
    setSelectedReason('');
    setDetails('');
  };

  const handleSubmit = async (close: () => void) => {
    if (!selectedReason) {
      setPopup({ visible: true, type: 'warning', message: 'Please select a reason for reporting' });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSubmitting(true);

    const result = await reportComment({
      reporter_id: currentUserId,
      target_id: commentOwnerId,
      item_id: commentId,
      reason: selectedReason,
      details: details.trim(),
    });

    setSubmitting(false);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      reset();
      close();
      onReportSuccess?.();
    } else {
      setPopup({ visible: true, type: 'error', message: result.error || 'Failed to submit report' });
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      maxHeight="80%"
    >
      {(close) => (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: '#F3F4F6',
            }}
          >
            <AlertCircle size={20} color="#EF4444" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111', marginLeft: 8 }}>
              Report Comment
            </Text>
          </View>

          <ScrollView style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 10 }}>
              Select a reason
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {COMMENT_REPORT_REASONS.map((reason) => {
                const active = selectedReason === reason.id;
                return (
                  <TouchableOpacity
                    key={reason.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setSelectedReason(reason.id);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? '#EF4444' : '#E5E7EB',
                      backgroundColor: active ? '#FEF2F2' : '#fff',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#DC2626' : '#374151' }}>
                      {reason.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111', marginBottom: 10 }}>
              Additional details (optional)
            </Text>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Tell us more…"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
              style={{
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                color: '#111',
                minHeight: 90,
                textAlignVertical: 'top',
              }}
            />

            <TouchableOpacity
              onPress={() => handleSubmit(close)}
              disabled={submitting || !selectedReason}
              style={{
                marginTop: 20,
                marginBottom: 24,
                paddingVertical: 14,
                borderRadius: 16,
                alignItems: 'center',
                backgroundColor: submitting || !selectedReason ? '#D1D5DB' : '#EF4444',
              }}
            >
              {submitting ? (
                <CircularLoader color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </ScrollView>

          <PopupMessage
            visible={popup.visible}
            type={popup.type}
            message={popup.message}
            onHide={() => setPopup((p) => ({ ...p, visible: false }))}
          />
        </>
      )}
    </BottomSheetModal>
  );
}
