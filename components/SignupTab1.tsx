import { Entypo } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SignupTab1({ onNext }: { onNext: () => void }) {
  const router = useRouter();
  const [role, setRole] = useState<"Buyer" | "Seller" | null>(null);

  return (
    <View className="flex-1 bg-white">
      {/* Back button */}
      <TouchableOpacity
        onPress={() => router.push("/login")}
        className="absolute top-[5%] left-[3%] z-50 p-2"
        activeOpacity={0.7}
      >
        <Entypo name="chevron-thin-left" size={24} color="#000" />
      </TouchableOpacity>

      {/* Main Section */}
      <View className="flex-1 justify-center items-center gap-2">
        {/* Image & Header */}
        <Image
          source={require("../assets/images/logo.png")}
          className="w-50 h-50 mb-2"
          resizeMode="contain"
        />
        <Text className="text-primary/90 text-4xl font-mbold mb-10">
          Welcome<Text className="text-secondary text-4xl">!</Text>
        </Text>

        {/* Role Selection */}
        <Text className="text-gray-400 text-sm font-regular mt-6 mb-2">
          - Select your Role -
        </Text>

        <TouchableOpacity
          className={`bg-white rounded-md px-16 py-3 mt-2 border ${
            role === "Buyer" ? "border-primary" : "border-gray-300"
          }`}
          onPress={() => setRole("Buyer")}
        >
          <Text
            className={`text-xl font-semibold m-2 px-10 ${
              role === "Buyer" ? "text-primary font-mbold" : "text-gray-500"
            }`}
          >
            Buyer
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`bg-white rounded-md px-16 py-3 mt-2 border ${
            role === "Seller" ? "border-primary" : "border-gray-300"
          }`}
          onPress={() => setRole("Seller")}
        >
          <Text
            className={`text-xl font-semibold m-2 px-10 ${
              role === "Seller" ? "text-primary font-mbold" : "text-gray-500"
            }`}
          >
            Seller
          </Text>
        </TouchableOpacity>

        {/* Next Button */}
        <TouchableOpacity
          disabled={!role}
          className={`rounded-md mt-6 px-16 py-4 ${
            role ? "bg-primary" : "bg-primary/50"
          }`}
          onPress={onNext}
        >
          <Text className="text-secondary text-xl font-semibold py-2 px-10 mx-4">
            Next
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
