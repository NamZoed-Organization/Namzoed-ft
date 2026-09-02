import {
  Ionicons,
  MaterialIcons
} from "@expo/vector-icons";
import FormInput from "@/components/ui/FormInput";
import PopupMessage from "@/components/ui/PopupMessage";
import PrivacyPolicy from "@/components/settings/PrivacyPolicy";
import TermsOfService from "@/components/settings/TermsOfService";
import { clamp, useResponsive } from "@/utils/responsive";
import { useAppRouter } from "@/utils/navigation";
import { formatDisplayDate, getAgeFromDate, toISODate } from "@/utils/age";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Link } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from '../lib/supabase';
import { sendWelcomeSMS } from '../services/smsService';

export default function SignupTab2() {
  const router = useAppRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);
  const [popup, setPopup] = useState<{visible: boolean, type: 'success'|'error'|'warning'|'white', title: string, message: string}>({visible: false, type: 'success', title: '', message: ''});
  const { ms, vs, wp } = useResponsive();

  const showPopup = (type: 'success'|'error'|'warning'|'white', title: string, message: string) => {
    setPopup({visible: true, type, title, message});
    setTimeout(() => setPopup(p => ({...p, visible: false})), 2500);
  };
  const pagePaddingX = clamp(wp(10), 20, 44);
  const contentPaddingY = clamp(vs(40), 24, 52);
  const fieldGap = clamp(vs(15), 12, 20);
  const headerBottomSpacing = clamp(vs(24), 18, 32);
  const titleSize = clamp(ms(36), 30, 42);
  const logoSize = clamp(ms(96), 76, 118);
  const iconSize = clamp(ms(20), 18, 24);
  const termsSize = clamp(ms(14), 12, 16);
  const submitPaddingY = clamp(vs(16), 12, 20);
  const submitRadius = clamp(ms(8), 8, 12);
  const submitSize = clamp(ms(16), 14, 18);

  // Check if phone number already exists
  const checkPhoneExists = async (phoneNumber: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('phone')
        .eq('phone', phoneNumber);

      if (error) {
        console.error("Phone lookup error:", error);
        return false;
      }

      return data && data.length > 0;
    } catch (err) {
      console.error("Error checking phone:", err);
      return false;
    }
  };

  // handle signup
  const handleSignup = async () => {
    if (!isFormValid) {
      return;
    }

    try {
      setLoading(true);

      // PRE-CHECK: Check if phone already exists
      const phoneExists = await checkPhoneExists(phone);
      if (phoneExists) {
        Alert.alert(
          "Phone Already Registered",
          "This phone number is already associated with an account. Please login or use a different number.",
          [
            { text: "Go to Login", onPress: () => router.push("/login") },
            { text: "Cancel", style: "cancel" }
          ]
        );
        setLoading(false);
        return;
      }

      // Sign up with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
            birth_date: birthDate ? toISODate(birthDate) : null,
            role: "user",
          },
        }
      });

      if (signUpError) {
        console.error("Signup error:", signUpError);
        setLoading(false);
        return;
      }

      if (data?.user) {
        try {
          const userPhone = phone;

          setName("");
          setEmail("");
          setPassword("");
          setPhone("");
          setConfirmPassword("");
          setBirthDate(null);

          // Send welcome SMS (non-blocking, only for 97517 numbers)
          sendWelcomeSMS(userPhone).then((success) => {
            if (success) {
            } else {
            }
          }).catch((err) => {
            console.error('SMS sending error:', err);
          });

          alert("Signup successful! Please check your email to verify your account.");
          router.replace("/login");
        } catch (profileErr) {
          console.error("Profile creation error:", profileErr);
          alert("Account created but profile setup failed. You can still proceed to login.");
          router.replace("/login");
        }
      }
    } catch (err: any) {
      console.error("Signup error:", err);

      if (err.code === '23505' || err.message?.includes('profiles_phone_unique')) {
        Alert.alert(
          "Phone Already Registered",
          "This phone number is already in use. Please login or try a different number."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (_event: any, selected?: Date) => {
    if (Platform.OS === "android") setShowDatePicker(false);
    if (selected) setBirthDate(selected);
  };

  // Default the picker to 18 years ago for a sensible starting point.
  const defaultBirthDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d;
  })();

  const isValidBhutanesePhone = (input: string) =>
    (input.startsWith("17") || input.startsWith("77")) && input.length === 8;

  const isValidEmail = (input: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);

  // Date of birth is optional — only validate the range when the user chooses to provide one.
  const isValidBirthDate =
    birthDate === null ||
    (getAgeFromDate(birthDate) >= 0 && getAgeFromDate(birthDate) <= 120);

  const isFormValid =
    name.trim().length > 0 &&
    isValidEmail(email) &&
    isValidBhutanesePhone(phone) &&
    isValidBirthDate &&
    password.length >= 6 &&
    confirmPassword === password;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "padding"}
      style={{ flex: 1, backgroundColor: "#fff" }}
    >
      <ScrollView
          ref={scrollRef}
          className="flex-1"
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingVertical: contentPaddingY,
            rowGap: fieldGap,
            paddingHorizontal: pagePaddingX,
          }}
        >
          {/* Header */}
          <View
            className="flex-row justify-between items-center"
            style={{ marginBottom: headerBottomSpacing }}
          >
            <View>
              <Text
                className="font-mblack text-primary/90 mb-2"
                style={{ fontSize: titleSize }}
              >
                Create an
              </Text>
              <Text
                className="font-mbold text-secondary/90"
                style={{ fontSize: titleSize }}
              >
                Account
              </Text>
            </View>
            <Image
              source={require("../assets/images/logo.png")}
              style={{ width: logoSize, height: logoSize }}
              resizeMode="contain"
            />
          </View>

          {/* Name */}
          <FormInput
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            leftIcon={<MaterialIcons name="person" size={iconSize} color="#6B7280" />}
          />

          {/* Email */}
          <FormInput
            placeholder="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon={<MaterialIcons name="email" size={iconSize} color="#6B7280" />}
          />

          {/* Phone */}
          <FormInput
            placeholder="XXXXXXXX"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={8}
            leftIcon={
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MaterialIcons name="phone" size={iconSize} color="#6B7280" />
                <Text style={{ color: "#374151", fontSize: clamp(ms(15), 13, 17), fontWeight: "500" }}>
                  975 -
                </Text>
              </View>
            }
          />

          {/* Date of Birth */}
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              borderWidth: 1,
              borderColor: "#E5E7EB",
              borderRadius: 12,
              borderCurve: "continuous",
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: "#F9FAFB",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <MaterialIcons name="cake" size={iconSize} color="#6B7280" />
              <Text
                className="font-regular"
                style={{
                  fontSize: clamp(ms(15), 13, 17),
                  color: birthDate ? "#374151" : "#9CA3AF",
                }}
              >
                {birthDate ? formatDisplayDate(birthDate) : "Date of Birth (optional)"}
              </Text>
            </View>
            <MaterialIcons name="calendar-today" size={iconSize} color="#6B7280" />
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={birthDate ?? defaultBirthDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onDateChange}
              maximumDate={new Date()}
            />
          )}
          <Text
            className="font-mlight text-gray-400"
            style={{ fontSize: clamp(ms(12), 10, 14), marginTop: -fieldGap + 4 }}
          >
            Used to apply age-related content restrictions (e.g. adult health
            items are hidden for users under 18).
          </Text>

          {/* Password */}
          <FormInput
            placeholder="Password"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            leftIcon={<MaterialIcons name="lock" size={iconSize} color="#6B7280" />}
            rightAccessory={
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye" : "eye-off"}
                  size={iconSize}
                  color="#6B7280"
                />
              </Pressable>
            }
          />

          {/* Confirm Password */}
          <FormInput
            placeholder="Confirm Password"
            secureTextEntry={!showConfirmPassword}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
            leftIcon={
              <MaterialIcons name="lock-outline" size={iconSize} color="#6B7280" />
            }
            rightAccessory={
              <Pressable
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye" : "eye-off"}
                  size={iconSize}
                  color="#6B7280"
                />
              </Pressable>
            }
          />

          {/* Terms */}
          <Text
            className="font-mlight text-center text-gray-500"
            style={{ fontSize: termsSize }}
          >
            By clicking the <Text className="text-red-600">Register</Text>{" "}
            button, you agree to the{" "}
            <Text
              className="text-primary font-msemibold"
              onPress={() => setLegalModal("terms")}
            >
              Terms of Service
            </Text>{" "}
            and{" "}
            <Text
              className="text-primary font-msemibold"
              onPress={() => setLegalModal("privacy")}
            >
              Privacy Policy
            </Text>
          </Text>

          {/* Register Button */}
          <TouchableOpacity
            onPress={handleSignup}
            activeOpacity={0.8}
            disabled={!isFormValid || loading}
            style={{ backgroundColor: isFormValid && !loading ? "#094569" : "#09456980",
              paddingVertical: submitPaddingY,
              borderRadius: submitRadius,
              borderCurve: "continuous" }}
          >
            <Text
              className="text-secondary text-center font-semibold"
              style={{ fontSize: submitSize }}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </Text>
          </TouchableOpacity>

          {/* Already have account */}
          <Text
            className="text-center text-gray-500 font-regular"
            style={{ fontSize: termsSize }}
          >
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold">
              Login
            </Link>
          </Text>
      </ScrollView>

      {/* Popup */}
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup(p => ({ ...p, visible: false }))}
      />

      {/* Terms of Service / Privacy Policy */}
      <Modal
        visible={legalModal !== null}
        animationType="slide"
        onRequestClose={() => setLegalModal(null)}
      >
        {legalModal === "terms" ? (
          <TermsOfService onClose={() => setLegalModal(null)} />
        ) : legalModal === "privacy" ? (
          <PrivacyPolicy onClose={() => setLegalModal(null)} />
        ) : null}
      </Modal>
    </KeyboardAvoidingView>
  );
}
