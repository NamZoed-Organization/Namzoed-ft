import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { ArrowLeft, Smartphone } from 'lucide-react-native';

interface AppVersionProps {
  onClose?: () => void;
}

export default function AppVersion({ onClose }: AppVersionProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <View className="flex-1">
      {/* Fading background overlay that covers status bar */}
      <Animated.View
        className="absolute top-0 left-0 right-0 bottom-0 bg-black/30"
        style={{
          opacity: fadeAnim,
          marginTop: -100 // Extend upward to cover status bar
        }}
      />

      {/* Top space to show underlying page */}
      <View className="h-20" />

      {/* Sliding white content */}
      <Animated.View
        className="flex-1 bg-white rounded-t-3xl overflow-hidden"
        style={{ transform: [{ translateY: slideAnim }] }}
      >
        <View className="flex-row items-center p-4 border-b border-gray-200">
          <TouchableOpacity onPress={onClose} className="mr-3">
            <ArrowLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-gray-900">App Version</Text>
        </View>

        {/* Content */}
        <View className="flex-1 items-center justify-center px-4">
          <Smartphone size={64} color="#94a3b8" />
          <Text className="text-xl font-bold text-gray-700 mt-4 mb-2">App Version</Text>
          <Text className="text-2xl font-bold text-primary mb-4">v1.0.0</Text>
          <Text className="text-gray-500 text-center">
            App version information and update options will be available here
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}