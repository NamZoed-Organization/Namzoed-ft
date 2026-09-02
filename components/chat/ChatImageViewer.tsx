/**
 * ChatImageViewer
 * - Fullscreen image viewer for chat images
 * - Swipe left/right to browse all images in the conversation
 * - Pinch-to-zoom + pan while zoomed
 * - Single tap toggles the close/count UI
 * - Always-visible close button
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import { Dimensions, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Reanimated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ─── ZoomableImage ────────────────────────────────────────────────────────────

const ZoomableImage = ({
  uri,
  onToggleUI,
  onZoomChange,
}: {
  uri: string;
  onToggleUI?: () => void;
  onZoomChange?: (zoomed: boolean) => void;
}) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const notifyZoom = useCallback(
    (zoomed: boolean) => {
      setIsZoomed(zoomed);
      onZoomChange?.(zoomed);
    },
    [onZoomChange],
  );

  // Reset zoom when URI changes (swiped to different image)
  useEffect(() => {
    scale.value = withTiming(1, { duration: 150 });
    savedScale.value = 1;
    translateX.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(0, { duration: 150 });
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    runOnJS(notifyZoom)(false);
  }, [uri]);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 5);
    })
    .onEnd(() => {
      if (scale.value <= 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        runOnJS(notifyZoom)(false);
      } else {
        savedScale.value = scale.value;
        runOnJS(notifyZoom)(true);
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    if (onToggleUI) runOnJS(onToggleUI)();
  });

  const composed = isZoomed
    ? Gesture.Race(tapGesture, Gesture.Simultaneous(pinchGesture, panGesture))
    : Gesture.Race(tapGesture, pinchGesture);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Reanimated.View
        style={[
          { width: SCREEN_W, height: SCREEN_H, justifyContent: "center", alignItems: "center" },
          animStyle,
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </Reanimated.View>
    </GestureDetector>
  );
};

// ─── ChatImageViewer ──────────────────────────────────────────────────────────

interface ChatImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

export default function ChatImageViewer({
  visible,
  images,
  initialIndex,
  onClose,
}: ChatImageViewerProps) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [carouselScrollEnabled, setCarouselScrollEnabled] = useState(true);
  const [showUI, setShowUI] = useState(true);
  const showUIRef = useRef(true);
  const uiOpacity = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setCarouselScrollEnabled(true);
      showUIRef.current = true;
      setShowUI(true);
      uiOpacity.value = 1;
      // Scroll to initial image after modal is visible
      setTimeout(() => {
        scrollRef.current?.scrollTo({ x: initialIndex * SCREEN_W, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const toggleUI = useCallback(() => {
    const next = !showUIRef.current;
    showUIRef.current = next;
    setShowUI(next);
    uiOpacity.value = withTiming(next ? 1 : 0, { duration: 180 });
  }, [uiOpacity]);

  const uiAnimStyle = useAnimatedStyle(() => ({ opacity: uiOpacity.value }));

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_W);
    setCurrentIndex(index);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>

          {/* ── Image carousel ── */}
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            scrollEnabled={carouselScrollEnabled}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            scrollEventThrottle={16}
            style={{ flex: 1 }}
            contentContainerStyle={{ alignItems: "center" }}
          >
            {images.map((uri, index) => (
              <ZoomableImage
                key={index}
                uri={uri}
                onToggleUI={toggleUI}
                onZoomChange={(zoomed) => setCarouselScrollEnabled(!zoomed)}
              />
            ))}
          </ScrollView>

          {/* ── Always-visible close button ── */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: "absolute",
              top: (insets.top || 0) + 16,
              left: 16,
              zIndex: 20,
              backgroundColor: "rgba(0,0,0,0.55)",
              borderRadius: 20,
              borderCurve: "continuous",
              padding: 7,
            }}
          >
            <Ionicons name="close" size={22} color="white" />
          </TouchableOpacity>

          {/* ── Toggleable: image count ── */}
          {images.length > 1 && (
            <Reanimated.View
              style={[
                uiAnimStyle,
                {
                  position: "absolute",
                  top: (insets.top || 0) + 14,
                  right: 16,
                  zIndex: 15,
                  backgroundColor: "rgba(0,0,0,0.55)",
                  borderRadius: 20,
                  borderCurve: "continuous",
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                },
              ]}
              pointerEvents="none"
            >
              <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>
                {currentIndex + 1} / {images.length}
              </Text>
            </Reanimated.View>
          )}

          {/* ── Dot indicator ── */}
          {images.length > 1 && (
            <Reanimated.View
              style={[
                uiAnimStyle,
                {
                  position: "absolute",
                  bottom: (insets.bottom || 0) + 20,
                  left: 0,
                  right: 0,
                  flexDirection: "row",
                  justifyContent: "center",
                },
              ]}
              pointerEvents="none"
            >
              {images.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    borderCurve: "continuous",
                    marginHorizontal: 3,
                    backgroundColor:
                      i === currentIndex ? "white" : "rgba(255,255,255,0.35)",
                  }}
                />
              ))}
            </Reanimated.View>
          )}

        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
