/**
 * Notifications screen
 *
 * Shows all notifications grouped by date (Today, Yesterday, older dates).
 * Each item shows the actor's avatar, a brief message, timestamp, and an
 * unread dot.  Tapping a notification marks it as read and navigates to the
 * relevant screen.
 */

import { useNotifications } from "@/contexts/NotificationsContext";
import type {
  AppNotification,
  NotificationSection,
} from "@/types/notification";
import { Ionicons } from "@expo/vector-icons";
import { useAppRouter } from "@/utils/navigation";
import { Bell, ChevronLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  InteractionManager,
  SectionList,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── video helper ───────────────────────────────────────────────────

const VIDEO_EXTS = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"];
function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return VIDEO_EXTS.some((ext) => lower.includes(ext)) || lower.includes("post-videos");
}

// ─── post thumbnail component ────────────────────────────────────────

function PostThumbnail({ url }: { url: string }) {
  const isVideo = isVideoUrl(url);
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 8,
        marginLeft: 10,
        overflow: "hidden",
        backgroundColor: "#e5e7eb",
      }}
    >
      {isVideo ? (
        <View
          style={{
            flex: 1,
            backgroundColor: "#111",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="play-circle" size={28} color="rgba(255,255,255,0.85)" />
        </View>
      ) : (
        <Image
          source={{ uri: url }}
          style={{ width: 56, height: 56 }}
          resizeMode="cover"
        />
      )}
    </View>
  );
}

// ─── date helpers ───────────────────────────────────────────────────

const SECTION_ORDER = ["Today", "Yesterday", "Last 7 days", "Last 30 days", "Earlier"] as const;
type SectionKey = (typeof SECTION_ORDER)[number];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function sectionKey(date: Date): SectionKey {
  const now = new Date();
  if (isSameDay(date, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays <= 7) return "Last 7 days";
  if (diffDays <= 30) return "Last 30 days";
  return "Earlier";
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ─── icon per type ──────────────────────────────────────────────────

const KNOWN_NOTIFICATION_TYPES = new Set([

  "post_liked",
 
]);

const POST_CONTEXT_TYPES = new Set(["post_liked", "post_commented", "new_post"]);

function hasKnownIcon(type: string): boolean {
  return KNOWN_NOTIFICATION_TYPES.has(type);
}

function TypeIcon({ type }: { type: string }) {
  const size = 14;
  const color = "#fff";
  switch (type) {
    case "new_follower":
      return <Ionicons name="person-add" size={size} color={color} />;
    case "post_liked":
      return <Ionicons name="heart" size={size} color={color} />;
    case "post_commented":
      return <Ionicons name="chatbubble" size={size} color={color} />;
    case "user_went_live":
      return <Ionicons name="radio" size={size} color={color} />;
    case "new_post":
      return <Ionicons name="document-text" size={size} color={color} />;
    default:
      return null;
  }
}

function typeIconBg(type: string): string {
  switch (type) {
    case "new_follower":
      return "#3b82f6"; // blue
    case "post_liked":
      return "#ef4444"; // red
    case "post_commented":
      return "#f59e0b"; // amber
    case "user_went_live":
      return "#8b5cf6"; // purple
    case "new_post":
      return "#22c55e"; // green
    default:
      return "#6b7280";
  }
}

// ─── list item ──────────────────────────────────────────────────────

function NotificationItem({
  item,
  onPress,
}: {
  item: AppNotification;
  onPress: (n: AppNotification) => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(item)}
      className="flex-row px-4 py-3"
      style={{
        backgroundColor: item.is_read ? "transparent" : "#f0f7ff",
      }}
    >
      {/* Avatar + type badge */}
      <View className="relative mr-3">
        {item.actor_avatar_url ? (
          <Image
            source={{ uri: item.actor_avatar_url }}
            className="w-12 h-12 rounded-full"
          />
        ) : (
          <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center">
            <Ionicons name="person" size={22} color="#9ca3af" />
          </View>
        )}
        {/* small type badge — only shown for known notification types */}
        {hasKnownIcon(item.type) && (
          <View
            style={{
              position: "absolute",
              bottom: 4,
              right: -5,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: typeIconBg(item.type),
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: item.is_read ? "#fff" : "#f0f7ff",
            }}
          >
            <TypeIcon type={item.type} />
          </View>
        )}
      </View>

      {/* copy */}
      <View className="flex-1 justify-center">
        <Text
          className={`text-sm ${item.is_read ? "text-gray-700" : "text-gray-900"}`}
          numberOfLines={2}
        >
          {item.actor_name && item.body.startsWith(item.actor_name) ? (
            <>
              <Text style={{ fontWeight: "700" }}>{item.actor_name}</Text>
              {item.body.slice(item.actor_name.length)}
            </>
          ) : (
            item.body
          )}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">
          {relativeTime(item.created_at)}
        </Text>
      </View>

      {/* post thumbnail — only for post-related types */}
      {POST_CONTEXT_TYPES.has(item.type) && item.reference_image_url ? (
        <PostThumbnail url={item.reference_image_url} />
      ) : POST_CONTEXT_TYPES.has(item.type) && item.reference_id ? (
        // Placeholder for text-only posts
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 8,
            marginLeft: 10,
            backgroundColor: "#f3f4f6",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="document-text" size={22} color="#9ca3af" />
        </View>
      ) : null}

      {/* unread dot */}
      {!item.is_read && (
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "#3b82f6",
            alignSelf: "center",
            marginLeft: 6,
          }}
        />
      )}
    </TouchableOpacity>
  );
}

