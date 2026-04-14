/**
 * Notification types and interfaces used across the notification system.
 */

export type NotificationType =
  | "new_follower"
  | "post_liked"
  | "post_commented"
  | "user_went_live"
  | "new_post"
  | "mongoose_booking_request";

export interface AppNotification {
  id: string;
  /** The user this notification belongs to */
  user_id: string;
  type: NotificationType;
  /** The user who triggered the notification (follower, liker, poster, etc.) */
  actor_id: string;
  /** Extra IDs for aggregation (e.g. other likers in the same burst) */
  extra_actor_ids?: string[];
  /** Optional reference to a post or livestream */
  reference_id?: string | null;
  /** Human-readable title e.g. "New Follower" */
  title: string;
  /** Human-readable body e.g. "Dorji started following you" */
  body: string;
  /** Actor profile data joined from profiles table or resolved locally */
  actor_name?: string;
  actor_avatar_url?: string | null;
  /** Thumbnail URL of the referenced post (first image/video), for post-related types */
  reference_image_url?: string | null;
  /** Whether the user has seen this notification */
  is_read: boolean;
  created_at: string;
}

/** Row shape stored in the `notifications` Supabase table */
export interface NotificationRow {
  id: string;
  user_id: string;
  type: NotificationType;
  actor_id: string;
  extra_actor_ids: string[] | null;
  reference_id: string | null;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

/** Section header for the notifications list grouped by date */
export interface NotificationSection {
  title: string; // "Today", "Yesterday", "Feb 25, 2026", etc.
  data: AppNotification[];
}
