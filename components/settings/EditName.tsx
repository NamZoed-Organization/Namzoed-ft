import CircularLoader from '@/components/ui/CircularLoader';
import PopupMessage from '@/components/ui/PopupMessage';
import { MODAL_RADIUS } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { updateUserProfile } from '@/lib/profileService';
import { ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EditNameProps {
  onClose?: () => void;
}

const NAME_MAX_LENGTH = 50;

// Just the display name, on its own screen — the Edit Profile hub's Name row
// opens straight here. Built to UI_STANDARD.md, same as EditBio.
export default function EditName({ onClose }: EditNameProps) {
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

  const canSave = name.trim().length > 0 && name !== ((currentUser as any)?.name || '');

  const showPopup = (type: 'success' | 'error', title: string, message: string) => {
    setPopup({ visible: true, type, title, message });
    setTimeout(() => setPopup(p => ({ ...p, visible: false })), 2500);
  };

  const handleSave = async () => {
    if (!currentUser?.id) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await updateUserProfile(currentUser.id, { name: trimmed });
      setCurrentUser({ ...currentUser, name: trimmed } as any);
      showPopup('success', 'Name Updated', 'Your name has been updated.');
      setTimeout(() => onClose?.(), 1500);
    } catch {
      showPopup('error', 'Update Failed', 'Failed to update your name. Please try again.');
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
          <Text className="text-xl font-medium text-gray-900">Name</Text>
        </View>
        <TouchableOpacity onPress={handleSave} disabled={loading || !canSave} className="py-1">
          {loading ? (
            <CircularLoader color="#094569" size="small" />
          ) : (
            <Text className="text-xl font-medium" style={{ color: canSave ? "#0369A1" : "#93C5FD" }}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 10, flex: 1 }}>
        <View style={{ position: "relative" }}>
          <TextInput
            style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", paddingBottom: 34 }}
            className="bg-white px-4 py-3 text-xl text-gray-900"
            placeholder="Your name"
            placeholderTextColor="#9CA3AF"
            value={name}
            onChangeText={(text) => setName(text.slice(0, NAME_MAX_LENGTH))}
            maxLength={NAME_MAX_LENGTH}
            autoFocus
          />
          <Text
            className="text-xl text-gray-400"
            style={{ position: "absolute", right: 12, bottom: 10 }}
          >
            {name.length}/{NAME_MAX_LENGTH}
          </Text>
        </View>
      </View>
    </View>
  );
}
