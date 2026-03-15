import { Entypo } from "@expo/vector-icons";
import PopupMessage from "@/components/ui/PopupMessage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { clamp, useResponsive } from "@/utils/responsive";
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
  const { identifier, type, otp } = params;
  const { ms, vs, wp, hp } = useResponsive();
  const pagePaddingX = clamp(wp(10), 20, 44);
  const backTop = clamp(hp(5), 32, 54);
  const backLeft = clamp(wp(3), 10, 18);
  const backPadding = clamp(ms(8), 6, 10);
  const backIconSize = clamp(ms(24), 20, 28);
  const headerBottom = clamp(vs(32), 24, 40);
  const titleSize = clamp(ms(36), 30, 42);
  const logoSize = clamp(ms(112), 88, 132);
  const subtitleSize = clamp(ms(15), 13, 17);
  const otpValueSize = clamp(ms(16), 14, 18);
  const otpGap = clamp(ms(14), 10, 20);
  const otpBoxSize = clamp(ms(64), 52, 72);
  const otpBoxRadius = clamp(ms(8), 8, 14);
  const otpTextSize = clamp(ms(24), 20, 30);
  const timerTextSize = clamp(ms(14), 12, 16);
  const verifyPaddingY = clamp(vs(20), 14, 22);
  const verifyRadius = clamp(ms(10), 8, 14);
  const verifyTextSize = clamp(ms(18), 16, 20);
  const resendTextSize = clamp(ms(15), 13, 17);

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
                Verify
              </Text>
              <Text
                className="text-secondary/90 font-mbold"
                style={{ fontSize: titleSize }}
              >
                OTP
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
            className="text-gray-600 font-regular text-center mb-2"
            style={{ fontSize: subtitleSize }}
          >
            We have sent a 4-digit code to
          </Text>
          <Text
            className="text-primary font-semibold text-center"
            style={{ fontSize: otpValueSize, marginBottom: headerBottom }}
          >
            {identifier}
          </Text>

          {/* OTP Input Boxes */}
          <View
            className="flex-row justify-center"
            style={{ columnGap: otpGap, marginBottom: clamp(vs(24), 18, 30) }}
          >
            <TextInput
              ref={input1Ref}
              value={otp1}
              onChangeText={(val) => handleOtpChange(val, 1)}
              keyboardType="number-pad"
              maxLength={1}
              className="border-2 border-gray-300 text-center font-bold text-primary"
              style={{
                width: otpBoxSize,
                height: otpBoxSize,
                borderRadius: otpBoxRadius,
                fontSize: otpTextSize,
              }}
              selectTextOnFocus
            />
            <TextInput
              ref={input2Ref}
              value={otp2}
              onChangeText={(val) => handleOtpChange(val, 2)}
              onKeyPress={(e) => handleKeyPress(e, 2)}
              keyboardType="number-pad"
              maxLength={1}
              className="border-2 border-gray-300 text-center font-bold text-primary"
              style={{
                width: otpBoxSize,
                height: otpBoxSize,
                borderRadius: otpBoxRadius,
                fontSize: otpTextSize,
              }}
              selectTextOnFocus
            />
            <TextInput
              ref={input3Ref}
              value={otp3}
              onChangeText={(val) => handleOtpChange(val, 3)}
              onKeyPress={(e) => handleKeyPress(e, 3)}
              keyboardType="number-pad"
              maxLength={1}
              className="border-2 border-gray-300 text-center font-bold text-primary"
              style={{
                width: otpBoxSize,
                height: otpBoxSize,
                borderRadius: otpBoxRadius,
                fontSize: otpTextSize,
              }}
              selectTextOnFocus
            />
            <TextInput
              ref={input4Ref}
              value={otp4}
              onChangeText={(val) => handleOtpChange(val, 4)}
              onKeyPress={(e) => handleKeyPress(e, 4)}
              keyboardType="number-pad"
              maxLength={1}
              className="border-2 border-gray-300 text-center font-bold text-primary"
              style={{
                width: otpBoxSize,
                height: otpBoxSize,
                borderRadius: otpBoxRadius,
                fontSize: otpTextSize,
              }}
              selectTextOnFocus
            />
          </View>

          {/* Timer */}
          <Text
            className="text-center text-gray-500 font-regular"
            style={{ fontSize: timerTextSize, marginBottom: headerBottom }}
          >
            Time remaining: <Text className="font-bold text-red-500">{formatTime(timeLeft)}</Text>
          </Text>

          {/* Verify Button */}
          <TouchableOpacity
            disabled={!(otp1 && otp2 && otp3 && otp4) || loading}
            onPress={handleVerify}
            activeOpacity={0.8}
            className={`items-center mb-4 ${
              (otp1 && otp2 && otp3 && otp4) && !loading
                ? "bg-primary"
                : "bg-primary/50"
            }`}
            style={{ paddingVertical: verifyPaddingY, borderRadius: verifyRadius }}
          >
            {loading ? (
              <ActivityIndicator color="#EDC06D" />
            ) : (
              <Text
                className="text-secondary text-center font-semibold"
                style={{ fontSize: verifyTextSize }}
              >
                Verify OTP
              </Text>
            )}
          </TouchableOpacity>

          {/* Resend OTP */}
          <TouchableOpacity onPress={handleResendOtp} activeOpacity={0.7}>
            <Text
              className="text-center text-primary font-semibold"
              style={{ fontSize: resendTextSize }}
            >
              Did not receive the code? <Text className="underline">Resend</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Popup */}
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
      />
    </TouchableWithoutFeedback>
  );
}
