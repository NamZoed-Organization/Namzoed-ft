import {
  getContentRatingLabel,
  getContentWarningMessage,
} from "@/lib/contentClassifier";
import type { ContentRating, ContentRatingSuggestion } from "@/types/post";
import {
  CircleAlert,
  CircleCheck,
  ChevronDown,
  Info,
  Shield,
  AlertTriangle,
} from "lucide-react-native";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface ContentRatingSuggestionProps {
  /**
   * The suggestion from suggestContentRating()
   */
  suggestion: ContentRatingSuggestion;

  /**
   * Currently selected rating (can differ from suggestion)
   */
  selectedRating: ContentRating;

  /**
   * Called when user selects a different rating
   */
  onRatingChange: (rating: ContentRating) => void;

  /**
   * Whether to show the suggestion prominently
   * Usually true for first-time posters or when high confidence
   */
  showProminent?: boolean;
}

/**
 * Component that shows content rating suggestions during post creation
 *
 * Usage in a post creation form:
 * ```tsx
 * const suggestion = suggestContentRating(postText, tags);
 * const [rating, setRating] = useState<ContentRating>(suggestion.suggested);
 *
 * <ContentRatingSuggestion
 *   suggestion={suggestion}
 *   selectedRating={rating}
 *   onRatingChange={setRating}
 *   showProminent={suggestion.confidence === 'high'}
 * />
 * ```
 */
