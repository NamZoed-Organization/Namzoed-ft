import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";

interface ConversationSkeletonProps {
  count?: number;
}

export default function ConversationSkeleton({ count = 8 }: ConversationSkeletonProps) {
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerOpacity]);

  const SkeletonRow = () => (
    <View style={styles.row}>
      {/* Avatar circle */}
      <Animated.View style={[styles.avatar, { opacity: shimmerOpacity }]} />

      {/* Right column */}
      <View style={styles.rightCol}>
        {/* Top row: name + timestamp */}
        <View style={styles.topRow}>
          <Animated.View style={[styles.nameLine, { opacity: shimmerOpacity }]} />
          <Animated.View style={[styles.timeLine, { opacity: shimmerOpacity }]} />
        </View>
        {/* Bottom row: preview */}
        <Animated.View style={[styles.previewLine, { opacity: shimmerOpacity }]} />
      </View>
    </View>
  );

  return (
    <View style={{ backgroundColor: "white" }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: "white",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: "#e5e7eb",
    marginRight: 12,
  },
  rightCol: {
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  nameLine: {
    width: 128,
    height: 14,
    borderRadius: 6,
    borderCurve: "continuous",
    backgroundColor: "#e5e7eb",
  },
  timeLine: {
    width: 48,
    height: 12,
    borderRadius: 6,
    borderCurve: "continuous",
    backgroundColor: "#e5e7eb",
  },
  previewLine: {
    width: 192,
    height: 12,
    borderRadius: 6,
    borderCurve: "continuous",
    backgroundColor: "#e5e7eb",
  },
});
