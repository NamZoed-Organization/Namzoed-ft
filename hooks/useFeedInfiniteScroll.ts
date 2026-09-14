import { useUser } from "@/contexts/UserContext";
import { useRankedFeed } from "@/hooks/useRankedFeed";
import { fetchFeedOrder } from "@/lib/feedSession";
import { parseMediaDisplay } from "@/lib/postMediaDisplay";
import {
  fetchPostRankingPool,
  fetchPostsByIds,
  fetchPostsCreatedSince,
  PostWithUser,
} from "@/lib/postsService";
import { supabase } from "@/lib/supabase";
import { PostData } from "@/types/post";
import { useCallback, useMemo, useState } from "react";

const PAGE_SIZE = 15;
const BOOST_SLOT_COUNT = 2;

/** Verified is resolved when a page is fetched and stored on the row, so the
 *  rows kept for the next open carry their badge with them. */
type FeedPost = PostWithUser & { is_verified?: boolean };

interface UseFeedInfiniteScrollResult {
  posts: PostData[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  removePost: (postId: string) => void;
}

function convertToPostData(post: FeedPost): PostData {
  const username = post.profiles?.name || post.profiles?.email?.split("@")[0] || "Unknown User";
  const mediaDisplay = parseMediaDisplay((post as any).media_display);

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
    mediaDisplay,
    locationName: (post as any).location_name ?? undefined,
    tagged_products: (post as any).tagged_products ?? undefined,
    tagged_accounts: (post as any).tagged_accounts ?? undefined,
    isVerified: !!post.is_verified,
    contentRating: (post as any).content_rating ?? "general",
    moderationStatus: (post as any).moderation_status ?? "approved",
    view_count: (post as any).view_count ?? 0,
  };
}

async function withVerified(posts: PostWithUser[]): Promise<FeedPost[]> {
  const userIds = [...new Set(posts.map((p) => p.user_id))];
  if (userIds.length === 0) return posts;
  const { data } = await supabase
    .from("service_providers")
    .select("user_id, verification_status")
    .in("user_id", userIds);
  const verified = new Set(
    (data || []).filter((sp) => sp.verification_status === "verified").map((sp) => sp.user_id),
  );
  return posts.map((p) => ({ ...p, is_verified: verified.has(p.user_id) }));
}

export function useFeedInfiniteScroll(): UseFeedInfiniteScrollResult {
  const { currentUser, isLoading: userLoading } = useUser();
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const fetchOrder = useCallback(
    (seed: string) =>
      fetchFeedOrder({
        rpc: "feed_order_posts",
        seed,
        fallbackPool: fetchPostRankingPool,
        boostSlotCount: BOOST_SLOT_COUNT,
      }),
    [],
  );
  const fetchByIds = useCallback(async (ids: string[]) => withVerified(await fetchPostsByIds(ids)), []);
  const fetchNewSince = useCallback(
    async (asOf: string) => withVerified(await fetchPostsCreatedSince(asOf)),
    [],
  );

  const trackImpressions = useCallback(async (ids: string[]) => {
    const { error } = await supabase.rpc("increment_impressions_posts", { ids });
    if (error) console.error("Error tracking post impressions:", error);
  }, []);

  const ranked = useRankedFeed<FeedPost>({
    sessionKey: "posts",
    userId: currentUser?.id,
    enabled: !userLoading,
    fetchOrder,
    fetchByIds,
    fetchNewSince,
    trackImpressions,
    pageSize: PAGE_SIZE,
  });

  const posts = useMemo(
    () => ranked.items.filter((p) => !removedIds.has(p.id)).map(convertToPostData),
    [ranked.items, removedIds],
  );

  const removePost = useCallback((postId: string) => {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(postId);
      return next;
    });
  }, []);

  const { loadMore: rankedLoadMore } = ranked;
  const loadMore = useCallback(async () => {
    rankedLoadMore();
  }, [rankedLoadMore]);

  return {
    posts,
    loading: ranked.loading,
    loadingMore: ranked.loadingMore,
    refreshing: ranked.refreshing,
    hasMore: ranked.hasMore,
    loadMore,
    refresh: ranked.refresh,
    removePost,
  };
}
