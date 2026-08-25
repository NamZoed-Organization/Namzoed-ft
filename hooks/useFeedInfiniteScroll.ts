import { useRankedFeed } from "@/hooks/useRankedFeed";
import { parseMediaDisplay } from "@/lib/postMediaDisplay";
import { fetchAllPostsForRanking, PostWithUser } from "@/lib/postsService";
import { readCache, writeCache } from "@/lib/queryCache";
import { supabase } from "@/lib/supabase";
import { PostData } from "@/types/post";
import { useCallback, useMemo, useState } from "react";

const PAGE_SIZE = 15;
const BOOST_SLOT_COUNT = 2;

// Cached full pool so the feed paints instantly on mount, then revalidates —
// see lib/feedRanking.ts / hooks/useRankedFeed.ts for the session ordering
// this pool feeds into.
const FEED_CACHE_KEY = "feed:pool";
interface FeedCachePayload {
  raw: PostWithUser[];
  verified: string[];
}

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

function convertToPostData(post: PostWithUser, verifiedIds: Set<string>): PostData {
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
    isVerified: verifiedIds.has(post.user_id),
    contentRating: (post as any).content_rating ?? "general",
    moderationStatus: (post as any).moderation_status ?? "approved",
    view_count: (post as any).view_count ?? 0,
  };
}

async function fetchVerifiedIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data } = await supabase
    .from("service_providers")
    .select("user_id, verification_status")
    .in("user_id", userIds);
  return new Set((data || []).filter((sp) => sp.verification_status === "verified").map((sp) => sp.user_id));
}

export function useFeedInfiniteScroll(): UseFeedInfiniteScrollResult {
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());

  const seedFromCache = useCallback(async () => {
    const cached = await readCache<FeedCachePayload>(FEED_CACHE_KEY);
    if (!cached?.data?.raw?.length) return null;
    setVerifiedIds(new Set(cached.data.verified));
    return cached.data.raw;
  }, []);

  const fetchPool = useCallback(async () => {
    const fetched = await fetchAllPostsForRanking();
    const userIds = [...new Set(fetched.map((p) => p.user_id))];
    const verified = await fetchVerifiedIds(userIds);
    setVerifiedIds(verified);
    writeCache<FeedCachePayload>(FEED_CACHE_KEY, { raw: fetched, verified: [...verified] });
    return fetched;
  }, []);

  const trackImpressions = useCallback(async (ids: string[]) => {
    const { error } = await supabase.rpc("increment_impressions_posts", { ids });
    if (error) console.error("Error tracking post impressions:", error);
  }, []);

  const ranked = useRankedFeed<PostWithUser>({
    fetchPool,
    trackImpressions,
    pageSize: PAGE_SIZE,
    boostSlotCount: BOOST_SLOT_COUNT,
    seedFromCache,
  });

  const posts = useMemo(
    () => ranked.items.filter((p) => !removedIds.has(p.id)).map((p) => convertToPostData(p, verifiedIds)),
    [ranked.items, verifiedIds, removedIds],
  );

  const removePost = useCallback((postId: string) => {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(postId);
      return next;
    });
  }, []);

  const loadMore = useCallback(async () => {
    ranked.loadMore();
  }, [ranked]);

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
