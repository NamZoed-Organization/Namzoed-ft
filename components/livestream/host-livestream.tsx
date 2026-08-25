import { Ionicons } from "@expo/vector-icons";
import {
    LivestreamPlayer,
    StreamCall,
    useCall,
    useCallStateHooks,
} from "@stream-io/video-react-native-sdk";
import { Camera } from "expo-camera";
import React, { useCallback, useEffect, useState } from "react";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import {
    Linking,
    Modal,
    Pressable,
    Text,
    View,
} from "react-native";

type Props = {
  callId: string;
};

export function HostLivestreamScreen({ callId }: Props) {
  return (
    <StreamCall call={callId as unknown as any}>
      <HostLivestreamUI callId={callId} />
    </StreamCall>
  );
}

function HostLivestreamUI({ callId }: { callId: string }) {
  const call = useCall();
  const { useCameraState } = useCallStateHooks();
  const { camera, optimisticIsMute, direction } = useCameraState();

  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<{visible: boolean; title: string; message: string}>({visible: false, title: '', message: ''});
  const showPopup = (title: string, message: string) => setPopup({visible: true, title, message});

  const ensureCameraPermission = useCallback(async () => {
    const { status, canAskAgain } = await Camera.requestCameraPermissionsAsync();
    if (status === "granted") return true;

    // If permanently denied, skip the OS prompt and go straight to a settings alert
    if (!canAskAgain) {
      showPopup("Camera Blocked", "Camera access has been denied. Please enable it in your device settings.");
      return false;
    }

    showPopup("Camera Access Needed", "Please allow camera access to start the livestream.");
    return false;
  }, []);

  useEffect(() => {
    if (!call) return;
    call.join(); // host must join before going live
  }, [call]);

  const startLive = useCallback(async () => {
    if (!call || live || busy) return;
    setBusy(true);

    try {
      const cameraGranted = await ensureCameraPermission();
      if (!cameraGranted) return;
      await call.camera.enable();
      await call.microphone.enable();
      await call.goLive();
      setLive(true);
    } finally {
      setBusy(false);
    }
  }, [call, live, busy, ensureCameraPermission]);

  const endLive = useCallback(async () => {
    if (!call || busy) return;
    setBusy(true);

    try {
      await call.endCall();
    } finally {
      setBusy(false);
    }
  }, [call, busy]);

  if (!call) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <CircularLoader color="white" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <LivestreamPlayer callType="livestream" callId={callId} />

      {/* CUSTOM CONTROLS */}
      <View className="absolute bottom-10 left-0 right-0 flex-row justify-center gap-4">
        {live && (
          <Pressable
            onPress={async () => {
              if (optimisticIsMute) return;
              const cameraGranted = await ensureCameraPermission();
              if (!cameraGranted) return;
              try {
                await camera.flip();
              } catch (error) {
              }
            }}
            className={`px-4 py-2 rounded-xl ${
              optimisticIsMute ? "bg-gray-700" : "bg-gray-800"
            }`}
            disabled={optimisticIsMute}
          >
            <Ionicons
              name="camera-reverse"
              size={20}
              color={
                optimisticIsMute
                  ? "#9CA3AF"
                  : direction === "back"
                    ? "#ef4444"
                    : "#fff"
              }
            />
          </Pressable>
        )}
        {!live ? (
          <Pressable
            onPress={startLive}
            className="bg-red-600 px-4 py-2 rounded-xl"
          >
            <Text className="text-white font-bold">Go Live</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={endLive}
            className="bg-gray-800 px-4 py-2 rounded-xl"
          >
            <Text className="text-white font-bold">End</Text>
          </Pressable>
        )}
      </View>

      {busy && (
        <View className="absolute inset-0 bg-black/40 items-center justify-center">
          <CircularLoader color="white" />
        </View>
      )}
      <Modal visible={popup.visible} transparent animationType="none" statusBarTranslucent>
        <PopupMessage visible={popup.visible} type="warning" title={popup.title} message={popup.message} onHide={() => setPopup(p => ({...p, visible: false}))} />
      </Modal>
    </View>
  );
}
