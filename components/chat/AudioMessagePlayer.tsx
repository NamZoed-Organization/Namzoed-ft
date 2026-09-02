import CircularLoader from "@/components/ui/CircularLoader";
import { Ionicons } from "@expo/vector-icons";
import {
    setAudioModeAsync,
    useAudioPlayer,
    useAudioPlayerStatus,
} from 'expo-audio';
import React, { useEffect, useRef } from "react";
import {
    Animated,
    Text,
    TouchableOpacity,
    View
} from "react-native";

const WAVEFORM = [4, 7, 11, 16, 9, 19, 23, 16, 21, 26, 19, 12, 20, 26, 18, 13, 10, 23, 19, 14, 17, 21, 13, 9];

interface AudioMessagePlayerProps {
  audioUrl: string;
  duration?: number;
  isCurrentUser: boolean;
  isOptimistic?: boolean;
}

export default function AudioMessagePlayer({
  audioUrl,
  duration = 0,
  isCurrentUser,
  isOptimistic = false,
}: AudioMessagePlayerProps) {
  const player       = useAudioPlayer(null, { updateInterval: 100 });
  const status       = useAudioPlayerStatus(player);
  const loadedRef    = useRef(false);   // has replace() been called yet
  const playOnLoad   = useRef(false);   // waiting for isLoaded to fire play

  // ── Auto-play once the source is loaded ────────────────────────────────────
  useEffect(() => {
    if (playOnLoad.current && status.isLoaded) {
      playOnLoad.current = false;
      player.play();
    }
  }, [status.isLoaded]);

  // ── Progress bar ───────────────────────────────────────────────────────────
  const progressAnim = useRef(new Animated.Value(0)).current;
  const totalDur     = status.duration > 0 ? status.duration : duration;
  const pct          = totalDur > 0 ? Math.min(100, (status.currentTime / totalDur) * 100) : 0;

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: pct, duration: 80, useNativeDriver: false }).start();
  }, [pct]);

  // ── Play / Pause ───────────────────────────────────────────────────────────
  const handlePlayPause = async () => {
    if (isOptimistic) return;

    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });

      if (!loadedRef.current) {
        // First tap — load the source then play once isLoaded fires
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

  // Bare seconds count with a trailing double-quote mark ("45", not
  // "0:45") — matches CommentAudioPlayer's own voice-note format instead of
  // a clock-style m:ss, for a consistent stopwatch-tick reading everywhere
  // a voice note's duration shows up.
  const fmt = (secs: number) => `${Math.round(secs)}"`;

  const displayTime   = (status.playing || status.currentTime > 0) ? fmt(status.currentTime) : fmt(totalDur);
  const isLoading     = loadedRef.current && !status.isLoaded && !status.playing;
  const playedColor   = isCurrentUser ? 'rgba(255,255,255,0.97)' : '#094569';
  const unplayedColor = isCurrentUser ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.15)';

  return (
    <View
      className={`flex-row items-center px-3 py-2 ${isCurrentUser ? 'bg-primary' : 'bg-gray-200'} ${isOptimistic ? 'opacity-70' : ''}`}
      // borderRadius/borderCurve moved out of the rounded-2xl className and
      // into style — borderCurve (iOS's continuous "squircle" corner, same
      // as the text/image chat bubbles now use) only takes effect via RN's
      // own style prop, not a NativeWind className.
      style={{ minWidth: 210, maxWidth: 280, borderRadius: 16, borderCurve: 'continuous' }}
    >
      {/* Play / Pause button */}
      <TouchableOpacity
        onPress={handlePlayPause}
        disabled={isOptimistic}
        style={{ flexShrink: 0 }}
        className={`w-9 h-9 rounded-full items-center justify-center ${isCurrentUser ? 'bg-white/30' : 'bg-gray-300'}`}
      >
        {isLoading
          ? <CircularLoader size="small" color={isCurrentUser ? 'white' : '#666'} />
          : <Ionicons name={status.playing ? 'pause' : 'play'} size={18} color={isCurrentUser ? 'white' : '#333'} />
        }
      </TouchableOpacity>

      {/* Waveform with progress fill */}
      <View style={{ flex: 1, height: 32, marginLeft: 8, marginRight: 6, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center' }}>
          {WAVEFORM.map((h, i) => (
            <View key={i} style={{ width: 3, height: h, borderRadius: 2, borderCurve: 'continuous', marginHorizontal: 1.2, backgroundColor: unplayedColor }} />
          ))}
        </View>
        <Animated.View style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden',
          width: progressAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' }),
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 32 }}>
            {WAVEFORM.map((h, i) => (
              <View key={i} style={{ width: 3, height: h, borderRadius: 2, borderCurve: 'continuous', marginHorizontal: 1.2, backgroundColor: playedColor }} />
            ))}
          </View>
        </Animated.View>
      </View>

      {/* Time */}
      <Text numberOfLines={1} style={{
        fontSize: 11, color: isCurrentUser ? 'rgba(255,255,255,0.92)' : '#374151',
        minWidth: 36, textAlign: 'right', fontVariant: ['tabular-nums'], flexShrink: 0, letterSpacing: 0.2,
      }}>
        {displayTime}
      </Text>

      {/* Upload spinner for optimistic messages */}
      {isOptimistic && (
        <View style={{ marginLeft: 5 }}>
          <CircularLoader size="small" color={isCurrentUser ? 'white' : '#666'} />
        </View>
      )}
    </View>
  );
}
