import * as ImageManipulator from "expo-image-manipulator";
import { Check, X } from "lucide-react-native";
import PopupMessage from "@/components/ui/PopupMessage";
import CircularLoader from "@/components/ui/CircularLoader";
import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StatusBar,
  Text,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

export interface StoryCropResult {
  uri: string;
  width: number;
  height: number;
}

interface StoryCropOverlayProps {
  visible: boolean;
  imageUri: string;
  imageWidth?: number;
  imageHeight?: number;
  onSave: (result: StoryCropResult) => void;
  onCancel: () => void;
}

// Story canvas is a fixed 9:16 portrait — narrower than the ~0.56-height-capped
// crop frame used for feed posts (FeedAspectReframeOverlay), since stories
// need an immersive, near-edge-to-edge canvas rather than a bounded preview.
const ASPECT = 9 / 16;
const HEADER_RESERVED = 100;

/**
 * Pinch / pan reframing to a fixed 9:16 story canvas. Same gesture and
 * crop-math technique as FeedAspectReframeOverlay, forked with full-screen
 * sizing and full-black immersive chrome for the Stories composer.
 */
export default function StoryCropOverlay({
  visible,
  imageUri,
  imageWidth,
  imageHeight,
  onSave,
  onCancel,
}: StoryCropOverlayProps) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displayedImageSize, setDisplayedImageSize] = useState({
    width: 0,
    height: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [stageLayout, setStageLayout] = useState({ w: 0, h: 0 });
  const [popup, setPopup] = useState({
    visible: false,
    type: "error" as const,
    title: "",
    message: "",
  });

  const { width: sw, height: sh } = Dimensions.get("window");

  const { frameW, frameH } = useMemo(() => {
    const maxW = sw;
    const maxH = sh - HEADER_RESERVED;
    let fh = maxH;
    let fw = fh * ASPECT;
    if (fw > maxW) {
      fw = maxW;
      fh = fw / ASPECT;
    }
    return { frameW: fw, frameH: fh };
  }, [sw, sh]);

  const fitRef = Math.max(frameW, frameH, 280);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    if (!visible || !imageUri) return;

    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    setReady(false);

    const showErr = () => {
      setPopup({
        visible: true,
        type: "error",
        title: "Load Failed",
        message: "Could not load image.",
      });
      setTimeout(() => setPopup((p) => ({ ...p, visible: false })), 2200);
      onCancel();
    };

    const initWithSize = (w: number, h: number) => {
      setImageSize({ width: w, height: h });
      const imgAspect = w / h;
      let renderWidth: number;
      let renderHeight: number;
      if (w >= h) {
        renderHeight = fitRef;
        renderWidth = fitRef * imgAspect;
      } else {
        renderWidth = fitRef;
        renderHeight = fitRef / imgAspect;
      }
      setDisplayedImageSize({ width: renderWidth, height: renderHeight });
      setReady(true);
    };

    if (imageWidth && imageHeight) {
      initWithSize(imageWidth, imageHeight);
    } else {
      Image.getSize(imageUri, initWithSize, showErr);
    }
  }, [visible, imageUri, imageWidth, imageHeight, frameW, frameH]);

  const clamp = (val: number, min: number, max: number) => {
    "worklet";
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
      const maxTranslateX = Math.max(0, (currentWidth - frameW) / 2);
      const maxTranslateY = Math.max(0, (currentHeight - frameH) / 2);
      translateX.value = clamp(
        savedTranslateX.value + e.translationX,
        -maxTranslateX,
        maxTranslateX,
      );
      translateY.value = clamp(
        savedTranslateY.value + e.translationY,
        -maxTranslateY,
        maxTranslateY,
      );
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
      const maxTranslateX = Math.max(0, (currentWidth - frameW) / 2);
      const maxTranslateY = Math.max(0, (currentHeight - frameH) / 2);
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      } else {
        if (Math.abs(translateX.value) > maxTranslateX) {
          translateX.value = withTiming(
            clamp(translateX.value, -maxTranslateX, maxTranslateX),
          );
        }
        if (Math.abs(translateY.value) > maxTranslateY) {
          translateY.value = withTiming(
            clamp(translateY.value, -maxTranslateY, maxTranslateY),
          );
        }
      }
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
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

      const cropW_unscaled = frameW / currentScale;
      const cropH_unscaled = frameH / currentScale;

      const cropCenterX_unscaled =
        centerX_unscaled + offsetFromCenterX / currentScale;
      const cropCenterY_unscaled =
        centerY_unscaled + offsetFromCenterY / currentScale;

      const cropOriginX_unscaled = cropCenterX_unscaled - cropW_unscaled / 2;
      const cropOriginY_unscaled = cropCenterY_unscaled - cropH_unscaled / 2;

      const originX = Math.max(0, cropOriginX_unscaled * scaleToOriginal);
      const originY = Math.max(0, cropOriginY_unscaled * scaleToOriginal);
      const cropW = cropW_unscaled * scaleToOriginal;
      const cropH = cropH_unscaled * scaleToOriginal;

      const safeOriginX = Math.min(originX, imageSize.width - 1);
      const safeOriginY = Math.min(originY, imageSize.height - 1);
      const safeWidth = Math.min(cropW, imageSize.width - safeOriginX);
      const safeHeight = Math.min(cropH, imageSize.height - safeOriginY);

      const outW = 1080;
      const outH = Math.round(outW / ASPECT);

      const cropped = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX: safeOriginX,
              originY: safeOriginY,
              width: safeWidth,
              height: safeHeight,
            },
          },
          { resize: { width: outW, height: outH } },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );

      onSave({
        uri: cropped.uri,
        width: cropped.width,
        height: cropped.height,
      });
    } catch (e) {
      console.error("StoryCropOverlay save:", e);
      setPopup({
        visible: true,
        type: "error",
        title: "Save Failed",
        message: "Could not save the crop.",
      });
      setTimeout(() => setPopup((p) => ({ ...p, visible: false })), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  const stageW = stageLayout.w || sw;
  const stageH = stageLayout.h || sh - HEADER_RESERVED;
  const frameLeft = (stageW - frameW) / 2;
  const frameTop = (stageH - frameH) / 2;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <StatusBar barStyle="light-content" />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingTop: 52,
              paddingBottom: 12,
              zIndex: 50,
              elevation: 10,
            }}
          >
            <Pressable onPress={onCancel} hitSlop={16} style={{ padding: 10 }}>
              <X size={24} color="#fff" />
            </Pressable>
            <Text style={{ color: "#fff", fontWeight: "600", fontSize: 17 }}>
              Pinch &amp; position
            </Text>
            <Pressable
              onPress={handleSave}
              disabled={isSaving || !ready}
              hitSlop={16}
              style={{ padding: 10 }}
            >
              {isSaving ? (
                <CircularLoader size="small" color="#4ade80" />
              ) : (
                <Check size={24} color="#4ade80" />
              )}
            </Pressable>
          </View>

          {!ready ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <CircularLoader color="#fff" size="large" />
            </View>
          ) : (
            <GestureDetector gesture={composedGesture}>
              <View
                onLayout={(e) => {
                  const { width, height } = e.nativeEvent.layout;
                  setStageLayout({ w: width, h: height });
                }}
                style={{
                  flex: 1,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Animated.View style={animatedStyle}>
                  <Image
                    source={{ uri: imageUri }}
                    style={{
                      width: displayedImageSize.width,
                      height: displayedImageSize.height,
                    }}
                    resizeMode="contain"
                  />
                </Animated.View>

                {/* Dim outside frame */}
                <View
                  pointerEvents="none"
                  style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
                >
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 0,
                      height: frameTop,
                      backgroundColor: "rgba(0,0,0,0.55)",
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: frameTop + frameH,
                      bottom: 0,
                      backgroundColor: "rgba(0,0,0,0.55)",
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      top: frameTop,
                      width: frameLeft,
                      height: frameH,
                      backgroundColor: "rgba(0,0,0,0.55)",
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      right: 0,
                      top: frameTop,
                      width: frameLeft,
                      height: frameH,
                      backgroundColor: "rgba(0,0,0,0.55)",
                    }}
                  />
                </View>

                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: frameLeft,
                    top: frameTop,
                    width: frameW,
                    height: frameH,
                    borderWidth: 2,
                    borderColor: "rgba(255,255,255,0.95)",
                    borderRadius: 4,
                  }}
                />

                <Text
                  style={{
                    position: "absolute",
                    bottom: 28,
                    alignSelf: "center",
                    color: "rgba(255,255,255,0.65)",
                    fontSize: 13,
                  }}
                >
                  Pinch to zoom · Drag to move
                </Text>
              </View>
            </GestureDetector>
          )}

          <PopupMessage
            visible={popup.visible}
            type={popup.type}
            title={popup.title}
            message={popup.message}
          />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
