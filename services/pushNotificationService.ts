/**
 * pushNotificationService.ts
 *
 * Client-side wrapper for the `send-push-notification` Supabase Edge Function.
 * Sends push notifications via OneSignal for non-chat notification types:
 * new_follower, post_liked, post_commented, user_went_live, new_post.
 */

import { supabase } from "@/lib/supabase";

const FUNCTION_NAME = "send-push-notification";

interface PushParams {
  recipientIds: string[];
  heading: string;
  content: string;
  type: string;
  data?: Record<string, unknown>;
  actorAvatarUrl?: string | null;
}

export async function sendPushToUsers({
  recipientIds,
  heading,
  content,
  type,
  data,
  actorAvatarUrl,
}: PushParams): Promise<boolean> {
  if (recipientIds.length === 0) return false;

  try {
    const { error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: {
        recipient_ids: recipientIds,
        heading,
        content,
        type,
        data: data ?? {},
        actor_avatar_url: actorAvatarUrl ?? null,
      },
    });

    if (error) {
      console.warn("[pushNotificationService] invoke error:", error);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[pushNotificationService] failed:", err);
    return false;
  }
}
