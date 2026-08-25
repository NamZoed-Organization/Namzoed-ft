/**
 * useFilteredFeedPosts
 *
 * Wraps useFeedInfiniteScroll() with the feed's viewer-safety rules: reported
 * posts, unapproved moderation status, and content-rating/Safe View/age
 * gating. Shared by every screen that lists feed posts (Feed tab, Home "For
 * You" grid, ...) so the filtering rules only live in one place.
 */

import { useSafety } from "@/contexts/SafetyContext";
import { useUser } from "@/contexts/UserContext";
import {
  useFeedInfiniteScroll,
} from "@/hooks/useFeedInfiniteScroll";
import { canViewContent } from "@/lib/contentClassifier";
import { getReportedPostIds } from "@/lib/reportService";
import { PostData } from "@/types/post";
import { useCallback, useEffect, useMemo, useState } from "react";

interface UseFilteredFeedPostsResult {
  posts: PostData[];
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  removePost: (postId: string) => void;
  /** Optimistically hide a post the viewer just reported, before the next refetch. */
  markReported: (postId: string) => void;
}

export function useFilteredFeedPosts(): UseFilteredFeedPostsResult {
  const { currentUser } = useUser();
  const { safeView, userAge, isAgeVerified } = useSafety();
  const feed = useFeedInfiniteScroll();
  const [reportedPostIds, setReportedPostIds] = useState<string[]>([]);

  useEffect(() => {
    if (currentUser?.id) {
      getReportedPostIds(currentUser.id)
        .then(setReportedPostIds)
        .catch((error) =>
          console.error("Error loading reported posts:", error),
        );
    }
  }, [currentUser?.id]);

  const posts = useMemo(() => {
    let result = feed.posts;

    if (reportedPostIds.length > 0) {
      result = result.filter((post) => !reportedPostIds.includes(post.id));
    }

    // Only show approved posts. Admin view can show all.
    result = result.filter((post) => {
      const moderationStatus = (post as any).moderationStatus || "approved";
      return moderationStatus === "approved";
    });

    // With Safe View ON (default) or for minors/unverified users, mature
    // (sensitive / 18+) posts are hidden entirely so they're never recommended.
    result = result.filter((post) => {
      const contentRating = (post as any).contentRating || "general";
      return canViewContent(contentRating, userAge, isAgeVerified, safeView);
    });

    return result;
  }, [feed.posts, reportedPostIds, userAge, isAgeVerified, safeView]);

  const markReported = useCallback((postId: string) => {
    setReportedPostIds((prev) => [...prev, postId]);
  }, []);

  return { ...feed, posts, markReported };
}
