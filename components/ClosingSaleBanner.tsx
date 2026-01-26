import { Product } from "@/lib/productsService";
import {
  formatCompactCountdown,
  getCountdownDisplayText,
  getCountdownSeconds,
  isClosingSaleActive,
} from "@/utils/timeHelpers";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

interface ClosingSaleBannerProps {
  foodItems: Product[]; // Food items with closing sale enabled
}

export default function ClosingSaleBanner({
  foodItems,
}: ClosingSaleBannerProps) {
  const [countdown, setCountdown] = useState(getCountdownSeconds());
  const [displayText, setDisplayText] = useState(getCountdownDisplayText());
  const [isActive, setIsActive] = useState(isClosingSaleActive());

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getCountdownSeconds());
      setDisplayText(getCountdownDisplayText());
      setIsActive(isClosingSaleActive());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.bannerContainer}>
      <LinearGradient
        colors={
          isActive
            ? ["#F59E0B", "#D97706"] // Yellow gradient when active (8-10pm)
            : ["#094569", "#0A5276"] // Blue gradient when dormant
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientBanner}
      >
        {/* Three-part banner layout */}
        <View style={styles.headerSection}>
          <View style={styles.contentRow}>
            {/* Part 1: Moon emoji */}
            <Text style={styles.emoji}>🌙</Text>

            {/* Part 2: Title and time range */}
            <View style={styles.middleSection}>
              <Text style={styles.bannerTitle}>{displayText.title}</Text>
              <Text style={styles.timeRange}>8:00 PM - 10:00 PM</Text>
            </View>

            {/* Part 3: Countdown label and timer */}
            <View style={styles.rightSection}>
              <Text style={styles.countdownLabel}>{displayText.subtitle}</Text>
              <Text style={styles.countdownTimer}>
                {formatCompactCountdown(countdown)}
              </Text>
            </View>
          </View>
        </View>
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
});
