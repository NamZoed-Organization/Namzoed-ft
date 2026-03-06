import { Ionicons } from "@expo/vector-icons";
import {
    createAudioPlayer,
    setAudioModeAsync,
    type AudioPlayer,
    type AudioStatus,
} from 'expo-audio';
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Text,
    TouchableOpacity,
    View
} from "react-native";

// Realistic voice-message waveform heights (24 bars — fits cleanly in bubble)
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
  const [isPlaying, setIsPlaying]         = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);          // seconds
  const [audioDuration, setAudioDuration]     = useState(duration);   // seconds

  // ── Player lives in a ref so callbacks always see the latest instance ────────
  const playerRef   = useRef<AudioPlayer | null>(null);
  const listenerRef = useRef<{ remove: () => void } | null>(null);
  const isMounted   = useRef(true);

  // Animated progress 0–100
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── Animate fill whenever position / duration change ─────────────────────────
  useEffect(() => {
    const pct = audioDuration > 0 ? Math.min(100, (currentPosition / audioDuration) * 100) : 0;
    Animated.timing(progressAnim, {
      toValue: pct,
      duration: 80,
      useNativeDriver: false,
    }).start();
  }, [currentPosition, audioDuration]);

  // ── Unmount cleanup ──────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      _destroy();
    };
  }, []);

  // ── Destroy current player instance ─────────────────────────────────────────
  const _destroy = () => {
    try { listenerRef.current?.remove(); } catch (_) {}
    try { playerRef.current?.remove();   } catch (_) {}
    listenerRef.current = null;
    playerRef.current   = null;
  };

  // ── Playback status callback ─────────────────────────────────────────────────
  // Defined at module level (stable) — only uses refs and stable setState.
  const onStatus = (status: AudioStatus) => {
    if (!status.isLoaded) return;

    // currentTime / duration come through as the typed fields in expo-audio v2
    const t = (status as any).currentTime ?? 0;
    const d = (status as any).duration    ?? 0;

    if (isMounted.current) {
      setCurrentPosition(t);
      if (d > 0) setAudioDuration((prev) => (prev > 0 ? prev : d));
    }

    if (status.didJustFinish) {
      // Reset visual state immediately
      progressAnim.setValue(0);
      if (isMounted.current) {
        setIsPlaying(false);
        setCurrentPosition(0);
      }
      // Destroy the finished player — next tap creates a fresh one so replay always works
      _destroy();
    }
  };

  // ── Play / Pause ─────────────────────────────────────────────────────────────
  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        playerRef.current?.pause();
        setIsPlaying(false);
        return;
      }

      setIsLoading(true);

      if (!playerRef.current) {
        // Create a completely fresh player (handles first play AND replays)
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });

        const p = createAudioPlayer({ uri: audioUrl }, { updateInterval: 100 });
        listenerRef.current = p.addListener('playbackStatusUpdate', onStatus);
        playerRef.current   = p;
        p.play();
      } else {
        // Resume from pause
        playerRef.current.play();
      }

      setIsPlaying(true);
      setIsLoading(false);
    } catch (err) {
      console.error('❌ Audio playback error:', err);
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // While playing or paused mid-way show elapsed; otherwise show total duration
  const displayTime = (isPlaying || currentPosition > 0)
    ? formatTime(currentPosition)
    : formatTime(audioDuration);

  // ── Colors ───────────────────────────────────────────────────────────────────
  const playedColor   = isCurrentUser ? 'rgba(255,255,255,0.97)' : '#094569';
  const unplayedColor = isCurrentUser ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.15)';

  return (
    <View
      className={`flex-row items-center px-3 py-2 rounded-2xl ${isCurrentUser ? 'bg-primary' : 'bg-gray-200'} ${isOptimistic ? 'opacity-70' : ''}`}
      style={{ minWidth: 210, maxWidth: 280 }}
    >
      {/* ── Play/Pause Button ──────────────────────────────────────────────── */}
      <TouchableOpacity
        onPress={handlePlayPause}
        disabled={isLoading || isOptimistic}
        style={{ flexShrink: 0 }}
        className={`w-9 h-9 rounded-full items-center justify-center ${isCurrentUser ? 'bg-white/30' : 'bg-gray-300'}`}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={isCurrentUser ? 'white' : '#666'} />
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color={isCurrentUser ? 'white' : '#333'}
          />
        )}
      </TouchableOpacity>

      {/* ── Waveform with real-time fill overlay ──────────────────────────── */}
      <View style={{ flex: 1, height: 32, marginLeft: 8, marginRight: 6, overflow: 'hidden' }}>

        {/* Base layer — unplayed bars */}
        <View style={{
          position: 'absolute', left: 0, top: 0, right: 0, bottom: 0,
          flexDirection: 'row', alignItems: 'center',
        }}>
          {WAVEFORM.map((h, i) => (
            <View key={i} style={{
              width: 3, height: h, borderRadius: 2, marginHorizontal: 1.2,
              backgroundColor: unplayedColor,
            }} />
          ))}
        </View>

        {/* Played fill — shrinking clip from left */}
        <Animated.View style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          overflow: 'hidden',
          width: progressAnim.interpolate({
            inputRange: [0, 100],
            outputRange: ['0%', '100%'],
            extrapolate: 'clamp',
          }),
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 32 }}>
            {WAVEFORM.map((h, i) => (
              <View key={i} style={{
                width: 3, height: h, borderRadius: 2, marginHorizontal: 1.2,
                backgroundColor: playedColor,
              }} />
            ))}
          </View>
        </Animated.View>
      </View>

      {/* ── Time label ─────────────────────────────────────────────────────── */}
      <Text
        numberOfLines={1}
        style={{
          fontSize: 11,
          color: isCurrentUser ? 'rgba(255,255,255,0.92)' : '#374151',
          minWidth: 36,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
          flexShrink: 0,
          letterSpacing: 0.2,
        }}
      >
        {displayTime}
      </Text>

      {/* ── Mic icon ───────────────────────────────────────────────────────── */}
      <View style={{ marginLeft: 5, flexShrink: 0 }}>
        <Ionicons
          name="mic"
          size={15}
          color={isCurrentUser ? 'rgba(255,255,255,0.75)' : '#6b7280'}
        />
      </View>

      {/* ── Uploading spinner ──────────────────────────────────────────────── */}
      {isOptimistic && (
        <View style={{ marginLeft: 5 }}>
          <ActivityIndicator size="small" color={isCurrentUser ? 'white' : '#666'} />
        </View>
      )}
    </View>
  );
}
