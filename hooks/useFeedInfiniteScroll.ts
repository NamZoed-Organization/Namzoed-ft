import { parseMediaDisplay } from "@/lib/postMediaDisplay";
import { fetchPostsCursor, PostWithUser } from "@/lib/postsService";
import { readCache, writeCache } from "@/lib/queryCache";
import { supabase } from "@/lib/supabase";
import { PostData } from "@/types/post";
import { useCallback, useEffect, useRef, useState } from "react";

const PAGE_SIZE = 15;

// Cached first page so the feed renders instantly on mount, then revalidates.
const FEED_CACHE_KEY = "feed:firstPage";
interface FeedCachePayload {
  raw: PostWithUser[];
  verified: string[];
}

interface UseFeedInfiniteScrollResult {
  posts: PostData[];
  loading: boolean;
  refreshing: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  removePost: (postId: string) => void;
}

function convertToPostData(
  post: PostWithUser,
  verifiedIds: Set<string>
): PostData {
  const username =
    post.profiles?.name ||
    post.profiles?.email?.split("@")[0] ||
    "Unknown User";

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
    contentRating: (post as any).content_rating ?? 'general',
    moderationStatus: (post as any).moderation_status ?? 'approved',
    view_count: (post as any).view_count ?? 0,
  };
}

async function fetchVerifiedIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data } = await supabase
    .from("service_providers")
    .select("user_id, verification_status")
    .in("user_id", userIds);
  return new Set(
    (data || [])
      .filter((sp) => sp.verification_status === "verified")
      .map((sp) => sp.user_id)
  );
}

export function useFeedInfiniteScroll(): UseFeedInfiniteScrollResult {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const fetched = await fetchPostsCursor(cursorRef.current, PAGE_SIZE);

      if (fetched.length < PAGE_SIZE) {
        hasMoreRef.current = false;
        setHasMore(false);
      }

      if (fetched.length > 0) {
        cursorRef.current = fetched[fetched.length - 1].created_at;

        const userIds = [...new Set(fetched.map((p) => p.user_id))];
        const verifiedIds = await fetchVerifiedIds(userIds);

        const newPosts = fetched.map((p) => convertToPostData(p, verifiedIds));

        setPosts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const unique = newPosts.filter((p) => !existingIds.has(p.id));
          return [...prev, ...unique];
        });
      }
    } catch (error) {
      console.error("Error loading more posts:", error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // Fetch (and cache) the first page. `silent` skips the pull-to-refresh spinner
  // when we already painted cached posts.
  const fetchFirstPage = useCallback(async (silent: boolean) => {
    if (!silent) setRefreshing(true);
    cursorRef.current = null;
    hasMoreRef.current = true;
    loadingRef.current = false;
    setHasMore(true);

    try {
      const fetched = await fetchPostsCursor(null, PAGE_SIZE);

      if (fetched.length < PAGE_SIZE) {
        hasMoreRef.current = false;
        setHasMore(false);
      }

      if (fetched.length > 0) {
        cursorRef.current = fetched[fetched.length - 1].created_at;
      }

      const userIds = [...new Set(fetched.map((p) => p.user_id))];
      const verifiedIds = await fetchVerifiedIds(userIds);

      const newPosts = fetched.map((p) => convertToPostData(p, verifiedIds));
      setPosts(newPosts);

      // Persist for an instant render next time the feed mounts.
      writeCache<FeedCachePayload>(FEED_CACHE_KEY, {
        raw: fetched,
        verified: [...verifiedIds],
      });
    } catch (error) {
      console.error("Error refreshing posts:", error);
      if (!silent) setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(() => fetchFirstPage(false), [fetchFirstPage]);

  const removePost = useCallback((postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  // Initial load: paint cached posts immediately, then revalidate in background.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await readCache<FeedCachePayload>(FEED_CACHE_KEY);
      if (!cancelled && cached?.data?.raw?.length) {
        const verifiedSet = new Set(cached.data.verified);
        setPosts(cached.data.raw.map((p) => convertToPostData(p, verifiedSet)));
        cursorRef.current = cached.data.raw[cached.data.raw.length - 1].created_at;
        setLoading(false);
        fetchFirstPage(true); // silent background revalidate
      } else if (!cancelled) {
        setLoading(true);
        fetchFirstPage(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchFirstPage]);

  return { posts, loading, refreshing, hasMore, loadMore, refresh, removePost };
}
