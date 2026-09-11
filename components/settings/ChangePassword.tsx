/**
 * Settings › Account › Change Password.
 *
 * It was the old pattern inverted against § Form screens in every respect:
 * white screen with grey bordered fields, a hand-rolled `ArrowLeft` header
 * with a bottom border, a label above every field, an 8pt radius, and a
 * full-width filled "Change Password" button at the foot with a static line
 * under it stating a rule you could not tell you had met. Every rule was
 * enforced only on press, as a popup — you filled in three fields, pressed,
 * and were told the second one was too short.
 *
 * `app/reset-password.tsx` is the same moment on the auth side ("pick a new
 * password, twice"), so the two now agree: the requirements are `AuthHint`
 * ticks that turn green as they are met (§ Auth screens — a rule that cannot
 * tell you it is satisfied is a rule you re-read every time), and Save is
 * live only once they all are. The chrome is § Form screens' because this is
 * a settings sub-page and not an auth screen: chevron, centred title, and
 * the action as text in the header rather than a button at the bottom.
 *
 * The logic underneath is unchanged — Supabase has no "verify my password"
 * call, so the current one is checked by signing in with it before
 * `updateUser` is allowed to run.
 */

import { AuthHint } from '@/components/auth/AuthChrome';
import CircularLoader from '@/components/ui/CircularLoader';
import PopupMessage from '@/components/ui/PopupMessage';
import { MODAL_RADIUS } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { ChevronLeft, Eye, EyeOff, Lock } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChangePasswordProps {
  onClose?: () => void;
}

const MIN_LENGTH = 6;

/** One white field on the grey: no label, no border, the placeholder
 *  carrying the name and the eye as the trailing accessory. */
function PasswordField({
  placeholder,
  value,
  onChangeText,
  visible,
  onToggleVisible,
  first,
  autoFocus,
}: {
  placeholder: string;
  value: string;
  onChangeText: (next: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  first?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <View
      style={{
        borderRadius: MODAL_RADIUS,
        borderCurve: "continuous",
        marginTop: first ? 0 : 12,
      }}
      className="bg-white px-4 flex-row items-center"
    >
      <Lock size={20} color="#9CA3AF" strokeWidth={1.8} />
      <TextInput
        className="flex-1 text-xl text-gray-900 ml-3"
        style={{ paddingVertical: Platform.OS === "android" ? 12 : 16 }}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
      />
      <TouchableOpacity onPress={onToggleVisible} hitSlop={8}>
        {visible ? (
          <EyeOff size={20} color="#9CA3AF" strokeWidth={1.8} />
        ) : (
          <Eye size={20} color="#9CA3AF" strokeWidth={1.8} />
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function ChangePassword({ onClose }: ChangePasswordProps) {
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ visible: boolean; type: 'success' | 'error' | 'warning' | 'white'; title: string; message: string }>({
    visible: false, type: 'success', title: '', message: '',
  });

  const showPopup = (type: 'success' | 'error' | 'warning' | 'white', title: string, message: string) => {
    setPopup({ visible: true, type, title, message });
    setTimeout(() => setPopup(p => ({ ...p, visible: false })), 2500);
  };

  // The three ticks below the fields, and the three reasons Save stays pale.
  const hasCurrent = currentPassword.length > 0;
  const longEnough = newPassword.length >= MIN_LENGTH;
  const matching = newPassword.length > 0 && newPassword === confirmPassword;
  const different = newPassword.length > 0 && newPassword !== currentPassword;
  const canSave = hasCurrent && longEnough && matching && different;

  const handleChangePassword = async () => {
    if (!canSave) return;

    try {
      setLoading(true);
      const { data: userData, error: userError } = await supabase.auth.getUser();
      const authEmail = userData?.user?.email;

      if (userError || !authEmail) {
        showPopup('error', 'Session Error', 'Unable to verify your account. Please log in again.');
        return;
      }

      // Supabase has no "check this password" call, so signing in with it is
      // the verification — without it, anyone holding an unlocked phone could
      // change the password without knowing the old one.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: currentPassword,
      });

      if (verifyError) {
        showPopup('error', 'Incorrect Password', 'Your current password is incorrect');
        return;
      }

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
        // Long enough for the popup to be read. It used to close on the same
        // tick it was shown, which unmounted the confirmation with it.
        setTimeout(() => onClose?.(), 1500);
      }
    } catch (error: any) {
      showPopup('error', 'Error', error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingBottom: insets.bottom }}>
      {/* A screen mounted underneath may have set light-content, and RN
          merges StatusBar props last-mounted-wins. */}
      <StatusBar barStyle="dark-content" />

      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup(p => ({ ...p, visible: false }))}
      />

      <View className="flex-row items-center justify-between px-4 pb-4 pt-2">
        <TouchableOpacity onPress={onClose} className="py-1 -ml-1">
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
        <View
          style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, justifyContent: "center", alignItems: "center" }}
          pointerEvents="none"
        >
          <Text className="text-xl font-medium text-gray-900">Change Password</Text>
        </View>
        <TouchableOpacity onPress={handleChangePassword} disabled={loading || !canSave} className="py-1">
          {loading ? (
            <CircularLoader color="#094569" size="small" />
          ) : (
            <Text className="text-xl font-medium" style={{ color: canSave ? "#0369A1" : "#93C5FD" }}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 10, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <PasswordField
            first
            autoFocus
            placeholder="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            visible={showCurrent}
            onToggleVisible={() => setShowCurrent(v => !v)}
          />
          <PasswordField
            placeholder="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            visible={showNew}
            onToggleVisible={() => setShowNew(v => !v)}
          />
          <PasswordField
            placeholder="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            visible={showConfirm}
            onToggleVisible={() => setShowConfirm(v => !v)}
          />

          {/* The rules, saying whether they are met — the same ticks the
              reset-password screen shows for the same two fields, instead of
              a popup after the fact. */}
          <View style={{ gap: 8, marginTop: 16 }}>
            <AuthHint met={longEnough}>{`At least ${MIN_LENGTH} characters`}</AuthHint>
            <AuthHint met={matching}>Both new passwords match</AuthHint>
            <AuthHint met={different}>Different from your current one</AuthHint>
          </View>

          <Text className="text-base text-gray-400 mt-4 px-1 leading-5">
            You stay signed in on this device. Anywhere else you are signed in
            will ask for the new password.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
