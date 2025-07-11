import {
  Entypo,
  FontAwesome5,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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

const dzongkhags = [
  "Bumthang", "Chukha", "Dagana", "Gasa", "Haa", "Lhuntse", "Mongar", "Paro",
  "Pemagatshel", "Punakha", "Samdrup Jongkhar", "Samtse", "Sarpang", "Thimphu",
  "Trashigang", "Trashiyangtse", "Trongsa", "Tsirang", "Wangdue Phodrang", "Zhemgang",
];

export default function SignupTab2({ onPrev }: { onPrev: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dzongkhag, setDzongkhag] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const dropdownAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;

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
          {/* Back */}
          <TouchableOpacity
            onPress={onPrev}
            className="absolute top-[5%] left-[3%] z-50 p-2"
            activeOpacity={0.7}
          >
            <Entypo name="chevron-thin-left" size={24} color="#094569" />
          </TouchableOpacity>
        <ScrollView
          className="flex-1 px-[10%]"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingVertical: 40,
            rowGap: 30,
          }}
        >
        

          {/* Header */}
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-4xl font-mblack text-primary/90 mb-2">Create an</Text>
              <Text className="text-4xl font-mbold text-secondary/90">Account</Text>
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
              className="flex-1 font-regular text-base ml-2"
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
              className="flex-1 font-regular text-base ml-2"
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
              className="flex-1 font-regular text-base ml-2"
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
              style={{ position: "absolute", left: 16, top: 14, zIndex: 1000 }}
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
                  paddingVertical: 12,
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
                    transform: [{
                      rotate: dropdownAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "180deg"],
                      }),
                    }],
                  }}
                >
                  <MaterialIcons name="keyboard-arrow-down" size={24} color="#999" />
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
                        borderBottomWidth: index !== dzongkhags.length - 1 ? 0.5 : 0,
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
              className="flex-1 font-regular text-base ml-2"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              onFocus={closeDropdown}
            />
            <Pressable onPress={() => setShowPassword(!showPassword)}>
              <Ionicons name={showPassword ? "eye" : "eye-off"} size={20} color="#999" />
            </Pressable>
          </View>

          {/* Confirm Password */}
          <View className="flex-row items-center border border-gray-300 rounded-lg px-4 py-3">
            <MaterialIcons name="lock-outline" size={20} color="#999" />
            <TextInput
              placeholder="Confirm Password"
              className="flex-1 font-regular text-base ml-2"
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={closeDropdown}
            />
            <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <Ionicons
                name={showConfirmPassword ? "eye" : "eye-off"}
                size={20}
                color="#999"
              />
            </Pressable>
          </View>

          {/* Terms */}
          <Text className="text-sm font-mlight text-center text-gray-500">
            By clicking the <Text className="text-red-600">Register</Text> button,
            you agree to the public offer
          </Text>

          {/* Register Button */}
          <TouchableOpacity
            onPress={() =>
              console.log({
                name,
                email,
                phone,
                password,
                confirmPassword,
                dzongkhag,
              })
            }
            className="bg-primary py-4 rounded-lg"
            activeOpacity={0.8}
          >
            <Text className="text-secondary text-center font-semibold text-base">
              Create Account
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
