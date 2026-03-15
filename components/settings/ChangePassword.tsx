import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react-native';
import PopupMessage from '@/components/ui/PopupMessage';
import { supabase } from '@/lib/supabase';

interface ChangePasswordProps {
  onClose?: () => void;
}

export default function ChangePassword({ onClose }: ChangePasswordProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{visible: boolean, type: 'success'|'error'|'warning'|'white', title: string, message: string}>({visible: false, type: 'success', title: '', message: ''});

  const showPopup = (type: 'success'|'error'|'warning'|'white', title: string, message: string) => {
    setPopup({visible: true, type, title, message});
    setTimeout(() => setPopup(p => ({...p, visible: false})), 2500);
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      showPopup('error', 'Missing Fields', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      showPopup('error', 'Mismatch', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      showPopup('error', 'Weak Password', 'Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        showPopup('error', 'Change Failed', error.message);
      } else {
        showPopup('success', 'Password Changed!', 'Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onClose?.();
      }
    } catch (error: any) {
      showPopup('error', 'Error', error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleTestPassword = async () => {
    if (!currentPassword) {
      showPopup('error', 'Missing Field', 'Please enter a test password');
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.email) {
        showPopup('error', 'No Email', 'No user email found');
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (error) {
        showPopup('error', 'Test Failed', `Password does NOT match database\n\nError: ${error.message}`);
      } else {
        showPopup('success', 'Test Passed!', `Password MATCHES database\n\nUser ID: ${data.user?.id}`);
      }
    } catch (error: any) {
      showPopup('error', 'Test Error', error.message || 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-gray-200">
        <TouchableOpacity onPress={onClose} className="mr-3">
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Change Password</Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-8">
          {/* Current Password (for testing) */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">Test Password</Text>
            <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3 border border-gray-300">
              <TextInput
                className="flex-1 text-base text-gray-900"
                placeholder="Enter password to test"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                {showCurrent ? (
                  <EyeOff size={20} color="#6b7280" />
                ) : (
                  <Eye size={20} color="#6b7280" />
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={handleTestPassword}
              disabled={loading}
              className="mt-2 bg-gray-600 rounded-lg py-2 px-4"
            >
              <Text className="text-white text-center font-medium">
                {loading ? 'Testing...' : 'Test Password'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View className="border-t border-gray-300 my-4" />

          {/* New Password */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">New Password</Text>
            <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3 border border-gray-300">
              <TextInput
                className="flex-1 text-base text-gray-900"
                placeholder="Enter new password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                {showNew ? (
                  <EyeOff size={20} color="#6b7280" />
                ) : (
                  <Eye size={20} color="#6b7280" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">Confirm Password</Text>
            <View className="flex-row items-center bg-gray-100 rounded-lg px-4 py-3 border border-gray-300">
              <TextInput
                className="flex-1 text-base text-gray-900"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                {showConfirm ? (
                  <EyeOff size={20} color="#6b7280" />
                ) : (
                  <Eye size={20} color="#6b7280" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Change Password Button */}
          <TouchableOpacity
            onPress={handleChangePassword}
            disabled={loading}
            className="bg-primary rounded-lg py-4 px-6"
          >
            <Text className="text-white text-center font-semibold text-base">
              {loading ? 'Changing Password...' : 'Change Password'}
            </Text>
          </TouchableOpacity>

          {/* Info Text */}
          <Text className="text-xs text-gray-500 text-center mt-4">
            Password must be at least 6 characters long
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
