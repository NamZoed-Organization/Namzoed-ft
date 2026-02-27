import { Entypo, MaterialIcons } from "@expo/vector-icons";
import FormInput from "@/components/ui/FormInput";
import { clamp, useResponsive } from "@/utils/responsive";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { supabase } from '../lib/supabase';
import { sendOTPSMS } from '../services/smsService';
import PopupMessage from '../components/ui/PopupMessage';

export default function Forgot() {
  const [identifier, setIdentifier] = useState(""); // Can be email or phone
  const [loading, setLoading] = useState(false);
  const [inputType, setInputType] = useState<"email" | "phone" | null>(null);
  const [popup, setPopup] = useState({ visible: false, type: 'error' as 'success' | 'error' | 'warning', title: '', message: '' });
  const router = useRouter();
  const { ms, vs, wp, hp } = useResponsive();
  const pagePaddingX = clamp(wp(10), 20, 44);
  const backTop = clamp(hp(5), 32, 54);
  const backLeft = clamp(wp(3), 10, 18);
  const backPadding = clamp(ms(8), 6, 10);
  const backIconSize = clamp(ms(24), 20, 28);
  const headerBottom = clamp(vs(32), 24, 40);
  const titleSize = clamp(ms(36), 30, 42);
  const logoSize = clamp(ms(112), 88, 132);
  const inputBottom = clamp(vs(16), 12, 20);
  const bodyTextSize = clamp(ms(14), 12, 16);
  const bulletSize = clamp(ms(24), 20, 28);
  const instructionBottom = clamp(vs(40), 28, 52);
  const submitPaddingY = clamp(vs(20), 14, 22);
  const submitRadius = clamp(ms(10), 8, 14);
  const submitTextSize = clamp(ms(18), 16, 20);
  const inputIconSize = clamp(ms(20), 18, 24);

  const showPopup = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
    setPopup({ visible: true, type, title, message });
    setTimeout(() => setPopup({ visible: false, type: 'error', title: '', message: '' }), 3000);
  };
  
  const isValidBhutanesePhone = (input: string) => {
    return (
      (input.startsWith("17") || input.startsWith("77")) && input.length === 8
    );
  };

  const isValidEmail = (input: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(input);
  };

  const detectInputType = (input: string) => {
    if (input.includes("@")) {
      setInputType("email");
    } else if (input.match(/^[0-9]+$/)) {
      setInputType("phone");
    } else {
      setInputType(null);
    }
  };

  const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  const handleSubmit = async () => {
    if (!identifier) return;

    const isPhone = isValidBhutanesePhone(identifier);
    const isEmail = isValidEmail(identifier);

    if (!isPhone && !isEmail) {
      showPopup('error', 'Invalid Input', 'Please enter a valid email or phone number');
      return;
    }

    setLoading(true);

    try {
      // Check if user exists - Fixed query using .eq() instead of .or()
      const query = isEmail
        ? supabase.from('profiles').select('id, email, phone').eq('email', identifier)
        : supabase.from('profiles').select('id, email, phone').eq('phone', identifier);

      const { data: profiles, error: profileError } = await query.single();

      if (profileError || !profiles) {
        console.error('Profile lookup error:', profileError);
        showPopup(
          'error',
          'Not Found',
          `No account found with this ${isEmail ? 'email' : 'phone number'}.\n\nError: ${profileError?.message || 'Unknown error'}`
        );
        setLoading(false);
        return;
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP temporarily (you might want to create a table for this)
      // For now, we'll pass it via route params
      
      if (isPhone) {
        // Send OTP via SMS - wrapped in try-catch for detailed error logging
        try {
          const smsSent = await sendOTPSMS(identifier, otp);
          if (smsSent) {
            router.push({
              pathname: "/verify-otp",
              params: {
                identifier: identifier,
                type: "phone",
                otp: otp, // In production, don't pass OTP in params, use a secure backend
                expiresAt: expiresAt.toISOString()
              }
            });
          } else {
            showPopup(
              'error',
              'SMS Failed',
              'Failed to send OTP via SMS. The SMS service returned false. Please check your internet connection and try again.'
            );
          }
        } catch (smsError: any) {
          console.error('SMS Error:', smsError);
          console.error('SMS Error details:', JSON.stringify(smsError, null, 2));
          showPopup(
            'error',
            'SMS Error',
            `Failed to send OTP.\n\nError: ${smsError?.message || 'Unknown error'}\n\nDetails: ${JSON.stringify(smsError, null, 2)}`
          );
        }
      } else {
        // Send OTP via email using Supabase
        showPopup(
          'success',
          'Email OTP',
          `OTP sent to your email. Use this OTP: ${otp}`
        );

        setTimeout(() => {
          router.push({
            pathname: "/verify-otp",
            params: {
              identifier: identifier,
              type: "email",
              otp: otp,
              expiresAt: expiresAt.toISOString()
            }
          });
        }, 3000);
      }
    } catch (error: any) {
      console.error("Error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      showPopup(
        'error',
        'Error',
        `Something went wrong.\n\nError: ${error?.message || 'Unknown error'}\n\nDetails: ${JSON.stringify(error, null, 2)}`
      );
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
        {/* Popup Message */}
        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
        />

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
                Forgot
              </Text>
              <Text
                className="text-secondary/90 font-mbold"
                style={{ fontSize: titleSize }}
              >
                Password?
              </Text>
            </View>
            <Image
              source={require("../assets/images/logo.png")}
              style={{ width: logoSize, height: logoSize }}
              resizeMode="contain"
            />
          </View>

          {/* Email/Phone Input */}
          <View style={{ marginBottom: inputBottom }}>
            <FormInput
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                detectInputType(text);
              }}
              placeholder="Enter your email or phone number"
              keyboardType={inputType === "email" ? "email-address" : "phone-pad"}
              autoCapitalize="none"
              leftIcon={
                <MaterialIcons
                  name={inputType === "email" ? "email" : "phone"}
                  size={inputIconSize}
                  color="#6B7280"
                />
              }
            />
          </View>

          {/* Instructional Text */}
          <Text
            className="flex font-mlight text-gray-400"
            style={{ marginBottom: instructionBottom, fontSize: bodyTextSize }}
          >
            <Text className="text-red-500" style={{ fontSize: bulletSize }}>• </Text>
            We will send you an OTP to reset your password
          </Text>

          {/* Submit Button */}
          <TouchableOpacity
            disabled={(!isValidBhutanesePhone(identifier) && !isValidEmail(identifier)) || loading}
            onPress={handleSubmit}
            activeOpacity={0.8}
            className={`items-center ${
              (isValidBhutanesePhone(identifier) || isValidEmail(identifier)) && !loading
                ? "bg-primary"
                : "bg-primary/50"
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
                Submit
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
