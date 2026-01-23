import * as ImageManipulator from "expo-image-manipulator";
import { Check, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue
} from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// --- Configuration ---
const MIN_DIMENSION = 60;
const OVERLAY_OPACITY = 0.6;
const BORDER_WIDTH = 3; // Thickness of the corner bars
const CORNER_LENGTH = 20; // Length of the corner bars
const SIDE_HANDLE_HEIGHT = 24; // Height of the side bars

interface ImageCropperProps {
  imageUri: string;
  onSave: (croppedUri: string) => void;
  onCancel: () => void;
}

export default function ResizableImageCropper({
  imageUri,
  onSave,
  onCancel,
}: ImageCropperProps) {
  const [ready, setReady] = useState(false);
  const [imageLayout, setImageLayout] = useState({
    width: 0,
    height: 0,
    x: 0,
    y: 0,
  });
  const [originalSize, setOriginalSize] = useState({ width: 0, height: 0 });
  const [isSaving, setIsSaving] = useState(false);

  // --- Shared Values ---
  const cropX = useSharedValue(0);
  const cropY = useSharedValue(0);
  const cropWidth = useSharedValue(0);
  const cropHeight = useSharedValue(0);

  // Gesture Context
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startWidth = useSharedValue(0);
  const startHeight = useSharedValue(0);

  useEffect(() => {
    if (!imageUri) return;

    Image.getSize(
      imageUri,
      (w, h) => {
        setOriginalSize({ width: w, height: h });

        const maxAreaWidth = SCREEN_WIDTH;
        const maxAreaHeight = SCREEN_HEIGHT - 140;

        const imageAspect = w / h;
        const screenAspect = maxAreaWidth / maxAreaHeight;

        let renderWidth, renderHeight;

        if (imageAspect > screenAspect) {
          renderWidth = maxAreaWidth;
          renderHeight = maxAreaWidth / imageAspect;
        } else {
          renderHeight = maxAreaHeight;
          renderWidth = maxAreaHeight * imageAspect;
        }

        const x = (maxAreaWidth - renderWidth) / 2;
        const y = (maxAreaHeight - renderHeight) / 2;

        setImageLayout({ width: renderWidth, height: renderHeight, x, y });

        const initialW = renderWidth * 0.8;
        const initialH = renderHeight * 0.8;

        cropWidth.value = initialW;
        cropHeight.value = initialH;
        cropX.value = (renderWidth - initialW) / 2;
        cropY.value = (renderHeight - initialH) / 2;

        setReady(true);
      },
      () => {
        onCancel();
      },
    );
  }, [imageUri]);

  const clamp = (val: number, min: number, max: number) => {
    "worklet";
    return Math.min(Math.max(val, min), max);
  };

  // --- 1. MOVE GESTURE (Center) ---
  const panGesture = Gesture.Pan()
    .onStart(() => {
      startX.value = cropX.value;
      startY.value = cropY.value;
    })
    .onUpdate((e) => {
      const newX = startX.value + e.translationX;
      const newY = startY.value + e.translationY;

      cropX.value = clamp(newX, 0, imageLayout.width - cropWidth.value);
      cropY.value = clamp(newY, 0, imageLayout.height - cropHeight.value);
    });

  // --- 2. CORNER RESIZE GESTURE ---
  const createCornerGesture = (corner: "tl" | "tr" | "bl" | "br") => {
    return Gesture.Pan()
      .onStart(() => {
        startX.value = cropX.value;
        startY.value = cropY.value;
        startWidth.value = cropWidth.value;
        startHeight.value = cropHeight.value;
      })
      .onUpdate((e) => {
        if (corner === "br") {
          const maxWidth = imageLayout.width - startX.value;
          const maxHeight = imageLayout.height - startY.value;
          cropWidth.value = clamp(
            startWidth.value + e.translationX,
            MIN_DIMENSION,
            maxWidth,
          );
          cropHeight.value = clamp(
            startHeight.value + e.translationY,
            MIN_DIMENSION,
            maxHeight,
          );
        } else if (corner === "bl") {
          const newX = clamp(
            startX.value + e.translationX,
            0,
            startX.value + startWidth.value - MIN_DIMENSION,
          );
          const newWidth = startWidth.value + (startX.value - newX);
          const maxHeight = imageLayout.height - startY.value;
          const newHeight = clamp(
            startHeight.value + e.translationY,
            MIN_DIMENSION,
            maxHeight,
          );
          cropX.value = newX;
          cropWidth.value = newWidth;
          cropHeight.value = newHeight;
        } else if (corner === "tr") {
          const maxWidth = imageLayout.width - startX.value;
          const newWidth = clamp(
            startWidth.value + e.translationX,
            MIN_DIMENSION,
            maxWidth,
          );
          const newY = clamp(
            startY.value + e.translationY,
            0,
            startY.value + startHeight.value - MIN_DIMENSION,
          );
          const newHeight = startHeight.value + (startY.value - newY);
          cropY.value = newY;
          cropWidth.value = newWidth;
          cropHeight.value = newHeight;
        } else if (corner === "tl") {
          const newX = clamp(
            startX.value + e.translationX,
            0,
            startX.value + startWidth.value - MIN_DIMENSION,
          );
          const newY = clamp(
            startY.value + e.translationY,
            0,
            startY.value + startHeight.value - MIN_DIMENSION,
          );
          const newWidth = startWidth.value + (startX.value - newX);
          const newHeight = startHeight.value + (startY.value - newY);
          cropX.value = newX;
          cropY.value = newY;
          cropWidth.value = newWidth;
          cropHeight.value = newHeight;
        }
      });
  };

  // --- 3. SIDE RESIZE GESTURE (Horizontal Only) ---
  const createSideGesture = (side: "left" | "right") => {
    return Gesture.Pan()
      .onStart(() => {
        startX.value = cropX.value;
        startWidth.value = cropWidth.value;
      })
      .onUpdate((e) => {
        if (side === "right") {
          // Only dragging right edge
          const maxWidth = imageLayout.width - startX.value;
          cropWidth.value = clamp(
            startWidth.value + e.translationX,
            MIN_DIMENSION,
            maxWidth,
          );
        } else if (side === "left") {
          // Dragging left edge (updates X and Width)
          const newX = clamp(
            startX.value + e.translationX,
            0,
            startX.value + startWidth.value - MIN_DIMENSION,
          );
          const newWidth = startWidth.value + (startX.value - newX);
          cropX.value = newX;
          cropWidth.value = newWidth;
        }
      });
  };

  // --- Animation Styles ---
  const cropBoxStyle = useAnimatedStyle(() => ({
    left: cropX.value,
    top: cropY.value,
    width: cropWidth.value,
    height: cropHeight.value,
  }));

  const maskTopStyle = useAnimatedStyle(() => ({
    top: 0,
    left: 0,
    right: 0,
    height: cropY.value,
  }));
  const maskBottomStyle = useAnimatedStyle(() => ({
    top: cropY.value + cropHeight.value,
    left: 0,
    right: 0,
    height: imageLayout.height - (cropY.value + cropHeight.value),
  }));
  const maskLeftStyle = useAnimatedStyle(() => ({
    top: cropY.value,
    left: 0,
    width: cropX.value,
    height: cropHeight.value,
  }));
  const maskRightStyle = useAnimatedStyle(() => ({
    top: cropY.value,
    left: cropX.value + cropWidth.value,
    right: 0,
    height: cropHeight.value,
  }));

  const handleSave = async () => {
    if (isSaving) return;
    try {
      setIsSaving(true);
      const scaleX = originalSize.width / imageLayout.width;
      const scaleY = originalSize.height / imageLayout.height;

      const cropped = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: Math.max(0, cropX.value * scaleX),
              originY: Math.max(0, cropY.value * scaleY),
              width: Math.min(cropWidth.value * scaleX, originalSize.width),
              height: Math.min(cropHeight.value * scaleY, originalSize.height),
            },
          },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      onSave(cropped.uri);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to crop");
    } finally {
      setIsSaving(false);
    }
  };

  if (!ready) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#000" size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1 bg-white">
        <StatusBar barStyle="dark-content" />

        {/* --- Header --- */}
        <View className="flex-row items-center justify-between px-4 pt-12 pb-2 border-b border-gray-100 z-50">
          <TouchableOpacity onPress={onCancel} className="p-2">
            <X size={24} color="#000" />
          </TouchableOpacity>
          <Text className="text-black font-medium text-lg">Crop Image</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className="p-2"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Check size={24} color="#000" />
            )}
          </TouchableOpacity>
        </View>

        {/* --- Main Workspace --- */}
        <View className="flex-1 justify-center items-center overflow-hidden bg-gray-50">
          <View
            style={{
              width: imageLayout.width,
              height: imageLayout.height,
              position: "relative",
            }}
          >
            <Image
              source={{ uri: imageUri }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />

            {/* Mask Overlay */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Animated.View style={[styles.mask, maskTopStyle]} />
              <Animated.View style={[styles.mask, maskBottomStyle]} />
              <Animated.View style={[styles.mask, maskLeftStyle]} />
              <Animated.View style={[styles.mask, maskRightStyle]} />
            </View>

            {/* Crop Box */}
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.cropBox, cropBoxStyle]}>
                {/* Grid */}
                <View style={styles.gridV1} />
                <View style={styles.gridV2} />
                <View style={styles.gridH1} />
                <View style={styles.gridH2} />

                {/* --- CORNER BARS --- */}

                {/* Top Left */}
                <GestureDetector gesture={createCornerGesture("tl")}>
                  <View style={[styles.touchArea, { top: -15, left: -15 }]}>
                    <View
                      style={[
                        styles.cornerBar,
                        {
                          borderTopWidth: BORDER_WIDTH,
                          borderLeftWidth: BORDER_WIDTH,
                          top: 15,
                          left: 15,
                        },
                      ]}
                    />
                  </View>
                </GestureDetector>

                {/* Top Right */}
                <GestureDetector gesture={createCornerGesture("tr")}>
                  <View style={[styles.touchArea, { top: -15, right: -15 }]}>
                    <View
                      style={[
                        styles.cornerBar,
                        {
                          borderTopWidth: BORDER_WIDTH,
                          borderRightWidth: BORDER_WIDTH,
                          top: 15,
                          right: 15,
                        },
                      ]}
                    />
                  </View>
                </GestureDetector>

                {/* Bottom Left */}
                <GestureDetector gesture={createCornerGesture("bl")}>
                  <View style={[styles.touchArea, { bottom: -15, left: -15 }]}>
                    <View
                      style={[
                        styles.cornerBar,
                        {
                          borderBottomWidth: BORDER_WIDTH,
                          borderLeftWidth: BORDER_WIDTH,
                          bottom: 15,
                          left: 15,
                        },
                      ]}
                    />
                  </View>
                </GestureDetector>

                {/* Bottom Right */}
                <GestureDetector gesture={createCornerGesture("br")}>
                  <View style={[styles.touchArea, { bottom: -15, right: -15 }]}>
                    <View
                      style={[
                        styles.cornerBar,
                        {
                          borderBottomWidth: BORDER_WIDTH,
                          borderRightWidth: BORDER_WIDTH,
                          bottom: 15,
                          right: 15,
                        },
                      ]}
                    />
                  </View>
                </GestureDetector>

                {/* --- SIDE BARS (NEW) --- */}

                {/* Left Side Handle */}
                <GestureDetector gesture={createSideGesture("left")}>
                  <View style={[styles.sideTouchArea, { left: -15 }]}>
                    <View style={[styles.sideBar, { left: 15 }]} />
                  </View>
                </GestureDetector>

                {/* Right Side Handle */}
                <GestureDetector gesture={createSideGesture("right")}>
                  <View style={[styles.sideTouchArea, { right: -15 }]}>
                    <View style={[styles.sideBar, { right: 15 }]} />
                  </View>
                </GestureDetector>
              </Animated.View>
            </GestureDetector>
          </View>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  mask: {
    position: "absolute",
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  cropBox: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    backgroundColor: "transparent",
  },
  // Grid
  gridV1: {
    position: "absolute",
    left: "33.33%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  gridV2: {
    position: "absolute",
    left: "66.66%",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  gridH1: {
    position: "absolute",
    top: "33.33%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  gridH2: {
    position: "absolute",
    top: "66.66%",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
  },

  // Touch Areas
  touchArea: {
    position: "absolute",
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  sideTouchArea: {
    position: "absolute",
    top: "50%",
    width: 40,
    height: 60,
    marginTop: -30, // Center vertically
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },

  // Visuals
  cornerBar: {
    position: "absolute",
    width: CORNER_LENGTH,
    height: CORNER_LENGTH,
    borderColor: "#000",
  },
  sideBar: {
    position: "absolute",
    width: 4, // Thickness of the vertical bar
    height: SIDE_HANDLE_HEIGHT,
    backgroundColor: "#000",
    borderRadius: 2,
  },
});
