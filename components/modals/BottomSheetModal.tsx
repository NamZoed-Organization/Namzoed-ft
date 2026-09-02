/**
 * BottomSheetModal
 *
 * Shared "drawer" shell for the post's people-list modals (Likes / Viewers /
 * Savers): sheet slides up from the bottom, but the grey backdrop fades in
 * via opacity instead of sliding with it — RN's built-in `animationType`
 * on <Modal> applies one transform to everything, so the two need separate
 * Animated.Values to move independently.
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

const SCREEN_H = Dimensions.get("window").height;

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  /** Render prop — pass it the animated `close` handler for header "X" buttons
   * etc. so they play the same slide-down/fade-out instead of unmounting flat. */
  children: (close: () => void) => React.ReactNode;
  maxHeight?: number | `${number}%`;
}

export default function BottomSheetModal({
  visible,
  onClose,
  children,
  maxHeight = "65%",
}: BottomSheetModalProps) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (!visible) return;
    backdropOpacity.setValue(0);
    sheetY.setValue(SCREEN_H);
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
    Animated.spring(sheetY, {
      toValue: 0,
      useNativeDriver: true,
      damping: 22,
      stiffness: 200,
      mass: 0.9,
    }).start();
  }, [visible, backdropOpacity, sheetY]);

  const handleClose = () => {
    Animated.timing(backdropOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    Animated.timing(sheetY, {
      toValue: SCREEN_H,
      duration: 250,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <View style={{ flex: 1 }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.4)", opacity: backdropOpacity },
          ]}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
        </Animated.View>

        <Animated.View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "white",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderCurve: "continuous",
            maxHeight,
            paddingBottom: 40,
            transform: [{ translateY: sheetY }],
          }}
        >
          {/* Handle */}
          <View
            style={{
              width: 40,
              height: 4,
              backgroundColor: "#D1D5DB",
              borderRadius: 2,
              borderCurve: "continuous",
              alignSelf: "center",
              marginTop: 12,
              marginBottom: 8,
            }}
          />
          {children(handleClose)}
        </Animated.View>
      </View>
    </Modal>
  );
}
