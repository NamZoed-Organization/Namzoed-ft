import { Product } from "@/lib/productsService";
import {
  formatCompactCountdown,
  getCountdownDisplayText,
  getCountdownSeconds,
  isClosingSaleActive,
} from "@/utils/timeHelpers";
import { LinearGradient } from "expo-linear-gradient";
import { Info } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ClosingSaleBannerProps {
  foodItems: Product[];
  /** When true: no own margin/radius/shadow — parent container handles border */
  connected?: boolean;
}

export default function ClosingSaleBanner({
  foodItems,
  connected,
}: ClosingSaleBannerProps) {
  const [timer, setTimer] = useState(() => ({
    countdown: getCountdownSeconds(),
    displayText: getCountdownDisplayText(),
    isActive: isClosingSaleActive(),
  }));
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer({
        countdown: getCountdownSeconds(),
        displayText: getCountdownDisplayText(),
        isActive: isClosingSaleActive(),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const { countdown, displayText, isActive } = timer;

  return (
    <View style={[styles.bannerContainer, connected && { marginBottom: 0 }]}>
      <LinearGradient
        colors={
          isActive
            ? ["#F59E0B", "#D97706"]
            : ["#094569", "#0A5276"]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.gradientBanner,
          connected && styles.gradientConnected,
        ]}
      >
        <View style={styles.headerSection}>
          <View style={styles.contentRow}>
            <Text style={styles.emoji}>🌙</Text>

            <View style={styles.middleSection}>
              <Text style={styles.bannerTitle}>{displayText.title}</Text>
              <Text style={styles.timeRange}>3:00 PM - 10:00 PM</Text>
            </View>

            <View style={styles.rightSection}>
              <Text style={styles.countdownLabel}>{displayText.subtitle}</Text>
              <Text style={styles.countdownTimer}>
                {formatCompactCountdown(countdown)}
              </Text>
            </View>
          </View>

          {showInfo && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Food discounts active from 3:00 PM – 10:00 PM will appear below
              </Text>
            </View>
          )}
        </View>

        {/* Info button — absolute top-right */}
        <TouchableOpacity
          onPress={() => setShowInfo((v) => !v)}
          style={styles.infoButton}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          activeOpacity={0.7}
        >
          <Info size={13} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    marginBottom: 12,
  },
  gradientBanner: {
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  /** Overrides when inside a connected border wrapper */
  gradientConnected: {
    marginHorizontal: 0,
    borderRadius: 0,
    elevation: 0,
    shadowOpacity: 0,
  },
  headerSection: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  emoji: {
    fontSize: 28,
  },
  middleSection: {
    flex: 1,
  },
  rightSection: {
    alignItems: "flex-end",
    paddingRight: 18, // leave room for the info icon
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "white",
    letterSpacing: 0,
    marginBottom: 2,
  },
  timeRange: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 2,
  },
  countdownTimer: {
    fontSize: 14,
    fontWeight: "900",
    color: "white",
    letterSpacing: 0.5,
  },
  infoButton: {
    position: "absolute",
    top: 10,
    right: 12,
    padding: 4,
  },
  infoBox: {
    marginTop: 8,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  infoText: {
    color: "rgba(255, 255, 255, 0.93)",
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 16,
  },
});
