/**
 * notificationService.ts
 *
 * All Supabase CRUD + real-time helpers for the `notifications` table.
 * The table is expected to have:
 *
 *   id            uuid  PK  default gen_random_uuid()
 *   user_id       uuid  FK → profiles.id   (the recipient)
 *   type          text  CHECK (new_follower | post_liked | user_went_live | new_post)
 *   actor_id      uuid  FK → profiles.id   (who triggered it)
 *   extra_actor_ids uuid[]  nullable
 *   reference_id  uuid  nullable           (post / livestream id)
 *   title         text
 *   body          text
 *   is_read       boolean default false
 *   created_at    timestamptz default now()
 */

import { supabase } from "@/lib/supabase";
import { sendPushToUsers } from "@/services/pushNotificationService";
import type {
    AppNotification,
    NotificationRow,
    NotificationType,
} from "@/types/notification";

// ─── helpers ────────────────────────────────────────────────────────
const profileCache = new Map<
  string,
  { name: string; avatar_url: string | null }
>();

const postImageCache = new Map<string, string | null>();
const POST_IMAGE_TYPES = new Set(["post_liked", "post_commented", "new_post", "post_traction"]);

async function resolvePostImage(postId: string): Promise<string | null> {
  if (postImageCache.has(postId)) return postImageCache.get(postId)!;
  const { data } = await supabase
    .from("posts")
    .select("images")
    .eq("id", postId)
    .maybeSingle();
  const url: string | null = (data?.images as string[] | null)?.[0] ?? null;
  postImageCache.set(postId, url);
  return url;
}

async function resolveProfile(
  userId: string,
): Promise<{ name: string; avatar_url: string | null }> {
  if (profileCache.has(userId)) {
    console.log(`[NotifService:resolveProfile] cache hit for ${userId}:`, profileCache.get(userId));
    return profileCache.get(userId)!;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("name, phone, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  console.log(`[NotifService:resolveProfile] userId=${userId}`);
  console.log(`[NotifService:resolveProfile] error:`, error ?? "none");
  console.log(`[NotifService:resolveProfile] raw data:`, JSON.stringify(data));

  // Build a human-readable display name: name → phone (+975) → "Someone"
  let displayName = "Someone";
  let nameSource = "fallback";
  if (data?.name)       { displayName = data.name;                                                               nameSource = "name"; }
  else if (data?.phone) { const clean = String(data.phone).replace("+975", "").replace(/\D/g, "");
                          displayName = clean.length >= 6 ? `+975 ${clean}` : data.phone;                       nameSource = "phone"; }

  const resolved = {
    name: displayName,
    avatar_url: data?.avatar_url ?? null,
  };

  console.log(`[NotifService:resolveProfile] resolved name="${resolved.name}" (from ${nameSource}), avatar_url=${resolved.avatar_url ?? "null"}`);

  profileCache.set(userId, resolved);
  return resolved;
}

async function enrichRow(row: NotificationRow): Promise<AppNotification> {
  const [actor, referenceImageUrl] = await Promise.all([
    resolveProfile(row.actor_id),
    POST_IMAGE_TYPES.has(row.type) && row.reference_id
      ? resolvePostImage(row.reference_id)
      : Promise.resolve(null),
  ]);
  return {
    ...row,
    extra_actor_ids: row.extra_actor_ids ?? undefined,
    actor_name: actor.name,
    actor_avatar_url: actor.avatar_url,
    reference_image_url: referenceImageUrl,
  };
}

// ─── read ───────────────────────────────────────────────────────────

export async function fetchNotifications(
  userId: string,
  page = 0,
  pageSize = 30,
): Promise<AppNotification[]> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[NotifService] fetchNotifications error:", error.message);
    return [];
  }

  return Promise.all((data ?? []).map(enrichRow));
}

export async function getUnseenCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("[NotifService] getUnseenCount error:", error.message);
    return 0;
  }
  return count ?? 0;
}

// ─── write ──────────────────────────────────────────────────────────

export async function markAsRead(notificationId: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
}

export async function markAllAsRead(userId: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
}

