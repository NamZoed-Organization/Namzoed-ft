import {
  AuthButton,
  AuthField,
  AuthFooterLink,
  AuthHeading,
  AuthScreen,
} from "@/components/auth/AuthChrome";
import { MODAL_RADIUS } from "@/constants/theme";
import {
  Cake,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  User,
} from "lucide-react-native";
import PopupMessage from "@/components/ui/PopupMessage";
import { SafeAreaView } from "react-native-safe-area-context";
import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import PrivacyPolicy from "@/components/settings/PrivacyPolicy";
import TermsOfService from "@/components/settings/TermsOfService";
import { useAppRouter } from "@/utils/navigation";
import { formatDisplayDate, getAgeFromDate, toISODate } from "@/utils/age";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LIGHT_DATE_PICKER_PROPS } from "@/constants/datePicker";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  Text,
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

  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);
  const [popup, setPopup] = useState<{visible: boolean, type: 'success'|'error'|'warning'|'white', title: string, message: string}>({visible: false, type: 'success', title: '', message: ''});

  // Spacing and type come from the auth chrome now (§ Auth screens).

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
    <>
    <AuthScreen
      onBack={() => router.back()}
      footer={
        <AuthFooterLink
          prompt="Already have an account?"
          action="Sign in"
          onPress={() => router.replace("/login")}
        />
      }
    >
      <AuthHeading
        title="Create an account"
        subtitle="A name, a way to reach you, and a password. That's all."
      />

      <View style={{ gap: 12 }}>
        <AuthField
          placeholder="Full name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          icon={<User size={19} color="#9CA3AF" strokeWidth={1.8} />}
        />

        <AuthField
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          icon={<Mail size={19} color="#9CA3AF" strokeWidth={1.8} />}
        />

        <AuthField
          placeholder="XXXXXXXX"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
          maxLength={8}
          icon={<Phone size={19} color="#9CA3AF" strokeWidth={1.8} />}
          accessory={undefined}
          style={undefined}
        />

        {/* The date of birth is a choice, so it opens a picker rather than
            pretending to be a field you type into — but it wears the field's
            own shape so the column does not break. */}
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "#fff",
            borderRadius: MODAL_RADIUS,
            borderCurve: "continuous",
            paddingHorizontal: 14,
            minHeight: 52,
          }}
        >
          <View style={{ width: 26 }}>
            <Cake size={19} color="#9CA3AF" strokeWidth={1.8} />
          </View>
          <Text
            style={{
              flex: 1,
              fontSize: 16,
              color: birthDate ? "#111" : "#9CA3AF",
            }}
          >
            {birthDate ? formatDisplayDate(birthDate) : "Date of birth (optional)"}
          </Text>
          <ChevronRight size={18} color="#C7C7CC" />
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={birthDate ?? defaultBirthDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onDateChange}
            maximumDate={new Date()}
            {...LIGHT_DATE_PICKER_PROPS}
          />
        )}
        <Text style={{ fontSize: 13, lineHeight: 18, color: "#9CA3AF", marginTop: -4 }}>
          Used to hide age-restricted listings. Nobody sees it on your profile.
        </Text>

        <AuthField
          placeholder="Password"
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          icon={<Lock size={19} color="#9CA3AF" strokeWidth={1.8} />}
          accessory={
            <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
              {showPassword ? (
                <EyeOff size={19} color="#9CA3AF" strokeWidth={1.8} />
              ) : (
                <Eye size={19} color="#9CA3AF" strokeWidth={1.8} />
              )}
            </Pressable>
          }
        />

        <AuthField
          placeholder="Confirm password"
          secureTextEntry={!showConfirmPassword}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          autoCapitalize="none"
          icon={<Lock size={19} color="#9CA3AF" strokeWidth={1.8} />}
          accessory={
            <Pressable
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              hitSlop={8}
            >
              {showConfirmPassword ? (
                <EyeOff size={19} color="#9CA3AF" strokeWidth={1.8} />
              ) : (
                <Eye size={19} color="#9CA3AF" strokeWidth={1.8} />
              )}
            </Pressable>
          }
        />
      </View>

      <View style={{ height: 22 }} />

      <AuthButton
        label="Create account"
        onPress={handleSignup}
        loading={loading}
        disabled={!isFormValid}
      />

      {/* Under the button, because it is a consequence of pressing it. The
          red "Register" this replaced named a button that says something
          else, in the app's one destructive colour. */}
      <Text
        style={{
          fontSize: 13,
          lineHeight: 19,
          color: "#9CA3AF",
          textAlign: "center",
          marginTop: 14,
        }}
      >
        By creating an account you agree to our{" "}
        <Text
          style={{ color: "#0369A1", fontWeight: "600" }}
          onPress={() => setLegalModal("terms")}
        >
          Terms of Service
        </Text>{" "}
        and{" "}
        <Text
          style={{ color: "#0369A1", fontWeight: "600" }}
          onPress={() => setLegalModal("privacy")}
        >
          Privacy Policy
        </Text>
        .
      </Text>
    </AuthScreen>

      {/* Popup */}
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup(p => ({ ...p, visible: false }))}
      />

      {/* Terms of Service / Privacy Policy. Opened from Settings these sit
          inside a container that already pays the top inset; presented here
          as a modal of their own, nothing does, so this pays it — and in the
          documents' own grey, so the ground runs behind the status bar. */}
      <Modal
        visible={legalModal !== null}
        animationType="slide"
        onRequestClose={() => setLegalModal(null)}
      >
        <SafeAreaView
          edges={["top"]}
          style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND }}
        >
          {legalModal === "terms" ? (
            <TermsOfService onClose={() => setLegalModal(null)} />
          ) : legalModal === "privacy" ? (
            <PrivacyPolicy onClose={() => setLegalModal(null)} />
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}
