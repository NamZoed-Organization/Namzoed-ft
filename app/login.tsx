import AnimatedDropdown from "@/components/AnimationDropdown";
import { FontAwesome5, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const roles = ["Buyer", "Seller"];
  const [loading, setLoading] = useState(false);

  const isValidBhutanesePhone = (input: string) => {
    return (
      (input.startsWith("17") || input.startsWith("77")) && input.length === 8
    );
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

  const handleLogin = () => {
    if (!isValidBhutanesePhone(phone)) return;
   

    setLoading(true);
    setTimeout(() => {
      setPhone("");
      setLoading(false);
      router.replace("/(tabs)/explore");
    }, 2000);
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
        className="flex-1 bg-white"
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

            {/* Phone Input */}
            <View className="border border-gray-300 rounded-lg px-4 py-2 mb-4 flex-row items-center">
              <MaterialIcons
                name="phone"
                size={20}
                color="#999"
                className="mr-2"
              />
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone Number"
                keyboardType="phone-pad"
                className="flex-1 font-regular text-base"
                maxLength={8}
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
              !isValidBhutanesePhone(phone) || password.length === 0 || loading
            }
            onPress={handleLogin}
            className={`py-5 rounded-md items-center my-10 ${
              isValidBhutanesePhone(phone) && password.length > 0 && !loading
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
