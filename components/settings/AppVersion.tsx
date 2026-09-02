import { openAppStoreForUpdate } from '@/utils/appUpdate';
import Constants from 'expo-constants';
import { ArrowLeft, Download, Smartphone } from 'lucide-react-native';
import React from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface AppVersionProps {
  onClose?: () => void;
}

const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

export default function AppVersion({ onClose }: AppVersionProps) {
  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center p-4 border-b border-gray-200">
        <TouchableOpacity onPress={onClose} className="mr-3">
          <ArrowLeft size={24} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">App Version</Text>
      </View>

      {/* Scrollable Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="flex-1 items-center justify-center px-4 py-12">
          <Smartphone size={64} color="#94a3b8" />
          <Text className="text-xl font-bold text-gray-700 mt-4 mb-2">App Version</Text>
          <Text className="text-2xl font-bold text-primary mb-4">v{APP_VERSION}</Text>
          <Text className="text-gray-500 text-center mb-6">
            You're currently on version {APP_VERSION}. Check the store for the latest updates.
          </Text>

          {Platform.OS !== 'web' && (
            <TouchableOpacity
              style={{ borderRadius: 12, borderCurve: "continuous" }}
              onPress={() => void openAppStoreForUpdate()}
              activeOpacity={0.8}
              className="flex-row items-center bg-primary px-6 py-3.5"
            >
              <Download size={18} color="#fff" />
              <Text className="text-white font-semibold text-base ml-2">
                {Platform.OS === 'ios' ? 'Update on App Store' : 'Update on Play Store'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
