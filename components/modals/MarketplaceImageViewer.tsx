import ImageWithFallback from "@/components/ui/ImageWithFallback";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, Image as RNImage, Modal, Platform, ScrollView, TouchableOpacity, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: screenWidth } = Dimensions.get("window");
const screenRatio = screenWidth / Dimensions.get("window").height;
const DISMISS_SWIPE_THRESHOLD = 90;
const EDGE_BACK_SWIPE_THRESHOLD = 50;

// Zoomable image with pinch + pan (only when zoomed) — same gesture set and
// thresholds as the post-detail ImageViewer's ZoomableImage. When not
// zoomed: a single tap or a vertical swipe closes the viewer.
const ZoomableImage = ({
  uri,
  height,
  onClose,
  onZoomChange,
}: {
  uri: string;
  height: number;
  onClose: () => void;
  onZoomChange?: (zoomed: boolean) => void;
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [fitMode, setFitMode] = useState<"cover" | "contain">("contain");
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;

    RNImage.getSize(
      uri,
      (width, imgHeight) => {
        if (cancelled || !width || !imgHeight) return;
        const imageRatio = width / imgHeight;
        const ratioDelta = Math.abs(imageRatio - screenRatio);
        // Use cover only when ratios are close to reduce empty bars
        // while avoiding aggressive crop for very different image shapes.
        setFitMode(ratioDelta <= 0.12 ? "cover" : "contain");
      },
      () => {
        if (!cancelled) setFitMode("contain");
      },
    );

    return () => {
      cancelled = true;
    };
  }, [uri]);

  const notifyZoom = useCallback(
    (zoomed: boolean) => {
      setIsZoomed(zoomed);
      onZoomChange?.(zoomed);
    },
    [onZoomChange],
  );

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
    runOnJS(onClose)();
  });

  // Vertical swipe-to-dismiss — only when not zoomed. activeOffsetY/failOffsetX
  // keep it from stealing horizontal swipes (those page the carousel).
  const dismissPanGesture = Gesture.Pan()
    .activeOffsetY([-15, 15])
    .failOffsetX([-20, 20])
    .onEnd((e) => {
      if (Math.abs(e.translationY) > DISMISS_SWIPE_THRESHOLD) {
        runOnJS(onClose)();
      }
    });

  const composed = isZoomed
    ? Gesture.Race(tapGesture, Gesture.Simultaneous(pinchGesture, panGesture))
    : Gesture.Race(tapGesture, pinchGesture, dismissPanGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          { width: screenWidth, height, justifyContent: "center", alignItems: "center" },
          animatedStyle,
        ]}
      >
        <ImageWithFallback
          source={{ uri }}
          style={{ width: screenWidth, height }}
          resizeMode={fitMode}
        />
      </Animated.View>
    </GestureDetector>
  );
};

interface MarketplaceImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

export default function MarketplaceImageViewer({
  visible,
  images,
  initialIndex,
  onClose,
}: MarketplaceImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [carouselScrollEnabled, setCarouselScrollEnabled] = useState(true);
  // Measured from the actual media area's onLayout rather than assumed from
  // Dimensions — matches the post-detail ImageViewer's approach, since a
  // static Dimensions snapshot can be stale/wrong (esp. on Android).
  const [mediaHeight, setMediaHeight] = useState(() => Dimensions.get("window").height);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      setCarouselScrollEnabled(true);
    }
  }, [visible, initialIndex]);

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
    setCurrentIndex(index);
  };

  const topInset = Platform.OS === "ios" ? (insets.top || 44) : (insets.top || 0) + 8;

  // Thin left-edge strip for an iOS-style edge-swipe-back gesture — same as
  // the post-detail ImageViewer's, kept independent of the carousel's own
  // horizontal paging.
  const edgeBackGesture = useMemo(
    () =>
      Gesture.Pan().onEnd((e) => {
        if (e.translationX > EDGE_BACK_SWIPE_THRESHOLD && Math.abs(e.translationY) < EDGE_BACK_SWIPE_THRESHOLD) {
          runOnJS(onClose)();
        }
      }),
    [onClose],
  );

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
          {/* Back button — always visible, same position as post-detail's viewer */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: "absolute",
              top: topInset + 8,
              left: 16,
              zIndex: 20,
              backgroundColor: "rgba(0,0,0,0.55)",
              borderRadius: 20,
              padding: 7,
            }}
          >
            <ChevronLeft size={22} color="white" />
          </TouchableOpacity>

          {/* Image, true screen center */}
          <View
            style={{ flex: 1, justifyContent: "center" }}
            onLayout={(e) => setMediaHeight(e.nativeEvent.layout.height)}
          >
            <ScrollView
              horizontal
              pagingEnabled
              scrollEnabled={carouselScrollEnabled}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleScroll}
              contentOffset={{ x: initialIndex * screenWidth, y: 0 }}
              scrollEventThrottle={16}
              style={{ height: mediaHeight }}
            >
              {images.map((imageUrl, index) => (
                <ZoomableImage
                  key={index}
                  uri={imageUrl}
                  height={mediaHeight}
                  onClose={onClose}
                  onZoomChange={(zoomed) => setCarouselScrollEnabled(!zoomed)}
                />
              ))}
            </ScrollView>
          </View>

          {/* Left-edge swipe-back strip */}
          {carouselScrollEnabled && (
            <GestureDetector gesture={edgeBackGesture}>
              <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 24, zIndex: 15 }} />
            </GestureDetector>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
