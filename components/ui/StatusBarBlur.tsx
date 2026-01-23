import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StatusBarBlur() {
  const insets = useSafeAreaInsets();
  const height = insets.top;

  return (
    <View style={[styles.container, { height }]}>
      {/* 1. Reduced Intensity for a "transparent" glass look */}
      <BlurView
        tint="light"
        intensity={30} // Lowered from 80 to 30 to make it clearer
        style={StyleSheet.absoluteFill}
      />

      {/* 2. Very subtle backing layer (almost invisible) */}
      <View style={styles.clarityLayer} />

      {/* 3. The Fade: Drastically reduced opacity */}
      <LinearGradient
        // Starts at 15% white and fades to 0%. 
        // This hides the "strong color" line but keeps the soft edge.
        colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0)']}
        start={[0, 0]}
        end={[0, 1]}
        style={styles.gradientFade}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  clarityLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Reduced to 5% opacity
  },
  gradientFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -15, // Slightly shorter fade distance for a cleaner look
    height: 15,
  },
});