import PopupMessage from "@/components/ui/PopupMessage";
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
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Text,
  View,
} from "react-native";

type WeChatVoiceRecorderProps = {
  currentUserUUID: string;
  chatPartnerId: string;
  onOptimisticAudio: (msg: any) => void;
  onUploadSuccess: (msg: any, optimisticId: string) => void;
  onUploadError: (optimisticId: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
};

const PRIMARY = "#094569";
const CANCEL_Y = -72;
const BAR_COUNT = 29;
const MIN_H = 5;
const MAX_H = 34;

const formatSecs = (secs: number) =>
  `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;

export default function WeChatVoiceRecorder({
  currentUserUUID,
  chatPartnerId,
  onOptimisticAudio,
  onUploadSuccess,
  onUploadError,
  onRecordingStateChange,
}: WeChatVoiceRecorderProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 80);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCancelZone, setIsCancelZone] = useState(false);
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
  const cancelRef = useRef(false);
  const amplitudeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(MIN_H)),
  ).current;

  const parabolaWeights = useMemo(() => {
    const center = (BAR_COUNT - 1) / 2;
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const distance = Math.abs(i - center) / center;
      return 1 - distance * distance;
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

  const resetInteraction = () => {
    startingRef.current = false;
    pendingEndRef.current = null;
    cancelRef.current = false;
    sendingRef.current = false;
    clearTimer();
    if (mountedRef.current) {
      setRecording(false);
      setIsCancelZone(false);
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
    if (!isRecording) return;
    const db = recorderState.metering ?? -60;
    amplitudeRef.current = Math.min(1, Math.max(0, (db + 60) / 60));
  }, [isRecording, recorderState.metering]);

  useEffect(() => {
    Animated.timing(panelOpacity, {
      toValue: isRecording ? 1 : 0,
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
  }, [isRecording]);

  useEffect(() => {
    if (!isRecording) {
      barAnims.forEach((bar) =>
        Animated.spring(bar, {
          toValue: MIN_H,
          useNativeDriver: false,
          speed: 22,
          bounciness: 0,
        }).start(),
      );
      return;
    }

    const id = setInterval(() => {
      const amp = Math.max(0.08, amplitudeRef.current);
      const t = Date.now() / 220;
      barAnims.forEach((bar, i) => {
        const wave = (Math.sin(t + i * 0.58) + 1) / 2;
        const shaped = parabolaWeights[i] * (0.55 + wave * 0.45);
        const height = MIN_H + amp * shaped * (MAX_H - MIN_H);
        Animated.spring(bar, {
          toValue: Math.max(MIN_H, Math.min(MAX_H, height)),
          useNativeDriver: false,
          speed: 32,
          bounciness: 4,
        }).start();
      });
    }, 70);

    return () => clearInterval(id);
  }, [barAnims, isRecording, parabolaWeights]);

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
        message: "Please allow microphone access to send voice messages.",
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
        setIsCancelZone(false);
        cancelRef.current = false;
        setRecording(true);
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      timerRef.current = setInterval(() => {
        const secs = Math.floor(recorder.currentTime);
        setDisplaySecs(secs);
        if (secs >= 300) void stopAndSend();
      }, 500);

      const pendingEnd = pendingEndRef.current;
      if (pendingEnd) {
        pendingEndRef.current = null;
        setTimeout(() => {
          if (pendingEnd === "cancel") {
            void cancelRecording();
          } else {
            void stopAndSend();
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
    const optimisticId = `temp-${Date.now()}-${Math.random()}`;
    try {
      onOptimisticAudio({
        id: optimisticId,
        sender_id: currentUserUUID,
        receiver_id: chatPartnerId,
        message_type: "audio",
        audio_url: uri,
        audio_duration: duration,
        content: null,
        created_at: new Date().toISOString(),
        is_read: false,
        isOptimistic: true,
        localStatus: "sending",
      });

      const conversationKey = [currentUserUUID, chatPartnerId].sort().join("_");
      const filePath = `${conversationKey}/${optimisticId}_${Date.now()}.m4a`;
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const { error: uploadError } = await supabase.storage
        .from("chat-audio")
        .upload(filePath, bytes.buffer, {
          contentType: "audio/m4a",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("chat-audio").getPublicUrl(filePath);

      const { data: msg, error: msgError } = await supabase
        .from("messages")
        .insert([
          {
            sender_id: currentUserUUID,
            receiver_id: chatPartnerId,
            message_type: "audio",
            audio_url: publicUrl,
            audio_duration: duration,
            content: null,
            is_read: false,
          },
        ])
        .select()
        .single();
      if (msgError) throw msgError;

      onUploadSuccess(msg, optimisticId);
      void sendChatPushNotification({
        senderId: currentUserUUID,
        receiverId: chatPartnerId,
        messageType: "audio",
        messagePreview: "Voice message",
      });
    } catch {
      onUploadError(optimisticId);
    } finally {
      if (mountedRef.current) setIsUploading(false);
    }
  };

  const stopAndSend = async () => {
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
        setIsCancelZone(false);
        setDisplaySecs(0);
      }
      if (uri) {
        void triggerSendHaptic();
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
      setIsCancelZone(true);
      cancelRef.current = true;
      return;
    }
    clearTimer();
    sendingRef.current = false;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {}
    resetInteraction();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        const nextCancel = gesture.dy < CANCEL_Y;
        if (nextCancel !== cancelRef.current) {
          cancelRef.current = nextCancel;
          setIsCancelZone(nextCancel);
          void Haptics.selectionAsync();
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < CANCEL_Y || cancelRef.current) {
          void cancelRecording();
        } else {
          void stopAndSend();
        }
      },
      onPanResponderTerminate: () => {
        void cancelRecording();
      },
    }),
  ).current;

  return (
    <>
      <View style={{ flex: 1, position: "relative" }}>
        {isRecording ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 48,
              alignItems: "center",
              opacity: panelOpacity,
            }}
          >
            <View
              style={{
                borderRadius: 24,
                backgroundColor: "rgba(17,24,39,0.88)",
                paddingHorizontal: 18,
                paddingTop: 14,
                paddingBottom: 12,
                minWidth: 238,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: isCancelZone ? "#ef4444" : PRIMARY,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                <Ionicons
                  name={isCancelZone ? "trash-outline" : "mic"}
                  size={22}
                  color="white"
                />
              </View>
              <View
                style={{
                  height: 42,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {barAnims.map((bar, i) => (
                  <Animated.View
                    key={i}
                    style={{
                      width: 3,
                      marginHorizontal: 1.4,
                      borderRadius: 3,
                      height: bar,
                      backgroundColor: isCancelZone ? "#fecaca" : "#bfdbfe",
                      transform: [
                        {
                          translateY: -Math.sin(
                            (i / (BAR_COUNT - 1)) * Math.PI,
                          ) * 8,
                        },
                      ],
                    }}
                  />
                ))}
              </View>
              <Text
                style={{
                  color: isCancelZone ? "#fecaca" : "white",
                  fontSize: 12,
                  fontWeight: "700",
                  marginTop: 8,
                }}
              >
                {isCancelZone ? "Release to cancel" : "Release to send"}
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.72)",
                  fontSize: 11,
                  marginTop: 3,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatSecs(displaySecs)}
              </Text>
            </View>
            <View
              style={{
                marginTop: 8,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: isCancelZone ? "#fee2e2" : "#eff6ff",
              }}
            >
              <Text
                style={{
                  color: isCancelZone ? "#dc2626" : PRIMARY,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {isCancelZone ? "Cancel voice message" : "Drag up to cancel"}
              </Text>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View
          {...panResponder.panHandlers}
          style={{
            minHeight: 38,
            borderRadius: 20,
            backgroundColor: isRecording
              ? isCancelZone
                ? "#fee2e2"
                : "#e0f2fe"
              : "#ffffff",
            borderWidth: 1,
            borderColor: isRecording
              ? isCancelZone
                ? "#fecaca"
                : "#bae6fd"
              : "#e5e7eb",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 12,
            transform: [{ scale: pulse }],
          }}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={PRIMARY} />
          ) : (
            <Text
              style={{
                color: isCancelZone ? "#dc2626" : "#111827",
                fontSize: 15,
                fontWeight: "700",
              }}
            >
              {isRecording ? "Listening..." : "Hold to talk"}
            </Text>
          )}
        </Animated.View>
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
