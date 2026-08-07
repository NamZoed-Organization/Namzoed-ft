import { useFocusEffect } from 'expo-router';
import React from 'react';
import { Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const EDGE_WIDTH = 20;
const BACK_THRESHOLD = SCREEN_WIDTH * 0.28;
const VELOCITY_THRESHOLD = 800;

interface EdgeSwipeBackProps {
  onSwipeBack: () => void;
  children: React.ReactNode;
}

/**
 * Screens hosted inside a bottom-tabs navigator (e.g. a hidden tab reached via
 * router.push) don't get the native-stack edge swipe-to-go-back gesture, since
 * that's a react-native-screens/native-stack feature bottom-tabs doesn't provide.
 * This recreates it manually: a thin gesture zone at the screen's left edge that
 * drags the content and triggers onSwipeBack past a distance/velocity threshold.
 */
export default function EdgeSwipeBack({ onSwipeBack, children }: EdgeSwipeBackProps) {
  const translateX = useSharedValue(0);

  // This screen is a pre-mounted tab, not a stack screen that unmounts on
  // back — so translateX must be snapped back to 0 whenever it regains
  // focus, otherwise it stays shifted off-screen from the last swipe.
  useFocusEffect(
    React.useCallback(() => {
      translateX.value = 0;
    }, [translateX])
  );

  const pan = Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      translateX.value = Math.max(0, e.translationX);
    })
    .onEnd((e) => {
      const shouldGoBack = e.translationX > BACK_THRESHOLD || e.velocityX > VELOCITY_THRESHOLD;
      if (shouldGoBack) {
        translateX.value = withTiming(SCREEN_WIDTH, { duration: 220 }, (finished) => {
          if (finished) {
            runOnJS(onSwipeBack)();
            translateX.value = 0;
          }
        });
      } else {
        translateX.value = withSpring(0, { damping: 22, stiffness: 250 });
      }
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[{ flex: 1 }, contentStyle]}>
      {children}
      <GestureDetector gesture={pan}>
        <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: EDGE_WIDTH }} />
      </GestureDetector>
    </Animated.View>
  );
}
