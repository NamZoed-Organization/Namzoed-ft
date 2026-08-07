import PopupMessage from "@/components/ui/PopupMessage";
import { Check, Type, X } from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import ViewShot from "react-native-view-shot";

export interface StoryDesignResult {
  uri: string;
}

interface TextLayerData {
  id: string;
  text: string;
  color: string;
}

const TEXT_COLORS = [
  "#FFFFFF",
  "#000000",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
];

interface StoryDesignOverlayProps {
  visible: boolean;
  /** Already cropped to the 9:16 story canvas by StoryCropOverlay */
  imageUri: string;
  onSave: (result: StoryDesignResult) => void;
  onCancel: () => void;
}

function DraggableTextLayer({
  layer,
  index,
  isFocused,
  onFocus,
  onChangeText,
}: {
  layer: TextLayerData;
  index: number;
  isFocused: boolean;
  onFocus: () => void;
  onChangeText: (text: string) => void;
}) {
  const translateX = useSharedValue(0);
  // Stagger multiple layers vertically so new ones don't stack exactly on top.
  const translateY = useSharedValue((index - 1) * 60);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const savedRotation = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    });

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = Math.max(0.4, Math.min(savedScale.value * e.scale, 4));
    });

  const rotationGesture = Gesture.Rotation()
    .onStart(() => {
      savedRotation.value = rotation.value;
    })
    .onUpdate((e) => {
      rotation.value = savedRotation.value + e.rotation;
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    runOnJS(onFocus)();
  });

  const composed = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    rotationGesture,
    tapGesture,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotateZ: `${rotation.value}rad` },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
      <Animated.View
        style={[
          { position: "absolute", alignSelf: "center", top: "45%" },
          animatedStyle,
        ]}
      >
        {isFocused ? (
          <TextInput
            autoFocus
            value={layer.text}
            onChangeText={onChangeText}
            multiline
            style={{
              color: layer.color,
              fontSize: 28,
              fontWeight: "700",
              textAlign: "center",
              minWidth: 60,
              textShadowColor: "rgba(0,0,0,0.4)",
              textShadowRadius: 4,
            }}
          />
        ) : (
          <Text
            style={{
              color: layer.color,
              fontSize: 28,
              fontWeight: "700",
              textAlign: "center",
              textShadowColor: "rgba(0,0,0,0.4)",
              textShadowRadius: 4,
            }}
          >
            {layer.text || " "}
          </Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Text-overlay editor for the story composer. Draggable/pinch-scalable/
 * rotatable text layers over the cropped photo, flattened into one final
 * image via react-native-view-shot on save (expo-image-manipulator can only
 * crop/resize/rotate/flip, not composite arbitrary overlay views).
 */
export default function StoryDesignOverlay({
  visible,
  imageUri,
  onSave,
  onCancel,
}: StoryDesignOverlayProps) {
  const [layers, setLayers] = useState<TextLayerData[]>([]);
  const [focusedLayerId, setFocusedLayerId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [popup, setPopup] = useState({
    visible: false,
    type: "error" as const,
    title: "",
    message: "",
  });
  const viewShotRef = useRef<ViewShot>(null);

  const focusedLayer = layers.find((l) => l.id === focusedLayerId) ?? null;

  const addTextLayer = () => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setLayers((prev) => [...prev, { id, text: "", color: "#FFFFFF" }]);
    setFocusedLayerId(id);
  };

  const updateLayerText = (id: string, text: string) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, text } : l)));
  };

  const updateLayerColor = (color: string) => {
    if (!focusedLayerId) return;
    setLayers((prev) =>
      prev.map((l) => (l.id === focusedLayerId ? { ...l, color } : l)),
    );
  };

  // Tapping the background dismisses editing; an empty layer left behind is removed.
  const handleBackgroundPress = () => {
    if (focusedLayerId) {
      setLayers((prev) => prev.filter((l) => l.id !== focusedLayerId || l.text.trim() !== ""));
    }
    setFocusedLayerId(null);
  };

  const handleSave = async () => {
    if (isSaving) return;
    // Commit any in-progress edit first (same empty-removal rule as tapping away).
    handleBackgroundPress();
    try {
      setIsSaving(true);
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error("capture returned no uri");
      onSave({ uri });
    } catch (e) {
      console.error("StoryDesignOverlay save:", e);
      setPopup({
        visible: true,
        type: "error",
        title: "Save Failed",
        message: "Could not save your design.",
      });
      setTimeout(() => setPopup((p) => ({ ...p, visible: false })), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <StatusBar barStyle="light-content" />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingTop: 52,
              paddingBottom: 12,
              zIndex: 50,
              elevation: 10,
            }}
          >
            <Pressable onPress={onCancel} hitSlop={16} style={{ padding: 10 }}>
              <X size={24} color="#fff" />
            </Pressable>
            <Pressable onPress={addTextLayer} hitSlop={16} style={{ padding: 10 }}>
              <Type size={24} color="#fff" />
            </Pressable>
            <Pressable onPress={handleSave} disabled={isSaving} hitSlop={16} style={{ padding: 10 }}>
              <Check size={24} color="#4ade80" />
            </Pressable>
          </View>

          <Pressable style={{ flex: 1 }} onPress={handleBackgroundPress}>
            <ViewShot
              ref={viewShotRef}
              options={{ format: "jpg", quality: 0.9 }}
              style={{ flex: 1 }}
            >
              <Image
                source={{ uri: imageUri }}
                style={{ flex: 1 }}
                resizeMode="cover"
              />
              {layers.map((layer, index) => (
                <DraggableTextLayer
                  key={layer.id}
                  layer={layer}
                  index={index}
                  isFocused={layer.id === focusedLayerId}
                  onFocus={() => setFocusedLayerId(layer.id)}
                  onChangeText={(text) => updateLayerText(layer.id, text)}
                />
              ))}
            </ViewShot>
          </Pressable>

          {focusedLayer && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                paddingVertical: 16,
                gap: 12,
              }}
            >
              {TEXT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => updateLayerColor(color)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: color,
                    borderWidth: focusedLayer.color === color ? 3 : 1,
                    borderColor: focusedLayer.color === color ? "#4ade80" : "rgba(255,255,255,0.4)",
                  }}
                />
              ))}
            </View>
          )}

          <PopupMessage
            visible={popup.visible}
            type={popup.type}
            title={popup.title}
            message={popup.message}
          />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
