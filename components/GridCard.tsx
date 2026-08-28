/**
 * GridCard
 *
 * Content-agnostic thumbnail tile for the 2-column masonry grid (see
 * MasonryGrid.tsx) — generalizes PostGridCard's layout (image, one-line
 * title, avatar/username + trailing badge footer) so products, marketplace
 * listings, and services can render in the same grid system posts already
 * use, each supplying only the fields relevant to it.
 */

import PostGridReportOverlay from "@/components/modals/PostGridReportOverlay";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { clampMediaRatio } from "@/lib/postMediaDisplay";
import { feedEvents } from "@/utils/feedEvents";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { useVideoPlayer, VideoView } from "expo-video";
import { Play } from "lucide-react-native";
import React from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/** Extra height added on top of the natural aspect ratio, for a taller card — matches PostGridCard. */
const EXTRA_IMAGE_HEIGHT = 18;

/** Height (in px) a card should render at for a given column width, given a raw width/height ratio. */
export function gridCardHeight(ratio: number, columnWidth: number): number {
  return columnWidth / clampMediaRatio(ratio) + EXTRA_IMAGE_HEIGHT;
}

export interface GridCardSourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Renders a video paused on its first frame — never calls .play(), so it acts as a thumbnail. */
function VideoFrameThumbnail({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.muted = true;
    p.loop = false;
  });
  return <VideoView player={player} style={{ width: "100%", height: "100%" }} nativeControls={false} contentFit="cover" />;
}

export interface GridCardProps {
  id: string;
  width: number;
  /** Raw media width/height ratio — height is derived via gridCardHeight. */
  ratio: number;
  imageUri?: string;
  blurhash?: string;
  isVideo?: boolean;
  title?: string;
  avatarUri?: string;
  /** Fallback initial shown when avatarUri is absent. */
  avatarLabel?: string;
  subtitle?: string;
  /** Right-aligned trailing content in the footer row — price, like count, etc. */
  footerRight?: React.ReactNode;
  /** Small overlay badge in the image's top-right corner (video icon by default when isVideo). */
  badge?: React.ReactNode;
  /** rect is the tapped thumbnail's own on-screen box, for hero-transition callers. */
  onPress: (id: string, rect: GridCardSourceRect) => void;
  /** When provided, enables hold-to-report — long-pressing the card shows a
   * "Report" overlay (same affordance as PostGridCard's), and tapping it
   * calls this with the card's id. The caller owns what "report" means
   * (e.g. opening its own report modal), keeping this card content-agnostic. */
  onReport?: (id: string) => void;
  /** True while this card is far enough off-screen that MasonryGrid hasn't
   * revealed it yet — renders a same-size placeholder instead of mounting
   * the real image/video, so a slow connection isn't spent downloading
   * content nowhere near the viewport. */
  deferred?: boolean;
  /** Forwarded to ProgressiveImage — cards on the first screen get "high"
   * so they win bandwidth contention over ones merely pre-revealed ahead
   * of scroll. */
  priority?: "low" | "normal" | "high";
}

function GridCard({
  id,
  width,
  ratio,
  imageUri,
  blurhash,
  isVideo,
  title,
  avatarUri,
  avatarLabel,
  subtitle,
  footerRight,
  badge,
  onPress,
  onReport,
  deferred,
  priority = "normal",
}: GridCardProps) {
  const imageRef = React.useRef<View>(null);
  const [showReportOverlay, setShowReportOverlay] = React.useState(false);

  // Only one grid card's report overlay should be open at a time — opening
  // one broadcasts its id so every other mounted card closes itself. Must
  // run unconditionally (before the `!imageUri` early return below) so the
  // hook order stays stable across renders.
  React.useEffect(() => {
    if (!onReport) return;
    const handler = (openedId: string) => {
      if (openedId !== id) setShowReportOverlay(false);
    };
    feedEvents.on("gridCardReportOverlayOpen", handler);
    return () => feedEvents.off("gridCardReportOverlayOpen", handler);
  }, [id, onReport]);

  if (!imageUri) return null;

  const imageHeight = gridCardHeight(ratio, width);

  const handlePress = () => {
    imageRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      onPress(id, { x, y, width: measuredWidth, height: measuredHeight });
    });
  };

  const handleLongPress = () => {
    if (!onReport) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    feedEvents.emit("gridCardReportOverlayOpen", id);
    setShowReportOverlay(true);
  };

  const handleReportFromOverlay = () => {
    setShowReportOverlay(false);
    onReport?.(id);
  };

  const showAvatarRow = !!(avatarUri || avatarLabel || subtitle);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={onReport ? handleLongPress : undefined}
      delayLongPress={350}
      disabled={deferred || showReportOverlay}
      activeOpacity={0.85}
      style={{
        width,
        marginBottom: 6,
        backgroundColor: "#F7F7F8",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <View
        ref={imageRef}
        collapsable={false}
        style={{
          width,
          height: imageHeight,
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
          overflow: "hidden",
          backgroundColor: "#f3f4f6",
        }}
      >
        {deferred ? null : isVideo ? (
          <VideoFrameThumbnail uri={imageUri} />
        ) : (
          <ProgressiveImage uri={imageUri} blurhash={blurhash} style={{ width: "100%", height: "100%" }} showProgress={false} recyclingKey={id} priority={priority} />
        )}
        {!deferred && isVideo && !badge && (
          <View
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              borderRadius: 12,
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "rgba(255,255,255,0.35)",
              backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(0,0,0,0.45)",
            }}
          >
            {Platform.OS === "ios" && <BlurView tint="dark" intensity={50} style={StyleSheet.absoluteFill} />}
            <Play size={12} color="#fff" fill="#fff" />
          </View>
        )}
        {!deferred && badge}
      </View>

      <View style={{ paddingHorizontal: 9, paddingBottom: 9 }}>
        {deferred ? null : title ? (
          <Text
            numberOfLines={3}
            style={{
              fontSize: 14,
              fontFamily: "Montserrat-Medium",
              fontWeight: "500",
              color: "#1f2937",
              marginTop: 9,
              lineHeight: 19,
            }}
          >
            {title}
          </Text>
        ) : null}

        {!deferred && (showAvatarRow || footerRight) && (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 9 }}>
            {showAvatarRow && (
              <>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    backgroundColor: "#D1D5DB",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={{ width: "100%", height: "100%" }} />
                  ) : (
                    <Text style={{ fontSize: 10, fontWeight: "600", color: "#6B7280" }}>{avatarLabel?.charAt(0) || "U"}</Text>
                  )}
                </View>
                <Text numberOfLines={1} style={{ fontSize: 13, color: "#6B7280", marginLeft: 6, flex: 1 }}>
                  {subtitle || "Unknown"}
                </Text>
              </>
            )}
            {!showAvatarRow && <View style={{ flex: 1 }} />}
            {footerRight}
          </View>
        )}
      </View>

      {onReport && (
        <PostGridReportOverlay
          visible={showReportOverlay}
          onClose={() => setShowReportOverlay(false)}
          onReport={handleReportFromOverlay}
        />
      )}
    </TouchableOpacity>
  );
}

export default React.memo(GridCard);
