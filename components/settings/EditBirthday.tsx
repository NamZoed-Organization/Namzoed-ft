import CircularLoader from '@/components/ui/CircularLoader';
import PopupMessage from '@/components/ui/PopupMessage';
import { MODAL_RADIUS, SWITCH_COLORS } from '@/constants/theme';
import { useSafety } from '@/contexts/SafetyContext';
import { useUser } from '@/contexts/UserContext';
import { updateUserProfile } from '@/lib/profileService';
import { formatDisplayDate, getAgeFromDate, toISODate } from '@/utils/age';
import {
  BirthdayDisplay,
  getAnimalYear,
  getSunSign,
  parseBirthDate,
} from '@/utils/zodiac';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LIGHT_DATE_PICKER_PROPS } from '@/constants/datePicker';
import { Cake, Check, ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface EditBirthdayProps {
  onClose?: () => void;
}

// Options for what a profile shows in place of the actual date. The date
// itself is never shown to anyone — that's the whole point of this screen.
const DISPLAY_OPTIONS: { value: BirthdayDisplay; label: string; hint: string }[] = [
  { value: 'age', label: 'Age', hint: 'How old you are, in years' },
  { value: 'animal', label: 'Animal year', hint: 'Your Bhutanese animal year' },
  { value: 'sun', label: 'Sun sign', hint: 'Your Western star sign' },
];

// Birthday screen: pick the date, then choose whether — and as what — it
// appears on your profile. Built to UI_STANDARD.md, same as EditBio.
export default function EditBirthday({ onClose }: EditBirthdayProps) {
  const { currentUser, setCurrentUser } = useUser();
  const { refresh: refreshSafety } = useSafety();
  const insets = useSafeAreaInsets();
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showOnProfile, setShowOnProfile] = useState(false);
  const [display, setDisplay] = useState<BirthdayDisplay>('age');
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; type: 'success' | 'error'; title: string; message: string }>({
    visible: false, type: 'success', title: '', message: '',
  });

  useEffect(() => {
    if (!currentUser) return;
    setBirthDate(parseBirthDate((currentUser as any).birth_date));
    setShowOnProfile(!!(currentUser as any).show_birthday);
    const stored = (currentUser as any).birthday_display;
    setDisplay(stored === 'animal' || stored === 'sun' ? stored : 'age');
  }, [currentUser]);

  const storedDate = parseBirthDate((currentUser as any)?.birth_date);
  const dirty =
    (birthDate ? toISODate(birthDate) : null) !== (storedDate ? toISODate(storedDate) : null) ||
    showOnProfile !== !!(currentUser as any)?.show_birthday ||
    display !== (((currentUser as any)?.birthday_display as BirthdayDisplay) || 'age');
  const canSave = !!birthDate && dirty;

  const showPopup = (type: 'success' | 'error', title: string, message: string) => {
    setPopup({ visible: true, type, title, message });
    setTimeout(() => setPopup(p => ({ ...p, visible: false })), 2500);
  };

  const handleDateChange = (_event: any, selected?: Date) => {
    // Android's picker is a dialog that dismisses itself; iOS's is inline
    // and stays open until the user is done with it.
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setBirthDate(selected);
  };

  const handleSave = async () => {
    if (!currentUser?.id || !birthDate) return;
    const age = getAgeFromDate(birthDate);
    if (age < 0 || age > 120) {
      showPopup('error', 'Check the date', 'Please select a valid date of birth.');
      return;
    }
    setLoading(true);
    try {
      const iso = toISODate(birthDate);
      // age_verified rides along with the date, exactly as signup and the
      // login date-of-birth prompt set it — it records that the user has
      // told us their date of birth, and it's what gates Safe View. Writing
      // the date without it would leave someone unverified with no way to
      // become verified.
      const verifiedAt = new Date().toISOString();
      await updateUserProfile(currentUser.id, {
        birth_date: iso,
        age_verified: true,
        age_verification_date: verifiedAt,
        show_birthday: showOnProfile,
        birthday_display: display,
      });
      const updatedUser = {
        ...currentUser,
        birth_date: iso,
        age_verified: true,
        age_verification_date: verifiedAt,
        show_birthday: showOnProfile,
        birthday_display: display,
      };
      await AsyncStorage.setItem('currentUser', JSON.stringify(updatedUser));
      setCurrentUser(updatedUser as any);
      // Safe View is gated on age + verification, and SafetyContext only
      // reloads those when the signed-in user changes — without this the
      // toggle stays locked until the next app launch.
      refreshSafety().catch(() => {});
      showPopup('success', 'Birthday Updated', 'Your birthday has been updated.');
      setTimeout(() => onClose?.(), 1500);
    } catch {
      showPopup('error', 'Update Failed', 'Failed to update your birthday. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Live preview of exactly what other people would see.
  const previewFor = (option: BirthdayDisplay): string => {
    if (!birthDate) return '—';
    if (option === 'animal') return getAnimalYear(birthDate).label;
    if (option === 'sun') return getSunSign(birthDate).label;
    return `${getAgeFromDate(birthDate)}`;
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
          <Text className="text-xl font-medium text-gray-900">Birthday</Text>
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

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24 }}>
        {/* Date row — tapping opens the platform picker. */}
        <TouchableOpacity
          onPress={() => setShowPicker((open) => (Platform.OS === 'ios' ? !open : true))}
          activeOpacity={0.7}
          style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous" }}
          className="bg-white px-4 py-4 flex-row items-center"
        >
          <Cake size={20} color="#9CA3AF" />
          <Text
            className="text-xl ml-3 flex-1"
            style={{ color: birthDate ? "#111827" : "#9CA3AF" }}
          >
            {birthDate ? formatDisplayDate(birthDate) : "Select your birthday"}
          </Text>
        </TouchableOpacity>

        {showPicker && (
          <View
            style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", marginTop: 12, overflow: "hidden" }}
            className="bg-white"
          >
            <DateTimePicker
              value={birthDate ?? new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={handleDateChange}
              {...LIGHT_DATE_PICKER_PROPS}
            />
          </View>
        )}

        {/* Visibility switch. Off is the default — a birthday is private
            until its owner says otherwise. */}
        <View
          style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", marginTop: 12 }}
          className="bg-white px-4 py-4 flex-row items-center"
        >
          <Text className="text-xl text-gray-900 flex-1">Show on profile</Text>
          <Switch
            value={showOnProfile}
            onValueChange={setShowOnProfile}
            trackColor={{ false: SWITCH_COLORS.trackOff, true: SWITCH_COLORS.trackOn }}
            thumbColor={SWITCH_COLORS.thumb}
            ios_backgroundColor={SWITCH_COLORS.trackOff}
          />
        </View>

        <Text className="text-base text-gray-400 mt-3 px-1 leading-5">
          Your date of birth is never shown to anyone. When this is on, your
          profile shows only what you pick below.
        </Text>

        {showOnProfile && (
          <View
            style={{ borderRadius: MODAL_RADIUS, borderCurve: "continuous", marginTop: 12, overflow: "hidden" }}
            className="bg-white"
          >
            {DISPLAY_OPTIONS.map((option, index) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => setDisplay(option.value)}
                activeOpacity={0.7}
                className={`px-4 py-4 flex-row items-center ${index > 0 ? "border-t border-gray-100" : ""}`}
              >
                <View className="flex-1">
                  <Text className="text-xl text-gray-900">{option.label}</Text>
                  <Text className="text-base text-gray-400 mt-0.5">{option.hint}</Text>
                </View>
                <Text className="text-xl text-gray-500 mr-3">{previewFor(option.value)}</Text>
                {display === option.value && <Check size={20} color="#0369A1" />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
