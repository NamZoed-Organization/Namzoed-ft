import { useAppRouter } from "@/utils/navigation";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Animated, TextInput, TouchableOpacity, View } from "react-native";

const ROTATE_INTERVAL_MS = 2600;
const ROTATE_OUT_MS = 220;
const ROTATE_IN_MS = 280;

/**
 * Trigger button that navigates to the global search screen.
 * The value/onChangeText props are kept for API compatibility with parent
 * components that manage their own local filter state.
 */
export default function SearchBar({
  value,
  onChangeText,
  placeholder = "Search",
  animatedPlaceholders,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** When given 2+ entries, replaces the static placeholder with a slide/fade
   * ticker that cycles through them — e.g. trending search suggestions. */
  animatedPlaceholders?: string[];
}) {
  const router = useAppRouter();
  const rotating = !!animatedPlaceholders && animatedPlaceholders.length > 1;

  const [rotatingIndex, setRotatingIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!rotating) return;
    setRotatingIndex(0);
    opacity.setValue(1);
    translateY.setValue(0);

    const id = setInterval(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: ROTATE_OUT_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setRotatingIndex((i) => (i + 1) % animatedPlaceholders!.length);
        translateY.setValue(8);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: ROTATE_IN_MS,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: ROTATE_IN_MS,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
    // animatedPlaceholders is compared by identity on purpose — callers
    // should memoize the array, same as any other effect dependency.
  }, [rotating, animatedPlaceholders, opacity, translateY]);

  return (
    <TouchableOpacity
      className="flex-row items-center rounded-full px-4 py-2 border border-gray-200"
      activeOpacity={0.9}
      onPress={() => router.push("/(users)/search" as any)}
    >
      <Ionicons name="search" size={18} color="#888" style={{ marginRight: 8 }} />
      <View style={{ flex: 1, position: "relative", justifyContent: "center" }}>
        <TextInput
          pointerEvents="none"
          editable={false}
          className="font-regular text-sm text-gray-800"
          style={{ paddingVertical: 0 }}
          placeholder={rotating ? "" : placeholder}
          placeholderTextColor="#888"
          value={value}
        />
        {rotating && !value && (
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, justifyContent: "center" }}
          >
            <Animated.Text
              numberOfLines={1}
              className="font-regular text-sm"
              style={{ color: "#888", opacity, transform: [{ translateY }] }}
            >
              {animatedPlaceholders![rotatingIndex]}
            </Animated.Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
