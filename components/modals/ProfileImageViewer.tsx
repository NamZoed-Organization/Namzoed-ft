import { Camera, Image as ImageIcon, Sparkles, User, X } from "lucide-react-native";
import React from "react";
import { Image } from "expo-image";
import { Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ProfileImageViewerProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  // Optional — only the owner's own profile screen passes this, which is
  // what shows the "Change Profile Photo" card below. Viewing someone
  // else's photo (the other-user profile screen) omits it, so the card
  // never appears there.
  onChangePhoto?: () => void;
  // Optional — when given, the action area offers taking a photo as well as
  // picking one, so a caller doesn't need a separate source-picker sheet on
  // top of this. Callers that only ever pick from the library omit it and
  // keep the single card.
  onTakePhoto?: () => void;
  // Optional — opens the generated-avatar picker. It sits in the same block
  // as the two camera sources because it is the same decision: what this
  // circle shows. Nobody has to own a photo of themselves to have a face
  // here (§ Generated avatars).
  onGeneratedAvatar?: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const AVATAR_SIZE = Math.min(screenWidth * 0.78, 360);

// ZoomableImage Component (simplified version from ImageViewer)
const ZoomableImage = ({ uri }: { uri: string }) => {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      // Reset zoom if too zoomed out
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
      }
      // Limit max zoom
      else if (scale.value > 3) {
        scale.value = withSpring(3);
        savedScale.value = 3;
      } else {
        savedScale.value = scale.value;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={pinchGesture}>
      <Animated.View
        style={[
          {
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            justifyContent: "center",
            alignItems: "center",
          },
          animatedStyle,
        ]}
      >
        <Image
          source={{ uri }}
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      </Animated.View>
    </GestureDetector>
  );
};

export default function ProfileImageViewer({
  visible,
  imageUri,
  onClose,
  onChangePhoto,
  onTakePhoto,
  onGeneratedAvatar,
}: ProfileImageViewerProps) {
  const insets = useSafeAreaInsets();
  // No photo yet is a real state for a caller that opens this to *set* one
  // (Edit Profile), so an empty avatar shows the same placeholder circle the
  // profile screen draws rather than nothing at all.

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

          {/* Rounded profile image viewer — tapping anywhere here (outside
              the change-photo card below) closes the viewer, same as the X
              button. The pinch gesture on the image itself still works
              since a single tap isn't claimed by Gesture.Pinch. */}
          <Pressable
            className="items-center justify-center"
            style={{
              width: screenWidth,
              height: screenHeight,
            }}
            onPress={onClose}
          >
            <View
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: AVATAR_SIZE / 2,
                borderCurve: "continuous",
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: imageUri ? undefined : "#1F2937",
              }}
            >
              {imageUri ? (
                <ZoomableImage uri={imageUri} />
              ) : (
                <User size={AVATAR_SIZE * 0.4} strokeWidth={1.2} color="#6B7280" />
              )}
            </View>
          </Pressable>

          {/* Change Profile Photo — same rectangular card treatment as the
              Norbu Wallet / History pair on the profile screen. */}
          {onChangePhoto && (
            <View
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                bottom: Math.max(insets.bottom, 16) + 40,
              }}
            >
              {/* One block, not two floating cards — the two sources are a
                  single control, so they're joined with a hairline rather
                  than separated by a gap. */}
              <View
                style={{ borderRadius: 8, borderCurve: "continuous", overflow: "hidden" }}
              >
                <TouchableOpacity
                  onPress={onChangePhoto}
                  className="py-3 px-4 flex-row items-center justify-between gap-3 bg-white/[0.14]"
                >
                  <Text className="text-xl font-semibold text-white">
                    {onTakePhoto ? "Choose from Library" : "Change Profile Photo"}
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
                {onGeneratedAvatar && (
                  <>
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: "rgba(255,255,255,0.18)",
                      }}
                    />
                    <TouchableOpacity
                      onPress={onGeneratedAvatar}
                      className="py-3 px-4 flex-row items-center justify-between gap-3 bg-white/[0.14]"
                    >
                      <Text className="text-xl font-semibold text-white">
                        Generated Avatar
                      </Text>
                      <Sparkles size={18} color="#fff" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}
      </View>
    </Modal>
  );
}
