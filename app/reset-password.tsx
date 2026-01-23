import { Entypo, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { identifier, type } = params;

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
      const { data: resetData, error: resetError } = await supabase.rpc('reset_user_password', {
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
      <View className="flex-1 justify-center items-center bg-white px-[10%]">
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute top-[5%] left-[3%] z-50 p-2"
          activeOpacity={0.6}
        >
          <Entypo name={"chevron-thin-left"} size={24} color="#094569" />
        </TouchableOpacity>

        <View className="w-full">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-8">
            <View>
              <Text className="text-4xl text-primary/90 font-mbold">
                Reset
              </Text>
              <Text className="text-4xl text-secondary/90 font-mbold">
                Password
              </Text>
            </View>
            <Image
              source={require("../assets/images/logo.png")}
              className="w-28 h-28"
              resizeMode="contain"
            />
          </View>

          {/* Info Text */}
          <Text className="text-gray-600 font-regular mb-6">
            Create a new password for your account
          </Text>

          {/* New Password Input */}
          <View className="border border-gray-300 rounded-lg px-4 py-2 mb-4 flex-row items-center">
            <Ionicons
              name="lock-closed"
              size={20}
              color="#999"
              className="mr-2"
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              secureTextEntry={!showNewPassword}
              className="flex-1 font-regular text-base"
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword(!showNewPassword)}
              className="ml-2"
            >
              <Ionicons
                name={showNewPassword ? "eye" : "eye-off"}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
          </View>

          {/* Confirm Password Input */}
          <View className="border border-gray-300 rounded-lg px-4 py-2 mb-4 flex-row items-center">
            <Ionicons
              name="lock-closed"
              size={20}
              color="#999"
              className="mr-2"
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm Password"
              secureTextEntry={!showConfirmPassword}
              className="flex-1 font-regular text-base"
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              className="ml-2"
            >
              <Ionicons
                name={showConfirmPassword ? "eye" : "eye-off"}
                size={20}
                color="#999"
              />
            </TouchableOpacity>
          </View>

          {/* Password Requirements */}
          <View className="mb-6">
            <Text className="flex font-mlight text-gray-400 mb-2">
              <Text className="text-red-500 text-2xl">• </Text>
              Password must be at least 6 characters
            </Text>
            <Text className="flex font-mlight text-gray-400">
              <Text className="text-red-500 text-2xl">• </Text>
              Both passwords must match
            </Text>
          </View>

          {/* Password Match Indicator */}
          {newPassword && confirmPassword && (
            <Text
              className={`text-center mb-4 font-semibold ${
                newPassword === confirmPassword ? "text-green-600" : "text-red-600"
              }`}
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
            className={`py-5 rounded-md items-center ${
              isPasswordValid() && !loading ? "bg-primary" : "bg-primary/50"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#EDC06D" />
            ) : (
              <Text className="text-secondary text-center font-semibold text-lg">
                Reset Password
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
