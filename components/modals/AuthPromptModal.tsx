import { useRouter } from "expo-router";
import React from "react";
import { Modal, Text, TouchableOpacity } from "react-native";

interface AuthPromptModalProps {
  visible: boolean;
  onClose: () => void;
  message?: string;
}

export default function AuthPromptModal({
  visible,
  onClose,
  message = "Sign in to access this feature",
}: AuthPromptModalProps) {
  const router = useRouter();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 bg-black/50 justify-center items-center px-6"
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          className="bg-white rounded-2xl w-full px-6 py-8 items-center"
        >
          <Text className="text-xl font-mbold text-gray-900 mb-2 text-center">
            Account Required
          </Text>
          <Text className="text-sm font-regular text-gray-500 text-center mb-6">
            {message}
          </Text>

          <TouchableOpacity
            onPress={() => {
              onClose();
              router.push("/login");
            }}
            className="bg-primary w-full py-3.5 rounded-full items-center mb-3"
            activeOpacity={0.8}
          >
            <Text className="text-white font-msemibold text-base">Log In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              onClose();
              router.push("/signup");
            }}
            className="bg-gray-100 w-full py-3.5 rounded-full items-center mb-2"
            activeOpacity={0.8}
          >
            <Text className="text-gray-800 font-msemibold text-base">
              Create Account
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} className="mt-1">
            <Text className="text-gray-400 font-mmedium text-sm">
              Not now
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
