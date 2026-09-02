import PopupMessage from '@/components/ui/PopupMessage';
import CircularLoader from '@/components/ui/CircularLoader';
import { useUser } from '@/contexts/UserContext';
import { dzongkhagCenters } from '@/data/dzongkhag';
import { updateUserProfile } from '@/lib/profileService';
import { Picker } from '@react-native-picker/picker';
import { ArrowLeft, MapPin } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EditProfileProps {
  onClose?: () => void;
}

const BIO_MAX_LENGTH = 150;

export default function EditProfile({ onClose }: EditProfileProps) {
  const { currentUser, setCurrentUser } = useUser();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [dzongkhag, setDzongkhag] = useState('');
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; type: 'success' | 'error'; title: string; message: string }>({
    visible: false, type: 'success', title: '', message: '',
  });

  useEffect(() => {
    if (currentUser) {
      setName((currentUser as any).name || '');
      setBio((currentUser as any).bio || '');
      setDzongkhag(currentUser.dzongkhag || '');
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
      const trimmedBio = bio.trim();
      await updateUserProfile(currentUser.id, {
        name: name.trim(),
        bio: trimmedBio || null,
        dzongkhag: dzongkhag || null,
      });
      setCurrentUser({ ...currentUser, name: name.trim(), bio: trimmedBio || null, dzongkhag: dzongkhag || null } as any);
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
            style={{ borderRadius: 12, borderCurve: "continuous" }}
            className="bg-gray-50 px-4 py-3 text-base text-gray-900 border border-gray-200"
            placeholder="Enter your name"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View className="mb-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-msemibold text-gray-700">Bio</Text>
            <Text className="text-xs text-gray-400">{bio.length}/{BIO_MAX_LENGTH}</Text>
          </View>
          <TextInput
            style={{ borderRadius: 12, borderCurve: "continuous", minHeight: 88, textAlignVertical: "top" }}
            className="bg-gray-50 px-4 py-3 text-base text-gray-900 border border-gray-200"
            placeholder="Tell people a bit about yourself (optional)"
            placeholderTextColor="#9CA3AF"
            value={bio}
            onChangeText={(text) => setBio(text.slice(0, BIO_MAX_LENGTH))}
            multiline
            maxLength={BIO_MAX_LENGTH}
          />
        </View>

        <View className="mb-4">
          <Text className="text-sm font-msemibold text-gray-700 mb-2">Location</Text>
          <View
            style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-gray-50 border border-gray-200 flex-row items-center px-2">
            <MapPin size={18} color="#9CA3AF" style={{ marginLeft: 6 }} />
            <Picker
              selectedValue={dzongkhag}
              onValueChange={(value) => setDzongkhag(value)}
              style={{ flex: 1, height: 50 }}
            >
              <Picker.Item label="Not set" value="" />
              {dzongkhagCenters.map((dz) => (
                <Picker.Item key={dz.name} label={dz.name} value={dz.name} />
              ))}
            </Picker>
          </View>
        </View>

        <TouchableOpacity
          style={{ borderRadius: 12, borderCurve: "continuous" }}
          onPress={handleSave}
          disabled={loading}
          className="bg-primary py-4 items-center mt-4"
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
