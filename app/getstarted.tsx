import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

const slides = [
  { key: '1', title: 'Welcome to Namzoed!' },
  { key: '2', title: 'Discover products near you' },
  { key: '3', title: 'Join the community' },
];

export default function GetStarted() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const router = useRouter();

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setCurrentIndex(index);
  };

  const goNext = () => {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex((prev) => prev + 1); // Force update
    } else {
      router.replace('/(tabs)/explore');
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true });
      setCurrentIndex((prev) => prev - 1); // Force update
    }
  };

  return (
    <View className="flex-1 bg-white">
      <FlatList
        data={slides}
        ref={flatListRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1 justify-center items-center px-6">
            <Text className="text-2xl font-bold text-center text-gray-800 font-sans">
              {item.title}
            </Text>
          </View>
        )}
      />

      <View className="flex-row items-center justify-between px-6 py-5">
        <TouchableOpacity onPress={goPrev} disabled={currentIndex === 0}>
          <Text className={`text-lg ${currentIndex === 0 ? 'text-gray-300' : 'text-blue-900'}`}>
            Prev
          </Text>
        </TouchableOpacity>

        <View className="flex-row gap-2 items-center">
          {slides.map((_, i) => (
            <View
              key={i}
              className={`h-2 rounded-full ${
                currentIndex === i ? 'w-7 bg-blue-900' : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </View>

        <TouchableOpacity onPress={goNext}>
          <Text className="text-lg text-blue-900">
            {currentIndex === slides.length - 1 ? 'Start' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
