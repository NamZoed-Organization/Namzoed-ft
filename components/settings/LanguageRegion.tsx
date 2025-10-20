import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { ArrowLeft, Globe } from 'lucide-react-native';

interface LanguageRegionProps {
  onClose?: () => void;
}

export default function LanguageRegion({ onClose }: LanguageRegionProps) {
  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-gray-200">
        <TouchableOpacity onPress={onClose} className="mr-3">
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Language & Region</Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 items-center justify-center px-4 py-12">
          <Globe size={64} color="#94a3b8" />
          <Text className="text-xl font-bold text-gray-700 mt-4 mb-2">Language & Region</Text>
          <Text className="text-gray-500 text-center">
            Language and region settings will be available here
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
