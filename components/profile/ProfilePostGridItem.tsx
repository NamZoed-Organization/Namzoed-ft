import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { useVideoPlayer, VideoView } from "expo-video";
import { Copy, Play } from "lucide-react-native";
import React from "react";
import { TouchableOpacity, View } from "react-native";

/** Fixed 3-column profile grid cell (matches previous `aspect-[9/12]` layout). */
const CELL_ASPECT = 9 / 12;
export const PROFILE_GRID_COLUMNS = 3;
/** Cell height for a given full-row (container) width — used by callers to
 * compute each cell's cumulative top offset for viewport-reveal gating. */
export function profileGridCellHeight(containerWidth: number): number {
  return containerWidth / PROFILE_GRID_COLUMNS / CELL_ASPECT;
}

function VideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
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
  thumbnailBlurHash?: string | null;
  isVideo: boolean;
  mediaCount: number;
  onPress: () => void;
  /** True while this cell is far enough off-screen that the caller hasn't
   * revealed it yet — renders a same-size placeholder instead of mounting
   * the real image/video, so scrolling a long post grid doesn't fire a
   * network request (or spin up a video player) for every post at once. */
  deferred?: boolean;
  priority?: "low" | "normal" | "high";
};

export default function ProfilePostGridItem({
  thumbnailUrl,
  thumbnailBlurHash,
  isVideo,
  mediaCount,
  onPress,
  deferred,
  priority = "normal",
}: ProfilePostGridItemProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      disabled={deferred}
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
        {deferred ? null : isVideo ? (
          <VideoThumb uri={thumbnailUrl} />
        ) : (
          <ProgressiveImage
            uri={thumbnailUrl}
            blurhash={thumbnailBlurHash}
            style={{ width: "100%", height: "100%" }}
            showProgress={false}
            recyclingKey={thumbnailUrl}
            priority={priority}
          />
        )}
        {!deferred && mediaCount > 1 && (
          <View className="absolute top-1.5 right-1.5" pointerEvents="none">
            <Copy size={14} color="#fff" strokeWidth={2} />
          </View>
        )}
        {!deferred && isVideo && mediaCount <= 1 && (
          <View className="absolute top-1.5 right-1.5" pointerEvents="none">
            <Play size={14} color="#fff" strokeWidth={1.5} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
