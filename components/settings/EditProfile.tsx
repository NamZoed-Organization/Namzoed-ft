import PopupMessage from '@/components/ui/PopupMessage';
import CircularLoader from '@/components/ui/CircularLoader';
import { useUser } from '@/contexts/UserContext';
import { updateUserProfile } from '@/lib/profileService';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EditProfileProps {
  onClose?: () => void;
}

export default function EditProfile({ onClose }: EditProfileProps) {
  const { currentUser, setCurrentUser } = useUser();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; type: 'success' | 'error'; title: string; message: string }>({
    visible: false, type: 'success', title: '', message: '',
  });

  useEffect(() => {
    if (currentUser) {
      setName((currentUser as any).name || '');
    }
  }, [currentUser]);

  const showPopup = (type: 'success' | 'error', title: string, message: string) => {
    setPopup({ visible: true, type, title, message });
    setTimeout(() => setPopup(p => ({ ...p, visible: false })), 2500);
  };

  const handleSave = async () => {
    if (!currentUser?.id) return;
    if (!name.trim()) {
      showPopup('error', 'Missing Name', 'Please enter your name.');
      return;
    }
    setLoading(true);
    try {
      await updateUserProfile(currentUser.id, { name: name.trim() });
      setCurrentUser({ ...currentUser, name: name.trim() } as any);
      showPopup('success', 'Profile Updated', 'Your profile has been updated.');
      setTimeout(() => onClose?.(), 1500);
    } catch {
      showPopup('error', 'Update Failed', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingBottom: insets.bottom }}>
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup(p => ({ ...p, visible: false }))}
      />

      {/* Header */}
      <View className="flex-row items-center px-4 pb-4 pt-2">
        <TouchableOpacity onPress={onClose} className="mr-3 p-1">
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Edit Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10 }}>
        <View className="mb-4">
          <Text className="text-sm font-msemibold text-gray-700 mb-2">Name</Text>
          <TextInput
            className="bg-gray-50 rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-200"
            placeholder="Enter your name"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
          />
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          className="bg-primary rounded-xl py-4 items-center mt-4"
        >
          {loading ? (
            <CircularLoader color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
