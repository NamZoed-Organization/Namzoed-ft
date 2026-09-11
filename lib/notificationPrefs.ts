// lib/notificationPrefs.ts
//
// Which push notifications a user wants. Stored as one JSONB blob on the
// profile (see supabase/migrations/add_notification_prefs_to_profiles.sql)
// so it follows them across devices.
//
// Everything defaults to ON: a missing key means the user has never touched
// that switch, which should behave as opted in — not silently muted.

import { supabase } from "@/lib/supabase";

export type NotificationKey =
  | "likes_saves"
  | "followers"
  | "comments"
  | "messages"
  | "shares";

export interface NotificationPrefs extends Record<string, boolean> {
  /** Master switch — off silences every category below it. */
  enabled: boolean;
  likes_saves: boolean;
  followers: boolean;
  comments: boolean;
  messages: boolean;
  shares: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  likes_saves: true,
  followers: true,
  comments: true,
  messages: true,
  shares: true,
};

/** The categories shown on the settings screen, in order. */
export const NOTIFICATION_CATEGORIES: { key: NotificationKey; label: string; description: string }[] = [
  { key: "likes_saves", label: "Likes and saves", description: "When someone likes or saves your post" },
  { key: "followers", label: "New followers", description: "When someone follows you" },
  { key: "comments", label: "Comments", description: "Replies and comments on your posts" },
  { key: "messages", label: "Messages", description: "New chat messages" },
  { key: "shares", label: "Shared posts", description: "When someone shares your post" },
];

function normalize(raw: unknown): NotificationPrefs {
  const stored = (raw ?? {}) as Partial<NotificationPrefs>;
  const out = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFS)) {
    if (typeof stored[key] === "boolean") out[key] = stored[key] as boolean;
  }
  return out;
}

export async function fetchNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return normalize(data?.notification_prefs);
}

/** Writes the whole blob — the screen always holds a complete set. */
export async function saveNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ notification_prefs: prefs })
    .eq("id", userId);
  if (error) throw error;
}

/** Whether a given notification should be delivered, master switch included. */
export function isNotificationAllowed(
  prefs: NotificationPrefs | null | undefined,
  key: NotificationKey,
): boolean {
  if (!prefs) return true;
  return prefs.enabled !== false && prefs[key] !== false;
}
