/**
 * CreateOptionsSheet
 *
 * The "+" tab in the bottom bar no longer navigates to a full feed screen —
 * it opens this bottom sheet instead, offering the three things that button
 * was always meant to start: a new post, a new story, or going live. Plain/
 * functional for now; the UI here is a placeholder pending redesign.
 */

import { CirclePlus, ImagePlus, Radio, X } from "lucide-react-native";
import React, { useRef } from "react";
import { Animated, Modal, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#094569";

interface CreateOptionsSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectPost: () => void;
  onSelectStory: () => void;
  onSelectLive: () => void;
}

function OptionRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 20 }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          borderCurve: "continuous",
          backgroundColor: "rgba(9,69,105,0.08)",
          alignItems: "center",
          justifyContent: "center",
          marginRight: 14,
        }}
      >
        {icon}
      </View>
      <Text style={{ fontSize: 16, fontWeight: "600", color: "#111" }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CreateOptionsSheet({
  visible,
  onClose,
  onSelectPost,
  onSelectStory,
  onSelectLive,
}: CreateOptionsSheetProps) {
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetY = useRef(new Animated.Value(200)).current;

  React.useEffect(() => {
    if (visible) {
      backdropOpacity.setValue(0);
      sheetY.setValue(200);
      Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      Animated.spring(sheetY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 200, mass: 0.9 }).start();
    }
  }, [visible]);

  const close = () => {
    Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    Animated.timing(sheetY, { toValue: 200, duration: 180, useNativeDriver: true }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.4)", opacity: backdropOpacity }}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} />
        </Animated.View>

        <Animated.View
          style={{
            backgroundColor: "#fff",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderCurve: "continuous",
            paddingBottom: Math.max(insets.bottom, 16),
            transform: [{ translateY: sheetY }],
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#111" }}>Create</Text>
            <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <OptionRow
            icon={<ImagePlus size={20} color={PRIMARY} />}
            label="New Post"
            onPress={onSelectPost}
          />
          <OptionRow
            icon={<CirclePlus size={20} color={PRIMARY} />}
            label="New Story"
            onPress={onSelectStory}
          />
          <OptionRow
            icon={<Radio size={20} color={PRIMARY} />}
            label="Go Live"
            onPress={onSelectLive}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}
