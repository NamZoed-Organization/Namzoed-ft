import searchData from "@/data/searchData";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  BackHandler,
  Image,
  Keyboard,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function SearchBar({
  value,
  onChangeText,
  onMicPress,
  placeholder = "Search any products...",
}: {
  value: string;
  onChangeText: (text: string) => void;
  onMicPress?: () => void;
  placeholder?: string;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [throttledValue, setThrottledValue] = useState(value);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(30)).current;

 
  useEffect(() => {
    const handler = setTimeout(() => {
      setThrottledValue(value);
    }, 800);
    return () => clearTimeout(handler);
  }, [value]);

  // Animate IN and setup back handler
  useEffect(() => {
    const onBackPress = () => {
      if (isFocused) {
        closeOverlay();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener("hardwareBackPress", onBackPress);

    if (isFocused) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(translateYAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }

    return () => backHandler.remove();
  }, [isFocused]);

  // Animate OUT then close
  const closeOverlay = () => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 30,
        duration: 75,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsFocused(false);
    });
  };

  return (
    <>
      <TouchableOpacity
        className="flex-row items-center bg-white rounded-lg px-5 py-1 mx-4"
        activeOpacity={0.9}
        onPress={() => setIsFocused(true)}
      >
        <Ionicons name="search" size={20} color="#888" className="mr-2" />
        <TextInput
          pointerEvents="none"
          editable={false}
          className="flex-1 font-regular text-base text-gray-800"
          placeholder={placeholder}
          placeholderTextColor="#888"
          value={value}
        />
        <Ionicons
          name="mic-outline"
          size={20}
          color="#888"
          onPress={onMicPress}
        />
      </TouchableOpacity>

      <Modal
        visible={isFocused}
        animationType="none"
        transparent={false}
        statusBarTranslucent={true}
        onRequestClose={closeOverlay}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <Animated.View
            style={{
              opacity: opacityAnim,
              transform: [{ translateY: translateYAnim }],
            }}
            className="flex-1 bg-white pt-16 px-4"
          >
            <View className="flex-row items-center mb-4">
              <TouchableOpacity onPress={closeOverlay} className="p-2">
                <Ionicons name="arrow-back" size={24} color="#000" />
              </TouchableOpacity>
              <TextInput
                autoFocus
                className="flex-1 font-regular text-base text-gray-800 ml-2"
                placeholder={placeholder}
                placeholderTextColor="#888"
                value={value}
                onChangeText={onChangeText}
              />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {throttledValue.length > 0 &&
                searchData
                  .filter((item) =>
                    item.title.toLowerCase().includes(throttledValue.toLowerCase())
                  )
                  .map((item, index) => (
                    <View
                      key={index}
                      className="flex-row items-center mb-4 gap-3"
                    >
                      <Image
                        source={item.image}
                        className="w-12 h-12 rounded-md"
                        resizeMode="cover"
                      />
                      <View>
                        <Text className="text-base font-medium text-gray-800">
                          {item.title}
                        </Text>
                        <Text className="text-sm text-gray-500">
                          {item.type}
                        </Text>
                      </View>
                    </View>
                  ))}
            </ScrollView>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
