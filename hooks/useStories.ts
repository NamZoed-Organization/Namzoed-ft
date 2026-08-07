import { supabase } from "@/lib/supabase";
import {
  fetchStoriesForFollowedUsers,
  fetchViewedStoryIds,
  type UserStoryGroup,
} from "@/lib/storiesService";
import { useCallback, useEffect, useState } from "react";

/**
 * useStories
 *
 * Mirrors useLivestreams.ts's shape (initial fetch + realtime subscription),
 * with one deliberate simplification: on INSERT we just refetch (`load(false)`)
 * rather than splicing the raw payload row in client-side, since cheaply
 * checking a new story's poster against the follow graph isn't as trivial as
 * livestreams' `is_active` boolean shortcut, and story inserts are far less
 * frequent than viewer-count updates.
 */
export function useStories(currentUserId?: string, refreshKey?: number) {
  const [storyGroups, setStoryGroups] = useState<UserStoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (showSpinner = false) => {
      if (!currentUserId) {
        setStoryGroups([]);
        setLoading(false);
        return;
      }
      if (showSpinner) setLoading(true);
      try {
        const groups = await fetchStoriesForFollowedUsers(currentUserId);
        setStoryGroups(groups);

        const allStoryIds = groups.flatMap((g) => g.stories.map((s) => s.id));
        const viewed = await fetchViewedStoryIds(currentUserId, allStoryIds);
        setViewedStoryIds(viewed);
      } catch (e) {
        console.error("useStories: fetch error", e);
      } finally {
        setLoading(false);
      }
    },
    [currentUserId],
  );

  useEffect(() => {
    load(true);

    const channel = supabase
      .channel("useStories-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "stories" },
        () => {
          load(false);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "stories" },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          setStoryGroups((prev) =>
            prev
              .map((g) => ({ ...g, stories: g.stories.filter((s) => s.id !== id) }))
              .filter((g) => g.stories.length > 0),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  useEffect(() => {
    if (refreshKey === undefined) return;
    load(false);
  }, [refreshKey, load]);

  /** True once every story in the user's group has been viewed. */
  const isUserSeen = useCallback(
    (userId: string): boolean => {
      const group = storyGroups.find((g) => g.userId === userId);
      if (!group || group.stories.length === 0) return false;
      return group.stories.every((s) => viewedStoryIds.has(s.id));
    },
    [storyGroups, viewedStoryIds],
  );

  const getGroupForUser = useCallback(
    (userId: string): UserStoryGroup | null =>
      storyGroups.find((g) => g.userId === userId) ?? null,
    [storyGroups],
  );

  /** Optimistically marks every story in a group as seen (ring updates instantly). */
  const markGroupSeen = useCallback((userId: string) => {
    setStoryGroups((prev) => {
      const group = prev.find((g) => g.userId === userId);
      if (!group) return prev;
      setViewedStoryIds((ids) => {
        const next = new Set(ids);
        group.stories.forEach((s) => next.add(s.id));
        return next;
      });
      return prev;
    });
  }, []);

  return {
    storyGroups,
    loading,
    isUserSeen,
    getGroupForUser,
    viewedStoryIds,
    markGroupSeen,
    reload: load,
  };
}
