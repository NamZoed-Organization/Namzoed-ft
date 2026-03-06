/**
 * NotificationsContext
 *
 * Global provider that:
 *  - Resolves the current user's UUID
 *  - Fetches existing notifications on mount
 *  - Subscribes to real-time INSERT events on the notifications table
 *  - Tracks an unseen count for the badge
 *  - Provides mark-as-read and mark-all-as-read helpers
 */

import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import {
    fetchNotifications,
    getUnseenCount,
    markAllAsRead as markAllAsReadService,
    markAsRead as markAsReadService,
    subscribeToNotifications,
} from "@/services/notificationService";
import type { AppNotification, NotificationRow, NotificationType } from "@/types/notification";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { AppState } from "react-native";

// ── In-app notification banner payload ──────────────────────────────
export type NotificationBanner = {
  id: string;
  type: NotificationType;
  actorId: string;
  actorName: string;
  actorAvatarUrl: string | null;
  body: string;
  referenceId?: string | null;
};

interface NotificationsContextType {
  notifications: AppNotification[];
  unseenCount: number;
  loading: boolean;
  /** In-app banner for the most recent notification */
  banner: NotificationBanner | null;
  /** Dismiss the in-app notification banner */
  dismissBanner: () => void;
  /** Refresh the notifications list & unseen count from the server */
  refresh: () => Promise<void>;
  /** Mark a single notification as read */
  markAsRead: (notificationId: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllAsRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(
  undefined,
);

// ─── profile resolver (lightweight, local cache) ────────────────────
const profileCache = new Map<
  string,
  { name: string; avatar_url: string | null }
>();

// ─── post thumbnail resolver (lightweight, local cache) ──────────────
const postImageCache = new Map<string, string | null>();
const POST_IMAGE_TYPES = new Set(["post_liked", "post_commented", "new_post"]);

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
    console.log(`[NotifCtx:resolveProfile] cache hit for ${userId}:`, profileCache.get(userId));
    return profileCache.get(userId)!;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("name, phone, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  console.log(`[NotifCtx:resolveProfile] userId=${userId}`);
  console.log(`[NotifCtx:resolveProfile] error:`, error ?? "none");
  console.log(`[NotifCtx:resolveProfile] raw data:`, JSON.stringify(data));

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

  console.log(`[NotifCtx:resolveProfile] resolved name="${resolved.name}" (from ${nameSource}), avatar_url=${resolved.avatar_url ?? "null"}`);

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

// ─── provider ───────────────────────────────────────────────────────

export const NotificationsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { currentUser } = useUser();
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<NotificationBanner | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const dismissBanner = useCallback(() => {
    setBanner(null);
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
  }, []);

  // ── Resolve UUID ── same logic as UnreadMessagesContext
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const authId = data?.user?.id;

      if (currentUser?.id) {
        const { data: row } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", currentUser.id)
          .maybeSingle();
        if (row?.id && mounted) {
          setUserId(row.id);
          return;
        }
      }

      if (mounted) setUserId(authId ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, [currentUser]);

  // ── Fetch helpers ──
  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      const [items, count] = await Promise.all([
        fetchNotifications(userId),
        getUnseenCount(userId),
      ]);
      setNotifications(items);
      setUnseenCount(count);
    } catch (e) {
      console.error("[NotifCtx] refresh error:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // ── Initial fetch + subscribe ──
  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnseenCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    refresh();

    // Real-time subscription
    unsubRef.current?.();
    unsubRef.current = subscribeToNotifications(userId, async (row) => {
      const enriched = await enrichRow(row);
      setNotifications((prev) => [enriched, ...prev]);
      setUnseenCount((c) => c + 1);

      // Show in-app banner
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      setBanner({
        id: enriched.id,
        type: enriched.type,
        actorId: enriched.actor_id,
        actorName: enriched.actor_name || "Someone",
        actorAvatarUrl: enriched.actor_avatar_url || null,
        body: enriched.body,
        referenceId: enriched.reference_id,
      });
      bannerTimerRef.current = setTimeout(() => {
        setBanner(null);
        bannerTimerRef.current = null;
      }, 4000);
    });

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [userId, refresh]);

  // ── Refresh on foreground ──
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // ── Actions ──
  const markAsRead = useCallback(
    async (notificationId: string) => {
      await markAsReadService(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n,
        ),
      );
      setUnseenCount((c) => Math.max(0, c - 1));
    },
    [],
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    await markAllAsReadService(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnseenCount(0);
  }, [userId]);

  const value = useMemo(
    () => ({
      notifications,
      unseenCount,
      loading,
      banner,
      dismissBanner,
      refresh,
      markAsRead,
      markAllAsRead,
    }),
    [notifications, unseenCount, loading, banner, dismissBanner, refresh, markAsRead, markAllAsRead],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider",
    );
  }
  return ctx;
};
