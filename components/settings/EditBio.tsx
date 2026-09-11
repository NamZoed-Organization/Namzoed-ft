import PopupMessage from '@/components/ui/PopupMessage';
import CircularLoader from '@/components/ui/CircularLoader';
import { useUser } from '@/contexts/UserContext';
import { updateUserProfile } from '@/lib/profileService';
import { ChevronLeft } from 'lucide-react-native';
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
    <View className="flex-1 bg-gray-50" style={{ paddingBottom: insets.bottom }}>
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup(p => ({ ...p, visible: false }))}
      />

      {/* Header — Cancel (grey) / title (centered) / Save (light blue,
          darkens once there's content to save). */}
      <View className="flex-row items-center justify-between px-4 pb-4 pt-2">
        {/* A chevron, matching the Edit Profile hub these open from — the
            row you came from is one level up, not a modal to cancel out
            of. Save stays on the right. */}
        <TouchableOpacity onPress={onClose} className="py-1 -ml-1">
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
        <View
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, justifyContent: "center", alignItems: "center" }}
          pointerEvents="none"
        >
          <Text className="text-xl font-medium text-gray-900">Edit Bio</Text>
        </View>
        <TouchableOpacity
          onPress={handleSave}
          disabled={loading || bio.trim().length === 0}
          className="py-1"
        >
          {loading ? (
            <CircularLoader color="#094569" size="small" />
          ) : (
            <Text
              className="text-xl font-medium"
              style={{ color: bio.trim().length > 0 ? "#0369A1" : "#93C5FD" }}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 10, flex: 1 }}>
        <View style={{ position: "relative" }}>
          <TextInput
            style={{ borderRadius: 12, borderCurve: "continuous", minHeight: 160, textAlignVertical: "top" }}
            className="bg-white px-4 py-3 text-xl text-gray-900"
            placeholder="Tell people a bit about yourself"
            placeholderTextColor="#9CA3AF"
            value={bio}
            onChangeText={(text) => setBio(text.slice(0, BIO_MAX_LENGTH))}
            multiline
            maxLength={BIO_MAX_LENGTH}
            autoFocus
          />
          <Text
            className="text-xl text-gray-400"
            style={{ position: "absolute", right: 12, bottom: 10 }}
          >
            {bio.length}/{BIO_MAX_LENGTH}
          </Text>
        </View>
      </View>
    </View>
  );
}
