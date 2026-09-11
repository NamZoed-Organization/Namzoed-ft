/**
 * ConversationSkeleton
 *
 * First paint of the messages list, in the shape the real rows land in —
 * one white group on the grey, 44pt avatar, inset hairlines, the group's
 * ends rounded. A skeleton whose geometry differs from the list it stands
 * in for makes the arrival read as a re-layout rather than as content
 * filling in, which is the opposite of what it is for.
 *
 * Kept in step with `components/messages/ConversationRow.tsx` — the avatar
 * size and separator inset are imported from it rather than repeated.
 */

import {
  CONVERSATION_AVATAR,
  CONVERSATION_GROUP_RADIUS,
  CONVERSATION_SEPARATOR_INSET,
} from "@/components/messages/ConversationRow";
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface ConversationSkeletonProps {
  count?: number;
}

export default function ConversationSkeleton({ count = 8 }: ConversationSkeletonProps) {
  const shimmerOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerOpacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerOpacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmerOpacity]);

  return (
    <View style={styles.group}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>
          {i > 0 && <View style={styles.separator} />}
          <View style={styles.row}>
            <Animated.View style={[styles.avatar, { opacity: shimmerOpacity }]} />
            <View style={styles.rightCol}>
              <View style={styles.topRow}>
                <Animated.View style={[styles.nameLine, { opacity: shimmerOpacity }]} />
                <Animated.View style={[styles.timeLine, { opacity: shimmerOpacity }]} />
              </View>
              <Animated.View style={[styles.previewLine, { opacity: shimmerOpacity }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: CONVERSATION_GROUP_RADIUS,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#f0f0f0",
    marginLeft: CONVERSATION_SEPARATOR_INSET,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: CONVERSATION_AVATAR,
    height: CONVERSATION_AVATAR,
    borderRadius: CONVERSATION_AVATAR / 2,
    borderCurve: "continuous",
    backgroundColor: "#E5E7EB",
  },
  rightCol: { flex: 1, marginLeft: 12 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  nameLine: {
    width: 128,
    height: 13,
    borderRadius: 6,
    borderCurve: "continuous",
    backgroundColor: "#E5E7EB",
  },
  timeLine: {
    width: 40,
    height: 11,
    borderRadius: 6,
    borderCurve: "continuous",
    backgroundColor: "#E5E7EB",
  },
  previewLine: {
    width: 192,
    height: 11,
    borderRadius: 6,
    borderCurve: "continuous",
    backgroundColor: "#E5E7EB",
  },
});
