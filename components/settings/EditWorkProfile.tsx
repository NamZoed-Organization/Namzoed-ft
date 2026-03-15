import PopupMessage from '@/components/ui/PopupMessage';
import { useUser } from '@/contexts/UserContext';
import { fetchServiceProviderProfile, updateServiceProviderProfile } from '@/lib/servicesService';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EditWorkProfileProps {
  onClose?: () => void;
  onSaved?: () => void;
}

export default function EditWorkProfile({ onClose, onSaved }: EditWorkProfileProps) {
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();
  const [businessName, setBusinessName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; type: 'success' | 'error'; title: string; message: string }>({
    visible: false, type: 'success', title: '', message: '',
  });

  useEffect(() => {
    if (!currentUser?.id) return;
    fetchServiceProviderProfile(currentUser.id).then((data) => {
      if (data) {
        setBusinessName(data.name || '');
        setBio(data.master_bio || '');
      }
    }).catch(() => {});
  }, [currentUser?.id]);

  const showPopup = (type: 'success' | 'error', title: string, message: string) => {
    setPopup({ visible: true, type, title, message });
    setTimeout(() => setPopup(p => ({ ...p, visible: false })), 2500);
  };

  const handleSave = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      await updateServiceProviderProfile(currentUser.id, {
        name: businessName.trim(),
        master_bio: bio.trim(),
      });
      showPopup('success', 'Profile Updated', 'Work profile saved successfully.');
      onSaved?.();
      setTimeout(() => onClose?.(), 1500);
    } catch {
      showPopup('error', 'Update Failed', 'Failed to save. Please try again.');
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
        <Text className="text-lg font-semibold text-gray-900">Edit Work Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10 }}>
        <View className="mb-4">
          <Text className="text-sm font-msemibold text-gray-700 mb-2">Business Name</Text>
          <TextInput
            className="bg-gray-50 rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-200"
            placeholder="Enter business name"
            placeholderTextColor="#9CA3AF"
            value={businessName}
            onChangeText={setBusinessName}
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-msemibold text-gray-700 mb-2">Business Bio</Text>
          <TextInput
            className="bg-gray-50 rounded-xl px-4 py-3 text-base text-gray-900 border border-gray-200"
            placeholder="Tell us about your business"
            placeholderTextColor="#9CA3AF"
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            style={{ minHeight: 100 }}
          />
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={loading}
          className="bg-primary rounded-xl py-4 items-center mt-2"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
