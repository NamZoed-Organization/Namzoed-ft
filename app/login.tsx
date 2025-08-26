import AnimatedDropdown from "@/components/AnimationDropdown";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function Login() {
  const [role, setRole] = useState("Buyer");
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const roles = ["Buyer", "Seller"];
  const [loading, setLoading] = useState(false);
  const { setCurrentUser } = useUser();

  const isValidEmail = (input: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
  };

  useEffect(() => {
    const handleBackPress = () => {
      if (showRoleModal) {
        setShowRoleModal(false);
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );

    return () => backHandler.remove();
  }, [showRoleModal]);

  const handleLogin = async () => {
    if (!isValidEmail(email)) {
      console.error("Invalid email:", email);
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }
    
    try {
      setLoading(true);
      
      // Debug: Check if user exists in auth
      const { data: authCheck } = await supabase.auth.getUser();
      console.log("Current auth state:", authCheck);

      // Debug: Check if user exists in profiles
      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();
      
      console.log("Profile check:", profileCheck);

      console.log("Attempting login with:", { 
        email,
        passwordLength: password.length 
      });

      // Attempt to sign in
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
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
        setShowRoleModal(false);
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
            {/* Role Dropdown */}
            <View
              className="mb-4 relative self-end"
              style={{ width: "100%", zIndex: 99 }}
            >
              <View className="absolute left-3 top-[33%] z-10 pointer-events-none">
                <FontAwesome5 name="user-tag" size={18} color="#999" />
              </View>

              <TouchableOpacity
                className="border border-gray-300 rounded-lg h-[60px] justify-center pl-10 pr-10 bg-white shadow-sm"
                onPress={() => {
                  Keyboard.dismiss();
                  setShowRoleModal(true);
                }}
                activeOpacity={0.8}
              >
                <Text className="font-regular text-gray-700 pl-[5%]">
                  {role}
                </Text>
                <Ionicons
                  name={showRoleModal ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#999"
                  style={{ position: "absolute", right: 12, top: "38%" }}
                />
              </TouchableOpacity>

              {showRoleModal && (
                <>
                  {/* Tap catcher */}
                  <Pressable
                    onPress={() => setShowRoleModal(false)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: "transparent",
                      zIndex: 90,
                    }}
                  />

                  <AnimatedDropdown
                    roles={roles}
                    onSelect={(item) => setRole(item)}
                    onClose={() => setShowRoleModal(false)}
                  />
                </>
              )}
            </View>

            {/* Email Input */}
            <View className="border border-gray-300 rounded-lg px-4 py-2 mb-4 flex-row items-center">
              <MaterialIcons
                name="email"
                size={20}
                color="#999"
                className="mr-2"
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email Address"
                keyboardType="email-address"
                autoCapitalize="none"
                className="flex-1 font-regular text-base"
                onFocus={() => setShowRoleModal(false)}
              />
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
                className="flex-1 font-regular text-base"
                onFocus={() => setShowRoleModal(false)}
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
              !isValidEmail(email) || password.length === 0 || loading
            }
            onPress={handleLogin}
            className={`py-5 rounded-md items-center my-10 ${
              isValidEmail(email) && password.length > 0 && !loading
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
