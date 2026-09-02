/**
 * PostGridCard
 *
 * Single thumbnail card for the RedNote/Xiaohongshu-style 2-column feed grid
 * on the Home "For You" tab (see components/FeedGrid.tsx). Not a scaled-down
 * FeedPost — this only renders what a grid tile needs: thumbnail, a one-line
 * caption, and a small avatar/username + like-count footer.
 */

import PostGridReportOverlay from "@/components/modals/PostGridReportOverlay";
import ReportPostModal from "@/components/modals/ReportPostModal";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { useUser } from "@/contexts/UserContext";
import { hasUserLikedPost, togglePostLike } from "@/lib/likesService";
import {
  clampMediaRatio,
  ratioForUniformMode,
} from "@/lib/postMediaDisplay";
import { playSound } from "@/lib/soundUtils";
import { PostData } from "@/types/post";
import { feedEvents } from "@/utils/feedEvents";
import * as Haptics from "expo-haptics";
import { BlurView } from "expo-blur";
import { useVideoPlayer, VideoView } from "expo-video";
import { Heart, Play } from "lucide-react-native";
import React from "react";
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".mp4") ||
    lower.endsWith(".mov") ||
    lower.endsWith(".m4v") ||
    lower.includes("post-videos")
  );
}

/** Renders a video paused on its first frame — never calls .play(), so it acts as a thumbnail. */
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

/** Extra height added on top of the post's natural aspect ratio, for a taller card. */
const EXTRA_IMAGE_HEIGHT = 18;

/** Height (in px) a card should render at for a given column width. */
export function gridCardImageHeight(post: PostData, columnWidth: number): number {
  const ratio =
    post.mediaDisplay?.ratios?.[0] ??
    ratioForUniformMode(post.mediaDisplay?.mode ?? "portrait");
  return columnWidth / clampMediaRatio(ratio) + EXTRA_IMAGE_HEIGHT;
}

export interface PostGridCardSourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PostGridCardProps {
  post: PostData;
  width: number;
  /** rect is the tapped thumbnail's own on-screen box — the hero transition grows from it. */
  onPress: (postId: string, rect: PostGridCardSourceRect) => void;
  /** True while this card is far enough off-screen that FeedGrid hasn't
   * revealed it yet — renders a same-size placeholder instead of mounting
   * the real image/video, so a slow connection isn't spent downloading
   * content nowhere near the viewport. */
  deferred?: boolean;
  /** Forwarded to ProgressiveImage — cards on the first screen get "high"
   * so they win bandwidth contention over ones merely pre-revealed ahead
   * of scroll. */
  priority?: "low" | "normal" | "high";
}

