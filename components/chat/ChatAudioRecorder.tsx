/**
 * ChatAudioRecorder — Instagram-style press-and-hold voice recorder.
 *
 * Idle     : 36x36 mic button — press and HOLD to start.
 * Pressing : expanded row with waveform + "Slide to cancel" + timer.
 *            Slide LEFT >= 65px  → cancel zone (turns red), release → cancel.
 *            Slide UP  >= 70px   → locks recording (hands-free mode).
 *            Release normally    → stop + send.
 * Locked   : full-width bar: [x cancel] [waveform] [timer] [send].
 * Uploading: small activity indicator.
 */

import { supabase } from "@/lib/supabase";
import { sendChatPushNotification } from "@/services/chatPushService";
import { triggerSendHaptic } from "@/utils/chatSounds";
import { Ionicons } from "@expo/vector-icons";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  StyleProp,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ChatAudioRecorderProps {
  currentUserUUID: string;
  chatPartnerId: string;
  onOptimisticAudio: (msg: any) => void;
  onUploadSuccess: (msg: any, optimisticId: string) => void;
  onUploadError: (optimisticId: string) => void;
  /** Tells the parent to hide text input + action buttons while recording. */
  onRecordingStateChange?: (isRecording: boolean) => void;
  style?: StyleProp<ViewStyle>;
  /**
   * When true and idle, renders width/height 0 (invisible) so the component
   * stays mounted (preserving recording state) without taking up row space.
   */
  hidden?: boolean;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const NUM_BARS         = 26;
const BAR_MIN_H        = 3;
const BAR_MAX_H        = 28;
const CANCEL_THRESHOLD = -65;  // dx  < this → cancel zone
const LOCK_THRESHOLD   = -70;  // dy  < this → lock (finger goes up)
const PRIMARY          = "#094569";

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ChatAudioRecorder({
  currentUserUUID,
  chatPartnerId,
  onOptimisticAudio,
  onUploadSuccess,
  onUploadError,
  onRecordingStateChange,
  style,
  hidden = false,
}: ChatAudioRecorderProps) {

  // ── State ─────────────────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked,    setIsLocked]    = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cancelZone,  setCancelZone]  = useState(false);
  const [displaySecs, setDisplaySecs] = useState(0);

  // ── Refs (always-current values for PanResponder / interval closures) ─────────
  const isMountedRef   = useRef(true);
  const isRecordingRef = useRef(false);
  const isLockedRef    = useRef(false);
  const cancelZoneRef  = useRef(false);
  const secondsRef     = useRef(0);
  const amplitudeRef   = useRef(0);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Audio recorder ────────────────────────────────────────────────────────────
  const recorder      = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 80);

  // ── Animations ───────────────────────────────────────────────────────────────
  const pulseAnim      = useRef(new Animated.Value(1)).current;
  const slideAnim      = useRef(new Animated.Value(0)).current;
  const lockBadgeAnim  = useRef(new Animated.Value(0)).current;
  const cancelSlideAnim = useRef(new Animated.Value(0)).current;  // bounces the slide-to-cancel arrow
  const lockSlideAnim   = useRef(new Animated.Value(0)).current;  // bounces the lock icon upward
  const barAnims       = useRef(
    Array.from({ length: NUM_BARS }, () => new Animated.Value(BAR_MIN_H))
  ).current;

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      _clearTimer();
      try { void recorder.stop().catch(() => {}); } catch (_) {}
    };
  }, []);

  // ── Metering → amplitudeRef ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) return;
    const db = recorderState.metering ?? -60;
    amplitudeRef.current = Math.min(1, Math.max(0, (db + 60) / 60));
  }, [recorderState.metering, isRecording]);

  // ── Waveform animation loop ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording) {
      barAnims.forEach((b) =>
        Animated.spring(b, {
          toValue: BAR_MIN_H, useNativeDriver: false, speed: 20, bounciness: 0,
        }).start()
      );
      return;
    }
    const id = setInterval(() => {
      const amp = amplitudeRef.current;
      const t   = Date.now() / 260;
      barAnims.forEach((b, i) => {
        const phase = (i / NUM_BARS) * Math.PI * 2.6;
        const sine  = Math.sin(t + phase);
        const norm  = Math.max(0, amp * 0.7 + sine * amp * 0.38 + Math.random() * 0.1);
        const h     = BAR_MIN_H + norm * (BAR_MAX_H - BAR_MIN_H);
        Animated.spring(b, {
          toValue: Math.min(BAR_MAX_H, Math.max(BAR_MIN_H, h)),
          useNativeDriver: false, speed: 30, bounciness: 3,
        }).start();
      });
    }, 80);
    return () => clearInterval(id);
  }, [isRecording]);

  // ── Mic pulse while pressing ──────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording && !isLocked) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.18, duration: 540, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1.0,  duration: 540, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
  }, [isRecording, isLocked]);

  // ── Slide-in for recording bar ────────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isRecording ? 1 : 0,
      useNativeDriver: true, speed: 18, bounciness: 6,
    }).start();
  }, [isRecording]);

  // ── Lock badge tooltip ────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(lockBadgeAnim, {
      toValue: isRecording && !isLocked ? 1 : 0,
      useNativeDriver: true, speed: 22, bounciness: 10,
    }).start();
  }, [isRecording, isLocked]);
  // ── Slide-to-cancel bounce + lock-hint bounce ─────────────────────────────
  useEffect(() => {
    if (isRecording && !isLocked) {
      // Chevron slides left in a looping bounce to hint swipe direction
      Animated.loop(
        Animated.sequence([
          Animated.timing(cancelSlideAnim, { toValue: -7, duration: 500, useNativeDriver: true }),
          Animated.timing(cancelSlideAnim, { toValue:  0, duration: 500, useNativeDriver: true }),
        ])
      ).start();
      // Lock icon bounces upward to hint slide-up-to-lock
      Animated.loop(
        Animated.sequence([
          Animated.timing(lockSlideAnim, { toValue: -6, duration: 480, useNativeDriver: true }),
          Animated.timing(lockSlideAnim, { toValue:  0, duration: 480, useNativeDriver: true }),
        ])
      ).start();
    } else {
      cancelSlideAnim.stopAnimation();
      Animated.timing(cancelSlideAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start();
      lockSlideAnim.stopAnimation();
      Animated.timing(lockSlideAnim,   { toValue: 0, duration: 100, useNativeDriver: true }).start();
    }
  }, [isRecording, isLocked]);
  // ── Helpers ───────────────────────────────────────────────────────────────────
  const _clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const _setRec = (v: boolean) => {
    isRecordingRef.current = v;
    setIsRecording(v);
    onRecordingStateChange?.(v);
  };

  const _isActive = () => {
    try { return recorder.getStatus()?.isRecording ?? false; } catch (_) { return false; }
  };

  // ── Recording actions ─────────────────────────────────────────────────────────

  const startRecording = async () => {
    if (isRecordingRef.current) return;
    const perm = await requestRecordingPermissionsAsync();
    if (perm.status !== "granted") {
      Alert.alert("Microphone Access", "Please allow microphone access to send voice messages.");
      return;
    }
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      secondsRef.current = 0;
      if (isMountedRef.current) { setDisplaySecs(0); _setRec(true); }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      timerRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        secondsRef.current += 1;
        setDisplaySecs(secondsRef.current);
        if (secondsRef.current >= 300) void stopAndSend();
      }, 1000);
    } catch (err) {
      console.error("startRecording failed:", err);
      Alert.alert("Error", "Could not start recording. Please try again.");
    }
  };

  const stopAndSend = async () => {
    if (!isRecordingRef.current) return;
    _clearTimer();
    const dur = Math.max(1, secondsRef.current);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (isMountedRef.current) {
        _setRec(false);
        setIsLocked(false);     isLockedRef.current   = false;
        setCancelZone(false);   cancelZoneRef.current = false;
        setDisplaySecs(0);      secondsRef.current    = 0;
      }
      if (uri) { void triggerSendHaptic(); await uploadAudio(uri, dur); }
    } catch (err) {
      console.error("stopAndSend failed:", err);
      if (isMountedRef.current) { _setRec(false); setIsLocked(false); isLockedRef.current = false; }
    }
  };

  const cancelRecording = async () => {
    _clearTimer();
    try {
      if (_isActive()) await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (_) {}
    if (isMountedRef.current) {
      _setRec(false);
      setIsLocked(false);     isLockedRef.current   = false;
      setCancelZone(false);   cancelZoneRef.current = false;
      setDisplaySecs(0);      secondsRef.current    = 0;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const lockRecording = () => {
    if (isLockedRef.current) return;
    isLockedRef.current = true;
    setIsLocked(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── Upload ────────────────────────────────────────────────────────────────────

  const uploadAudio = async (uri: string, duration: number) => {
    if (isMountedRef.current) setIsUploading(true);
    const optId = `temp-${Date.now()}-${Math.random()}`;
    try {
      onOptimisticAudio({
        id: optId,
        sender_id: currentUserUUID,
        receiver_id: chatPartnerId,
        message_type: "audio",
        audio_url: uri,
        audio_duration: duration,
        content: null,
        created_at: new Date().toISOString(),
        is_read: false,
        isOptimistic: true,
      });

      const convKey  = [currentUserUUID, chatPartnerId].sort().join("_");
      const filePath = `${convKey}/${optId}_${Date.now()}.m4a`;

      const b64    = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const binary = atob(b64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const { error: upErr } = await supabase.storage
        .from("chat-audio")
        .upload(filePath, bytes.buffer, { contentType: "audio/m4a", upsert: true });
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from("chat-audio").getPublicUrl(filePath);

      const { data: msg, error: msgErr } = await supabase
        .from("messages")
        .insert([{
          sender_id: currentUserUUID,
          receiver_id: chatPartnerId,
          message_type: "audio",
          audio_url: publicUrl,
          audio_duration: duration,
          content: null,
          is_read: false,
        }])
        .select()
        .single();
      if (msgErr) throw msgErr;

      onUploadSuccess(msg, optId);
      void sendChatPushNotification({
        senderId: currentUserUUID,
        receiverId: chatPartnerId,
        messageType: "audio",
        messagePreview: "Voice message",
      });
    } catch (err) {
      console.error("uploadAudio failed:", err);
      onUploadError(optId);
    } finally {
      if (isMountedRef.current) setIsUploading(false);
    }
  };

  // ── PanResponder — placed on mic button, stays mounted during pressing ─────────
  // Using refs for all values read inside handlers so closures see current data.
  // Tracks when the finger first pressed down (for tap vs hold detection)
  const touchStartTimeRef = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isLockedRef.current,
      onMoveShouldSetPanResponder:  () => !isLockedRef.current,

      onPanResponderGrant: () => {
        touchStartTimeRef.current = Date.now();
        void startRecording();
      },

      onPanResponderMove: (_, gs) => {
        if (isLockedRef.current) return;
        const entered = gs.dx < CANCEL_THRESHOLD;
        if (entered !== cancelZoneRef.current) {
          cancelZoneRef.current = entered;
          setCancelZone(entered);
          void Haptics.selectionAsync();
        }
        if (gs.dy < LOCK_THRESHOLD) lockRecording();
      },

      onPanResponderRelease: (_, gs) => {
        if (isLockedRef.current) return;

        // ─ Tap detection: quick touch with near-zero movement → lock mode ─────────────
        const elapsed = Date.now() - touchStartTimeRef.current;
        const isTap = elapsed < 300 && Math.abs(gs.dx) < 12 && Math.abs(gs.dy) < 12;
        if (isTap) {
          // Start recording was already called on grant; now lock hands-free
          lockRecording();
          return;
        }

        if (gs.dx < CANCEL_THRESHOLD || cancelZoneRef.current) {
          void cancelRecording();
        } else {
          void stopAndSend();
        }
      },

      onPanResponderTerminate: () => {
        if (!isLockedRef.current) void cancelRecording();
      },
    })
  ).current;

  // ── Render ────────────────────────────────────────────────────────────────────

  // UPLOADING
  if (isUploading) {
    return (
      <View style={[{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }, style as any]}>
        <ActivityIndicator size="small" color={PRIMARY} />
      </View>
    );
  }

  // LOCKED — explicit cancel / send tap buttons
  if (isLocked) {
    return (
      <Animated.View
        style={[{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#f0f9ff",
          borderRadius: 22,
          paddingHorizontal: 8,
          paddingVertical: 4,
          opacity: slideAnim,
          transform: [{
            scale: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
          }],
        }, style as any]}
      >
        {/* Cancel */}
        <TouchableOpacity
          onPress={cancelRecording}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center", marginRight: 4 }}
        >
          <Ionicons name="close-circle" size={26} color="#ef4444" />
        </TouchableOpacity>

        {/* Waveform */}
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", height: 36, overflow: "hidden" }}>
          {barAnims.map((a, i) => (
            <Animated.View
              key={i}
              style={{ width: 2.5, marginHorizontal: 0.8, borderRadius: 2, backgroundColor: PRIMARY, height: a }}
            />
          ))}
        </View>

        {/* Timer */}
        <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 6 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#ef4444", marginRight: 4 }} />
          <Text style={{ color: "#dc2626", fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] }}>
            {fmt(displaySecs)}
          </Text>
        </View>

        {/* Send */}
        <TouchableOpacity
          onPress={stopAndSend}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: PRIMARY,
            alignItems: "center", justifyContent: "center",
            shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.35, shadowRadius: 4, elevation: 4,
          }}
        >
          <Ionicons name="send" size={16} color="white" />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // PRESSING — slide-to-cancel row, mic button with PanResponder on the right
  if (isRecording) {
    const accent    = cancelZone ? "#ef4444" : PRIMARY;
    const hintColor = cancelZone ? "#ef4444" : "#9ca3af";
    return (
      <Animated.View
        style={[{ flex: 1, flexDirection: "row", alignItems: "center", opacity: slideAnim }, style as any]}
      >
        {/* Slide-to-cancel hint — chevron bounces left as a gesture cue */}
        <Animated.View
          style={{
            flexDirection: "row", alignItems: "center", marginLeft: 6, marginRight: 4,
            transform: [{ translateX: cancelSlideAnim }],
          }}
        >
          <Ionicons name="chevron-back" size={13} color={hintColor} />
          <Text style={{ fontSize: 12, color: hintColor, marginLeft: 1 }} numberOfLines={1}>
            {cancelZone ? "Release to cancel" : "Slide to cancel"}
          </Text>
        </Animated.View>

        {/* Waveform */}
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", height: 36, overflow: "hidden" }}>
          {barAnims.map((a, i) => (
            <Animated.View
              key={i}
              style={{ width: 2.5, marginHorizontal: 0.8, borderRadius: 2, backgroundColor: accent, height: a }}
            />
          ))}
        </View>

        {/* Timer */}
        <Text style={{ fontSize: 13, fontWeight: "600", color: accent, fontVariant: ["tabular-nums"], marginHorizontal: 6 }}>
          {fmt(displaySecs)}
        </Text>

        {/* Mic button with panResponder + floating lock badge */}
        <View style={{ position: "relative" }}>
          {/* Lock hint — floats above mic, fades in then bounces upward as a gesture cue */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: "100%",
              left: 0,
              right: 0,
              alignItems: "center",
              marginBottom: 4,
              opacity: lockBadgeAnim,
              transform: [
                { translateY: lockBadgeAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
                { translateY: lockSlideAnim },  // secondary bounce upward
              ],
            }}
          >
            <View style={{
              backgroundColor: PRIMARY, borderRadius: 10,
              paddingHorizontal: 6, paddingVertical: 4,
              flexDirection: "row", alignItems: "center",
              shadowColor: PRIMARY, shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4, shadowRadius: 4, elevation: 3,
            }}>
              <Ionicons name="lock-closed" size={11} color="white" />
              <Text style={{ color: "white", fontSize: 9, marginLeft: 2, fontWeight: "700", letterSpacing: 0.5 }}>LOCK</Text>
            </View>
          </Animated.View>

          {/* Mic button — PanResponder is here, stays mounted during pressing */}
          <View
            {...panResponder.panHandlers}
            style={{
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: cancelZone ? "#fee2e2" : "#ffe4e6",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Ionicons name="mic" size={22} color={cancelZone ? "#b91c1c" : "#ef4444"} />
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    );
  }

  // IDLE — just the mic button
  return (
    <View
      {...panResponder.panHandlers}
      style={[
        hidden
          ? { width: 0, height: 0, overflow: 'hidden' }
          : { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
        style as any,
      ]}
    >
      {!hidden && <Ionicons name="mic-outline" size={22} color="#6b7280" />}
    </View>
  );
}
