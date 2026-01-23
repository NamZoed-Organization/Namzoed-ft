import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import React from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
  Pressable
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown
} from 'react-native-reanimated';

interface ImagePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onCameraPress: () => void;
  onGalleryPress: () => void;
  title?: string;
}

export default function ImagePickerSheet({
  visible,
  onClose,
  onCameraPress,
  onGalleryPress,
  title = 'Add Photo'
}: ImagePickerSheetProps) {
  if (!visible) return null;

  const handleCameraPress = () => {
    onClose();
    setTimeout(() => onCameraPress(), 100);
  };

  const handleGalleryPress = () => {
    onClose();
    setTimeout(() => onGalleryPress(), 100);
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        {/* Backdrop */}
        <Pressable onPress={onClose} className="absolute inset-0">
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            className="flex-1 bg-black/50"
          />
        </Pressable>

        {/* Sheet Content */}
        <Animated.View
          entering={SlideInDown.duration(250)}
          exiting={SlideOutDown.duration(200)}
          className="bg-white rounded-t-3xl pb-8 pt-2"
        >
          {/* Handle Bar */}
          <View className="items-center py-3">
            <View className="w-10 h-1 bg-gray-300 rounded-full" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-6 pb-4 border-b border-gray-100">
            <Text className="text-lg font-semibold text-gray-900">{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 bg-gray-100 rounded-full"
            >
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Options */}
          <View className="px-6 pt-4 gap-3">
            {/* Take Photo Option */}
            <TouchableOpacity
              onPress={handleCameraPress}
              activeOpacity={0.7}
              className="flex-row items-center p-4 bg-gray-50 rounded-2xl border border-gray-100"
            >
              <View className="w-12 h-12 bg-primary/10 rounded-xl items-center justify-center mr-4">
                <Camera size={24} color="#094569" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-medium text-gray-900">Take Photo</Text>
                <Text className="text-sm text-gray-500">Use your camera</Text>
              </View>
            </TouchableOpacity>

            {/* Choose from Gallery Option */}
            <TouchableOpacity
              onPress={handleGalleryPress}
              activeOpacity={0.7}
              className="flex-row items-center p-4 bg-gray-50 rounded-2xl border border-gray-100"
            >
              <View className="w-12 h-12 bg-primary/10 rounded-xl items-center justify-center mr-4">
                <ImageIcon size={24} color="#094569" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-medium text-gray-900">Choose from Gallery</Text>
                <Text className="text-sm text-gray-500">Select from your photos</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <View className="px-6 pt-4">
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              className="py-4 bg-gray-100 rounded-2xl"
            >
              <Text className="text-center text-base font-medium text-gray-600">Cancel</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
