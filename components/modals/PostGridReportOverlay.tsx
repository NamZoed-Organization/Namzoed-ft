/**
 * PostGridReportOverlay
 *
 * Grid-card counterpart to PostFeedbackOverlay (the full post-detail
 * long-press overlay) — same "Report" affordance, but scaled down to a
 * 2-column grid thumbnail and using a white bottom-fade instead of a dark
 * scrim, since a full dark dim reads too heavy over a small card and would
 * fight the card's own footer (avatar/caption) sitting right below it.
 */

import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { AlertTriangle, X } from "lucide-react-native";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface PostGridReportOverlayProps {
  visible: boolean;
  onClose: () => void;
  onReport: () => void;
}

export default function PostGridReportOverlay({
  visible,
  onClose,
  onReport,
}: PostGridReportOverlayProps) {
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
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose}>
        <LinearGradient
          colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.75)", "#fff"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
      </TouchableOpacity>

      <TouchableOpacity style={styles.closeButton} onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={14} color="#111" />
      </TouchableOpacity>

      <View style={styles.actions} pointerEvents="box-none">
        <TouchableOpacity style={styles.pill} activeOpacity={0.6} onPress={handleReport}>
          <AlertTriangle size={14} color="#6B7280" strokeWidth={2} />
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
    zIndex: 50,
  },
  closeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 34,
    borderRadius: 17,
    borderCurve: "continuous",
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#6B7280",
  },
  pillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
  },
});
