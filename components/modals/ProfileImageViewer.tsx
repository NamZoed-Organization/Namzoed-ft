import React from "react";
import { View, TouchableOpacity, Modal, Image, Dimensions } from "react-native";
import { X } from "lucide-react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

interface ProfileImageViewerProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

// ZoomableImage Component (simplified version from ImageViewer)
const ZoomableImage = ({ uri }: { uri: string }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      // Reset zoom if too zoomed out
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      }
      // Limit max zoom
      else if (scale.value > 3) {
        scale.value = withSpring(3);
        savedScale.value = 3;
      } else {
        savedScale.value = scale.value;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={pinchGesture}>
      <Animated.View style={[{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' }, animatedStyle]}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
};

export default function ProfileImageViewer({ visible, imageUri, onClose }: ProfileImageViewerProps) {
  if (!imageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-black" style={{ backgroundColor: '#000000' }}>
          {/* Close Button - Top Left */}
          <View className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between p-4 pt-16">
            <TouchableOpacity
              onPress={onClose}
              className="bg-black/50 rounded-full p-2"
            >
              <X size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Zoomable Image - Center */}
          <View
            className="items-center justify-center bg-black"
            style={{
              width: screenWidth,
              height: screenHeight,
              backgroundColor: '#000000'
            }}
          >
            <ZoomableImage uri={imageUri} />
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
