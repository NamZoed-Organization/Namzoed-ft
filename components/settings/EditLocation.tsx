import BottomSheetModal from '@/components/modals/BottomSheetModal';
import CircularLoader from '@/components/ui/CircularLoader';
import PopupMessage from '@/components/ui/PopupMessage';
import { MODAL_RADIUS } from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { dzongkhagCenters } from '@/data/dzongkhag';
import { updateUserProfile } from '@/lib/profileService';
import { nearestDzongkhag } from '@/utils/dzongkhag';
import * as Location from 'expo-location';
import { Check, ChevronLeft, ChevronRight, LocateFixed, MapPin } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EditLocationProps {
  onClose?: () => void;
}

// Location screen: detect the dzongkhag from where the phone actually is, or
// pick one from the list. Built to UI_STANDARD.md, same as EditBio.
export default function EditLocation({ onClose }: EditLocationProps) {
  const { currentUser, setCurrentUser } = useUser();
  const insets = useSafeAreaInsets();
  const [dzongkhag, setDzongkhag] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [showList, setShowList] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; type: 'success' | 'error'; title: string; message: string }>({
    visible: false, type: 'success', title: '', message: '',
  });

  useEffect(() => {
    if (currentUser) setDzongkhag(currentUser.dzongkhag || '');
  }, [currentUser]);

  const canSave = dzongkhag !== (currentUser?.dzongkhag || '');

  const showPopup = (type: 'success' | 'error', title: string, message: string) => {
    setPopup({ visible: true, type, title, message });
    setTimeout(() => setPopup(p => ({ ...p, visible: false })), 2500);
  };

  // Detect only fills the field in — saving is still the header button, so a
  // wrong reading can be corrected (or abandoned) before it's committed.
  const handleDetect = async () => {
    setDetecting(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showPopup('error', 'Location Off', 'Allow location access to detect your dzongkhag.');
        return;
      }
      const { coords } = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setDzongkhag(nearestDzongkhag(coords.latitude, coords.longitude));
    } catch {
      showPopup('error', 'Detection Failed', "Couldn't read your location. Pick your dzongkhag instead.");
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      await updateUserProfile(currentUser.id, { dzongkhag: dzongkhag || null });
      setCurrentUser({ ...currentUser, dzongkhag: dzongkhag || null } as any);
      showPopup('success', 'Location Updated', 'Your location has been updated.');
      setTimeout(() => onClose?.(), 1500);
    } catch {
      showPopup('error', 'Update Failed', 'Failed to update your location. Please try again.');
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
          <Text className="text-xl font-medium text-gray-900">Location</Text>
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
        {/* Current selection. */}
        <View
          style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous" }}
          className="bg-white px-4 py-4 flex-row items-center"
        >
          <MapPin size={20} color="#9CA3AF" />
          <Text
            className="text-xl ml-3 flex-1"
            style={{ color: dzongkhag ? "#111827" : "#9CA3AF" }}
            numberOfLines={1}
          >
            {dzongkhag || "No dzongkhag set"}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleDetect}
          disabled={detecting}
          activeOpacity={0.7}
          style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", marginTop: 12 }}
          className="bg-white px-4 py-4 flex-row items-center"
        >
          {detecting ? (
            <CircularLoader color="#0369A1" size="small" />
          ) : (
            <LocateFixed size={20} color="#0369A1" />
          )}
          <Text className="text-xl ml-3 flex-1" style={{ color: "#0369A1" }}>
            {detecting ? "Detecting…" : "Use my current location"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowList(true)}
          activeOpacity={0.7}
          style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", marginTop: 12 }}
          className="bg-white px-4 py-4 flex-row items-center"
        >
          <Text className="text-xl text-gray-900 flex-1">Choose from the list</Text>
          <ChevronRight size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <Text className="text-base text-gray-400 mt-3 px-1 leading-5">
          Detecting picks the dzongkhag nearest to where you are right now.
          Your exact coordinates are never saved.
        </Text>
      </View>

      <BottomSheetModal visible={showList} onClose={() => setShowList(false)}>
        {(close) => (
          <View style={{ flexShrink: 1 }}>
            <Text className="text-xl font-medium text-gray-900 px-6 pb-3 pt-1">
              Dzongkhag
            </Text>
            <ScrollView>
              {[{ name: "Not set" }, ...dzongkhagCenters].map((dz, index) => {
                const value = index === 0 ? "" : dz.name;
                return (
                  <TouchableOpacity
                    key={dz.name}
                    onPress={() => {
                      setDzongkhag(value);
                      close();
                    }}
                    activeOpacity={0.7}
                    className="px-6 py-3 flex-row items-center"
                  >
                    <Text
                      className="text-xl flex-1"
                      style={{ color: index === 0 ? "#9CA3AF" : "#111827" }}
                    >
                      {dz.name}
                    </Text>
                    {value === dzongkhag && <Check size={20} color="#0369A1" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </BottomSheetModal>
    </View>
  );
}
