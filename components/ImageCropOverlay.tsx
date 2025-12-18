import * as ImageManipulator from 'expo-image-manipulator';
import { Check, X } from 'lucide-react-native';
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  StatusBar,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";

interface ImageCropOverlayProps {
  imageUri: string;
  onSave: (croppedUri: string) => void;
  onCancel: () => void;
}

export default function ImageCropOverlay({ imageUri, onSave, onCancel }: ImageCropOverlayProps) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displayedImageSize, setDisplayedImageSize] = useState({ width: 0, height: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [ready, setReady] = useState(false);

  const screenWidth = Dimensions.get('window').width;
  // Reduce crop size slightly to ensure it fits well on all screens
  const cropSize = Math.min(screenWidth - 40, 350); 
  
  // Overlay math: We use a giant border to create the "hole" effect.
  const overlayBorderWidth = 2000; 

  // Shared values for gestures
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    if (!imageUri) return;

    Image.getSize(imageUri, (w, h) => {
      setImageSize({ width: w, height: h });

      const aspectRatio = w / h;
      
      // Calculate dimensions to ensure the image covers the crop area completely
      let renderWidth, renderHeight;
      if (w >= h) {
         // Landscape or Square: Height determines scale
         renderHeight = cropSize;
         renderWidth = cropSize * aspectRatio;
      } else {
         // Portrait: Width determines scale
         renderWidth = cropSize;
         renderHeight = cropSize / aspectRatio;
      }

      setDisplayedImageSize({ width: renderWidth, height: renderHeight });
      setReady(true);
    }, (error) => {
        console.error("Failed to get image size", error);
        Alert.alert("Error", "Could not load image.");
        onCancel();
    });
  }, [imageUri]);

  // Helper to clamp values
  const clamp = (val: number, min: number, max: number) => {
    'worklet';
    return Math.min(Math.max(val, min), max);
  };

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const currentWidth = displayedImageSize.width * scale.value;
      const currentHeight = displayedImageSize.height * scale.value;
      
      const maxTranslateX = (currentWidth - cropSize) / 2;
      const maxTranslateY = (currentHeight - cropSize) / 2;

      translateX.value = clamp(savedTranslateX.value + e.translationX, -maxTranslateX, maxTranslateX);
      translateY.value = clamp(savedTranslateY.value + e.translationY, -maxTranslateY, maxTranslateY);
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 4));
    })
    .onEnd(() => {
        const currentWidth = displayedImageSize.width * scale.value;
        const currentHeight = displayedImageSize.height * scale.value;
        const maxTranslateX = (currentWidth - cropSize) / 2;
        const maxTranslateY = (currentHeight - cropSize) / 2;

        if (scale.value < 1) {
            scale.value = withSpring(1);
            translateX.value = withSpring(0);
            translateY.value = withSpring(0);
        } else {
            if (Math.abs(translateX.value) > maxTranslateX) {
                translateX.value = withTiming(clamp(translateX.value, -maxTranslateX, maxTranslateX));
            }
            if (Math.abs(translateY.value) > maxTranslateY) {
                translateY.value = withTiming(clamp(translateY.value, -maxTranslateY, maxTranslateY));
            }
        }
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ],
    width: displayedImageSize.width,
    height: displayedImageSize.height,
  }));

  const handleSave = async () => {
    if (isSaving || !ready) return;
    try {
      setIsSaving(true);

      const currentScale = scale.value;
      const offsetFromCenterX = -translateX.value; 
      const offsetFromCenterY = -translateY.value;

      const scaleToOriginal = imageSize.width / displayedImageSize.width; 

      const centerX_unscaled = displayedImageSize.width / 2;
      const centerY_unscaled = displayedImageSize.height / 2;
      
      const cropHalfSize_unscaled = (cropSize / 2) / currentScale;

      const cropCenterX_unscaled = centerX_unscaled + (offsetFromCenterX / currentScale);
      const cropCenterY_unscaled = centerY_unscaled + (offsetFromCenterY / currentScale);

      const cropOriginX_unscaled = cropCenterX_unscaled - cropHalfSize_unscaled;
      const cropOriginY_unscaled = cropCenterY_unscaled - cropHalfSize_unscaled;

      const originX = Math.max(0, cropOriginX_unscaled * scaleToOriginal);
      const originY = Math.max(0, cropOriginY_unscaled * scaleToOriginal);
      
      const cropDimension = (cropSize / currentScale) * scaleToOriginal;

      const safeOriginX = Math.min(originX, imageSize.width - 1);
      const safeOriginY = Math.min(originY, imageSize.height - 1);
      const safeWidth = Math.min(cropDimension, imageSize.width - safeOriginX);
      const safeHeight = Math.min(cropDimension, imageSize.height - safeOriginY);

      const cropped = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: safeOriginX,
              originY: safeOriginY,
              width: safeWidth,
              height: safeHeight,
            }
          },
          { resize: { width: 500, height: 500 } }
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      onSave(cropped.uri);
    } catch (error) {
      console.error('Error cropping image:', error);
      Alert.alert('Error', 'Failed to save image.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!ready) {
      return (
          <View style={{ flex: 1, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#000" size="large" />
          </View>
      )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <StatusBar barStyle="dark-content" />
        
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-12 pb-4 bg-white z-20 border-b border-gray-100 shadow-sm">
          <TouchableOpacity onPress={onCancel} className="p-2">
            <X size={24} color="#374151" />
          </TouchableOpacity>
          <Text className="text-gray-900 font-semibold text-lg">Edit Photo</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            className="p-2"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#22c55e" />
            ) : (
              <Check size={24} color="#22c55e" />
            )}
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        <GestureDetector gesture={composedGesture}>
          <View style={{ flex: 1, backgroundColor: 'white', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            
            {/* The Image (Visible everywhere) */}
            <Animated.View style={animatedStyle}>
                <Image
                    source={{ uri: imageUri }}
                    style={{ width: displayedImageSize.width, height: displayedImageSize.height }}
                    resizeMode="contain"
                />
            </Animated.View>

            {/* The "Hole" Overlay */}
            <View 
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    top: 0, bottom: 0, left: 0, right: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <View 
                    style={{
                        width: cropSize + 2 * overlayBorderWidth,
                        height: cropSize + 2 * overlayBorderWidth,
                        borderRadius: (cropSize + 2 * overlayBorderWidth) / 2,
                        borderWidth: overlayBorderWidth,
                        // This semi-transparent white allows you to see the excluded parts of the image
                        borderColor: 'rgba(255, 255, 255, 0.6)', 
                    }}
                />
            </View>

            {/* Visual Border for Crop Area */}
            <View
              style={{
                position: 'absolute',
                width: cropSize,
                height: cropSize,
                borderRadius: cropSize / 2,
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.2)',
                pointerEvents: 'none',
              }}
            />
            
            <Text className="text-gray-500 text-sm mt-8 absolute bottom-10">
                Pinch to zoom • Drag to move
            </Text>

          </View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}