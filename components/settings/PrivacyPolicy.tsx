import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Shield } from 'lucide-react-native';

export default function PrivacyPolicy() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      {/* Status Bar Space */}
      <View className="h-12 bg-white" />

      {/* Header */}
      <View className="flex-row items-center p-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Privacy Policy</Text>
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-4">
        <Shield size={64} color="#94a3b8" />
        <Text className="text-xl font-bold text-gray-700 mt-4 mb-2">Privacy Policy</Text>
        <Text className="text-gray-500 text-center">
          Privacy policy content will be displayed here
        </Text>
      </View>
    </View>
  );
}