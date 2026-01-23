import { Entypo, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { sendOTPSMS } from '../services/smsService';

export default function Forgot() {
  const [identifier, setIdentifier] = useState(""); // Can be email or phone
  const [loading, setLoading] = useState(false);
  const [inputType, setInputType] = useState<"email" | "phone" | null>(null);
  const router = useRouter();
  
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
      Alert.alert("Invalid Input", "Please enter a valid email or phone number");
      return;
    }

    setLoading(true);

    try {
      // Check if user exists
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, phone')
        .or(isEmail ? `email.eq.${identifier}` : `phone.eq.${identifier}`)
        .single();

      if (profileError || !profiles) {
        Alert.alert("Not Found", "No account found with this " + (isEmail ? "email" : "phone number"));
        setLoading(false);
        return;
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store OTP temporarily (you might want to create a table for this)
      // For now, we'll pass it via route params
      
      if (isPhone) {
        // Send OTP via SMS
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
          Alert.alert("Error", "Failed to send OTP. Please try again.");
        }
      } else {
        // Send OTP via email using Supabase
        Alert.alert(
          "Email OTP",
          `OTP sent to your email. Use this OTP: ${otp}`, // In production, send via email service
          [
            {
              text: "OK",
              onPress: () => {
                router.push({
                  pathname: "/verify-otp",
                  params: { 
                    identifier: identifier,
                    type: "email",
                    otp: otp,
                    expiresAt: expiresAt.toISOString()
                  }
                });
              }
            }
          ]
        );
      }
    } catch (error: any) {
      console.error("Error:", error);
      Alert.alert("Error", error.message || "Something went wrong");
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
                Forgot
              </Text>
              <Text className="text-4xl text-secondary/90 font-mbold">
                Password?
              </Text>
            </View>
            <Image
              source={require("../assets/images/logo.png")}
              className="w-28 h-28"
              resizeMode="contain"
            />
          </View>

          {/* Email/Phone Input */}
          <View className="border border-gray-300 rounded-lg px-4 py-2 mb-4 flex-row items-center">
            <MaterialIcons
              name={inputType === "email" ? "email" : "phone"}
              size={20}
              color="#999"
              className="mr-2"
            />
            <TextInput
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                detectInputType(text);
              }}
              placeholder="Enter your email or phone number"
              keyboardType={inputType === "email" ? "email-address" : "phone-pad"}
              className="flex-1 font-regular text-base"
              autoCapitalize="none"
            />
          </View>

          {/* Instructional Text */}
          <Text className="flex font-mlight text-gray-400 mb-10">
            <Text className="text-red-500 text-2xl">• </Text>
            We will send you an OTP to reset your password
          </Text>

          {/* Submit Button */}
          <TouchableOpacity
            disabled={(!isValidBhutanesePhone(identifier) && !isValidEmail(identifier)) || loading}
            onPress={handleSubmit}
            activeOpacity={0.8}
            className={`py-5 rounded-md items-center ${
              (isValidBhutanesePhone(identifier) || isValidEmail(identifier)) && !loading
                ? "bg-primary"
                : "bg-primary/50"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#EDC06D" />
            ) : (
              <Text className="text-secondary text-center font-semibold text-lg">
                Submit
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
