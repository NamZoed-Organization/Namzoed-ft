/**
 * PostFeedbackOverlay
 *
 * Long-pressing a post's media in detail view (Home "For You" -> tap into a
 * post) dims the media in place and surfaces "Report" — same pattern as
 * ContentWarning: an absolute-fill sibling inside the media container, not a
 * separate sheet/modal, so it reads as feedback on the post itself rather
 * than navigating away from it.
 */

import * as Haptics from "expo-haptics";
import { AlertTriangle, X } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface PostFeedbackOverlayProps {
  visible: boolean;
  onClose: () => void;
  onReport: () => void;
}

export default function PostFeedbackOverlay({
  visible,
  onClose,
  onReport,
}: PostFeedbackOverlayProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setMounted(false);
        },
      );
    }
  }, [visible]);

  if (!mounted) return null;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReport();
  };

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents={visible ? "auto" : "none"}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />

      <TouchableOpacity style={styles.closeButton} onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <X size={20} color="#111" />
      </TouchableOpacity>

      <View style={styles.actions} pointerEvents="box-none">
        <TouchableOpacity style={styles.pill} activeOpacity={0.85} onPress={handleReport}>
          <AlertTriangle size={22} color="#111" strokeWidth={1.8} />
          <Text style={styles.pillText}>Report</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    zIndex: 50,
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 28,
    gap: 12,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
  },
  pillText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
  },
});
