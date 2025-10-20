import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { ArrowLeft, Users } from 'lucide-react-native';

interface CommunityGuidelinesProps {
  onClose?: () => void;
}

export default function CommunityGuidelines({ onClose }: CommunityGuidelinesProps) {
  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-gray-200">
        <TouchableOpacity onPress={onClose} className="mr-3">
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Community Guidelines</Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 items-center justify-center px-4 py-12">
          <Users size={64} color="#94a3b8" />
          <Text className="text-xl font-bold text-gray-700 mt-4 mb-2">Community Guidelines</Text>
          <Text className="text-gray-500 text-center">
            Community guidelines and rules will be displayed here
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