/**
 * Insert a notification row.
 * Called from event triggers (follow, like, go-live, new post).
 */
export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  actorId: string;
  extraActorIds?: string[];
  referenceId?: string | null;
  title: string;
  body: string;
}): Promise<NotificationRow | null> {
  // Do NOT chain .select().single() — the inserter (actor) is a different
  // user from the notification recipient (user_id), so the SELECT RLS
  // policy (auth.uid() = user_id) would reject the RETURNING clause.
  const row = {
    user_id: params.userId,
    type: params.type,
    actor_id: params.actorId,
    extra_actor_ids: params.extraActorIds ?? null,
    reference_id: params.referenceId ?? null,
    title: params.title,
    body: params.body,
    is_read: false,
  };

  const { error } = await supabase.from("notifications").insert(row);

  if (error) {
    console.error("[NotifService] createNotification error:", error.message);
    return null;
  }
  // Return a synthetic row — callers don't need the server-generated id
  return { ...row, id: "", created_at: new Date().toISOString() } as NotificationRow;
}

// ─── real-time ──────────────────────────────────────────────────────

/**
 * Subscribe to INSERT events on `notifications` for a specific user.
 * Returns a cleanup function.
 */
export function subscribeToNotifications(
  userId: string,
  onInsert: (row: NotificationRow) => void,
): () => void {
  const channel = supabase
    .channel(`notifs-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
      },
      (payload) => {
        const row = payload.new as NotificationRow;
        // JS-side filter so we don't need replica identity FULL
        if (row.user_id === userId) {
          onInsert(row);
        }
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// ─── notification builders ──────────────────────────────────────────
// Convenience helpers used from the places that trigger events.

export async function notifyNewFollower(
  followedUserId: string,
  followerUserId: string,
): Promise<void> {
  const actor = await resolveProfile(followerUserId);
  await createNotification({
    userId: followedUserId,
    type: "new_follower",
    actorId: followerUserId,
    title: "New Follower",
    body: `${actor.name} started following you`,
  });

  // Push notification (fire-and-forget)
  sendPushToUsers({
    recipientIds: [followedUserId],
    heading: "New Follower",
    content: `${actor.name} started following you`,
    type: "new_follower",
    data: { actor_id: followerUserId },
    actorAvatarUrl: actor.avatar_url,
  }).catch(() => {});
}

/**
 * Handles the "X liked your post" logic with aggregation.
 *
 * - If there's an existing unread `post_liked` notification for the same post
 *   created in the last 30 minutes, we append the new actor to `extra_actor_ids`
 *   and update the body text ( "Dorji and 3 others liked your post" ).
 * - Otherwise create a new notification.
 */
export async function notifyPostLiked(
  postOwnerId: string,
  likerUserId: string,
  postId: string,
): Promise<void> {
  if (postOwnerId === likerUserId) return; // don't self-notify

  const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();

  // Look for an existing notification to aggregate into.
  // The liker (auth.uid()) is NOT the notification owner, so we use an
  // RPC that runs with SECURITY DEFINER to bypass RLS for the lookup
  // + update.  If the RPC doesn't exist yet, fall back to a plain insert.
  const actor = await resolveProfile(likerUserId);

  try {
    const { data: existing } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", postOwnerId)
      .eq("type", "post_liked")
      .eq("reference_id", postId)
      .eq("is_read", false)
      .gte("created_at", thirtyMinAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const prev: string[] = existing.extra_actor_ids ?? [];
      if (
        existing.actor_id === likerUserId ||
        prev.includes(likerUserId)
      ) {
        return; // already counted
      }

      const updatedExtras = [...prev, likerUserId];
      const othersCount = updatedExtras.length;
      const mainActor = await resolveProfile(existing.actor_id);
      const body =
        othersCount === 1
          ? `${mainActor.name} and ${actor.name} liked your post`
          : `${mainActor.name} and ${othersCount} others liked your post`;

      await supabase
        .from("notifications")
        .update({ extra_actor_ids: updatedExtras, body })
        .eq("id", existing.id);
      return;
    }
  } catch (e) {
    // Aggregation lookup failed (likely RLS) — fall through to fresh insert
    console.warn("[NotifService] aggregation lookup failed, inserting fresh:", e);
  }

  await createNotification({
    userId: postOwnerId,
    type: "post_liked",
    actorId: likerUserId,
    referenceId: postId,
    title: "Post Liked",
    body: `${actor.name} liked your post`,
  });

  // Push notification (fire-and-forget)
  sendPushToUsers({
    recipientIds: [postOwnerId],
    heading: "Post Liked",
    content: `${actor.name} liked your post`,
    type: "post_liked",
    data: { actor_id: likerUserId, reference_id: postId },
    actorAvatarUrl: actor.avatar_url,
  }).catch(() => {});
}

export async function notifyPostCommented(
  postOwnerId: string,
  commenterUserId: string,
  postId: string,
  commentText: string,
  isReply = false,
): Promise<void> {
  if (postOwnerId === commenterUserId) return; // don't self-notify

  const actor = await resolveProfile(commenterUserId);

  const body = isReply
    ? `${actor.name} replied to your comment`
    : (() => {
        const preview =
          commentText.length > 60
            ? `${commentText.slice(0, 57)}...`
            : commentText;
        return `${actor.name} commented: “${preview}”`;
      })();

  await createNotification({
    userId: postOwnerId,
    type: "post_commented",
    actorId: commenterUserId,
    referenceId: postId,
    title: isReply ? "New Reply" : "New Comment",
    body,
  });

  // Push notification (fire-and-forget)
  sendPushToUsers({
    recipientIds: [postOwnerId],
    heading: isReply ? "New Reply" : "New Comment",
    content: body,
    type: "post_commented",
    data: { actor_id: commenterUserId, reference_id: postId },
    actorAvatarUrl: actor.avatar_url,
  }).catch(() => {});
}

export async function notifyUserWentLive(
  liveUserId: string,
  livestreamId: string,
  followerIds: string[],
): Promise<void> {
  const actor = await resolveProfile(liveUserId);
  const rows = followerIds.map((fid) => ({
    user_id: fid,
    type: "user_went_live" as const,
    actor_id: liveUserId,
    reference_id: livestreamId,
    title: "Live Now",
    body: `${actor.name} is live now!`,
    is_read: false,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error("[NotifService] notifyUserWentLive error:", error.message);
  }

  // Push notification to all followers (fire-and-forget)
  sendPushToUsers({
    recipientIds: followerIds,
    heading: "Live Now \uD83D\uDD34",
    content: `${actor.name} is live now!`,
    type: "user_went_live",
    data: { actor_id: liveUserId, reference_id: livestreamId },
    actorAvatarUrl: actor.avatar_url,
  }).catch(() => {});
}

/**
 * Notify the initiator that their chat partner accepted the Mongoose delivery request.
 * Triggered only after Person 2 confirms their location and the booking_request row is created.
 */
export async function notifyMongooseBookingConfirmed(
  initiatorId: string,
  responderId: string,
): Promise<void> {
  if (initiatorId === responderId) return;
  const actor = await resolveProfile(responderId);

  // Notify the initiator (Person 1)
  await createNotification({
    userId: initiatorId,
    type: "mongoose_booking_request",
    actorId: responderId,
    title: "Mongoose Request Confirmed",
    body: `${actor.name} accepted your Mongoose delivery request`,
  });

  // Look up the Mongoose service user so they get a push too
  const { data: mongooseProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", "mongoose@gmail.com")
    .maybeSingle();

  const pushRecipients = [initiatorId];
  if (mongooseProfile?.id && mongooseProfile.id !== initiatorId) {
    pushRecipients.push(mongooseProfile.id);
  }

  sendPushToUsers({
    recipientIds: pushRecipients,
    heading: "New Mongoose Booking!",
    content: `${actor.name} confirmed a delivery request`,
    type: "mongoose_booking_request",
    data: { actor_id: responderId },
    actorAvatarUrl: actor.avatar_url,
  }).catch(() => {});
}

export async function notifyNewPost(
  posterId: string,
  postId: string,
  followerIds: string[],
): Promise<void> {
  const actor = await resolveProfile(posterId);
  const rows = followerIds.map((fid) => ({
    user_id: fid,
    type: "new_post" as const,
    actor_id: posterId,
    reference_id: postId,
    title: "New Post",
    body: `${actor.name} shared a new post`,
    is_read: false,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error("[NotifService] notifyNewPost error:", error.message);
  }

  // Push notification to all followers (fire-and-forget)
  sendPushToUsers({
    recipientIds: followerIds,
    heading: "New Post",
    content: `${actor.name} shared a new post`,
    type: "new_post",
    data: { actor_id: posterId, reference_id: postId },
    actorAvatarUrl: actor.avatar_url,
  }).catch(() => {});
}

export async function notifyNewStory(
  posterId: string,
  storyId: string,
  followerIds: string[],
): Promise<void> {
  const actor = await resolveProfile(posterId);
  const rows = followerIds.map((fid) => ({
    user_id: fid,
    type: "new_story" as const,
    actor_id: posterId,
    reference_id: storyId,
    title: "New Story",
    body: `${actor.name} added to their story`,
    is_read: false,
  }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) {
    console.error("[NotifService] notifyNewStory error:", error.message);
  }

  // Push notification to all followers (fire-and-forget)
  sendPushToUsers({
    recipientIds: followerIds,
    heading: "New Story",
    content: `${actor.name} added to their story`,
    type: "new_story",
    data: { actor_id: posterId, reference_id: storyId },
    actorAvatarUrl: actor.avatar_url,
  }).catch(() => {});
}

// ─── engagement notifications ────────────────────────────────────────

const FOLLOWER_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

/**
 * Check if the user just hit a follower milestone and send a push if so.
 * Called after a successful follow insert. Uses the DB primary key as an
 * atomic "already sent" guard (INSERT fails with 23505 if duplicate).
 */
export async function checkAndNotifyFollowerMilestone(userId: string): Promise<void> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("follower_count")
    .eq("id", userId)
    .maybeSingle();

  const count: number = (profile as any)?.follower_count ?? 0;
  const milestone = FOLLOWER_MILESTONES.find((m) => m === count);
  if (!milestone) return;

  // Attempt to insert the milestone record — if it already exists, the UNIQUE
  // PK constraint throws code 23505, which means the notification was already sent.
  const { error } = await supabase
    .from("follower_milestone_notifications")
    .insert({ user_id: userId, milestone });

  if (error) {
    if (error.code === "23505") return; // already sent for this milestone
    console.warn("[NotifService] milestone insert error:", error.message);
    return;
  }

  await notifyFollowerMilestone(userId, milestone);
}

/**
 * Notify a user that they reached a follower milestone.
 * actor_id = userId (self-notification — no external actor).
 */
export async function notifyFollowerMilestone(
  userId: string,
  milestone: number,
): Promise<void> {
  const title = "Follower Milestone!";
  const body = `You now have ${milestone.toLocaleString()} followers. Keep it up!`;

  await createNotification({
    userId,
    type: "follower_milestone",
    actorId: userId,
    title,
    body,
  });

  sendPushToUsers({
    recipientIds: [userId],
    heading: title,
    content: body,
    type: "follower_milestone",
    data: { milestone },
    actorAvatarUrl: null,
  }).catch(() => {});
}

/**
 * Notify a post owner that their post is gaining traction.
 * Called from the daily edge function for posts with ≥10 views in first 24h.
 */
export async function notifyPostTraction(
  postOwnerId: string,
  postId: string,
  viewCount: number,
): Promise<void> {
  const title = "Your post is gaining momentum!";
  const body = `Your post has been viewed ${viewCount} times in its first 24 hours.`;

  await createNotification({
    userId: postOwnerId,
    type: "post_traction",
    actorId: postOwnerId,
    referenceId: postId,
    title,
    body,
  });

  sendPushToUsers({
    recipientIds: [postOwnerId],
    heading: title,
    content: body,
    type: "post_traction",
    data: { reference_id: postId, view_count: viewCount },
    actorAvatarUrl: null,
  }).catch(() => {});
}
