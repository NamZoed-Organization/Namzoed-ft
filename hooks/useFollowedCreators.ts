/**
 * The people you follow, newest-first, and which of them have posted
 * something you have not looked at.
 *
 * The Following tab used to be a wall of posts with no way to say "just
 * this person" and no sign of who had been busy. This is the row above it:
 * an avatar each, ordered by how recently they posted, with a dot on
 * anybody whose latest post is newer than the last time you looked at them.
 *
 * **"Seen" is local, and per creator.** It is a mark about *this* reader on
 * *this* phone, and writing it to the server would mean a table growing by
 * one row per follow per person for something nobody else can ever see.
 * `AsyncStorage`, keyed by viewer, holds the last-looked-at timestamp for
 * each creator.
 *
 * **Opening a creator is what clears their dot** — not scrolling past them
 * in the mixed feed, which is somebody glancing at one post rather than
 * catching up. That keeps the dot honest: it means "there is something here
 * you have not gone and looked at", which is the only reading that survives
 * a busy day.
 */

import { useUser } from "@/contexts/UserContext";
import { fetchFollowing } from "@/lib/followService";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface FollowedCreator {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** ISO timestamp of their newest post, or null if they have none. */
  latestPostAt: string | null;
  /** Their newest post is newer than the last time this reader opened them. */
  unseen: boolean;
}

const SEEN_KEY = (viewerId: string) => `nmz_creator_seen:${viewerId}`;

/** Enough to fill a row people will actually scroll; past this, the ones
 *  nobody has opened in months are not what the row is for. */
const MAX_CREATORS = 60;

export function useFollowedCreators() {
  const { currentUser } = useUser();
  const viewerId = currentUser?.id ? String(currentUser.id) : null;

  const [creators, setCreators] = useState<FollowedCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const seenRef = useRef<Record<string, string>>({});

  const readSeen = useCallback(async (): Promise<Record<string, string>> => {
    if (!viewerId) return {};
    try {
      const raw = await AsyncStorage.getItem(SEEN_KEY(viewerId));
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
      // An unreadable mark just means a dot shows once more than it should.
      return {};
    }
  }, [viewerId]);

  const load = useCallback(async () => {
    if (!viewerId) {
      setCreators([]);
      setLoading(false);
      return;
    }
    try {
      const [following, seen] = await Promise.all([
        fetchFollowing(viewerId),
        readSeen(),
      ]);
      seenRef.current = seen;

      const ids = following.map((f) => f.id);
      if (ids.length === 0) {
        setCreators([]);
        return;
      }

      /**
       * One query for everybody's newest post, not one per person.
       *
       * `created_at` descending with the whole set of ids, then the first
       * time each id appears is that person's latest — a row per follow
       * would be a query per follow, which on an account following two
       * hundred people is two hundred round trips for a row of avatars.
       */
      const { data } = await supabase
        .from("posts")
        .select("user_id, created_at")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(500);

      const latest = new Map<string, string>();
      for (const row of data ?? []) {
        const id = String((row as any).user_id);
        if (!latest.has(id)) latest.set(id, String((row as any).created_at));
      }

      const withPosts = following
        .map((f) => {
          const latestPostAt = latest.get(f.id) ?? null;
          const lastSeen = seen[f.id];
          return {
            id: f.id,
            name: f.name,
            avatarUrl: f.avatar_url ?? null,
            latestPostAt,
            unseen:
              latestPostAt != null &&
              (lastSeen == null || latestPostAt > lastSeen),
          };
        })
        // Whoever posted most recently leads: the row is about what is new,
        // not about who was followed first. People who have never posted
        // fall to the end rather than out — they are still followed.
        .sort((a, b) => {
          if (a.latestPostAt && b.latestPostAt) {
            return a.latestPostAt < b.latestPostAt ? 1 : -1;
          }
          if (a.latestPostAt) return -1;
          if (b.latestPostAt) return 1;
          return a.name.localeCompare(b.name);
        })
        .slice(0, MAX_CREATORS);

      setCreators(withPosts);
    } catch (e) {
      console.error("[creators] load failed", e);
    } finally {
      setLoading(false);
    }
  }, [readSeen, viewerId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Opening somebody clears their dot, up to what they had posted then. */
  const markSeen = useCallback(
    async (creatorId: string) => {
      if (!viewerId) return;
      const creator = creators.find((c) => c.id === creatorId);
      const at = creator?.latestPostAt ?? new Date().toISOString();
      seenRef.current = { ...seenRef.current, [creatorId]: at };
      setCreators((prev) =>
        prev.map((c) => (c.id === creatorId ? { ...c, unseen: false } : c)),
      );
      try {
        await AsyncStorage.setItem(
          SEEN_KEY(viewerId),
          JSON.stringify(seenRef.current),
        );
      } catch {
        // Worst case the dot comes back; not worth telling anybody.
      }
    },
    [creators, viewerId],
  );

  /** Whether *anybody* has something new — what the Explore tab's own dot
   *  is asking about. */
  const anyUnseen = useMemo(() => creators.some((c) => c.unseen), [creators]);

  /** The face on the Following tab while you are on Explore: whoever posted
   *  most recently, because that is what tapping it takes you to. */
  const latest = creators[0] ?? null;

  return { creators, loading, refresh: load, markSeen, anyUnseen, latest };
}
