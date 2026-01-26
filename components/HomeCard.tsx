import { Feather } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

const CARD_WIDTH = 180;
const IMAGE_HEIGHT = 140;

interface HomeCardProps {
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  isSeeMore?: boolean;
  onPress: () => void;
  discountPercent?: number;
  isClosingSale?: boolean;
  price?: string;
  profileImage?: string;
  profileName?: string;
}

export default function HomeCard({
  imageUrl,
  title,
  subtitle,
  isSeeMore = false,
  onPress,
  discountPercent,
  isClosingSale = false,
  price,
  profileImage,
  profileName,
}: HomeCardProps) {
  if (isSeeMore) {
    return (
      <Pressable onPress={onPress} style={styles.seeMoreContainer}>
        <View style={styles.seeMoreFrame}>
          <Text style={styles.seeMoreLabel}>VIEW ALL</Text>
          <Feather name="arrow-up-right" size={20} color="#094569" />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.cardContainer}>
        {/* 1. THE IMAGE FRAME */}
        <View style={styles.imageFrame}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />

          {/* Discount Badge on Image */}
          {discountPercent && (
            <View
              style={[
                styles.discountBadge,
                isClosingSale
                  ? styles.closingSaleBadge
                  : styles.regularDiscountBadge,
              ]}
            >
              {isClosingSale && <Text style={styles.discountEmoji}>🌙</Text>}
              <Text style={styles.discountText}>-{discountPercent}%</Text>
            </View>
          )}
        </View>

        {/* 2. THE TEXT AREA */}
        <View style={styles.infoContainer}>
          {/* Profile Info */}
          {profileName && (
            <View style={styles.profileRow}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Text style={styles.profileInitial}>
                    {profileName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.profileName} numberOfLines={1}>
                {profileName}
              </Text>
            </View>
          )}

          <View style={styles.topRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {price && (
              <Text style={styles.price} numberOfLines={1}>
                {price}
              </Text>
            )}
          </View>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle.toUpperCase()}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginRight: 16,
    marginBottom: 10,
  },
  cardContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  imageFrame: {
    width: "100%",
    height: IMAGE_HEIGHT,
    backgroundColor: "#F8F8F8",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  discountBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  closingSaleBadge: {
    backgroundColor: "#F59E0B",
  },
  regularDiscountBadge: {
    backgroundColor: "#10B981",
  },
  discountEmoji: {
    fontSize: 12,
    color: "white",
  },
  discountText: {
    fontSize: 12,
    fontWeight: "800",
    color: "white",
    letterSpacing: 0.5,
  },
  infoContainer: {
    padding: 12,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  profileImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
  profileImagePlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#094569",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  profileInitial: {
    fontSize: 10,
    fontWeight: "700",
    color: "white",
  },
  profileName: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4B5563",
    flex: 1,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A1A",
    letterSpacing: -0.3,
    flex: 1,
    marginRight: 8,
  },
  price: {
    fontSize: 14,
    fontWeight: "800",
    color: "#094569",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 9,
    color: "#888",
    fontWeight: "600",
    letterSpacing: 1.5,
  },
  // SEE MORE STYLES
  seeMoreContainer: {
    width: 140,
    height: IMAGE_HEIGHT,
    justifyContent: "center",
  },
  seeMoreFrame: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderStyle: "dashed",
  },
  seeMoreLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#094569",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
});