const ContentRatingSuggestionComponent: React.FC<ContentRatingSuggestionProps> = ({
  suggestion,
  selectedRating,
  onRatingChange,
  showProminent = true,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [expandAnim] = useState(new Animated.Value(0));
  const { suggested, confidence, detectedKeywords } = suggestion;

  React.useEffect(() => {
    Animated.timing(expandAnim, {
      toValue: showDetails ? 1 : 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showDetails, expandAnim]);

  const isOverride = selectedRating !== suggested;

  const getConfidenceBg = (conf: string) => {
    switch (conf) {
      case "high":
        return ["#FF6B6B", "#FF8E72"];
      case "medium":
        return ["#FFA500", "#FFB84D"];
      case "low":
        return ["#4CAF50", "#66BB6A"];
      default:
        return ["#9E9E9E", "#BDBDBD"];
    }
  };

  const getRatingGradient = (rating: ContentRating) => {
    switch (rating) {
      case "general":
        return { colors: ["#4CAF50", "#66BB6A"], icon: Shield };
      case "sensitive":
        return { colors: ["#FFC107", "#FFD54F"], icon: AlertTriangle };
      case "18_plus":
        return { colors: ["#F44336", "#EF5350"], icon: CircleAlert };
      case "review_required":
        return { colors: ["#9C27B0", "#BA68C8"], icon: Info };
      default:
        return { colors: ["#9E9E9E", "#BDBDBD"], icon: Shield };
    }
  };

  const rotateAnim = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  // Compact view - just show quick selector
  if (!showProminent) {
    return (
      <View style={styles.compactContainer}>
        <Text style={styles.compactLabel}>Content Rating</Text>
        <View style={styles.compactRatingOptions}>
          {(["general", "sensitive", "18_plus"] as const).map((rating) => {
            const { colors } = getRatingGradient(rating);
            const isSelected = selectedRating === rating;
            return (
              <TouchableOpacity
                key={rating}
                activeOpacity={0.7}
                onPress={() => onRatingChange(rating)}
              >
                <LinearGradient
                  colors={isSelected ? colors : ["#F5F5F5", "#F5F5F5"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.compactRatingCard,
                    isSelected && styles.compactRatingCardSelected,
                  ]}
                >
                  {isSelected && (
                    <CircleCheck
                      size={16}
                      color={isSelected ? "#fff" : colors[0]}
                      style={{ marginRight: 4 }}
                    />
                  )}
                  <Text
                    style={[
                      styles.compactRatingText,
                      isSelected && styles.compactRatingTextSelected,
                    ]}
                  >
                    {getContentRatingLabel(rating)}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  }

  // Prominent view - show suggestion with details
  const bgGradient = getConfidenceBg(confidence);
  const suggestedGradient = getRatingGradient(suggested);

  return (
    <View style={styles.promptContainer}>
      <LinearGradient
        colors={bgGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.containerGradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <View style={styles.confidenceBadge}>
              {confidence === "high" && (
                <AlertTriangle size={20} color="#fff" />
              )}
              {confidence === "medium" && <Info size={20} color="#fff" />}
              {confidence === "low" && (
                <CircleCheck size={20} color="#fff" />
              )}
            </View>
            <View style={styles.titleText}>
              <Text style={styles.mainText}>Content Rating</Text>
              <Text style={styles.subText}>
                {confidence === "high" &&
                  "Adult content detected"}
                {confidence === "medium" &&
                  "Mature subject matter"}
                {confidence === "low" &&
                  "General audience safe"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowDetails(!showDetails)}
            style={styles.expandButton}
            activeOpacity={0.6}
          >
            <Animated.View style={{ transform: [{ rotate: rotateAnim }] }}>
              <ChevronDown size={20} color="#fff" />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* Suggested Rating Card */}
        <View style={styles.suggestionBoxContainer}>
          <Text style={styles.suggestionLabelText}>Suggested Rating</Text>
          <LinearGradient
            colors={suggestedGradient.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.suggestionRatingGradient}
          >
            <suggestedGradient.icon size={18} color="#fff" />
            <Text style={styles.suggestionRatingLabel}>
              {getContentRatingLabel(suggested)}
            </Text>
          </LinearGradient>
        </View>

        {/* Detected Keywords */}
        {showDetails && detectedKeywords && detectedKeywords.length > 0 && (
          <View style={styles.detailsSection}>
            <Text style={styles.detailsLabel}>Keywords Detected</Text>
            <View style={styles.keywordsList}>
              {detectedKeywords.slice(0, 4).map((keyword, idx) => (
                <View key={idx} style={styles.modernKeywordTag}>
                  <Text style={styles.keywordText}>#{keyword}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Warning Message */}
        {showDetails && getContentWarningMessage(suggested) && (
          <View style={styles.modernWarningBox}>
            <AlertTriangle size={14} color="#fff" />
            <Text style={styles.modernWarningText}>
              {getContentWarningMessage(suggested)}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* Rating Selection */}
      <View style={styles.selectionContainer}>
        <Text style={styles.selectionLabel}>Choose Rating</Text>
        <View style={styles.modernRatingButtons}>
          {(["general", "sensitive", "18_plus"] as const).map((rating) => {
            const { colors, icon: IconComponent } = getRatingGradient(rating);
            const isSelected = selectedRating === rating;

            return (
              <TouchableOpacity
                key={rating}
                activeOpacity={0.7}
                onPress={() => onRatingChange(rating)}
                style={styles.ratingButtonWrapper}
              >
                <LinearGradient
                  colors={
                    isSelected
                      ? colors
                      : ["#F5F5F5", "#FAFAFA"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[
                    styles.modernRatingButton,
                    isSelected && styles.modernRatingButtonSelected,
                  ]}
                >
                  <IconComponent
                    size={18}
                    color={isSelected ? "#fff" : colors[0]}
                  />
                  <Text
                    style={[
                      styles.modernRatingButtonText,
                      isSelected && styles.modernRatingButtonTextSelected,
                    ]}
                  >
                    {getContentRatingLabel(rating)}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Override Notice */}
      {isOverride && (
        <View style={styles.modernOverrideNotice}>
          <CircleCheck size={16} color="#4CAF50" />
          <Text style={styles.modernOverrideText}>
            Your custom rating will be used
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Compact styles
  compactContainer: {
    marginVertical: 12,
    gap: 8,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1a1a1a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  compactRatingOptions: {
    flexDirection: "row",
    gap: 10,
  },
  compactRatingCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderCurve: "continuous",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  compactRatingCardSelected: {
    shadowOpacity: 0.15,
    elevation: 4,
  },
  compactRatingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  compactRatingTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },

  // Prominent view styles
  promptContainer: {
    marginVertical: 12,
    gap: 12,
  },
  containerGradient: {
    borderRadius: 16,
    borderCurve: "continuous",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  titleSection: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  confidenceBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  titleText: {
    flex: 1,
    gap: 4,
  },
  mainText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },
  subText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
    lineHeight: 18,
    fontWeight: "500",
  },
  expandButton: {
    padding: 6,
    marginRight: -6,
  },

  // Suggestion box
  suggestionBoxContainer: {
    gap: 8,
    marginBottom: 2,
  },
  suggestionLabelText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  suggestionRatingGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  suggestionRatingLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },

  // Details section
  detailsSection: {
    marginTop: 10,
    gap: 8,
  },
  detailsLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.75)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  keywordsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  modernKeywordTag: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
  },
  keywordText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "500",
  },

  // Warning box
  modernWarningBox: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderCurve: "continuous",
    marginTop: 8,
    alignItems: "center",
  },
  modernWarningText: {
    fontSize: 12,
    color: "#fff",
    fontWeight: "500",
    flex: 1,
    lineHeight: 16,
  },

  // Selection container
  selectionContainer: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderCurve: "continuous",
    padding: 14,
    gap: 10,
  },
  selectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1a1a1a",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  modernRatingButtons: {
    gap: 10,
  },
  ratingButtonWrapper: {
    borderRadius: 12,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  modernRatingButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderCurve: "continuous",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  modernRatingButtonSelected: {
    shadowOpacity: 0.12,
    elevation: 4,
  },
  modernRatingButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
    flex: 1,
  },
  modernRatingButtonTextSelected: {
    color: "#fff",
    fontWeight: "700",
  },

  // Override notice
  modernOverrideNotice: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#F0F7F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  modernOverrideText: {
    fontSize: 12,
    color: "#2E7D32",
    fontWeight: "600",
    flex: 1,
  },
});

export default ContentRatingSuggestionComponent;
