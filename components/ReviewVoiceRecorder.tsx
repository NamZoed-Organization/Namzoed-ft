/**
 * ReviewVoiceRecorder
 *
 * Hold-to-talk voice note for the review composer — an exact fork of
 * components/comments/CommentVoiceRecorder.tsx (same dome/pill gesture UI,
 * animation, and hold/slide-to-cancel/lock behavior — itself a fork of
 * components/chat/WeChatVoiceRecorder.tsx; see that file for the geometry/
 * animation math, intentionally left untouched here rather than re-derived),
 * adapted only where it touches persistence: a review is composed as one
 * draft (rating + text + photos/videos + voice, all submitted together via
 * the composer's own Submit button), so releasing here STAGES the note via
 * onRecorded — it doesn't post anything itself the way CommentVoiceRecorder's
 * release does for a standalone comment.
 */

import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { supabase } from "@/lib/supabase";
import { uploadFileToSupabase } from "@/lib/uploadFile";
import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  PanResponder,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

type DragZone = "none" | "cancel" | "lock";

const PRIMARY = "#094569";
const PILL_TINT_IDLE = "rgba(107,114,128,0.42)";
const PILL_TINT_CANCEL = "#ef4444";
const PILL_TINT_LOCK = PRIMARY;
const PILL_HIT_TOLERANCE = 16;
const BAR_COUNT = 14;
const DOME_HEIGHT = 130;
const DOME_EXTRA = 140;
const DOME_TOTAL = DOME_HEIGHT + DOME_EXTRA;
const DOME_CURVE_DEPTH = DOME_HEIGHT * 0.5;
const DOME_PATH = `M0,${DOME_TOTAL} L0,${DOME_CURVE_DEPTH} Q50,${-DOME_CURVE_DEPTH} 100,${DOME_CURVE_DEPTH} L100,${DOME_TOTAL} Z`;
const PILL_GAP = 55;
const PILL_STROKE_WIDTH = 70;
const PILL_PAD = PILL_STROKE_WIDTH / 2 + 2;
const PILL_CENTER_GAP = PILL_STROKE_WIDTH / 2 + 10;
const PILL_ARC_FACTOR = 1.7;
const PILL_EDGE_OVERHANG = 250;
const PILL_CONTAINER_WIDTH_EXTRA = PILL_EDGE_OVERHANG + PILL_PAD * 2;
const WAVEFORM_PANEL_HEIGHT = 88;
const WAVEFORM_BAR_MAX_H = 48;
const WAVEFORM_BAR_MIN_SCALE = 0.12;
const WAVEFORM_FADE_COUNT = 3;
const WAVEFORM_SAMPLE_INTERVAL = 50;
const WAVEFORM_PANEL_BOTTOM = DOME_HEIGHT + PILL_GAP + 90;

