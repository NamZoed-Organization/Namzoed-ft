import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { ArrowLeft, HelpCircle } from 'lucide-react-native';

interface HelpCenterProps {
  onClose?: () => void;
}

export default function HelpCenter({ onClose }: HelpCenterProps) {
  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-gray-200">
        <TouchableOpacity onPress={onClose} className="mr-3">
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Help Center</Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 items-center justify-center px-4 py-12">
          <HelpCircle size={64} color="#94a3b8" />
          <Text className="text-xl font-bold text-gray-700 mt-4 mb-2">Help Center</Text>
          <Text className="text-gray-500 text-center">
            Help articles and support content will be available here
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
