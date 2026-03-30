import { useVideoPlayer, VideoView } from "expo-video";
import { Copy, Play } from "lucide-react-native";
import React from "react";
import { Image, TouchableOpacity, View } from "react-native";

/** Fixed 3-column profile grid cell (matches previous `aspect-[9/12]` layout). */
const CELL_ASPECT = 9 / 12;

function VideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = false;
  });
  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "100%" }}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

export type ProfilePostGridItemProps = {
  thumbnailUrl: string;
  isVideo: boolean;
  mediaCount: number;
  onPress: () => void;
};

export default function ProfilePostGridItem({
  thumbnailUrl,
  isVideo,
  mediaCount,
  onPress,
}: ProfilePostGridItemProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={{
        width: "33.3333%",
        aspectRatio: CELL_ASPECT,
        padding: 1,
      }}
    >
      <View
        className="flex-1 bg-gray-100 overflow-hidden relative"
        style={{ backgroundColor: "#f3f4f6" }}
      >
        {isVideo ? (
          <VideoThumb uri={thumbnailUrl} />
        ) : (
          <Image
            source={{ uri: thumbnailUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        )}
        {mediaCount > 1 && (
          <View className="absolute top-1.5 right-1.5" pointerEvents="none">
            <Copy size={14} color="#fff" strokeWidth={2} />
          </View>
        )}
        {isVideo && mediaCount <= 1 && (
          <View className="absolute top-1.5 right-1.5" pointerEvents="none">
            <Play size={14} color="#fff" strokeWidth={1.5} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
