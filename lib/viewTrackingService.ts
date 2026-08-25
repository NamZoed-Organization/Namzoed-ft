/**
 * viewTrackingService.ts
 *
 * Tracks post and profile views with:
 * - Self-view guard (owners never count as viewers of their own content)
 * - Client-side session dedup (prevents redundant Supabase calls in the same session)
 * - Server-side dedup via UNIQUE(post_id, viewer_id, viewed_date) constraint
 * - Graceful failure (never throws, never blocks UI)
 */

import { supabase } from "@/lib/supabase";

// ─── Session-level dedup sets ──────────────────────────────────────────────────
// Key format: "<contentId>:<viewerId>:<YYYY-MM-DD>"
const trackedPostViews    = new Set<string>();
const trackedProfileViews = new Set<string>();

function todayDate(): string {
  return new Date().toISOString().split("T")[0]; // "2026-08-05"
}

// ─── Post view tracking ────────────────────────────────────────────────────────

/**
 * Record a post view. Safe to call every time a post becomes visible —
 * deduplicated client-side (session) and server-side (daily unique constraint).
 *
 * @param postId       - ID of the post being viewed
 * @param viewerId     - ID of the authenticated viewer
 * @param postOwnerId  - ID of the post owner (skipped if equal to viewerId)
 */
export async function trackPostView(
  postId: string,
  viewerId: string,
  postOwnerId: string,
): Promise<void> {
  if (viewerId === postOwnerId) return; // no self-views

  const key = `${postId}:${viewerId}:${todayDate()}`;
  if (trackedPostViews.has(key)) return;
  trackedPostViews.add(key);

  try {
    await supabase.from("post_views").insert({
      post_id:     postId,
      viewer_id:   viewerId,
      viewed_date: todayDate(),
    });
    // ON CONFLICT DO NOTHING is handled server-side by the UNIQUE constraint.
    // The DB trigger automatically increments posts.view_count on each INSERT.
  } catch {
    // Reset the session guard so it can be retried on next visibility
    trackedPostViews.delete(key);
  }
}

// ─── Profile view tracking ─────────────────────────────────────────────────────

/**
 * Record a profile view. Call when a user opens another user's profile screen.
 *
 * @param profileId - ID of the profile being viewed
 * @param viewerId  - ID of the viewer (must not equal profileId)
 */
export async function trackProfileView(
  profileId: string,
  viewerId: string,
): Promise<void> {
  if (viewerId === profileId) return; // no self-views

  const key = `${profileId}:${viewerId}:${todayDate()}`;
  if (trackedProfileViews.has(key)) return;
  trackedProfileViews.add(key);

  try {
    await supabase.from("profile_views").insert({
      profile_id:  profileId,
      viewer_id:   viewerId,
      viewed_date: todayDate(),
    });
  } catch {
    trackedProfileViews.delete(key);
  }
}

// ─── Aggregate queries (own content only) ──────────────────────────────────────

/**
 * Fetch the 7-day rolling profile view count for the authenticated user's own profile.
 * Returns a count only — viewer identities are never exposed (privacy).
 */
export async function getProfileViewCount7d(profileId: string): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().split("T")[0];

  const { count, error } = await supabase
    .from("profile_views")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .gte("viewed_date", cutoff);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Fetch the list of users who viewed a post, most recent first.
 * RLS (post_owner_can_read_views) restricts this to the post's owner —
 * any other caller gets an empty result, not an error.
 */
export async function getPostViewers(postId: string) {
  try {
    const { data, error } = await supabase
      .from("post_views")
      .select(`
        viewer_id,
        created_at,
        profiles:viewer_id (
          id,
          name,
          email,
          avatar_url
        )
      `)
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error getting post viewers:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Error in getPostViewers:", error);
    return [];
  }
}

/**
 * Fetch the save (bookmark) count for a specific post.
 * Only call for the post owner's own posts.
 */
export async function getPostSaveCount(postId: string): Promise<number> {
  const { count, error } = await supabase
    .from("user_bookmarks")
    .select("*", { count: "exact", head: true })
    .eq("post_id", postId);

  if (error) return 0;
  return count ?? 0;
}
