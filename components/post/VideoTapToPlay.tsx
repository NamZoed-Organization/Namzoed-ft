/**
 * VideoTapToPlay
 *
 * What an inline feed video is while data saver is on (lib/dataSaver.ts): its
 * poster and a play button. No player exists until the tap, because a player
 * starts downloading the moment it is created — creating one paused is not
 * enough.
 *
 * It is drawn as the paused state of the playing video — the same 64pt
 * button — so the tap reads as pressing play, not as a different control.
 *
 * A video with no poster (posted before posters existed) shows black behind
 * the button rather than falling back to the video's first frame: that
 * fallback downloads the video, which is exactly what this is here to avoid.
 */

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { Play } from "lucide-react-native";
import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

export interface VideoTapToPlayProps {
  /** From `toVideoPosterUrl` (lib/imagePreview.ts); absent for non-post videos. */
  posterUri?: string;
  width: number;
  height: number;
  onPlay: () => void;
}

export default function VideoTapToPlay({ posterUri, width, height, onPlay }: VideoTapToPlayProps) {
  const [posterFailed, setPosterFailed] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPlay}
      accessibilityRole="button"
      accessibilityLabel="Play video"
      style={{ width, height, backgroundColor: "#000" }}
    >
      {posterUri && !posterFailed ? (
        <ProgressiveImage
          uri={posterUri}
          displayWidth={width}
          style={{ width, height }}
          contentFit="cover"
          backgroundColor="#000"
          showProgress={false}
          onError={() => setPosterFailed(true)}
        />
      ) : null}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        <View style={styles.button}>
          <Play size={32} color="#fff" fill="#fff" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderCurve: "continuous",
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
