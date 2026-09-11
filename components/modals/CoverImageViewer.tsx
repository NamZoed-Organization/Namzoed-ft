import { LinearGradient } from "expo-linear-gradient";
import { Camera, Image as ImageIcon, X } from "lucide-react-native";
import React from "react";
import { Image } from "expo-image";
import { Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface CoverImageViewerProps {
  visible: boolean;
  // null renders the same gradient placeholder shown on the profile screen
  // itself when no cover photo has been set yet.
  imageUri: string | null;
  gradientColors: readonly [string, string, ...string[]];
  onClose: () => void;
  onChangePhoto: () => void;
  // Optional — when given, the action area offers taking a photo as well as
  // picking one, so a caller doesn't need a separate source-picker sheet on
  // top of this. Callers that only ever pick from the library omit it and
  // keep the single card.
  onTakePhoto?: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const BANNER_HEIGHT = screenWidth * 0.62;

// Full-screen cover-photo viewer — same visual language as
// ProfileImageViewer (plain black backdrop, X close, tap-to-dismiss) but
// with a banner-shaped frame instead of a circular one, and a gradient
// fallback for users who haven't set a cover photo yet.
export default function CoverImageViewer({
  visible,
  imageUri,
  gradientColors,
  onClose,
  onChangePhoto,
  onTakePhoto,
}: CoverImageViewerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        {/* Close Button - Top Left */}
        <View className="absolute top-0 left-0 right-0 z-10 flex-row items-center justify-between p-4 pt-16">
          <TouchableOpacity
            onPress={onClose}
            className="rounded-full p-2"
            style={{ backgroundColor: "rgba(9, 16, 29, 0.45)" }}
          >
            <X size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Banner cover viewer — tapping anywhere here (outside the
            change-photo card below) closes the viewer, same as the X
            button. */}
        <Pressable
          className="items-center justify-center"
          style={{ width: screenWidth, height: screenHeight }}
          onPress={onClose}
        >
          <View
            style={{
              width: screenWidth,
              height: BANNER_HEIGHT,
              overflow: "hidden",
            }}
          >
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <LinearGradient
                colors={gradientColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={{ width: "100%", height: "100%" }}
              />
            )}
          </View>
        </Pressable>

        {/* Change Cover Photo — same rectangular card treatment as the
            Norbu Wallet / History pair on the profile screen. */}
        <View
          style={{
            position: "absolute",
            left: 24,
            right: 24,
            bottom: Math.max(insets.bottom, 16) + 40,
          }}
        >
          {/* One block, not two floating cards — the two sources are a
              single control, so they're joined with a hairline rather than
              separated by a gap. */}
          <View
            style={{ borderRadius: 8, borderCurve: "continuous", overflow: "hidden" }}
          >
            <TouchableOpacity
              onPress={onChangePhoto}
              className="py-3 px-4 flex-row items-center justify-between gap-3 bg-white/[0.14]"
            >
              <Text className="text-xl font-semibold text-white">
                {onTakePhoto ? "Choose from Library" : "Change Cover Photo"}
              </Text>
              {onTakePhoto ? (
                <ImageIcon size={18} color="#fff" />
              ) : (
                <Camera size={18} color="#fff" />
              )}
            </TouchableOpacity>
            {onTakePhoto && (
              <>
                <View
                  style={{
                    height: StyleSheet.hairlineWidth,
                    backgroundColor: "rgba(255,255,255,0.18)",
                  }}
                />
                <TouchableOpacity
                  onPress={onTakePhoto}
                  className="py-3 px-4 flex-row items-center justify-between gap-3 bg-white/[0.14]"
                >
                  <Text className="text-xl font-semibold text-white">
                    Take a Photo
                  </Text>
                  <Camera size={18} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
