import {
  FontAwesome5,
  Ionicons,
  MaterialIcons
} from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { supabase } from '../lib/supabase';

const dzongkhags = [
  "Bumthang",
  "Chukha",
  "Dagana",
  "Gasa",
  "Haa",
  "Lhuntse",
  "Mongar",
  "Paro",
  "Pemagatshel",
  "Punakha",
  "Samdrup Jongkhar",
  "Samtse",
  "Sarpang",
  "Thimphu",
  "Trashigang",
  "Trashiyangtse",
  "Trongsa",
  "Tsirang",
  "Wangdue Phodrang",
  "Zhemgang",
];

export default function SignupTab2({ onPrev }: { onPrev: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dzongkhag, setDzongkhag] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const dropdownAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;


  // loading states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // handle signup
  const handleSignup = async () => {
    if (!isFormValid) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Sign up with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
            dzongkhag,
            role: "user",
          },
        }
      });

      if (signUpError) {
        console.error("Signup error:", signUpError);
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (data?.user) {
        try {
          // Create profile data
          const profileData = {
            id: data.user.id,
            name,
            phone,
            dzongkhag,
            email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // Clear form fields
          setName("");
          setEmail("");
          setPassword("");
          setPhone("");
          setConfirmPassword("");
          setDzongkhag("");

          // Show success message and navigate
          alert("Signup successful! Please check your email to verify your account.");
          router.replace("/login");
        } catch (profileErr) {
          console.error("Profile creation error:", profileErr);
          // Still navigate to login even if profile creation fails
          alert("Account created but profile setup failed. You can still proceed to login.");
          router.replace("/login");
        }
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      setError(err?.message || "An error occurred during signup");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const keyboardDidShow = Keyboard.addListener("keyboardDidShow", () => {
      setIsKeyboardOpen(true);
      if (showDropdown) closeDropdown();
    });
    const keyboardDidHide = Keyboard.addListener("keyboardDidHide", () => {
      setIsKeyboardOpen(false);
    });
    return () => {
      keyboardDidShow.remove();
      keyboardDidHide.remove();
    };
  }, [showDropdown]);

  const openDropdown = () => {
    if (isKeyboardOpen) {
      Keyboard.dismiss();
      setTimeout(() => {
        showDropdownAnimation();
      }, 100);
    } else {
      showDropdownAnimation();
    }
  };

  const showDropdownAnimation = () => {
    setShowDropdown(true);
    Animated.parallel([
      Animated.timing(dropdownAnimation, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 0.98,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDropdown = () => {
    Animated.parallel([
      Animated.timing(dropdownAnimation, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowDropdown(false);
    });
  };

  const handleItemSelect = (item: string) => {
    setDzongkhag(item);
    closeDropdown();
  };
  const isValidBhutanesePhone = (input: string) =>
    (input.startsWith("17") || input.startsWith("77")) && input.length === 8;

  const isValidEmail = (input: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);

  const isFormValid =
    name.trim().length > 0 &&
    isValidEmail(email) &&
    isValidBhutanesePhone(phone) &&
    dzongkhag !== "" &&
    password.length >= 6 &&
    confirmPassword === password;

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
        if (showDropdown) closeDropdown();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-white"
      >
    
        <ScrollView
          className="flex-1 px-[10%]"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingVertical: 40,
            rowGap: 15,
          }}
        >
          {/* Header */}
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-4xl font-mblack text-primary/90 mb-2">
                Create an
              </Text>
              <Text className="text-4xl font-mbold text-secondary/90">
                Account
              </Text>
            </View>
            <Image
              source={require("../assets/images/logo.png")}
              className="w-24 h-24"
              resizeMode="contain"
            />
          </View>

          {/* Name */}
          <View className="flex-row items-center border border-gray-300 rounded-lg px-4 py-3">
            <MaterialIcons name="person" size={20} color="#999" />
            <TextInput
              placeholder="Full Name"
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: '400',
                color: '#000000',
                marginLeft: 8,
                paddingVertical: 12,
              }}
              placeholderTextColor="#999999"
              value={name}
              onChangeText={setName}
              onFocus={closeDropdown}
            />
          </View>

          {/* Email */}
          <View className="flex-row items-center border border-gray-300 rounded-lg px-4 py-3">
            <MaterialIcons name="email" size={20} color="#999" />
            <TextInput
              placeholder="E-mail"
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: '400',
                color: '#000000',
                marginLeft: 8,
                paddingVertical: 12,
              }}
              placeholderTextColor="#999999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={closeDropdown}
            />
          </View>

          {/* Phone */}
          <View className="flex-row items-center border border-gray-300 rounded-lg px-4 py-3">
            <MaterialIcons name="phone" size={20} color="#999" />
            <TextInput
              placeholder="Phone Number"
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: '400',
                color: '#000000',
                marginLeft: 8,
                paddingVertical: 12,
              }}
              placeholderTextColor="#999999"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              onFocus={closeDropdown}
            />
          </View>

          {/* Dzongkhag Dropdown */}
          <View className="relative">
            <FontAwesome5
              name="map-marker-alt"
              size={18}
              color="#999"
              style={{ position: "absolute", left: 16, top: "30%", zIndex: 1000 }}
            />
            <Animated.View style={{ transform: [{ scale: scaleAnimation }] }}>
              <TouchableOpacity
                onPress={openDropdown}
                activeOpacity={0.8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderWidth: 1,
                  borderColor: showDropdown ? "#6B7280" : "#D1D5DB",
                  borderRadius: 8,
                  paddingVertical: 18,
                  paddingHorizontal: 16,
                  paddingLeft: 46,
                  backgroundColor: "#fff",
                }}
              >
                <Text
                  className="font-regular text-base text-gray-700"
                  selectable={false}
                >
                  {dzongkhag || "Select Dzongkhag"}
                </Text>
                <Animated.View
                  style={{
                    transform: [
                      {
                        rotate: dropdownAnimation.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", "180deg"],
                        }),
                      },
                    ],
                  }}
                >
                  <MaterialIcons
                    name="keyboard-arrow-down"
                    size={24}
                    color="#999"
                  />
                </Animated.View>
              </TouchableOpacity>
            </Animated.View>

            {showDropdown && (
              <Animated.View
                style={{
                  position: "absolute",
                  top: 0,
                  left: 20,
                  right: 20,
                  maxHeight: 250,
                  backgroundColor: "#fff",
                  borderRadius: 8,
                  borderColor: "#D1D5DB",
                  borderWidth: 1,
                  elevation: 8,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 6,
                  zIndex: 1000,
                  opacity: dropdownAnimation,
                  transform: [
                    {
                      translateY: dropdownAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-10, 0],
                      }),
                    },
                    {
                      scaleY: dropdownAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.8, 1],
                      }),
                    },
                  ],
                }}
              >
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  style={{ maxHeight: 250 }}
                  contentContainerStyle={{ paddingVertical: 10 }}
                >
                  {dzongkhags.map((item, index) => (
                    <Pressable
                      key={item}
                      onPress={() => handleItemSelect(item)}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        borderBottomWidth:
                          index !== dzongkhags.length - 1 ? 0.5 : 0,
                        borderBottomColor: "#E5E7EB",
                        alignItems: "center",
                      }}
                      android_ripple={{ color: "#F3F4F6" }}
                    >
                      <Text
                        className="font-regular text-base text-gray-700"
                        selectable={false}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
          </View>

          {/* Password */}
          <View className="flex-row items-center border border-gray-300 rounded-lg px-4 py-3">
            <MaterialIcons name="lock" size={20} color="#999" />
            <TextInput
              placeholder="Password"
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: '400',
                color: '#000000',
                marginLeft: 8,
                paddingVertical: 12,
              }}
              placeholderTextColor="#999999"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              onFocus={closeDropdown}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye" : "eye-off"}
                size={20}
                color="#999"
              />
            </Pressable>
          </View>

          {/* Confirm Password */}
          <View className="flex-row items-center border border-gray-300 rounded-lg px-4 py-3">
            <MaterialIcons name="lock-outline" size={20} color="#999" />
            <TextInput
              placeholder="Confirm Password"
              style={{
                flex: 1,
                fontSize: 16,
                fontWeight: '400',
                color: '#000000',
                marginLeft: 8,
                paddingVertical: 12,
              }}
              placeholderTextColor="#999999"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={closeDropdown}
            />
            <Pressable
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Ionicons
                name={showConfirmPassword ? "eye" : "eye-off"}
                size={20}
                color="#999"
              />
            </Pressable>
          </View>

          {/* Terms */}
          <Text className="text-sm font-mlight text-center text-gray-500">
            By clicking the <Text className="text-red-600">Register</Text>{" "}
            button, you agree to the public offer
          </Text>

          {/* Register Button */}
          <TouchableOpacity
  onPress={handleSignup}
  className="py-4 rounded-lg"
  activeOpacity={0.8}
  disabled={!isFormValid || loading}
  style={{
    backgroundColor: isFormValid && !loading ? "#094569" : "#09456980",
  }}
>
  <Text className="text-secondary text-center font-semibold text-base">
    {loading ? "Creating Account..." : "Create Account"}
  </Text>
</TouchableOpacity>


          {/* Already have account */}
          <Text className="text-center text-gray-500 font-regular">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold">
              Login
            </Link>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
