import {
  AuthButton,
  AuthCodeField,
  AuthHeading,
  AuthScreen,
} from "@/components/auth/AuthChrome";
import PopupMessage from "@/components/ui/PopupMessage";
import { useAppRouter } from "@/utils/navigation";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity } from "react-native";

export default function VerifyOTP() {
  const router = useAppRouter();
  const params = useLocalSearchParams();
  const { identifier, type, otp } = params;
  // Spacing and type come from the auth chrome now (§ Auth screens).

  const [otp1, setOtp1] = useState("");
  const [otp2, setOtp2] = useState("");
  const [otp3, setOtp3] = useState("");
  const [otp4, setOtp4] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [popup, setPopup] = useState<{visible: boolean, type: 'success'|'error'|'warning'|'white', title: string, message: string}>({visible: false, type: 'success', title: '', message: ''});

  const showPopup = (type: 'success'|'error'|'warning'|'white', title: string, message: string) => {
    setPopup({visible: true, type, title, message});
    setTimeout(() => setPopup(p => ({...p, visible: false})), 2500);
  };

  const input1Ref = useRef<TextInput>(null);
  const input2Ref = useRef<TextInput>(null);
  const input3Ref = useRef<TextInput>(null);
  const input4Ref = useRef<TextInput>(null);

  useEffect(() => {
    // Focus first input on mount
    input1Ref.current?.focus();

    // Start countdown timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          Alert.alert("OTP Expired", "Your OTP has expired. Please request a new one.", [
            { text: "OK", onPress: () => router.back() }
          ]);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [router]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleOtpChange = (value: string, index: number) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) return;

    switch (index) {
      case 1:
        setOtp1(value);
        if (value) input2Ref.current?.focus();
        break;
      case 2:
        setOtp2(value);
        if (value) input3Ref.current?.focus();
        break;
      case 3:
        setOtp3(value);
        if (value) input4Ref.current?.focus();
        break;
      case 4:
        setOtp4(value);
        break;
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace") {
      switch (index) {
        case 2:
          if (!otp2) input1Ref.current?.focus();
          break;
        case 3:
          if (!otp3) input2Ref.current?.focus();
          break;
        case 4:
          if (!otp4) input3Ref.current?.focus();
          break;
      }
    }
  };

  const handleVerify = async () => {
    const enteredOtp = otp1 + otp2 + otp3 + otp4;

    if (enteredOtp.length !== 4) {
      showPopup("error", "Incomplete", "Please enter all 4 digits");
      return;
    }

    setLoading(true);

    try {
      // Verify OTP
      if (enteredOtp === otp) {
        // OTP is correct, navigate to reset password page
        router.push({
          pathname: "/reset-password",
          params: { identifier, type }
        });
      } else {
        showPopup("error", "Invalid OTP", "The OTP you entered is incorrect. Please try again.");
        // Clear inputs
        setOtp1("");
        setOtp2("");
        setOtp3("");
        setOtp4("");
        input1Ref.current?.focus();
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      showPopup("error", "Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = () => {
    Alert.alert(
      "Resend OTP",
      "Would you like to resend the OTP?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Resend", 
          onPress: () => {
            // Reset timer
            setTimeLeft(600);
            // Clear inputs
            setOtp1("");
            setOtp2("");
            setOtp3("");
            setOtp4("");
            input1Ref.current?.focus();
            Alert.alert("OTP Resent", "A new OTP has been sent to your " + (type === "email" ? "email" : "phone"));
          }
        }
      ]
    );
  };

  const code = [otp1, otp2, otp3, otp4];
  const complete = code.every((digit) => digit.length > 0);

  return (
    <AuthScreen onBack={() => router.back()}>
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
      />

      <AuthHeading
        title="Enter the code"
        subtitle={`We sent a 4-digit code to ${identifier}.`}
      />

      <AuthCodeField
        values={code}
        refs={[input1Ref, input2Ref, input3Ref, input4Ref]}
        onChangeDigit={(index, value) => handleOtpChange(value, index + 1)}
        onKeyPressDigit={(index, event) => handleKeyPress(event, index + 1)}
      />

      {/* The clock, in the app's own quiet grey until it is nearly out —
          a countdown that is red from the first second is a countdown
          nobody reads by the last. */}
      <Text
        style={{
          fontSize: 14,
          color: timeLeft <= 30 ? "#DC2626" : "#9CA3AF",
          textAlign: "center",
          marginTop: 18,
          marginBottom: 24,
        }}
      >
        {timeLeft > 0 ? `Expires in ${formatTime(timeLeft)}` : "That code has expired."}
      </Text>

      <AuthButton
        label="Verify"
        onPress={handleVerify}
        loading={loading}
        disabled={!complete}
      />

      <TouchableOpacity
        onPress={handleResendOtp}
        activeOpacity={0.7}
        style={{ paddingVertical: 16 }}
      >
        <Text style={{ fontSize: 15, color: "#6B7280", textAlign: "center" }}>
          Didn&apos;t get it?{" "}
          <Text style={{ color: "#0369A1", fontWeight: "700" }}>Send again</Text>
        </Text>
      </TouchableOpacity>
    </AuthScreen>
  );
}
