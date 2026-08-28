/**
 * Post detail screen
 *
 * Navigated to from notifications, profile grids, saved posts, chat, deep
 * links, etc. — everywhere except the Home "For You" grid tap (which morphs
 * into PostDetailOverlay instead). Shows the single post using the existing
 * FeedPost component.
 *
 * Wrapped in the same ContextDrop gesture PostDetailOverlay uses (edge-swipe
 * back, with a "drop to Contact Author" dome) so that behavior isn't
 * Home-grid-exclusive — the native-stack edge-swipe is turned off for this
 * screen so it doesn't fight ContextDrop's own edge gesture for the same
 * touch zone.
 *
 * Presented as a transparentModal (not the navigator's default opaque
 * "card") so whatever screen this was opened from — notifications, a
 * profile grid, chat, etc. — stays mounted and visible underneath instead
 * of being detached, matching PostDetailOverlay's own "real screen shows
 * through while dragging" behavior even though this route is a genuine
 * stack push rather than an in-tree overlay.
 */

import ContextDrop, { ContextDropTarget } from "@/components/ContextDrop";
import FeedPost from "@/components/FeedPost";
import CircularLoader from "@/components/ui/CircularLoader";
import { useUser } from "@/contexts/UserContext";
import { parseMediaDisplay } from "@/lib/postMediaDisplay";
import { fetchPostById, PostWithUser } from "@/lib/postsService";
import { trackPostView } from "@/lib/viewTrackingService";
import { PostData } from "@/types/post";
import { useAppRouter } from "@/utils/navigation";
import { Stack, useLocalSearchParams } from "expo-router";
import { MessageCircle } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#094569";

// Hoisted to a stable module-level reference — Stack.Screen's `options` prop
// drives navigation.setOptions() internally; a fresh object literal on every
// render can retrigger that (and the parent navigator re-rendering this
// screen in response) badly enough to trip React's "Maximum update depth
// exceeded" guard (seen on the product-detail screen, which used this exact
// inline-literal pattern). These values are static, so a stable reference is
// all that's needed.
const POST_SCREEN_OPTIONS = {
  gestureEnabled: false,
  presentation: "transparentModal" as const,
  animation: "none" as const,
  contentStyle: { backgroundColor: "transparent" },
};

function toPostData(post: PostWithUser): PostData {
  const username =
    post.profiles?.name ||
    post.profiles?.email?.split("@")[0] ||
    "Unknown User";
  return {
    id: post.id,
    userId: post.user_id,
    username,
    profilePic: post.profiles?.avatar_url || undefined,
    content: post.content,
    images: post.images,
    blurHashes: (post as any).blur_hashes ?? undefined,
    date: new Date(post.created_at),
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    mediaDisplay: parseMediaDisplay((post as any).media_display),
    locationName: (post as any).location_name ?? undefined,
    tagged_products: (post as any).tagged_products ?? undefined,
    tagged_accounts: (post as any).tagged_accounts ?? undefined,
    view_count: (post as any).view_count ?? 0,
  };
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();

  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchPostById(id)
      .then((raw) => {
        if (raw) {
          setPost(toPostData(raw));
          // Track view (fire-and-forget, skips self-views)
          if (currentUser?.id && currentUser.id !== raw.user_id) {
            trackPostView(raw.id, currentUser.id, raw.user_id).catch(() => {});
          }
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id, currentUser?.id]);

  const handleContactAuthor = useCallback(() => {
    if (!post) return;
    const authorId = post.userId;
    if (currentUser?.id === authorId) return;
    router.push({
      pathname: "/(users)/chat/[id]",
      params: {
        id: String(authorId),
        context_product_id: String(post.id),
        context_product_title: post.content || "Shared post",
        context_product_image: post.images?.[0] || "",
        context_source: "post",
      },
    } as any);
  }, [post, currentUser?.id, router]);

  const canMessageAuthor = !!post && currentUser?.id !== post.userId;
  const contactAuthorTarget = useMemo<ContextDropTarget | null>(() => {
    if (!canMessageAuthor) return null;
    return {
      label: "Contact Author",
      armedLabel: "Drop to Contact Author",
      icon: <MessageCircle size={18} color="#fff" fill="none" />,
      armedIcon: <MessageCircle size={18} color={PRIMARY} fill={PRIMARY} />,
      onDrop: handleContactAuthor,
    };
  }, [canMessageAuthor, handleContactAuthor]);

  return (
    <>
      {/* Native-stack's own edge-swipe would otherwise compete with
          ContextDrop's for the same left-edge touch zone. transparentModal
          (+ transparent contentStyle, since Android's screens otherwise
          paint an opaque backing) keeps the previous screen mounted and
          visible behind this one. */}
      <Stack.Screen options={POST_SCREEN_OPTIONS} />
      <ContextDrop enabled={!loading} onDismiss={() => router.back()} target={contactAuthorTarget}>
        <View style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
          {loading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: insets.top }}>
              <CircularLoader size="large" color="#094569" />
            </View>
          ) : error || !post ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: insets.top }}>
              <Text style={{ fontSize: 15, color: "#6b7280", textAlign: "center" }}>
                This post is no longer available.
              </Text>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: "#094569", borderRadius: 20 }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Go back</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // FeedPost owns its own internal ScrollView in onBack mode (so its
            // header can stay pinned above it), so it isn't wrapped in one here.
            <FeedPost post={post} isVisible onBack={() => router.back()} />
          )}
        </View>
      </ContextDrop>
    </>
  );
}
