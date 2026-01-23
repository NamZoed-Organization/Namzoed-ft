import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Image } from 'expo-image';
import ImageZoom from 'react-native-image-pan-zoom';

interface LicenseViewerOverlayProps {
  visible: boolean;
  licenseUrl: string;
  onClose: () => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function LicenseViewerOverlay({
  visible,
  licenseUrl,
  onClose,
}: LicenseViewerOverlayProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        className="flex-1 bg-white"
      >
        {/* Header with Close Button */}
        <View className="absolute top-0 left-0 right-0 z-10 pt-12 pb-4 px-4 bg-white border-b border-gray-200">
          <View className="flex-row items-center justify-between">
            <Text className="text-gray-900 text-lg font-mbold">License Document</Text>
            <TouchableOpacity
              onPress={onClose}
              className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
            >
              <X size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>
        </View>

        {/* License Image - Full screen below header */}
        <View className="flex-1" style={{ marginTop: 80 }}>
          {imageLoading && (
            <View className="absolute z-20 left-0 right-0 top-0 bottom-0 items-center justify-center">
              <ActivityIndicator size="large" color="#094569" />
            </View>
          )}

          {imageError ? (
            <View className="items-center justify-center flex-1">
              <Text className="text-gray-900 text-base font-msemibold mb-2">Failed to load image</Text>
              <Text className="text-gray-600 text-sm">Please try again</Text>
            </View>
          ) : (
            <ImageZoom
              cropWidth={SCREEN_WIDTH}
              cropHeight={SCREEN_HEIGHT - 80}
              imageWidth={SCREEN_WIDTH}
              imageHeight={SCREEN_HEIGHT - 80}
              enableSwipeDown={false}
              enableCenterFocus={true}
              minScale={1}
              maxScale={5}
              useNativeDriver={true}
              doubleClickInterval={250}
            >
              <Image
                source={{ uri: licenseUrl }}
                style={{
                  width: SCREEN_WIDTH,
                  height: SCREEN_HEIGHT - 80,
                }}
                contentFit="contain"
                transition={200}
                recyclingKey={licenseUrl}
                onLoadStart={() => setImageLoading(true)}
                onLoad={() => setImageLoading(false)}
                onError={() => {
                  setImageLoading(false);
                  setImageError(true);
                  console.error('Failed to load license image:', licenseUrl);
                }}
              />
            </ImageZoom>
          )}
        </View>

      </Animated.View>
    </Modal>
  );
}
