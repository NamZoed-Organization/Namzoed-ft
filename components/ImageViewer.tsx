import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Dimensions,
  ScrollView,
} from "react-native";
import { X } from "lucide-react-native";
import { Image } from "react-native";

interface ImageViewerProps {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function ImageViewer({
  visible,
  images,
  initialIndex,
  onClose,
}: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handleScroll = (event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / screenWidth);
    setCurrentIndex(index);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black" style={{ backgroundColor: '#000000' }}>
        {/* Header */}
        <View className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between p-4 pt-16">
          <TouchableOpacity
            onPress={onClose}
            className="bg-black/50 rounded-full p-2"
          >
            <X size={24} color="white" />
          </TouchableOpacity>
          
          {images.length > 1 && (
            <View className="bg-black/50 rounded-full px-3 py-1">
              <Text className="text-white font-medium">
                {currentIndex + 1} / {images.length}
              </Text>
            </View>
          )}
        </View>

        {/* Image Carousel */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScroll}
          contentOffset={{ x: initialIndex * screenWidth, y: 0 }}
          className="flex-1 bg-black"
          style={{ backgroundColor: '#000000' }}
        >
          {images.map((_, index) => (
            <View
              key={index}
              className="items-center justify-center bg-black"
              style={{ 
                width: screenWidth, 
                height: screenHeight,
                backgroundColor: '#000000'
              }}
            >
              <Image
                source={require('@/assets/images/all.png')}
                className="w-full h-full"
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>

        {/* Dots Indicator */}
        {images.length > 1 && (
          <View className="absolute bottom-8 left-0 right-0 flex-row justify-center">
            <View className="flex-row bg-black/50 rounded-full px-3 py-2">
              {images.map((_, index) => (
                <View
                  key={index}
                  className={`w-2 h-2 rounded-full mx-1 ${
                    index === currentIndex ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}