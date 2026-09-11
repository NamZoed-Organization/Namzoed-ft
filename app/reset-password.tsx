import {
  AuthButton,
  AuthField,
  AuthHeading,
  AuthHint,
  AuthScreen,
} from "@/components/auth/AuthChrome";
import PopupMessage from "@/components/ui/PopupMessage";
import { useAppRouter } from "@/utils/navigation";
import { useLocalSearchParams } from "expo-router";
import { Eye, EyeOff, Lock } from "lucide-react-native";
import React, { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const router = useAppRouter();
  const params = useLocalSearchParams();
  const { identifier, type } = params;
  // Spacing and type come from the auth chrome now (§ Auth screens).

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{visible: boolean, type: 'success'|'error'|'warning'|'white', title: string, message: string}>({visible: false, type: 'success', title: '', message: ''});

  const showPopup = (type: 'success'|'error'|'warning'|'white', title: string, message: string) => {
    setPopup({visible: true, type, title, message});
    setTimeout(() => setPopup(p => ({...p, visible: false})), 2500);
  };

  const isPasswordValid = () => {
    return (
      newPassword.length >= 6 &&
      newPassword === confirmPassword
    );
  };

  const handleResetPassword = async () => {
    if (!isPasswordValid()) {
      showPopup("error", "Invalid Password", "Passwords must be at least 6 characters and match");
      return;
    }

    setLoading(true);

    try {
      // Get the user's profile with auth user_id
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, phone')
        .or(type === "email" ? `email.eq.${identifier}` : `phone.eq.${identifier}`)
        .single();

      if (profileError || !profile) {
        showPopup("error", "Account Not Found", "Unable to find your account");
        setLoading(false);
        return;
      }

      // Get the user's email (needed for Supabase auth)
      const userEmail = profile.email;
      
      if (!userEmail) {
        showPopup("error", "No Email", "No email associated with this account");
        setLoading(false);
        return;
      }

      // Sign in temporarily with a password reset approach
      // First, we need to use Supabase's password reset flow
      // Since we've verified OTP, we'll use updateUser after signing them in temporarily
      
      // Alternative approach: Use Supabase RPC function to reset password
      // You'll need to create a database function for this
      const { error: resetError } = await supabase.rpc('reset_user_password', {
        user_email: userEmail,
        new_password: newPassword
      });

      if (resetError) {
        console.error("RPC error:", resetError);
      }
      showPopup("success", "Password Reset", "Your password has been reset successfully. Please log in with your new password.");
      setTimeout(() => router.replace("/login"), 2500);

    } catch (error: any) {
      console.error("Password reset error:", error);
      showPopup("error", "Reset Failed", error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const longEnough = newPassword.length >= 6;
  const matching = newPassword.length > 0 && newPassword === confirmPassword;

  return (
    <AuthScreen onBack={() => router.back()}>
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup(p => ({ ...p, visible: false }))}
      />

      <AuthHeading
        title="New password"
        subtitle="Pick something you'll remember. You'll use it to sign in from now on."
      />

      <View style={{ gap: 12 }}>
        <AuthField
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="New password"
          secureTextEntry={!showNewPassword}
          autoCapitalize="none"
          icon={<Lock size={19} color="#9CA3AF" strokeWidth={1.8} />}
          accessory={
            <TouchableOpacity
              onPress={() => setShowNewPassword(!showNewPassword)}
              hitSlop={8}
            >
              {showNewPassword ? (
                <EyeOff size={19} color="#9CA3AF" strokeWidth={1.8} />
              ) : (
                <Eye size={19} color="#9CA3AF" strokeWidth={1.8} />
              )}
            </TouchableOpacity>
          }
        />

        <AuthField
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm password"
          secureTextEntry={!showConfirmPassword}
          autoCapitalize="none"
          icon={<Lock size={19} color="#9CA3AF" strokeWidth={1.8} />}
          accessory={
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              hitSlop={8}
            >
              {showConfirmPassword ? (
                <EyeOff size={19} color="#9CA3AF" strokeWidth={1.8} />
              ) : (
                <Eye size={19} color="#9CA3AF" strokeWidth={1.8} />
              )}
            </TouchableOpacity>
          }
        />
      </View>

      {/* The two rules, and whether they are met. They were a static red
          bulleted list plus a separate "✗ Passwords don't match" line that
          only appeared once both fields had something in them — three
          things saying what two ticks say. */}
      <View style={{ gap: 8, marginTop: 16, marginBottom: 24 }}>
        <AuthHint met={longEnough}>At least 6 characters</AuthHint>
        <AuthHint met={matching}>Both passwords match</AuthHint>
      </View>

      <AuthButton
        label="Save password"
        onPress={handleResetPassword}
        loading={loading}
        disabled={!isPasswordValid()}
      />
    </AuthScreen>
  );
}
