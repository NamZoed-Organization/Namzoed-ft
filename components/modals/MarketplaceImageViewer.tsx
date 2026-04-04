import ImageWithFallback from "@/components/ui/ImageWithFallback";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, FlatList, Image, Modal, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const screenRatio = screenWidth / screenHeight;

interface ZoomableImageProps {
  uri: string;
}

const ZoomableImage = ({ uri }: ZoomableImageProps) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const [fitMode, setFitMode] = useState<"cover" | "contain">("contain");

  useEffect(() => {
    let cancelled = false;

    Image.getSize(
      uri,
      (width, height) => {
        if (cancelled || !width || !height) return;
        const imageRatio = width / height;
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

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      } else if (scale.value > 3) {
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
            width: screenWidth,
            height: screenHeight,
            justifyContent: "center",
            alignItems: "center",
          },
          animatedStyle,
        ]}
      >
        <ImageWithFallback
          source={{ uri }}
          style={{ width: screenWidth, height: screenHeight }}
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
  const flatListRef = useRef<FlatList>(null);
  const openScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const translateY = useSharedValue(0);

  // Sync index when modal opens with a different image
  useEffect(() => {
    if (visible) {
      translateY.value = 0;
      setCurrentIndex(initialIndex);
      // Small delay to ensure FlatList is mounted before scrolling
      if (openScrollTimeoutRef.current) {
        clearTimeout(openScrollTimeoutRef.current);
      }
      openScrollTimeoutRef.current = setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }

    return () => {
      if (openScrollTimeoutRef.current) {
        clearTimeout(openScrollTimeoutRef.current);
        openScrollTimeoutRef.current = null;
      }
    };
  }, [visible, initialIndex]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: screenWidth,
      offset: screenWidth * index,
      index,
    }),
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: string }) => <ZoomableImage uri={item} />,
    [],
  );

  const swipeDownToCloseGesture = Gesture.Pan()
    .onUpdate((e) => {
      const isVertical = Math.abs(e.translationY) > Math.abs(e.translationX);
      if (isVertical && e.translationY > 0) {
        translateY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (e.translationY > 120) {
        translateY.value = withTiming(
          screenHeight,
          { duration: 220 },
          (finished) => {
            if (finished) {
              runOnJS(onClose)();
            }
          },
        );
        return;
      }
      translateY.value = withTiming(0, { duration: 140 });
    });

  const viewerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GestureDetector gesture={swipeDownToCloseGesture}>
          <Animated.View className="flex-1 bg-black" style={viewerAnimatedStyle}>
          {/* Image Counter */}
          <View className="absolute top-12 left-4 z-10 bg-black/70 px-3 py-2 rounded-full">
            <Animated.Text className="text-white text-sm font-medium">
              {currentIndex + 1} / {images.length}
            </Animated.Text>
          </View>

          {/* Swipeable Image List */}
          <FlatList
            ref={flatListRef}
            data={images}
            renderItem={renderItem}
            keyExtractor={(_, index) => index.toString()}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            getItemLayout={getItemLayout}
            initialScrollIndex={initialIndex}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />

          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}
