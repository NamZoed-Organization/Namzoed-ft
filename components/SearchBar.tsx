import { products } from "@/data/products";
import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
  const [isLoading, setIsLoading] = useState(false);
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(30)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setIsLoading(true);
    const handler = setTimeout(() => {
      setThrottledValue(value);
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(handler);
  }, [value]);

  useEffect(() => {
    const onBackPress = () => {
      if (isFocused) {
        closeOverlay();
        return true;
      }
      return false;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );

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
      ]).start(() => {
        setTimeout(() => {
          inputRef.current?.focus();
        }, 100);
      });
    }

    return () => backHandler.remove();
  }, [isFocused]);

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
      onChangeText("");
    });
  };

  const levenshtein = (a: string, b: string): number => {
    const matrix = Array.from({ length: b.length + 1 }, (_, i) =>
      Array.from({ length: a.length + 1 }, (_, j) => 0)
    );

    for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        matrix[i][j] =
          b[i - 1] === a[j - 1]
            ? matrix[i - 1][j - 1]
            : Math.min(
                matrix[i - 1][j - 1] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j] + 1
              );
      }
    }

    return matrix[b.length][a.length];
  };

  const fuzzyMatch = (
    query: string,
    item: { name: string; category: string }
  ): boolean => {
    const q = query.toLowerCase().trim();
    const name = item.name.toLowerCase();
    const category = item.category.toLowerCase();

    if (name.includes(q) || category.includes(q)) return true;

    const nameWords = name.split(" ");
    const categoryWords = category.split(" ");

    return [...nameWords, ...categoryWords].some(
      (word) => word.startsWith(q) || levenshtein(q, word) <= 2
    );
  };

  const highlightMatch = (text: string, query: string) => {
    const q = query.toLowerCase().trim();
    const parts = text.split(new RegExp(`(${q})`, "i"));

    return parts.map((part, index) => {
      const isMatch = part.toLowerCase() === q;
      return (
        <Text
          key={index}
          className={isMatch ? "font-semibold text-black" : "text-gray-800"}
        >
          {part}
        </Text>
      );
    });
  };

  const filtered =
    throttledValue.trim().length > 0
      ? products.filter((item) => fuzzyMatch(throttledValue, item))
      : [];

  const longestNameLength = Math.max(...products.map((p) => p.name.length));
  const showNoResults =
    throttledValue.trim().length > 0 && !isLoading && filtered.length === 0;

  return (
    <>
      <TouchableOpacity
        className="flex-row items-center bg-white rounded-lg px-5 py-1 mx-4 -mt-2"
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
                ref={inputRef}
                className="flex-1 font-regular text-base text-gray-800 ml-2"
                placeholder={placeholder}
                placeholderTextColor="#888"
                value={value}
                onChangeText={onChangeText}
              />
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              {throttledValue.trim().length === 0 ? null : isLoading ? (
                <View className="mt-10 items-center">
                  <ActivityIndicator size="small" color="#094569" />
                </View>
              ) : showNoResults ? (
                <Text className="text-center text-gray-500 mt-10">
                  No results found.
                </Text>
              ) : (
                filtered.map((item, index) => (
                  <Link
                    key={`${item.id}-${index}`}
                    href={{
                      pathname: "/product/[id]",
                      params: { id: item.id },
                    }}
                    asChild
                  >
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={closeOverlay}
                      className="flex-row items-center mb-4 gap-3"
                    >
                      <Image
                        source={item.image}
                        className="w-12 h-12 rounded-md"
                        resizeMode="cover"
                      />
                      <View>
                        <Text className="text-base text-gray-800 flex-row flex-wrap">
                          {highlightMatch(item.name, throttledValue)}
                        </Text>
                        <Text className="text-sm text-gray-500">
                          {item.category}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Link>
                ))
              )}
            </ScrollView>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
