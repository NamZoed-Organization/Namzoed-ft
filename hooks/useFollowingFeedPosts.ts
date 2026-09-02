/**
 * useFollowingFeedPosts
 *
 * Chronological feed of posts from users the current viewer follows — the
 * "Following" section of Home, as opposed to the ranked "Explore" pool from
 * useFilteredFeedPosts. Applies the same viewer-safety rules (reported
 * posts, moderation status, content-rating/Safe View/age gating) so the two
 * feeds behave consistently.
 */

import { useSafety } from "@/contexts/SafetyContext";
import { useUser } from "@/contexts/UserContext";
import { canViewContent } from "@/lib/contentClassifier";
import { getFollowingIds } from "@/lib/followService";
import { parseMediaDisplay } from "@/lib/postMediaDisplay";
import { fetchFollowingPostsCursor, PostWithUser } from "@/lib/postsService";
import { getReportedPostIds } from "@/lib/reportService";
import { supabase } from "@/lib/supabase";
import { PostData } from "@/types/post";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const PAGE_SIZE = 15;

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

interface UseFollowingFeedPostsResult {
  posts: PostData[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  /** false while we don't yet know / the user follows no one — used to show an empty state instead of a spinner. */
  hasFollows: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFollowingFeedPosts(): UseFollowingFeedPostsResult {
  const { currentUser } = useUser();
  const { safeView, userAge, isAgeVerified } = useSafety();
  const [followingIds, setFollowingIds] = useState<string[] | null>(null);
  const [rawPosts, setRawPosts] = useState<PostWithUser[]>([]);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(new Set());
  const [reportedPostIds, setReportedPostIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentUser?.id) {
      setFollowingIds([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    getFollowingIds(currentUser.id).then((ids) => {
      if (!cancelled) setFollowingIds(ids);
    });
    getReportedPostIds(currentUser.id)
      .then((ids) => {
        if (!cancelled) setReportedPostIds(ids);
      })
      .catch((error) => console.error("Error loading reported posts:", error));
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const loadFirstPage = useCallback(async (ids: string[]) => {
    setLoading(true);
    cursorRef.current = null;
    try {
      const fetched = await fetchFollowingPostsCursor(ids, null, PAGE_SIZE);
      const userIds = [...new Set(fetched.map((p) => p.user_id))];
      const verified = await fetchVerifiedIds(userIds);
      setVerifiedIds(verified);
      setRawPosts(fetched);
      setHasMore(fetched.length === PAGE_SIZE);
      cursorRef.current = fetched.length > 0 ? fetched[fetched.length - 1].created_at : null;
    } catch (error) {
      console.error("Error loading following feed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (followingIds === null) return;
    if (followingIds.length === 0) {
      setRawPosts([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    loadFirstPage(followingIds);
    // followingIds is refetched only when currentUser changes, so this won't loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followingIds]);

  const loadMore = useCallback(async () => {
    if (!followingIds || followingIds.length === 0 || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const fetched = await fetchFollowingPostsCursor(followingIds, cursorRef.current, PAGE_SIZE);
      setRawPosts((prev) => [...prev, ...fetched]);
      setHasMore(fetched.length === PAGE_SIZE);
      if (fetched.length > 0) {
        cursorRef.current = fetched[fetched.length - 1].created_at;
        const userIds = [...new Set(fetched.map((p) => p.user_id))];
        const verified = await fetchVerifiedIds(userIds);
        setVerifiedIds((prev) => new Set([...prev, ...verified]));
      }
    } catch (error) {
      console.error("Error loading more following posts:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [followingIds, loadingMore, hasMore]);

  const refresh = useCallback(async () => {
    if (!followingIds || followingIds.length === 0) return;
    await loadFirstPage(followingIds);
  }, [followingIds, loadFirstPage]);

  const posts = useMemo(() => {
    const result = rawPosts
      .filter((post) => !reportedPostIds.includes(post.id))
      .filter((post) => ((post as any).moderation_status || "approved") === "approved")
      .filter((post) =>
        canViewContent((post as any).content_rating || "general", userAge, isAgeVerified, safeView),
      );
    return result.map((p) => convertToPostData(p, verifiedIds));
  }, [rawPosts, reportedPostIds, verifiedIds, userAge, isAgeVerified, safeView]);

  return {
    posts,
    loading,
    loadingMore,
    hasMore,
    hasFollows: (followingIds?.length ?? 0) > 0,
    loadMore,
    refresh,
  };
}
