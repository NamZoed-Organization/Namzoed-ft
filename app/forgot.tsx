import { Entypo, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function Forgot() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const isValidBhutanesePhone = (input: string) => {
    return (
      (input.startsWith("17") || input.startsWith("77")) && input.length === 8
    );
  };

  const handleSubmit = () => {
    if (!isValidBhutanesePhone(phone)) return;

    setLoading(true);
    setTimeout(() => {
      setPhone(""); // Clear the input field
      setLoading(false);
    }, 2000);
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 justify-center items-center bg-white px-[10%]">
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute top-[5%] left-6 z-50 p-2"
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
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
              className="flex-1 font-regular text-base"
              maxLength={8}
            />
          </View>

          {/* Instructional Text */}
          <Text className="flex font-mlight text-gray-400 mb-10">
            <Text className="text-red-500 text-2xl">• </Text>
            We will send you a message to set or reset your new password
          </Text>

          {/* Submit Button */}
          <TouchableOpacity
            disabled={!isValidBhutanesePhone(phone) || loading}
            onPress={handleSubmit}
            activeOpacity={0.8}
            className={`py-5 rounded-md items-center ${
              isValidBhutanesePhone(phone) && !loading
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
