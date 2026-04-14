import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { X } from "lucide-react-native";
import React from "react";
import { Image } from "expo-image";
import { Dimensions, Modal, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface ProfileImageViewerProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const AVATAR_SIZE = Math.min(screenWidth * 0.78, 360);
const GRAIN_DOTS = Array.from({ length: 140 }, (_, i) => ({
  key: i,
  left: (i * 73) % 100,
  top: (i * 41) % 100,
  size: i % 3 === 0 ? 2 : 1,
  opacity: i % 4 === 0 ? 0.12 : 0.06,
}));

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
      <Animated.View
        style={[
          {
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            justifyContent: "center",
            alignItems: "center",
          },
          animatedStyle,
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </Animated.View>
    </GestureDetector>
  );
};

export default function ProfileImageViewer({
  visible,
  imageUri,
  onClose,
}: ProfileImageViewerProps) {
  if (!imageUri) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(232, 232, 232, 0.9)" }}>
        <BlurView
            intensity={35}
            tint="dark"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <LinearGradient
            colors={[
              "rgba(255, 132, 86, 0.14)",
              "rgba(112, 86, 255, 0.12)",
              "rgba(28, 28, 38, 0.18)",
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          >
            {GRAIN_DOTS.map((dot) => (
              <View
                key={dot.key}
                style={{
                  position: "absolute",
                  left: `${dot.left}%`,
                  top: `${dot.top}%`,
                  width: dot.size,
                  height: dot.size,
                  borderRadius: dot.size,
                  backgroundColor: `rgba(255,255,255,${dot.opacity})`,
                }}
              />
            ))}
          </View>

          {/* Close Button - Top Left */}
          <View className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between p-4 pt-16">
            <TouchableOpacity
              onPress={onClose}
              className="rounded-full p-2"
              style={{ backgroundColor: "rgba(9, 16, 29, 0.45)" }}
            >
              <X size={24} color="white" />
            </TouchableOpacity>
          </View>

          {/* Rounded profile image viewer */}
          <View
            className="items-center justify-center"
            style={{
              width: screenWidth,
              height: screenHeight,
            }}
          >
            <View
              style={{
                width: AVATAR_SIZE + 14,
                height: AVATAR_SIZE + 14,
                borderRadius: (AVATAR_SIZE + 14) / 2,
                padding: 7,
                backgroundColor: "rgba(255,255,255,0.18)",
              }}
            >
              <View
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: AVATAR_SIZE / 2,
                  overflow: "hidden",
                  backgroundColor: "rgba(255,255,255,0.12)",
                }}
              >
                <ZoomableImage uri={imageUri} />
              </View>
            </View>
          </View>
      </View>
    </Modal>
  );
}
