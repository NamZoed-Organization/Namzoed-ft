import CircularLoader from "@/components/ui/CircularLoader";
import {
  LivestreamPlayer,
  StreamCall,
  useCall,
} from "@stream-io/video-react-native-sdk";
import React, { useEffect } from "react";
import { View } from "react-native";

type Props = {
  callId: string;
};

export function ViewerLivestreamScreen({ callId }: Props) {
  return (
    <StreamCall call={callId as unknown as any}>
      <ViewerLivestreamUI callId={callId} />
    </StreamCall>
  );
}

function ViewerLivestreamUI({ callId }: { callId: string }) {
  const call = useCall();

  useEffect(() => {
    if (!call) return;
    call.join(); // viewer only joins
  }, [call]);

  if (!call) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <CircularLoader color="white" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <LivestreamPlayer callType="livestream" callId={callId} />

      {/* CUSTOM OVERLAYS */}
      {/* chat, reactions, viewer count, whatever you want */}
    </View>
  );
}
