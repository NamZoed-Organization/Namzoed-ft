import CircularLoader from "@/components/ui/CircularLoader";
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import React, { useEffect, useRef } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";

// Fewer bars than the chat bubble's waveform (24) — a comment's voice note
// sits in a tighter, "mini" card.
const WAVEFORM = [5, 10, 17, 10, 22, 15, 24, 18, 12, 20, 15, 9, 19, 13, 8];
const BAR_WIDTH = 3;
const BAR_MARGIN = 1.6;
// Sized to the bars' actual rendered width (not flex:1) — flex:1 stretched
// this to fill the pill's minWidth regardless of content, which is what
// opened a big gap before the time text.
const WAVEFORM_WIDTH = WAVEFORM.length * (BAR_WIDTH + BAR_MARGIN * 2);

interface CommentAudioPlayerProps {
  audioUrl: string;
  duration?: number;
  isOptimistic?: boolean;
}

/** Voice-note player for comments — no dedicated play button; the whole card
 * is the toggle. Time reads as a bare seconds count ("5", not "0:05"),
 * matching a stopwatch-tick mark rather than a clock format. */
export default function CommentAudioPlayer({ audioUrl, duration = 0, isOptimistic = false }: CommentAudioPlayerProps) {
  const player = useAudioPlayer(null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const loadedRef = useRef(false); // has replace() been called yet
  const playOnLoad = useRef(false); // waiting for isLoaded to fire play

  useEffect(() => {
    if (playOnLoad.current && status.isLoaded) {
      playOnLoad.current = false;
      player.play();
    }
  }, [status.isLoaded]);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const totalDur = status.duration > 0 ? status.duration : duration;
  const pct = totalDur > 0 ? Math.min(100, (status.currentTime / totalDur) * 100) : 0;

  // Set directly rather than tweening — an eased Animated.timing toward each
  // new sample would perpetually lag/overshoot the player's real position by
  // up to a tween-duration's worth of drift. Setting it straight from
  // status.currentTime/totalDur keeps the fill exactly in step with playback.
  useEffect(() => {
    progressAnim.setValue(pct);
  }, [pct]);

  const handlePlayPause = async () => {
    if (isOptimistic) return;

    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

      if (!loadedRef.current) {
        player.replace({ uri: audioUrl });
        loadedRef.current = true;
        playOnLoad.current = true;
        return;
      }

      if (status.playing) {
        player.pause();
      } else {
        if (status.didJustFinish) {
          void player.seekTo(0);
        }
        player.play();
      }
    } catch (_) {}
  };

  const fmt = (secs: number) => `${Math.round(secs)}"`;

  const displayTime = status.playing || status.currentTime > 0 ? fmt(status.currentTime) : fmt(totalDur);
  const isLoading = loadedRef.current && !status.isLoaded && !status.playing;
  const playedColor = "#094569";
  const unplayedColor = "rgba(0,0,0,0.15)";

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePlayPause}
      disabled={isOptimistic}
      className={`flex-row items-center px-3 py-2 rounded-2xl bg-gray-200 ${isOptimistic ? "opacity-70" : ""}`}
      style={{ alignSelf: "flex-start" }}
    >
      {/* Waveform with progress fill */}
      <View style={{ width: WAVEFORM_WIDTH, height: 32, marginRight: 2, overflow: "hidden" }}>
        <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center" }}>
          {WAVEFORM.map((h, i) => (
            <View key={i} style={{ width: 3, height: h, borderRadius: 2, marginHorizontal: 1.6, backgroundColor: unplayedColor }} />
          ))}
        </View>
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            overflow: "hidden",
            width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"], extrapolate: "clamp" }),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", height: 32 }}>
            {WAVEFORM.map((h, i) => (
              <View key={i} style={{ width: 3, height: h, borderRadius: 2, marginHorizontal: 1.6, backgroundColor: playedColor }} />
            ))}
          </View>
        </Animated.View>
      </View>

      {/* Time */}
      <Text
        numberOfLines={1}
        style={{ fontSize: 11, color: "#374151", minWidth: 24, textAlign: "right", fontVariant: ["tabular-nums"], flexShrink: 0, letterSpacing: 0.2 }}
      >
        {displayTime}
      </Text>

      {isLoading && (
        <View style={{ marginLeft: 5, flexShrink: 0 }}>
          <CircularLoader size="small" color="#666" />
        </View>
      )}

      {isOptimistic && (
        <View style={{ marginLeft: 5 }}>
          <CircularLoader size="small" color="#666" />
        </View>
      )}
    </TouchableOpacity>
  );
}
