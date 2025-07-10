import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
} from "react-native";

type Props = {
  roles: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
};

export default function AnimatedDropdown({ roles, onSelect, onClose }: Props) {
  const scale = useRef(new Animated.Value(0.95)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 150,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // ensure dropdown unmounts *after* animation finishes
      onClose();
    });
  };

  return (
    <>
      {/* Fullscreen tap catcher */}
      <Pressable onPress={handleClose} style={styles.overlay} />

      {/* Animated dropdown list */}
      <Animated.View style={[styles.dropdown, { opacity, transform: [{ scale }] }]}>
        {roles.map((item, index) => (
          <TouchableOpacity
            key={item}
            activeOpacity={1}
            onPressIn={() => setActiveIndex(index)}
            onPressOut={() => setActiveIndex(null)}
            onPress={() => {
              onSelect(item);
              handleClose();
            }}
            style={[
              styles.item,
              activeIndex === index && styles.itemActive, // rounded bg on hold
            ]}
          >
            <Text style={styles.text}>{item}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "transparent",
    zIndex: 90,
  },
  dropdown: {
    position: "absolute",
    top: 0,
    left: "10%",
    width: "40%",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderColor: "#D1D5DB",
    borderWidth: 1,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    zIndex: 100,
    overflow: "hidden",
  },
  item: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  itemActive: {
    backgroundColor: "#f3f4f6", // gray-100
    borderRadius: 8,
  },
  text: {
    fontFamily: "Montserrat-Regular",
    color: "#1f2937", // gray-800
  },
});
