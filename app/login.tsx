import { Link } from "expo-router";
import { useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity
} from "react-native";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 justify-center px-6 bg-white"
    >
      <Text className="text-3xl font-extrabold text-primary mb-2">Welcome Back</Text>
      <Text className="text-base text-gray-500 mb-8">Login to your account</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base"
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base"
      />

      <TouchableOpacity className="bg-primary py-3 rounded-lg mb-4">
        <Text className="text-white text-center font-semibold text-base">Login</Text>
      </TouchableOpacity>

      <Text className="text-center text-gray-500">
        Don't have an account?{" "}
        <Link href="/signup" className="text-primary font-semibold">Sign up</Link>
      </Text>
    </KeyboardAvoidingView>
  );
}
