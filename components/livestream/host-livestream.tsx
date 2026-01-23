import {
  LivestreamPlayer,
  StreamCall,
  useCall,
} from "@stream-io/video-react-native-sdk";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

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

  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!call) return;
    call.join(); // host must join before going live
  }, [call]);

  const startLive = useCallback(async () => {
    if (!call || live || busy) return;
    setBusy(true);

    try {
      await call.camera.enable();
      await call.microphone.enable();
      await call.goLive();
      setLive(true);
    } finally {
      setBusy(false);
    }
  }, [call, live, busy]);

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
        <ActivityIndicator color="white" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <LivestreamPlayer callType="livestream" callId={callId} />

      {/* CUSTOM CONTROLS */}
      <View className="absolute bottom-10 left-0 right-0 flex-row justify-center gap-4">
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
          <ActivityIndicator color="white" />
        </View>
      )}
    </View>
  );
}
