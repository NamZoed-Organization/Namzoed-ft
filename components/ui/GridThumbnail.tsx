/**
 * GridThumbnail
 *
 * The media inside a grid tile — the one place a tile decides what to
 * download, so every grid spends the same, small amount of data:
 *
 * - A photo is requested at the tile's width (`toSizedImageUrl`), never the
 *   original upload.
 * - A video shows its poster, a still uploaded next to it by `uploadVideo`
 *   (lib/postsService.ts). No player is created, so no video is downloaded.
 * - A video with no poster (posted before posters existed, until
 *   scripts/backfill-video-posters.mjs has run for it) falls back to a paused
 *   player on its first frame. That still works, but it downloads video data,
 *   which is why the backfill exists.
 */

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { toVideoPosterUrl } from "@/lib/imagePreview";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useState } from "react";

/** Renders a video paused on its first frame — never calls .play(). */
function VideoFrameThumbnail({ uri }: { uri: string }) {
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

export interface GridThumbnailProps {
  /** The photo, or the video file itself — its poster is derived from it. */
  uri: string;
  isVideo?: boolean;
  /** Width (pt) the tile is drawn at; picks the size requested. */
  width: number;
  blurhash?: string | null;
  recyclingKey?: string;
  priority?: "low" | "normal" | "high";
  /** Forwarded to ProgressiveImage; the hero passes 0. */
  transition?: number;
}

export default function GridThumbnail({
  uri,
  isVideo,
  width,
  blurhash,
  recyclingKey,
  priority,
  transition,
}: GridThumbnailProps) {
  const posterUri = isVideo ? toVideoPosterUrl(uri) : undefined;
  const [missingPosterUri, setMissingPosterUri] = useState<string | null>(null);

  if (isVideo && (!posterUri || missingPosterUri === posterUri)) {
    return <VideoFrameThumbnail uri={uri} />;
  }

  return (
    <ProgressiveImage
      uri={posterUri ?? uri}
      displayWidth={width}
      blurhash={blurhash}
      style={{ width: "100%", height: "100%" }}
      showProgress={false}
      recyclingKey={recyclingKey}
      priority={priority}
      transition={transition}
      onError={posterUri ? () => setMissingPosterUri(posterUri) : undefined}
    />
  );
}
