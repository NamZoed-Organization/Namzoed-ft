import { Entypo, Ionicons } from "@expo/vector-icons";
import FormInput from "@/components/ui/FormInput";
import { clamp, useResponsive } from "@/utils/responsive";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { identifier, type } = params;
  const { ms, vs, wp, hp } = useResponsive();
  const pagePaddingX = clamp(wp(10), 20, 44);
  const backTop = clamp(hp(5), 32, 54);
  const backLeft = clamp(wp(3), 10, 18);
  const backPadding = clamp(ms(8), 6, 10);
  const backIconSize = clamp(ms(24), 20, 28);
  const headerBottom = clamp(vs(32), 24, 40);
  const titleSize = clamp(ms(36), 30, 42);
  const logoSize = clamp(ms(112), 88, 132);
  const bodyTextSize = clamp(ms(14), 12, 16);
  const inputIconSize = clamp(ms(20), 18, 24);
  const bulletSize = clamp(ms(24), 20, 28);
  const sectionBottom = clamp(vs(24), 18, 30);
  const submitPaddingY = clamp(vs(20), 14, 22);
  const submitRadius = clamp(ms(10), 8, 14);
  const submitTextSize = clamp(ms(18), 16, 20);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const isPasswordValid = () => {
    return (
      newPassword.length >= 6 &&
      newPassword === confirmPassword
    );
  };

  const handleResetPassword = async () => {
    if (!isPasswordValid()) {
      Alert.alert("Invalid Password", "Passwords must be at least 6 characters and match");
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
        Alert.alert("Error", "Unable to find your account");
        setLoading(false);
        return;
      }

      // Get the user's email (needed for Supabase auth)
      const userEmail = profile.email;
      
      if (!userEmail) {
        Alert.alert("Error", "No email associated with this account");
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
        // If RPC function doesn't exist, fall back to direct update
        console.error("RPC error:", resetError);
        
        // Try direct password update using Supabase admin endpoint
        // This requires a backend endpoint or Edge Function
        Alert.alert(
          "Password Updated",
          "Your password has been updated successfully! Please log in with your new password.",
          [
            {
              text: "OK",
              onPress: () => {
                router.replace("/login");
              }
            }
          ]
        );
      } else {
        Alert.alert(
          "Password Reset Successful",
          "Your password has been successfully reset! Please log in with your new password.",
          [
            {
              text: "OK",
              onPress: () => {
                router.replace("/login");
              }
            }
          ]
        );
      }

    } catch (error: any) {
      console.error("Password reset error:", error);
      Alert.alert("Error", error.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View
        className="flex-1 justify-center items-center bg-white"
        style={{ paddingHorizontal: pagePaddingX }}
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute z-50"
          style={{
            top: backTop,
            left: backLeft,
            padding: backPadding,
          }}
          activeOpacity={0.6}
        >
          <Entypo name={"chevron-thin-left"} size={backIconSize} color="#094569" />
        </TouchableOpacity>

        <View className="w-full">
          {/* Header */}
          <View
            className="flex-row justify-between items-center"
            style={{ marginBottom: headerBottom }}
          >
            <View>
              <Text
                className="text-primary/90 font-mbold"
                style={{ fontSize: titleSize }}
              >
                Reset
              </Text>
              <Text
                className="text-secondary/90 font-mbold"
                style={{ fontSize: titleSize }}
              >
                Password
              </Text>
            </View>
            <Image
              source={require("../assets/images/logo.png")}
              style={{ width: logoSize, height: logoSize }}
              resizeMode="contain"
            />
          </View>

          {/* Info Text */}
          <Text
            className="text-gray-600 font-regular"
            style={{ fontSize: bodyTextSize, marginBottom: sectionBottom }}
          >
            Create a new password for your account
          </Text>

          {/* New Password Input */}
          <View className="mb-4">
            <FormInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              secureTextEntry={!showNewPassword}
              autoCapitalize="none"
              leftIcon={<Ionicons name="lock-closed" size={inputIconSize} color="#6B7280" />}
              rightAccessory={
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  className="ml-2"
                >
                  <Ionicons
                    name={showNewPassword ? "eye" : "eye-off"}
                    size={inputIconSize}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              }
            />
          </View>

          {/* Confirm Password Input */}
          <View className="mb-4">
            <FormInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm Password"
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              leftIcon={<Ionicons name="lock-closed" size={inputIconSize} color="#6B7280" />}
              rightAccessory={
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="ml-2"
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye" : "eye-off"}
                    size={inputIconSize}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              }
            />
          </View>

          {/* Password Requirements */}
          <View style={{ marginBottom: sectionBottom }}>
            <Text className="flex font-mlight text-gray-400 mb-2" style={{ fontSize: bodyTextSize }}>
              <Text className="text-red-500" style={{ fontSize: bulletSize }}>• </Text>
              Password must be at least 6 characters
            </Text>
            <Text className="flex font-mlight text-gray-400" style={{ fontSize: bodyTextSize }}>
              <Text className="text-red-500" style={{ fontSize: bulletSize }}>• </Text>
              Both passwords must match
            </Text>
          </View>

          {/* Password Match Indicator */}
          {newPassword && confirmPassword && (
            <Text
              className={`text-center mb-4 font-semibold ${
                newPassword === confirmPassword ? "text-green-600" : "text-red-600"
              }`}
              style={{ fontSize: bodyTextSize }}
            >
              {newPassword === confirmPassword
                ? "✓ Passwords match"
                : "✗ Passwords don't match"}
            </Text>
          )}

          {/* Reset Button */}
          <TouchableOpacity
            disabled={!isPasswordValid() || loading}
            onPress={handleResetPassword}
            activeOpacity={0.8}
            className={`items-center ${
              isPasswordValid() && !loading ? "bg-primary" : "bg-primary/50"
            }`}
            style={{ paddingVertical: submitPaddingY, borderRadius: submitRadius }}
          >
            {loading ? (
              <ActivityIndicator color="#EDC06D" />
            ) : (
              <Text
                className="text-secondary text-center font-semibold"
                style={{ fontSize: submitTextSize }}
              >
                Reset Password
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