// ─── screen ─────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const {
    notifications,
    unseenCount,
    loading,
    refresh,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // Mark all as read as soon as the screen opens (Instagram-style)
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      markAllAsRead();
    });
    return () => task.cancel();
  }, [markAllAsRead]);

  // Auto-refresh on mount
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      refresh();
    });
    return () => task.cancel();
  }, [refresh]);

  // ── sections ──
  const sections: NotificationSection[] = useMemo(() => {
    const buckets = new Map<SectionKey, AppNotification[]>();
    for (const n of notifications) {
      const key = sectionKey(new Date(n.created_at));
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(n);
    }
    // Return sections in the fixed order, skipping empty buckets
    return SECTION_ORDER.filter((k) => buckets.has(k)).map((k) => ({
      title: k,
      data: buckets.get(k)!,
    }));
  }, [notifications]);

  // ── tap handler ──
  const handlePress = useCallback(
    async (n: AppNotification) => {
      if (!n.is_read) await markAsRead(n.id);

      switch (n.type) {
        case "new_follower":
          // Go to the follower's profile
          router.push(`/(users)/profile/${n.actor_id}` as any);
          break;

        case "post_liked":
        case "post_commented":
          // Go directly to the post that was liked / commented on
          if (n.reference_id) {
            router.push(`/(users)/post/${n.reference_id}` as any);
          }
          break;

        case "new_post":
          // Go to the new post that was created
          if (n.reference_id) {
            router.push(`/(users)/post/${n.reference_id}` as any);
          } else {
            router.push(`/(users)/profile/${n.actor_id}` as any);
          }
          break;

        case "user_went_live":
          // Open the feed and auto-join the livestream
          if (n.reference_id) {
            router.push(`/(users)/(tabs)/feed?streamId=${n.reference_id}` as any);
          } else {
            router.push(`/(users)/profile/${n.actor_id}` as any);
          }
          break;

        default:
          break;
      }
    },
    [markAsRead, router],
  );

  // ── render ──
  return (
    <View className="flex-1 bg-white">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="bg-white border-b border-gray-100"
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 items-center justify-center"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={24} color="#111" />
          </TouchableOpacity>
          <Text className="text-lg font-mbold text-gray-900">
            Notifications
          </Text>
          <View style={{ width: 50 }} />
        </View>
      </View>

      {loading && notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Bell size={56} color="#d1d5db" />
          <Text className="text-base font-semibold text-gray-400 mt-4">
            No notifications yet
          </Text>
          <Text className="text-sm text-gray-300 mt-1 text-center">
            When someone follows you, likes your post, or goes live — you'll
            see it here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem item={item} onPress={handlePress} />
          )}
          renderSectionHeader={({ section }) => (
            <View className="px-4 py-2 bg-gray-50">
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                {section.title}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{
            paddingBottom: insets.bottom + 20,
          }}
          showsVerticalScrollIndicator={false}
          onRefresh={refresh}
          refreshing={loading}
        />
      )}
    </View>
  );
}
