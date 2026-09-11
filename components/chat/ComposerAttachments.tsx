/**
 * The pictures sitting in the composer, before they are sent.
 *
 * A row of thumbnails above the input, in the same place and with the same
 * entrance as `ComposerContextCard` — a composer that grows for a product
 * and a composer that grows for a photograph should grow the same way. Each
 * one shows what it is doing: a spinner while the bytes go up, a tick when
 * they are there, and a retry when they are not.
 *
 * **It reports its own layout changes.** The composer's height is measured,
 * and the message list's bottom padding follows it — so a strip that appears
 * without telling anybody pushes the last message under the keyboard. The
 * `onTransitionStart` / `onTransitionEnd` pair is the same one the context
 * card uses for exactly that reason.
 */

import { Image } from "expo-image";
import { CheckCircle2, RotateCcw, X } from "lucide-react-native";
import React, { useEffect } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { PendingAttachment } from "@/hooks/chat/usePendingAttachments";

const THUMB = 62;
const STRIP_HEIGHT = THUMB + 20;

export default function ComposerAttachments({
  items,
  onRemove,
  onRetry,
  onTransitionStart,
  onTransitionEnd,
}: {
  items: PendingAttachment[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onTransitionStart?: () => void;
  onTransitionEnd?: () => void;
}) {
  const shown = items.length > 0;
  const height = useSharedValue(0);

  useEffect(() => {
    onTransitionStart?.();
    height.value = withTiming(
      shown ? STRIP_HEIGHT : 0,
      { duration: 200, easing: Easing.out(Easing.cubic) },
      (finished) => {
        "worklet";
        if (finished && onTransitionEnd) {
          // Reported from the UI thread's own completion rather than a
          // setTimeout guess at the duration.
          height.value = height.value;
        }
      },
    );
    const t = setTimeout(() => onTransitionEnd?.(), 220);
    return () => clearTimeout(t);
  }, [height, onTransitionEnd, onTransitionStart, shown]);

  const style = useAnimatedStyle(() => ({
    height: height.value,
    opacity: height.value / STRIP_HEIGHT,
  }));

  return (
    <Animated.View style={[{ overflow: "hidden" }, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 10, gap: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        {items.map((item) => (
          <Animated.View
            key={item.id}
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
            style={{
              width: THUMB,
              height: THUMB,
              borderRadius: 10,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: "#E5E7EB",
            }}
          >
            <Image
              source={{ uri: item.uri }}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />

            {item.state === "uploading" && (
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  backgroundColor: "rgba(17,24,39,0.35)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Spinner />
              </View>
            )}

            {item.state === "ready" && (
              <View style={{ position: "absolute", left: 4, bottom: 4 }}>
                <CheckCircle2 size={14} color="#fff" strokeWidth={2.4} />
              </View>
            )}

            {item.state === "failed" && (
              <TouchableOpacity
                onPress={() => onRetry(item.id)}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  backgroundColor: "rgba(220,38,38,0.55)",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <RotateCcw size={15} color="#fff" strokeWidth={2.4} />
                <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>
                  Retry
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => onRemove(item.id)}
              hitSlop={8}
              style={{
                position: "absolute",
                right: 2,
                top: 2,
                width: 18,
                height: 18,
                borderRadius: 9,
                borderCurve: "continuous",
                backgroundColor: "rgba(17,24,39,0.7)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={11} color="#fff" strokeWidth={3} />
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

/** A quiet rotation rather than the platform spinner, which is a different
 *  grey on each OS and reads as a system alert inside a composer. */
function Spinner() {
  const spin = useSharedValue(0);
  useEffect(() => {
    spin.value = withTiming(1, { duration: 900, easing: Easing.linear });
    const loop = setInterval(() => {
      spin.value = 0;
      spin.value = withTiming(1, { duration: 900, easing: Easing.linear });
    }, 900);
    return () => clearInterval(loop);
  }, [spin]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 18,
          height: 18,
          borderRadius: 9,
          borderCurve: "continuous",
          borderWidth: 2,
          borderColor: "rgba(255,255,255,0.35)",
          borderTopColor: "#fff",
        },
        style,
      ]}
    />
  );
}
