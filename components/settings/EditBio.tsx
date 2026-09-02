import PopupMessage from '@/components/ui/PopupMessage';
import CircularLoader from '@/components/ui/CircularLoader';
import { useUser } from '@/contexts/UserContext';
import { updateUserProfile } from '@/lib/profileService';
import { ArrowLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EditBioProps {
  onClose?: () => void;
}

const BIO_MAX_LENGTH = 150;

// Just the bio field, on its own screen — the profile's bio placeholder
// button opens straight here instead of the full Edit Profile form (which
// also has name/location) when all someone wants to do is fill in their bio.
export default function EditBio({ onClose }: EditBioProps) {
  const { currentUser, setCurrentUser } = useUser();
  const insets = useSafeAreaInsets();
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; type: 'success' | 'error'; title: string; message: string }>({
    visible: false, type: 'success', title: '', message: '',
  });

  useEffect(() => {
    if (currentUser) {
      setBio((currentUser as any).bio || '');
    }
  }, [currentUser]);

  const showPopup = (type: 'success' | 'error', title: string, message: string) => {
    setPopup({ visible: true, type, title, message });
    setTimeout(() => setPopup(p => ({ ...p, visible: false })), 2500);
  };

  const handleSave = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const trimmedBio = bio.trim();
      await updateUserProfile(currentUser.id, { bio: trimmedBio || null });
      setCurrentUser({ ...currentUser, bio: trimmedBio || null } as any);
      showPopup('success', 'Bio Updated', 'Your bio has been updated.');
      setTimeout(() => onClose?.(), 1500);
    } catch {
      showPopup('error', 'Update Failed', 'Failed to update bio. Please try again.');
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
        <Text className="text-lg font-semibold text-gray-900">Edit Bio</Text>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 10, flex: 1 }}>
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-sm font-msemibold text-gray-700">Bio</Text>
          <Text className="text-xs text-gray-400">{bio.length}/{BIO_MAX_LENGTH}</Text>
        </View>
        <TextInput
          style={{ borderRadius: 12, borderCurve: "continuous", minHeight: 160, textAlignVertical: "top" }}
          className="bg-gray-50 px-4 py-3 text-base text-gray-900 border border-gray-200"
          placeholder="Tell people a bit about yourself"
          placeholderTextColor="#9CA3AF"
          value={bio}
          onChangeText={(text) => setBio(text.slice(0, BIO_MAX_LENGTH))}
          multiline
          maxLength={BIO_MAX_LENGTH}
          autoFocus
        />

        <TouchableOpacity
          style={{ borderRadius: 12, borderCurve: "continuous" }}
          onPress={handleSave}
          disabled={loading}
          className="bg-primary py-4 items-center mt-6"
        >
          {loading ? (
            <CircularLoader color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">Save Bio</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