function PostGridCard({ post, width, onPress, deferred, priority = "normal" }: PostGridCardProps) {
  const { currentUser } = useUser();
  const firstImage = post.images?.[0];
  const imageRef = React.useRef<View>(null);
  const [showReportOverlay, setShowReportOverlay] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [isLiked, setIsLiked] = React.useState(false);
  const [likesCount, setLikesCount] = React.useState(post.likes);

  // Only one grid card's report overlay should be open at a time — opening
  // one broadcasts its post id so every other mounted card closes itself.
  React.useEffect(() => {
    const handler = (openedPostId: string) => {
      if (openedPostId !== post.id) setShowReportOverlay(false);
    };
    feedEvents.on("postGridOverlayOpen", handler);
    return () => feedEvents.off("postGridOverlayOpen", handler);
  }, [post.id]);

  React.useEffect(() => {
    setLikesCount(post.likes);
  }, [post.likes]);

  // Skip the like-status lookup while the card isn't revealed yet — matches
  // the "deferred" gate that already skips image/video work off-screen.
  React.useEffect(() => {
    if (deferred || !currentUser?.id) return;
    let cancelled = false;
    hasUserLikedPost(post.id, currentUser.id).then((liked) => {
      if (!cancelled) setIsLiked(liked);
    });
    return () => {
      cancelled = true;
    };
  }, [deferred, currentUser?.id, post.id]);

  const handleLike = async () => {
    if (!currentUser?.id) return;

    const previousLiked = isLiked;
    const previousCount = likesCount;
    if (!isLiked) void playSound("like");
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

    try {
      const result = await togglePostLike(post.id, currentUser.id, isLiked);
      if (!result.success) {
        setIsLiked(previousLiked);
        setLikesCount(previousCount);
      } else {
        setIsLiked(result.isLiked);
        setLikesCount(result.likeCount);
      }
    } catch {
      setIsLiked(previousLiked);
      setLikesCount(previousCount);
    }
  };

  if (!firstImage) return null;

  const imageHeight = gridCardImageHeight(post, width);
  const isVideo = isVideoUrl(firstImage);

  const handlePress = () => {
    imageRef.current?.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      onPress(post.id, { x, y, width: measuredWidth, height: measuredHeight });
    });
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    feedEvents.emit("postGridOverlayOpen", post.id);
    setShowReportOverlay(true);
  };

  const handleReportFromOverlay = () => {
    setShowReportOverlay(false);
    setShowReportModal(true);
  };

  return (
    <>
    <TouchableOpacity
      onPress={handlePress}
      onLongPress={handleLongPress}
      delayLongPress={350}
      disabled={showReportOverlay || deferred}
      activeOpacity={0.85}
      style={{
        width,
        // Matches FeedGrid's GRID_GAP so the vertical gap between stacked
        // cards equals the horizontal gap between the two columns.
        marginBottom: 4,
        backgroundColor: "#F7F7F8",
        borderRadius: 4,
        borderCurve: "continuous",
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
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderCurve: "continuous",
          overflow: "hidden",
          backgroundColor: "#f3f4f6",
        }}
      >
        {deferred ? null : isVideo ? (
          <VideoFrameThumbnail uri={firstImage} />
        ) : (
          <ProgressiveImage
            uri={firstImage}
            blurhash={post.blurHashes?.[0]}
            style={{ width: "100%", height: "100%" }}
            showProgress={false}
            recyclingKey={post.id}
            priority={priority}
          />
        )}
        {!deferred && isVideo && (
          <View
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              borderRadius: 12,
              borderCurve: "continuous",
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: "rgba(255,255,255,0.35)",
              backgroundColor:
                Platform.OS === "ios" ? "transparent" : "rgba(0,0,0,0.45)",
            }}
          >
            {Platform.OS === "ios" && (
              <BlurView
                tint="dark"
                intensity={50}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Play size={12} color="#fff" fill="#fff" />
          </View>
        )}
      </View>

      <View style={{ paddingHorizontal: 9, paddingBottom: 9 }}>
        {deferred ? null : post.content ? (
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
            {post.content}
          </Text>
        ) : null}

        {!deferred && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 9,
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderCurve: "continuous",
                backgroundColor: "#D1D5DB",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {post.profilePic ? (
                <Image
                  source={{ uri: post.profilePic }}
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <Text style={{ fontSize: 10, fontWeight: "600", color: "#6B7280" }}>
                  {post.username?.charAt(0) || "U"}
                </Text>
              )}
            </View>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 13,
                color: "#6B7280",
                marginLeft: 6,
                flex: 1,
              }}
            >
              {post.username || "Unknown"}
            </Text>
            <TouchableOpacity
              onPress={handleLike}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ flexDirection: "row", alignItems: "center" }}
            >
              <Heart
                size={15}
                color={isLiked ? "#e91e63" : "#9CA3AF"}
                fill={isLiked ? "#e91e63" : "none"}
              />
              <Text
                style={{
                  fontSize: 13,
                  color: isLiked ? "#e91e63" : "#9CA3AF",
                  marginLeft: 3,
                }}
              >
                {likesCount}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <PostGridReportOverlay
        visible={showReportOverlay}
        onClose={() => setShowReportOverlay(false)}
        onReport={handleReportFromOverlay}
      />
    </TouchableOpacity>
    {showReportModal && currentUser?.id && post.userId && (
      <ReportPostModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        postId={post.id}
        postContent={post.content || ""}
        postOwnerId={post.userId}
        currentUserId={currentUser.id}
        onReportSuccess={() => setShowReportModal(false)}
      />
    )}
    </>
  );
}

export default React.memo(PostGridCard);
