import { Feather } from "@expo/vector-icons";
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

const CARD_WIDTH = 300;
const IMAGE_HEIGHT = 140;

interface HomeCardProps {
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  isSeeMore?: boolean;
  onPress: () => void;
}

export default function HomeCard({
  imageUrl,
  title,
  subtitle,
  isSeeMore = false,
  onPress,
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
      {/* 1. THE IMAGE FRAME */}
      <View style={styles.imageFrame}>
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
        {/* Subtle Gold technical accent in the corner of the image */}
        <View style={styles.goldCorner} />
      </View>

      {/* 2. THE TEXT AREA */}
      <View style={styles.infoContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.titleUnderline} />
        </View>
        <Text style={styles.subtitle}>{subtitle?.toUpperCase()}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    marginRight: 24,
    marginBottom: 10,
  },
  imageFrame: {
    width: "100%",
    height: IMAGE_HEIGHT,
    backgroundColor: "#F8F8F8",
    overflow: "hidden",
    // Very slight radius for a modern but sharp look
    borderRadius: 4,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  goldCorner: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 30,
    height: 2,
    backgroundColor: "#EDC06D",
  },
  infoContainer: {
    marginTop: 14,
  },
  titleRow: {
    alignSelf: "flex-start",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  titleUnderline: {
    height: 1,
    width: "40%",
    backgroundColor: "#EAEAEA",
    marginTop: 2,
  },
  subtitle: {
    fontSize: 10,
    color: "#888",
    fontWeight: "600",
    letterSpacing: 2,
    marginTop: 6,
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
    borderRadius: 4,
    justifyContent: "center",
    alignItems: "center",
    borderStyle: "dashed", // Gives it that "Add more/See more" architectural vibe
  },
  seeMoreLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#094569",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
});
