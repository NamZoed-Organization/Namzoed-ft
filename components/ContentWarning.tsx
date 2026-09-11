import { ContentRating, getContentRatingLabel, getContentWarningMessage } from '@/lib/contentClassifier';
import { BlurView } from 'expo-blur';
import { EyeOff } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface ContentWarningProps {
  contentRating?: ContentRating;
  onDismiss?: () => void;
  style?: any;
}

/**
 * Component to display content warning for sensitive/18+ posts
 * Shows a blurred overlay with warning message until user confirms
 */
export const ContentWarning: React.FC<ContentWarningProps> = ({
  contentRating = 'general',
  onDismiss,
  style,
}) => {
  const [showWarning, setShowWarning] = useState(true);

  if (contentRating === 'general' || !showWarning) {
    return null;
  }

  const warningMessage = getContentWarningMessage(contentRating);
  const ratingLabel = getContentRatingLabel(contentRating);

  if (!warningMessage) {
    return null;
  }

  const handleDismiss = () => {
    setShowWarning(false);
    onDismiss?.();
  };

  return (
    <View style={[styles.container, style]}>
      <BlurView style={StyleSheet.absoluteFillObject} intensity={62} tint="dark" />
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.tapArea} onPress={handleDismiss} activeOpacity={0.85}>
          <EyeOff size={34} color="#fff" strokeWidth={2.2} />
          <Text style={styles.title}>{ratingLabel}</Text>
          <Text style={styles.message}>{warningMessage}</Text>
          <Text style={styles.hint}>Tap to view</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tapArea: {
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 14,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.92)',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 20,
  },
  hint: {
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderCurve: "continuous",
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ContentWarning;
