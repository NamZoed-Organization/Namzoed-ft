/**
 * Finding somebody to mention.
 *
 * Anyone on the app can be mentioned — a comment thread is not limited to
 * people you already know, and a picker that hid strangers would make it
 * impossible to bring one into a conversation they are part of.
 *
 * But the order is not flat. The person you mean is nearly always someone
 * you already have a line to, so the list is ranked: people you follow who
 * follow you back, then people you follow, then people who follow you, then
 * everyone else. Within a tier, a name that *starts* with what was typed
 * beats one that merely contains it.
 *
 * The follow graph is read once per composer session and held, because it
 * does not change between keystrokes and re-fetching it on every letter is
 * three round trips per character.
 */

import { getFollowerIdsOf, getFollowingIds } from "./followService";
import { supabase } from "./supabase";

export interface MentionCandidate {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Why it is where it is in the list — the row shows this. */
  relation: "mutual" | "following" | "follower" | "none";
}

export interface MentionGraph {
  following: Set<string>;
  followers: Set<string>;
}

export const loadMentionGraph = async (
  userId: string | null | undefined,
): Promise<MentionGraph> => {
  if (!userId) return { following: new Set(), followers: new Set() };
  try {
    const [following, followers] = await Promise.all([
      getFollowingIds(userId),
      getFollowerIdsOf(userId),
    ]);
    return { following: new Set(following), followers: new Set(followers) };
  } catch {
    // A picker that still works, just without the ranking.
    return { following: new Set(), followers: new Set() };
  }
};

const RANK: Record<MentionCandidate["relation"], number> = {
  mutual: 0,
  following: 1,
  follower: 2,
  none: 3,
};

const relationOf = (
  id: string,
  graph: MentionGraph,
): MentionCandidate["relation"] => {
  const iFollow = graph.following.has(id);
  const theyFollow = graph.followers.has(id);
  if (iFollow && theyFollow) return "mutual";
  if (iFollow) return "following";
  if (theyFollow) return "follower";
  return "none";
};

/**
 * Candidates for the `@` currently being typed.
 *
 * An empty query is not an empty list: it is the moment right after `@`,
 * when the useful answer is the people you talk to most — so it comes back
 * ranked with no name filter at all rather than waiting for a first letter.
 */
export const searchMentionCandidates = async (
  query: string,
  graph: MentionGraph,
  currentUserId: string | null | undefined,
  limit = 8,
): Promise<MentionCandidate[]> => {
  const term = query.trim();

  let request = supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .not("name", "is", null)
    // A wider net than the list shows, because the ranking below is what
    // decides the order — taking the database's first 8 by name would put
    // strangers above friends.
    .limit(term ? 40 : 60);

  if (term) request = request.ilike("name", `%${term}%`);

  const { data, error } = await request;
  if (error) throw error;

  const lowered = term.toLowerCase();

  return (data ?? [])
    .filter((row: any) => row.id !== currentUserId)
    .map((row: any) => ({
      id: String(row.id),
      name: String(row.name ?? "").trim() || "Unknown",
      avatarUrl: row.avatar_url ?? null,
      relation: relationOf(String(row.id), graph),
    }))
    .sort((a, b) => {
      const byRelation = RANK[a.relation] - RANK[b.relation];
      if (byRelation !== 0) return byRelation;

      if (lowered) {
        const aStarts = a.name.toLowerCase().startsWith(lowered);
        const bStarts = b.name.toLowerCase().startsWith(lowered);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
};
