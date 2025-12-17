import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from "react-native";

export default function Login() {
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { setCurrentUser } = useUser();

  const isValidEmail = (input: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
  };

  const isValidBhutanesePhone = (input: string) => {
    return (input.startsWith("17") || input.startsWith("77")) && input.length === 8;
  };

  // Field disable logic
  const isEmailDisabled = phoneNumber.length > 0;
  const isPhoneDisabled = email.length > 0;

  // Clear handlers
  const handleClearEmail = () => {
    setEmail("");
  };

  const handleClearPhone = () => {
    setPhoneNumber("");
  };


  const handleLogin = async () => {
    const loginIdentifier = email || phoneNumber;

    // Validation
    if (!loginIdentifier || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    // Validate email format if email is being used
    if (email && !isValidEmail(email)) {
      console.error("Invalid email:", email);
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    // Validate phone format if phone is being used
    if (phoneNumber && !isValidBhutanesePhone(phoneNumber)) {
      console.error("Invalid phone:", phoneNumber);
      Alert.alert("Error", "Please enter a valid Bhutanese phone number (starts with 17 or 77, 8 digits)");
      return;
    }

    try {
      setLoading(true);

      let authEmail = email;

      // If using phone number, lookup email from profiles
      if (phoneNumber && !email) {
        console.log("Looking up user by phone:", phoneNumber);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email')
          .eq('phone', phoneNumber)
          .single();

        if (profileError || !profile) {
          console.error("Phone lookup error:", profileError);
          Alert.alert("Error", "Phone number not found. Please check your number or sign up.");
          setLoading(false);
          return;
        }

        authEmail = profile.email;
        console.log("Found email for phone:", authEmail);
      }

      console.log("Attempting login with:", {
        email: authEmail,
        passwordLength: password.length
      });

      // Attempt to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password
      });

      if (error) {
        console.error("Login Error:", {
          message: error.message,
          status: error.status,
          name: error.name
        });
        Alert.alert("Login Failed", error.message);
        return;
      }

      console.log("Auth successful:", data.user?.id);

      if (data?.user) {
        try {
          // Get user profile from profiles table
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profileError) {
            console.error("Profile fetch error:", {
              message: profileError.message,
              code: profileError.code,
              details: profileError.details
            });
            Alert.alert("Error", "Failed to fetch user profile");
            return;
          }

          console.log("Profile data fetched:", profileData);

          // Combine auth and profile data
          const userData = {
            ...data.user,
            ...profileData
          };
          console.log("Combined user data:", userData);

          try {
            // Store user data in AsyncStorage
            await AsyncStorage.setItem('currentUser', JSON.stringify(userData));
            console.log("User data stored in AsyncStorage");
            
            // Update context
            setCurrentUser(userData);
            console.log("Context updated with user data");
            
            // Clear form and redirect
            setEmail("");
            setPassword("");
            console.log("Redirecting to user area");
            router.replace("/(users)");
          } catch (storageError: any) {
            console.error("Storage/Context Error:", {
              message: storageError.message,
              stack: storageError.stack
            });
            Alert.alert("Error", "Failed to save login state");
          }
          
        } catch (error: any) {
          console.error("Profile processing error:", {
            message: error.message,
            stack: error.stack
          });
          Alert.alert("Error", "Failed to complete login");
        }
      }
    } catch (error: any) {
      console.error("Main login error:", {
        message: error.message,
        stack: error.stack
      });
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
      console.log("Login process completed");
    }
  };

  return (
    <TouchableWithoutFeedback
      onPress={() => {
        Keyboard.dismiss();
        
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-background"
      >
        <View className="flex-1 px-[10%] justify-center">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-8">
            <View>
              <Text className="text-4xl text-primary/90 font-mbold">
                Welcome
              </Text>
              <Text className="text-4xl text-secondary/90 font-mbold">
                Back!
              </Text>
            </View>
            <Image
              source={require("../assets/images/logo.png")}
              className="w-28 h-28"
              resizeMode="contain"
            />
          </View>

          {/* Fields */}
          <View className="gap-3 flex-2">
       

            {/* Email Input */}
            <View className={`border rounded-lg px-4 py-2 mb-4 flex-row items-center ${
              isEmailDisabled ? 'border-gray-200 bg-gray-50' : 'border-gray-300'
            }`}>
              <MaterialIcons
                name="email"
                size={20}
                color={isEmailDisabled ? "#ccc" : "#999"}
                className="mr-2"
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email Address"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isEmailDisabled}
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: '400',
                  color: isEmailDisabled ? '#999' : '#000000',
                  marginLeft: 8,
                  paddingVertical: 12,
                }}
                placeholderTextColor="#999999"
              />
              {email.length > 0 && (
                <Pressable onPress={handleClearEmail}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </Pressable>
              )}
            </View>

            {/* Phone Number Input */}
            <View className={`border rounded-lg px-4 py-2 mb-4 flex-row items-center ${
              isPhoneDisabled ? 'border-gray-200 bg-gray-50' : 'border-gray-300'
            }`}>
              <Ionicons
                name="call"
                size={20}
                color={isPhoneDisabled ? "#ccc" : "#999"}
                className="mr-2"
              />
              <TextInput
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="Phone Number"
                keyboardType="phone-pad"
                editable={!isPhoneDisabled}
                maxLength={8}
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: '400',
                  color: isPhoneDisabled ? '#999' : '#000000',
                  marginLeft: 8,
                  paddingVertical: 12,
                }}
                placeholderTextColor="#999999"
              />
              {phoneNumber.length > 0 && (
                <Pressable onPress={handleClearPhone}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </Pressable>
              )}
            </View>

            {/* Password Input */}
            <View className="border border-gray-300 rounded-lg px-4 py-2 mb-2 flex-row items-center">
              <Ionicons
                name="lock-closed"
                size={20}
                color="#999"
                className="mr-2"
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                secureTextEntry={!showPassword}
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: '400',
                  color: '#000000',
                  marginLeft: 8,
                  paddingVertical: 12,
                }}
                placeholderTextColor="#999999"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye" : "eye-off"}
                  size={20}
                  color="#999"
                />
              </Pressable>
            </View>
          </View>

          {/* Forgot Password */}
          <Text className="text-right text-sm mb-6 font-regular">
            <Link href="/forgot" className="text-red-400 font-regular">
              Forgot Password?
            </Link>
          </Text>

          {/* Login Button */}
          <TouchableOpacity
            disabled={
              !(email || phoneNumber) ||
              password.length === 0 ||
              (email && !isValidEmail(email)) ||
              (phoneNumber && !isValidBhutanesePhone(phoneNumber)) ||
              loading
            }
            onPress={handleLogin}
            className={`py-5 rounded-md items-center my-10 ${
              (email || phoneNumber) &&
              password.length > 0 &&
              (!email || isValidEmail(email)) &&
              (!phoneNumber || isValidBhutanesePhone(phoneNumber)) &&
              !loading
                ? "bg-primary"
                : "bg-primary/50"
            }`}
          >
            {loading ? (
              <ActivityIndicator color="#EDC06D" />
            ) : (
              <Text className="text-secondary text-center font-semibold text-lg">
                Login
              </Text>
            )}
          </TouchableOpacity>

          {/* Guest Option */}
          <Text className="text-center font-regular text-gray-500 text-sm mb-2">
            - or continue as -
          </Text>

          <TouchableOpacity
            className="bg-white border border-gray-300 py-5 rounded-md mb-4"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 1, height: 1 },
              shadowOpacity: 0.1,
              shadowRadius: 1,
              elevation: 1,
            }}
          >
            <Text className="text-black text-center font-semibold text-base">
              Guest
            </Text>
          </TouchableOpacity>

          {/* Signup Link */}
          <Text className="text-center text-gray-500 font-regular text-sm">
            Create an account{" "}
            <Link href="/signup" className="text-red-400 font-medium underline">
              Sign up
            </Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}
