import {
  AuthButton,
  AuthField,
  AuthHeading,
  AuthScreen,
} from "@/components/auth/AuthChrome";
import { useAppRouter } from "@/utils/navigation";
import { Mail, Phone } from "lucide-react-native";
import React, { useState } from "react";
import { View } from "react-native";
import { supabase } from '../lib/supabase';
import { sendOTPSMS } from '../services/smsService';
import PopupMessage from '../components/ui/PopupMessage';

export default function Forgot() {
  const [identifier, setIdentifier] = useState(""); // Can be email or phone
  const [loading, setLoading] = useState(false);
  const [inputType, setInputType] = useState<"email" | "phone" | null>(null);
  const [popup, setPopup] = useState({ visible: false, type: 'error' as 'success' | 'error' | 'warning', title: '', message: '' });
  const router = useAppRouter();
  // Spacing and type come from the auth chrome now (§ Auth screens).

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
    <AuthScreen onBack={() => router.back()}>
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup(p => ({ ...p, visible: false }))}
      />

      <AuthHeading
        title="Forgot password"
        subtitle="Tell us the email or phone on your account and we'll send a code to reset it."
      />

      <AuthField
        value={identifier}
        onChangeText={(text: string) => {
          setIdentifier(text);
          detectInputType(text);
        }}
        placeholder="Email or phone"
        keyboardType={inputType === "email" ? "email-address" : "phone-pad"}
        autoCapitalize="none"
        autoCorrect={false}
        icon={
          inputType === "email" ? (
            <Mail size={19} color="#9CA3AF" strokeWidth={1.8} />
          ) : (
            <Phone size={19} color="#9CA3AF" strokeWidth={1.8} />
          )
        }
      />

      <View style={{ height: 20 }} />

      <AuthButton
        label="Send code"
        onPress={handleSubmit}
        loading={loading}
        disabled={!isValidBhutanesePhone(identifier) && !isValidEmail(identifier)}
      />
    </AuthScreen>
  );
}
