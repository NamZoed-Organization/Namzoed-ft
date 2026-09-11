/**
 * Several pictures in one bubble.
 *
 * Sending four photographs used to be four messages: four full-width
 * bubbles, four timestamps, the whole thread pushed up by one act. A set
 * sent together is one thing somebody sent, so it is one bubble — and the
 * caption that came with it sits under the set rather than floating below as
 * a separate message about nothing in particular.
 *
 * The arrangements are the ones every messenger converged on, for the same
 * reason: the eye reads two-up and a 2×2 instantly, and anything past four
 * is a count rather than a picture too small to make out. The whole stack is
 * capped at 220pt so a message stays a message and does not become the
 * screen.
 */

import { Image } from "expo-image";
import React from "react";
import { Pressable, Text, View } from "react-native";

/** The widest a stack gets — roughly the width of a long line of text, so a
 *  thread of pictures and a thread of words have the same rhythm. */
const STACK = 220;
const GAP = 2;

export default function ImageStack({
  urls,
  onPressImage,
  onLongPress,
  dimmed,
}: {
  urls: string[];
  /** The index tapped, so the viewer opens on the right one. */
  onPressImage: (index: number) => void;
  onLongPress?: () => void;
  /** Optimistic, still uploading. */
  dimmed?: boolean;
}) {
  const count = urls.length;
  if (count === 0) return null;

  const tile = (
    uri: string,
    index: number,
    width: number,
    height: number,
    extra?: number,
  ) => (
    <Pressable
      key={`${uri}-${index}`}
      onPress={() => onPressImage(index)}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={{ width, height, backgroundColor: "#111" }}
    >
      <Image
        source={{ uri }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
      {/* The fifth picture onward is a number on the fourth: four tiles is
          the most that can be read at this size, and a fifth would be a
          smudge pretending to be information. */}
      {extra != null && extra > 0 && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: "rgba(17,24,39,0.55)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: 20, fontWeight: "700" }}>
            +{extra}
          </Text>
        </View>
      )}
    </Pressable>
  );

  const body = () => {
    if (count === 1) {
      return tile(urls[0], 0, STACK, STACK);
    }

    if (count === 2) {
      const half = (STACK - GAP) / 2;
      return (
        <View style={{ flexDirection: "row", gap: GAP }}>
          {tile(urls[0], 0, half, STACK * 0.8)}
          {tile(urls[1], 1, half, STACK * 0.8)}
        </View>
      );
    }

    if (count === 3) {
      // One tall, two stacked beside it — three equal tiles would leave a
      // hole in the grid, and a hole reads as a picture that failed to load.
      const big = STACK * 0.62;
      const small = STACK - big - GAP;
      const half = (STACK - GAP) / 2;
      return (
        <View style={{ flexDirection: "row", gap: GAP }}>
          {tile(urls[0], 0, big, STACK)}
          <View style={{ gap: GAP }}>
            {tile(urls[1], 1, small, half)}
            {tile(urls[2], 2, small, half)}
          </View>
        </View>
      );
    }

    const half = (STACK - GAP) / 2;
    const extra = count - 4;
    return (
      <View style={{ gap: GAP }}>
        <View style={{ flexDirection: "row", gap: GAP }}>
          {tile(urls[0], 0, half, half)}
          {tile(urls[1], 1, half, half)}
        </View>
        <View style={{ flexDirection: "row", gap: GAP }}>
          {tile(urls[2], 2, half, half)}
          {tile(urls[3], 3, half, half, extra)}
        </View>
      </View>
    );
  };

  return <View style={{ opacity: dimmed ? 0.7 : 1 }}>{body()}</View>;
}
