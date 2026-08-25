import React, { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ActionSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Render as a plain absolute-fill overlay instead of a native Modal — use
   * when the caller is already presenting a full-screen Modal, since nesting
   * a native Modal inside an open one is unreliable (status bar / safe area
   * math gets miscalculated on iOS regardless of statusBarTranslucent). */
  embedded?: boolean;
}

export default function ActionSheetModal({ visible, onClose, children, embedded }: ActionSheetModalProps) {
  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useSharedValue(0);
  const translateY = useSharedValue(SCREEN_HEIGHT);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdropOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) });
      translateY.value = withTiming(
        SCREEN_HEIGHT,
        { duration: 240, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        }
      );
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  if (!mounted) return null;

  const content = (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <AnimatedPressable
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }, backdropStyle]}
        onPress={onClose}
      />
      <Animated.View style={sheetStyle}>{children}</Animated.View>
    </View>
  );

  if (embedded) {
    return <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>{content}</View>;
  }

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent={false} onRequestClose={onClose}>
      {content}
    </Modal>
  );
}
