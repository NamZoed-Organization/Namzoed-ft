import CircularLoader from "@/components/ui/CircularLoader";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

export interface PendingMediaItem {
  id: string;
  uri: string;
  type: "image" | "video";
  duration?: number;
  uploadedUrl?: string;
  uploading: boolean;
  failed?: boolean;
}

const THUMB = 56;

interface PendingMediaStripProps {
  items: PendingMediaItem[];
  onRemove: (id: string) => void;
}

/** Thumbnail row for images/videos staged in a comment composer, before
 * send — shown inline above the text row so the pill grows in place rather
 * than opening a separate staging modal. */
export default function PendingMediaStrip({ items, onRemove }: PendingMediaStripProps) {
  if (items.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 2, gap: 8 }}
    >
      {items.map((m) => (
        <View key={m.id} style={{ width: THUMB, height: THUMB, borderRadius: 10, overflow: "hidden", backgroundColor: "#E5E7EB" }}>
          <Image source={{ uri: m.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          {m.type === "video" && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.15)" }]}>
              <Ionicons name="play-circle" size={18} color="#fff" />
            </View>
          )}
          {m.uploading && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" }]}>
              <CircularLoader size="small" color="#fff" />
            </View>
          )}
          {m.failed && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(239,68,68,0.55)" }]}>
              <Ionicons name="alert" size={16} color="#fff" />
            </View>
          )}
          <TouchableOpacity
            onPress={() => onRemove(m.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              width: 18,
              height: 18,
              borderRadius: 9,
              borderCurve: "continuous",
              backgroundColor: "rgba(0,0,0,0.6)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={10} color="#fff" />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );
}
