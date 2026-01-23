import { Entypo } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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

export default function VerifyOTP() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { identifier, type, otp, expiresAt } = params;

  const [otp1, setOtp1] = useState("");
  const [otp2, setOtp2] = useState("");
  const [otp3, setOtp3] = useState("");
  const [otp4, setOtp4] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds

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
  }, []);

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
      Alert.alert("Incomplete", "Please enter all 4 digits");
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
        Alert.alert("Invalid OTP", "The OTP you entered is incorrect. Please try again.");
        // Clear inputs
        setOtp1("");
        setOtp2("");
        setOtp3("");
        setOtp4("");
        input1Ref.current?.focus();
      }
    } catch (error: any) {
      console.error("Verification error:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
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
                Verify
              </Text>
              <Text className="text-4xl text-secondary/90 font-mbold">
                OTP
              </Text>
            </View>
            <Image
              source={require("../assets/images/logo.png")}
              className="w-28 h-28"
              resizeMode="contain"
            />
          </View>

          {/* Info Text */}
          <Text className="text-gray-600 font-regular text-center mb-2">
            We've sent a 4-digit code to
          </Text>
          <Text className="text-primary font-semibold text-center mb-8">
            {identifier}
          </Text>

          {/* OTP Input Boxes */}
          <View className="flex-row justify-center gap-4 mb-6">
            <TextInput
              ref={input1Ref}
              value={otp1}
              onChangeText={(val) => handleOtpChange(val, 1)}
              keyboardType="number-pad"
              maxLength={1}
              className="w-16 h-16 border-2 border-gray-300 rounded-lg text-center text-2xl font-bold text-primary"
              selectTextOnFocus
            />
            <TextInput
              ref={input2Ref}
              value={otp2}
              onChangeText={(val) => handleOtpChange(val, 2)}
              onKeyPress={(e) => handleKeyPress(e, 2)}
              keyboardType="number-pad"
              maxLength={1}
              className="w-16 h-16 border-2 border-gray-300 rounded-lg text-center text-2xl font-bold text-primary"
              selectTextOnFocus
            />
            <TextInput
              ref={input3Ref}
              value={otp3}
              onChangeText={(val) => handleOtpChange(val, 3)}
              onKeyPress={(e) => handleKeyPress(e, 3)}
              keyboardType="number-pad"
              maxLength={1}
              className="w-16 h-16 border-2 border-gray-300 rounded-lg text-center text-2xl font-bold text-primary"
              selectTextOnFocus
            />
            <TextInput
              ref={input4Ref}
              value={otp4}
              onChangeText={(val) => handleOtpChange(val, 4)}
              onKeyPress={(e) => handleKeyPress(e, 4)}
              keyboardType="number-pad"
              maxLength={1}
              className="w-16 h-16 border-2 border-gray-300 rounded-lg text-center text-2xl font-bold text-primary"
              selectTextOnFocus
            />
          </View>

          {/* Timer */}
          <Text className="text-center text-gray-500 font-regular mb-8">
            Time remaining: <Text className="font-bold text-red-500">{formatTime(timeLeft)}</Text>
          </Text>

          {/* Verify Button */}
          <TouchableOpacity
            disabled={!(otp1 && otp2 && otp3 && otp4) || loading}
            onPress={handleVerify}
            activeOpacity={0.8}
            className={`py-5 rounded-md items-center mb-4 ${
              (otp1 && otp2 && otp3 && otp4) && !loading
                ? "bg-primary"
                : "bg-primary/50"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#EDC06D" />
            ) : (
              <Text className="text-secondary text-center font-semibold text-lg">
                Verify OTP
              </Text>
            )}
          </TouchableOpacity>

          {/* Resend OTP */}
          <TouchableOpacity onPress={handleResendOtp} activeOpacity={0.7}>
            <Text className="text-center text-primary font-semibold">
              Didn't receive the code? <Text className="underline">Resend</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
