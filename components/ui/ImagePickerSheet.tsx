import { Camera, Image as ImageIcon, X } from 'lucide-react-native';
import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    SlideInDown,
} from 'react-native-reanimated';

interface ImagePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onCameraPress: () => void;
  onGalleryPress: () => void;
  title?: string;
}

export default function ImagePickerSheet({
  visible,
  onClose,
  onCameraPress,
  onGalleryPress,
  title = 'Add Photo'
}: ImagePickerSheetProps) {
  if (!visible) return null;

  // Close the sheet first, then launch the picker with no Modal to wait for.
  // No setTimeout needed — the sheet is a plain View overlay, not a nested Modal,
  // so there is no native modal dismissal race condition.
  const handleCameraPress = () => {
    onClose();
    onCameraPress();
  };

  const handleGalleryPress = () => {
    onClose();
    onGalleryPress();
  };

  // Rendered as an absolute overlay *inside* the parent's view tree instead of a
  // nested Modal.  Stacked native Modals cause the gallery picker to fail/freeze
  // on iOS because the inner Modal hasn't fully dismissed by the time the system
  // image picker is presented.
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        style={StyleSheet.absoluteFill}
        pointerEvents="auto"
      >
        <Animated.View
          entering={FadeIn.duration(200)}
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        />
      </Pressable>

      {/* Sheet Content */}
      <Animated.View
        entering={SlideInDown.duration(250)}
        style={styles.sheet}
        pointerEvents="auto"
      >
        {/* Handle Bar */}
        <View style={styles.handleRow}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
          >
            <X size={18} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {/* Take Photo */}
          <TouchableOpacity
            onPress={handleCameraPress}
            activeOpacity={0.7}
            style={styles.optionRow}
          >
            <View style={styles.optionIcon}>
              <Camera size={24} color="#094569" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Take Photo</Text>
              <Text style={styles.optionSubtitle}>Use your camera</Text>
            </View>
          </TouchableOpacity>

          {/* Choose from Gallery */}
          <TouchableOpacity
            onPress={handleGalleryPress}
            activeOpacity={0.7}
            style={styles.optionRow}
          >
            <View style={styles.optionIcon}>
              <ImageIcon size={24} color="#094569" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>Choose from Gallery</Text>
              <Text style={styles.optionSubtitle}>Select from your photos</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Cancel */}
        <View style={styles.cancelContainer}>
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    paddingTop: 8,
  },
  handleRow: { alignItems: 'center', paddingVertical: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#111827' },
  closeBtn: { padding: 8, backgroundColor: '#F3F4F6', borderRadius: 999 },
  optionsContainer: { paddingHorizontal: 24, paddingTop: 16, gap: 12 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  optionIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(9,69,105,0.08)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTitle: { fontSize: 16, fontWeight: '500', color: '#111827' },
  optionSubtitle: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  cancelContainer: { paddingHorizontal: 24, paddingTop: 16 },
  cancelBtn: { paddingVertical: 16, backgroundColor: '#F3F4F6', borderRadius: 16 },
  cancelText: { textAlign: 'center', fontSize: 16, fontWeight: '500', color: '#4B5563' },
});
