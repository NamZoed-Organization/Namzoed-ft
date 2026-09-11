/**
 * BottomSheetModal
 *
 * Shared "drawer" shell for the post's people-list modals (Likes / Viewers /
 * Savers) and the share composer: sheet slides up from the bottom, but the
 * grey backdrop fades in via opacity instead of sliding with it — RN's
 * built-in `animationType` on <Modal> applies one transform to everything,
 * so the two need separate Animated.Values to move independently.
 *
 * The grab handle is also the drag-to-dismiss target. Deliberately only the
 * handle: a pan responder on the whole sheet would win every vertical drag
 * that belongs to a list scrolling inside it, and these sheets are mostly
 * lists.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MODAL_RADIUS } from "@/constants/theme";

const SCREEN_H = Dimensions.get("window").height;
/** Drag far enough, or flick fast enough, and the sheet goes. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 0.9;

export interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  /** Render prop — pass it the animated `close` handler for header "X" buttons
   * etc. so they play the same slide-down/fade-out instead of unmounting flat. */
  children: (close: () => void) => React.ReactNode;
  maxHeight?: number | `${number}%`;
  /** Lifts the sheet clear of the keyboard — for sheets with a text field. */
  avoidKeyboard?: boolean;
  /** Rendered above the sheet, filling the screen: room for a PopupMessage,
   * which would otherwise be clipped to the sheet's own bounds. */
  overlay?: React.ReactNode;
}

export default function BottomSheetModal({
  visible,
  onClose,
  children,
  maxHeight = "65%",
  avoidKeyboard = false,
  overlay,
}: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  // Tracked by hand rather than with KeyboardAvoidingView: the sheet has to
  // stay absolutely positioned (see the container below), and a KAV inside an
  // absolutely positioned box measures its frame against the screen and
  // settles wrong. Moving the sheet's `bottom` is also a straighter answer
  // than padding a wrapper.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(SCREEN_H)).current;
  // The pan responder is built once and can't close over a fresh handleClose
  // each render, so it calls through this instead.
  const closeRef = useRef<() => void>(onClose);

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

  useEffect(() => {
    if (!avoidKeyboard) return;
    const showEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const shown = Keyboard.addListener(showEvent, (e: any) =>
      setKeyboardHeight(e?.endCoordinates?.height ?? 0),
    );
    const hidden = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, [avoidKeyboard]);

  useEffect(() => {
    if (!visible) setKeyboardHeight(0);
  }, [visible]);

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
  closeRef.current = handleClose;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          // Downward only — dragging up shouldn't peel the sheet off its
          // own bottom edge.
          if (gesture.dy > 0) sheetY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
            closeRef.current();
            return;
          }
          Animated.spring(sheetY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 200,
            mass: 0.9,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(sheetY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 22,
            stiffness: 200,
            mass: 0.9,
          }).start();
        },
      }),
    [sheetY],
  );

  const sheet = (
    <Animated.View
      style={{
        // Absolutely positioned, and it has to stay that way: `maxHeight` is a
        // percentage, and a percentage only resolves against an ancestor with
        // a definite height. In normal flow inside an auto-height column — or
        // inside an absolutely positioned *wrapper*, which is auto-height too
        // — it resolves against nothing, which both truncates the content and
        // leaves the sheet short of the bottom edge. `bottom` carries the
        // keyboard, so the sheet rides above it.
        position: "absolute",
        left: 0,
        right: 0,
        bottom: keyboardHeight,
        backgroundColor: "white",
        borderTopLeftRadius: MODAL_RADIUS,
        borderTopRightRadius: MODAL_RADIUS,
        borderCurve: "continuous",
        maxHeight,
        // The sheet reaches the true bottom of the screen (see the Modal's
        // translucency flags below), so its own padding is what keeps content
        // clear of the home indicator / gesture bar.
        paddingBottom: Math.max(40, insets.bottom + 16),
        transform: [{ translateY: sheetY }],
      }}
    >
      {/* Handle — and the drag target, so its hit area is padded out well
          past the 4pt bar itself. */}
      <View {...panResponder.panHandlers} style={{ paddingTop: 12, paddingBottom: 8 }}>
        <View
          style={{
            width: 40,
            height: 4,
            backgroundColor: "#D1D5DB",
            borderRadius: 2,
            borderCurve: "continuous",
            alignSelf: "center",
          }}
        />
      </View>
      {children(handleClose)}
    </Animated.View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      // Without these the modal's window is inset by the Android system bars,
      // which leaves a strip of the screen showing below a bottom-anchored
      // sheet — it reads as the sheet floating rather than sitting on the
      // edge. No effect on iOS, where the modal is full-screen already.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={{ flex: 1 }}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.4)", opacity: backdropOpacity },
          ]}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
        </Animated.View>

        {sheet}

        {overlay ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            {overlay}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