const formatSecs = (secs: number) =>
  `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;

export interface RecordedReviewVoice {
  url: string;
  duration: number;
}

interface ReviewVoiceRecorderProps {
  productId: string;
  userId: string;
  onRecorded: (voice: RecordedReviewVoice) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
}

export default function ReviewVoiceRecorder({
  productId,
  userId,
  onRecorded,
  onRecordingStateChange,
}: ReviewVoiceRecorderProps) {
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const recorderState = useAudioRecorderState(recorder, WAVEFORM_SAMPLE_INTERVAL);
  const [contentWidth, setContentWidth] = useState(0);
  const pillReach = Math.max(0, contentWidth / 2 - PILL_CENTER_GAP);
  const domeEdgeAngleRad = useMemo(() => {
    if (contentWidth <= 0) return 0;
    const boxWidth = contentWidth + 200;
    const t = 100 / boxWidth;
    const edgeDrop = DOME_CURVE_DEPTH * (1 - 2 * t) ** 2;
    const run = contentWidth / 2;
    return Math.atan2(edgeDrop, run);
  }, [contentWidth]);
  const virtualHalfRun = pillReach + PILL_CENTER_GAP;
  const targetAngle = domeEdgeAngleRad * PILL_ARC_FACTOR;
  const edgeDrop = (virtualHalfRun * Math.tan(targetAngle)) / 2;
  const frac = virtualHalfRun > 0 ? pillReach / virtualHalfRun : 0;
  const controlDrop = edgeDrop * (1 - frac);
  const endDrop = edgeDrop * (1 - frac) ** 2;
  const overhangDrop =
    virtualHalfRun > 0 ? (2 * edgeDrop * PILL_EDGE_OVERHANG) / virtualHalfRun : 0;
  const pillContainerHeight = edgeDrop + overhangDrop + PILL_PAD * 2;
  const pillContainerBottom = DOME_HEIGHT + PILL_GAP - pillContainerHeight + PILL_PAD;
  const pillContainerWidth = pillReach + PILL_CONTAINER_WIDTH_EXTRA;
  const cancelPillPath = useMemo(() => {
    const edgeX = PILL_EDGE_OVERHANG + PILL_PAD;
    const controlX = edgeX + pillReach / 2;
    const endX = edgeX + pillReach;
    const edgeY = PILL_PAD + edgeDrop;
    const farY = edgeY + overhangDrop;
    return `M${PILL_PAD},${farY} L${edgeX},${edgeY} Q${controlX},${PILL_PAD + controlDrop} ${endX},${PILL_PAD + endDrop}`;
  }, [pillReach, edgeDrop, controlDrop, endDrop, overhangDrop]);
  const lockPillPath = useMemo(() => {
    const edgeX = pillContainerWidth - (PILL_EDGE_OVERHANG + PILL_PAD);
    const controlX = edgeX - pillReach / 2;
    const endX = edgeX - pillReach;
    const edgeY = PILL_PAD + edgeDrop;
    const farY = edgeY + overhangDrop;
    return `M${pillContainerWidth - PILL_PAD},${farY} L${edgeX},${edgeY} Q${controlX},${PILL_PAD + controlDrop} ${endX},${PILL_PAD + endDrop}`;
  }, [pillContainerWidth, pillReach, edgeDrop, controlDrop, endDrop, overhangDrop]);
  const cancelLabel = useMemo(() => {
    const edgeX = PILL_EDGE_OVERHANG + PILL_PAD;
    const controlX = edgeX + pillReach / 2;
    const endX = edgeX + pillReach;
    const edgeY = PILL_PAD + edgeDrop;
    const controlY = PILL_PAD + controlDrop;
    const endY = PILL_PAD + endDrop;
    return {
      x: 0.25 * edgeX + 0.5 * controlX + 0.25 * endX,
      y: 0.25 * edgeY + 0.5 * controlY + 0.25 * endY,
      angleDeg: (Math.atan2(endY - edgeY, endX - edgeX) * 180) / Math.PI,
    };
  }, [pillReach, edgeDrop, controlDrop, endDrop]);
  const lockLabel = useMemo(() => {
    const edgeX = pillContainerWidth - (PILL_EDGE_OVERHANG + PILL_PAD);
    const controlX = edgeX - pillReach / 2;
    const endX = edgeX - pillReach;
    const edgeY = PILL_PAD + edgeDrop;
    const controlY = PILL_PAD + controlDrop;
    const endY = PILL_PAD + endDrop;
    return {
      x: 0.25 * edgeX + 0.5 * controlX + 0.25 * endX,
      y: 0.25 * edgeY + 0.5 * controlY + 0.25 * endY,
      angleDeg: (Math.atan2(edgeY - endY, edgeX - endX) * 180) / Math.PI,
    };
  }, [pillContainerWidth, pillReach, edgeDrop, controlDrop, endDrop]);
  const LABEL_HALF_W = 40;
  const LABEL_HALF_H = 11;
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showRecordingUI, setShowRecordingUI] = useState(false);
  const [dragZone, setDragZone] = useState<DragZone>("none");
  const [displaySecs, setDisplaySecs] = useState(0);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "warning" | "error";
    title: string;
    message: string;
  }>({ visible: false, type: "warning", title: "", message: "" });

  const mountedRef = useRef(true);
  const recordingRef = useRef(false);
  const startingRef = useRef(false);
  const pendingEndRef = useRef<"send" | "cancel" | null>(null);
  const dragZoneRef = useRef<DragZone>("none");
  const lockedRef = useRef(false);
  const cancelZoneRef = useRef<{ right: number; top: number; bottom: number } | null>(null);
  const lockZoneRef = useRef<{ left: number; top: number; bottom: number } | null>(null);
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const cancelPillRef = useRef<View>(null);
  const lockPillRef = useRef<View>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const domeProgress = useRef(new Animated.Value(0)).current;
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(WAVEFORM_BAR_MIN_SCALE)),
  ).current;
  const levelHistoryRef = useRef<number[]>(Array(BAR_COUNT).fill(WAVEFORM_BAR_MIN_SCALE));
  const waveformEnvelope = useMemo(() => {
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const edgeDistance = Math.min(i, BAR_COUNT - 1 - i);
      if (edgeDistance >= WAVEFORM_FADE_COUNT) return 1;
      const t = (edgeDistance + 1) / (WAVEFORM_FADE_COUNT + 1);
      return t * (2 - t);
    });
  }, []);

  const setRecording = (next: boolean) => {
    recordingRef.current = next;
    setIsRecording(next);
    onRecordingStateChange?.(next);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const applyDragZone = (zone: DragZone) => {
    if (dragZoneRef.current === zone) return;
    dragZoneRef.current = zone;
    setDragZone(zone);
    void Haptics.selectionAsync();
  };

  const evaluateDragZone = (x: number, y: number) => {
    if (lockedRef.current) return;
    const cancelZone = cancelZoneRef.current;
    const lockZone = lockZoneRef.current;
    const inCancelZone =
      !!cancelZone &&
      x <= cancelZone.right &&
      y >= cancelZone.top - PILL_HIT_TOLERANCE &&
      y <= cancelZone.bottom + PILL_HIT_TOLERANCE;
    const inLockZone =
      !!lockZone &&
      x >= lockZone.left &&
      y >= lockZone.top - PILL_HIT_TOLERANCE &&
      y <= lockZone.bottom + PILL_HIT_TOLERANCE;
    if (inCancelZone) {
      applyDragZone("cancel");
    } else if (inLockZone) {
      lockedRef.current = true;
      applyDragZone("none");
      if (mountedRef.current) setIsLocked(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      applyDragZone("none");
    }
  };

  const resetInteraction = () => {
    startingRef.current = false;
    pendingEndRef.current = null;
    lockedRef.current = false;
    sendingRef.current = false;
    lastTouchRef.current = null;
    clearTimer();
    applyDragZone("none");
    if (mountedRef.current) {
      setRecording(false);
      setIsLocked(false);
      setDisplaySecs(0);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      try {
        void recorder.stop().catch(() => {});
      } catch {}
    };
  }, []);

  useEffect(() => {
    Animated.timing(panelOpacity, {
      toValue: isRecording && !isLocked ? 1 : 0,
      duration: 140,
      useNativeDriver: true,
    }).start();

    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.04,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 520,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulse.stopAnimation();
      Animated.timing(pulse, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [isRecording, isLocked]);

  useEffect(() => {
    if (isRecording) {
      setShowRecordingUI(true);
      Animated.timing(domeProgress, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(domeProgress, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShowRecordingUI(false);
      });
    }
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) {
      levelHistoryRef.current = Array(BAR_COUNT).fill(WAVEFORM_BAR_MIN_SCALE);
      barAnims.forEach((bar) =>
        Animated.timing(bar, {
          toValue: WAVEFORM_BAR_MIN_SCALE,
          duration: 120,
          useNativeDriver: true,
        }).start(),
      );
      return;
    }

    const db = recorderState.metering ?? -60;
    const amp = Math.min(1, Math.max(0, (db + 60) / 60));
    const scale = WAVEFORM_BAR_MIN_SCALE + Math.max(0.08, amp) * (1 - WAVEFORM_BAR_MIN_SCALE);
    const history = levelHistoryRef.current;
    history.shift();
    history.push(scale);
    history.forEach((s, i) => {
      const target =
        WAVEFORM_BAR_MIN_SCALE + (s - WAVEFORM_BAR_MIN_SCALE) * waveformEnvelope[i];
      Animated.timing(barAnims[i], {
        toValue: target,
        duration: WAVEFORM_SAMPLE_INTERVAL,
        useNativeDriver: true,
      }).start();
    });
  }, [barAnims, isRecording, recorderState.metering, waveformEnvelope]);

  const startRecording = async () => {
    if (recordingRef.current || startingRef.current || isUploading) return;
    startingRef.current = true;
    pendingEndRef.current = null;
    const permission = await requestRecordingPermissionsAsync();
    if (permission.status !== "granted") {
      resetInteraction();
      setPopup({
        visible: true,
        type: "warning",
        title: "Microphone Needed",
        message: "Please allow microphone access to record a voice note.",
      });
      return;
    }

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startingRef.current = false;
      if (mountedRef.current) {
        setDisplaySecs(0);
        applyDragZone("none");
        setRecording(true);
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      timerRef.current = setInterval(() => {
        const secs = Math.floor(recorder.currentTime);
        setDisplaySecs(secs);
        if (secs >= 300) void stopAndSave();
      }, 500);

      const pendingEnd = pendingEndRef.current;
      if (pendingEnd) {
        pendingEndRef.current = null;
        setTimeout(() => {
          if (pendingEnd === "cancel") {
            void cancelRecording();
          } else {
            void stopAndSave();
          }
        }, 120);
      }
    } catch {
      resetInteraction();
      setPopup({
        visible: true,
        type: "error",
        title: "Recording Failed",
        message: "Could not start recording. Please try again.",
      });
    }
  };

  const uploadAudio = async (uri: string, duration: number) => {
    setIsUploading(true);
    try {
      const filePath = `${productId}/${userId}/${Date.now()}.m4a`;
      await uploadFileToSupabase(uri, "review-audio", filePath, "audio/m4a", true);
      const { data: urlData } = supabase.storage.from("review-audio").getPublicUrl(filePath);
      onRecorded({ url: urlData.publicUrl, duration });
    } catch {
      setPopup({
        visible: true,
        type: "error",
        title: "Upload Error",
        message: "Could not save your voice note. Please try again.",
      });
    } finally {
      if (mountedRef.current) setIsUploading(false);
    }
  };

  const stopAndSave = async () => {
    if (startingRef.current) {
      pendingEndRef.current = "send";
      return;
    }
    if (sendingRef.current || !recordingRef.current) return;
    sendingRef.current = true;
    clearTimer();
    const duration = Math.max(1, Math.round(recorder.currentTime));
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (mountedRef.current) {
        setRecording(false);
        setIsLocked(false);
        applyDragZone("none");
        setDisplaySecs(0);
      }
      lockedRef.current = false;
      if (uri) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await uploadAudio(uri, duration);
      }
    } catch {
      resetInteraction();
    } finally {
      sendingRef.current = false;
    }
  };

  const cancelRecording = async () => {
    if (startingRef.current) {
      pendingEndRef.current = "cancel";
      applyDragZone("cancel");
      return;
    }
    clearTimer();
    sendingRef.current = false;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {}
    resetInteraction();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        void startRecording();
      },
      onPanResponderMove: (_, gesture) => {
        if (lockedRef.current) return;
        lastTouchRef.current = { x: gesture.moveX, y: gesture.moveY };
        evaluateDragZone(gesture.moveX, gesture.moveY);
      },
      onPanResponderRelease: () => {
        if (lockedRef.current) return;
        if (dragZoneRef.current === "cancel") {
          void cancelRecording();
        } else {
          void stopAndSave();
        }
      },
      onPanResponderTerminate: () => {
        if (lockedRef.current) return;
        void cancelRecording();
      },
    }),
  ).current;

  const hintText =
    dragZone === "cancel"
      ? "Release to cancel"
      : dragZone === "lock"
        ? "Slide to lock"
        : "Release to save";

  const holdToTalkOpacity = domeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const domeOpacity = domeProgress;
  const domeScale = domeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });
  const pillsOpacity = domeProgress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 0, 1],
  });
  const pillsScale = domeProgress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0.7, 0.7, 1],
  });

  return (
    <>
      <View
        style={{ flex: 1, position: "relative" }}
        onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            minHeight: 38,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: pulse }],
            opacity: holdToTalkOpacity,
          }}
        >
          {isUploading ? (
            <CircularLoader size="small" color={PRIMARY} />
          ) : (
            <Text style={{ color: "#111827", fontSize: 15, fontWeight: "700" }}>
              Hold to talk
            </Text>
          )}
        </Animated.View>

        {showRecordingUI && (
          <>
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                bottom: WAVEFORM_PANEL_BOTTOM,
                height: WAVEFORM_PANEL_HEIGHT,
                borderRadius: 24,
                borderWidth: 1.5,
                borderColor: "rgba(255,255,255,0.15)",
                backgroundColor: PRIMARY,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                opacity: domeOpacity,
                transform: [{ scale: domeScale }],
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  height: WAVEFORM_BAR_MAX_H,
                }}
              >
                {barAnims.map((bar, i) => (
                  <Animated.View
                    key={i}
                    style={{
                      width: 4,
                      height: WAVEFORM_BAR_MAX_H,
                      marginHorizontal: 1.6,
                      borderRadius: 4,
                      backgroundColor: dragZone === "cancel" ? "#fca5a5" : "#ffffff",
                      transform: [{ scaleY: bar }],
                    }}
                  />
                ))}
              </View>
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: -100,
                right: -100,
                bottom: -DOME_EXTRA,
                height: DOME_TOTAL,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 18,
                opacity: domeOpacity,
                transform: [{ scale: domeScale }],
              }}
            >
              <Svg
                width="100%"
                height={DOME_TOTAL}
                viewBox={`0 0 100 ${DOME_TOTAL}`}
                preserveAspectRatio="none"
              >
                <Path d={DOME_PATH} fill="#ffffff" />
              </Svg>
            </Animated.View>

            <Animated.View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                zIndex: 1,
                left: 0,
                right: 0,
                bottom: -DOME_EXTRA,
                height: DOME_HEIGHT + DOME_EXTRA,
                opacity: domeOpacity,
                transform: [{ scale: domeScale }],
              }}
            >
              <View
                pointerEvents="none"
                style={{ position: "absolute", top: 22, left: 0, right: 0, alignItems: "center" }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: "#374151",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatSecs(displaySecs)}
                </Text>
              </View>

              {!isLocked && (
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 46,
                    left: 0,
                    right: 0,
                    alignItems: "center",
                    opacity: panelOpacity,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: dragZone === "cancel" ? "#dc2626" : "#111827",
                    }}
                  >
                    {hintText}
                  </Text>
                </Animated.View>
              )}
            </Animated.View>

            <Animated.View
              ref={cancelPillRef}
              pointerEvents="box-none"
              onLayout={() => {
                cancelPillRef.current?.measureInWindow((x, y, width, height) => {
                  cancelZoneRef.current = { right: x + width, top: y, bottom: y + height };
                  if (lastTouchRef.current) {
                    evaluateDragZone(lastTouchRef.current.x, lastTouchRef.current.y);
                  }
                });
              }}
              style={{
                position: "absolute",
                left: -(PILL_EDGE_OVERHANG + PILL_PAD),
                bottom: pillContainerBottom,
                width: pillContainerWidth,
                height: pillContainerHeight,
                opacity: pillsOpacity,
                transform: [{ scale: pillsScale }],
              }}
            >
              <MaskedView
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: pillContainerWidth,
                  height: pillContainerHeight,
                }}
                maskElement={
                  <Svg width={pillContainerWidth} height={pillContainerHeight}>
                    <Path
                      d={cancelPillPath}
                      stroke="#000000"
                      strokeWidth={PILL_STROKE_WIDTH}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                }
              >
                <BlurView intensity={20} tint="dark" style={{ width: "100%", height: "100%" }} />
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor:
                      !isLocked && dragZone === "cancel" ? PILL_TINT_CANCEL : PILL_TINT_IDLE,
                  }}
                />
              </MaskedView>
              {isLocked && (
                <TouchableOpacity
                  onPress={() => void cancelRecording()}
                  style={{
                    position: "absolute",
                    left: PILL_EDGE_OVERHANG,
                    top: 0,
                    right: 0,
                    bottom: 0,
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                />
              )}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: cancelLabel.x - LABEL_HALF_W,
                  top: cancelLabel.y - LABEL_HALF_H,
                  width: LABEL_HALF_W * 2,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ rotate: `${cancelLabel.angleDeg}deg` }],
                }}
              >
                <Ionicons name="trash-outline" size={16} color="#ffffff" />
                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#ffffff",
                  }}
                >
                  Cancel
                </Text>
              </View>
            </Animated.View>

            <Animated.View
              ref={lockPillRef}
              pointerEvents="box-none"
              onLayout={() => {
                lockPillRef.current?.measureInWindow((x, y, width, height) => {
                  lockZoneRef.current = { left: x, top: y, bottom: y + height };
                  if (lastTouchRef.current) {
                    evaluateDragZone(lastTouchRef.current.x, lastTouchRef.current.y);
                  }
                });
              }}
              style={{
                position: "absolute",
                right: -(PILL_EDGE_OVERHANG + PILL_PAD),
                bottom: pillContainerBottom,
                width: pillContainerWidth,
                height: pillContainerHeight,
                opacity: pillsOpacity,
                transform: [{ scale: pillsScale }],
              }}
            >
              <MaskedView
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: pillContainerWidth,
                  height: pillContainerHeight,
                }}
                maskElement={
                  <Svg width={pillContainerWidth} height={pillContainerHeight}>
                    <Path
                      d={lockPillPath}
                      stroke="#000000"
                      strokeWidth={PILL_STROKE_WIDTH}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                }
              >
                <BlurView intensity={20} tint="dark" style={{ width: "100%", height: "100%" }} />
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor:
                      isLocked || dragZone === "lock" ? PILL_TINT_LOCK : PILL_TINT_IDLE,
                  }}
                />
              </MaskedView>
              {isLocked && (
                <TouchableOpacity
                  onPress={() => void stopAndSave()}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    right: PILL_EDGE_OVERHANG,
                    bottom: 0,
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                />
              )}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: lockLabel.x - LABEL_HALF_W,
                  top: lockLabel.y - LABEL_HALF_H,
                  width: LABEL_HALF_W * 2,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ rotate: `${lockLabel.angleDeg}deg` }],
                }}
              >
                {isLocked ? (
                  <>
                    <Ionicons name="checkmark" size={15} color="#ffffff" />
                    <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: "700", color: "#ffffff" }}>
                      Done
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="lock-closed-outline" size={16} color="#ffffff" />
                    <Text
                      style={{
                        marginLeft: 6,
                        fontSize: 12,
                        fontWeight: "700",
                        color: "#ffffff",
                      }}
                    >
                      Lock
                    </Text>
                  </>
                )}
              </View>
            </Animated.View>
          </>
        )}
      </View>

      <Modal visible={popup.visible} transparent animationType="none">
        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup((p) => ({ ...p, visible: false }))}
        />
      </Modal>
    </>
  );
}
