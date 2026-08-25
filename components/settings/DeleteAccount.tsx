import { supabase } from '@/lib/supabase';
import { AlertTriangle, ArrowLeft, Trash2 } from 'lucide-react-native';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import PopupMessage from '@/components/ui/PopupMessage';
import CircularLoader from '@/components/ui/CircularLoader';

interface DeleteAccountProps {
  onClose?: () => void;
  onAccountDeleted?: () => void;
}

export default function DeleteAccount({ onClose, onAccountDeleted }: DeleteAccountProps) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{visible: boolean, type: 'success'|'error'|'warning'|'white', title: string, message: string}>({visible: false, type: 'success', title: '', message: ''});

  const showPopup = (type: 'success'|'error'|'warning'|'white', title: string, message: string) => {
    setPopup({visible: true, type, title, message});
    setTimeout(() => setPopup(p => ({...p, visible: false})), 2500);
  };

  const isConfirmed = confirmText.trim().toLowerCase() === 'delete my account';

  const handleDeleteAccount = async () => {
    if (!isConfirmed) return;

    Alert.alert(
      'Final Confirmation',
      'This action is permanent and cannot be undone. All your data including profile, posts, messages, and listings will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              // Call the server-side RPC that deletes user data and auth account
              const { error: rpcError } = await supabase.rpc('delete_user_account');

              if (rpcError) {
                showPopup('error', 'Deletion Failed', rpcError.message || 'Failed to delete account. Please contact support.');
                return;
              }

              // Sign out locally
              await supabase.auth.signOut({ scope: 'local' });

              onAccountDeleted?.();
            } catch (error: any) {
              showPopup('error', 'Error', error.message || 'Something went wrong. Please contact support at namzoed.com/support');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-gray-200">
        <TouchableOpacity onPress={onClose} className="mr-3">
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Delete Account</Text>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-8">
          {/* Warning Banner */}
          <View className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-8">
            <View className="flex-row items-center mb-3">
              <View className="w-10 h-10 bg-red-100 rounded-full items-center justify-center mr-3">
                <AlertTriangle size={22} color="#dc2626" />
              </View>
              <Text className="text-lg font-bold text-red-700 flex-1">
                Danger Zone
              </Text>
            </View>
            <Text className="text-sm text-red-600 leading-5">
              Deleting your account is permanent and cannot be reversed. All of the following will be permanently removed:
            </Text>
          </View>

          {/* What gets deleted */}
          <View className="bg-gray-50 rounded-xl p-5 mb-8">
            <Text className="text-sm font-semibold text-gray-800 mb-3">What will be deleted:</Text>
            {[
              'Your profile and personal information',
              'All your posts and media',
              'Your product and service listings',
              'All messages and chat history',
              'Your reviews and ratings',
              'Saved posts and preferences',
              'Follower and following connections',
            ].map((item, i) => (
              <View key={i} className="flex-row items-start mb-2">
                <Text className="text-red-500 mr-2 text-sm">•</Text>
                <Text className="text-sm text-gray-700 flex-1">{item}</Text>
              </View>
            ))}
          </View>

          {/* Confirmation input */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Type <Text className="font-bold text-red-600">DELETE MY ACCOUNT</Text> to confirm
            </Text>
            <TextInput
              className="bg-gray-100 rounded-lg px-4 py-3 border border-gray-300 text-base text-gray-900"
              placeholder="DELETE MY ACCOUNT"
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* Delete button */}
          <TouchableOpacity
            onPress={handleDeleteAccount}
            disabled={!isConfirmed || loading}
            className={`flex-row items-center justify-center py-4 rounded-xl ${
              isConfirmed && !loading ? 'bg-red-600' : 'bg-gray-300'
            }`}
            activeOpacity={0.7}
          >
            {loading ? (
              <CircularLoader size="small" color="#fff" />
            ) : (
              <>
                <Trash2 size={18} color={isConfirmed ? '#fff' : '#9ca3af'} style={{ marginRight: 8 }} />
                <Text className={`text-base font-semibold ${isConfirmed ? 'text-white' : 'text-gray-400'}`}>
                  Permanently Delete Account
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Contact support note */}
          <Text className="text-xs text-gray-400 text-center mt-6 leading-4">
            If you're having issues or need help, please contact our support team at namzoed.com/support before deleting your account.
          </Text>
        </View>
      </ScrollView>

      {/* Popup */}
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
      />
    </View>
  );
}
