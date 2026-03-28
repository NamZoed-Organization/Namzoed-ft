import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, TouchableOpacity, Modal, Dimensions, FlatList } from "react-native";
import { X, ChevronLeft, ChevronRight } from "lucide-react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import ImageWithFallback from "@/components/ui/ImageWithFallback";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface ZoomableImageProps {
  uri: string;
}

const ZoomableImage = ({ uri }: ZoomableImageProps) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

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
          resizeMode="contain"
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

  // Sync index when modal opens with a different image
  useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
      // Small delay to ensure FlatList is mounted before scrolling
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 50);
    }
  }, [visible, initialIndex]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  };

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

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View className="flex-1 bg-black">
          {/* Close Button */}
          <TouchableOpacity
            onPress={onClose}
            className="absolute top-12 right-4 z-10 bg-black/50 rounded-full p-2"
          >
            <X size={28} color="white" />
          </TouchableOpacity>

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

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              {/* Previous Arrow */}
              {currentIndex > 0 && (
                <TouchableOpacity
                  onPress={handlePrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/60 rounded-full p-3"
                >
                  <ChevronLeft size={32} color="white" />
                </TouchableOpacity>
              )}

              {/* Next Arrow */}
              {currentIndex < images.length - 1 && (
                <TouchableOpacity
                  onPress={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/60 rounded-full p-3"
                >
                  <ChevronRight size={32} color="white" />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
