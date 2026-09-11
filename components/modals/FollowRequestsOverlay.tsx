/**
 * FollowRequestsOverlay
 *
 * The Followers / Following list, opened from the counts on a profile.
 *
 * Rebuilt to UI_STANDARD.md. What it was: a blurred header with a 2xl
 * left-aligned title, a subtitle, a sort pill and an X in a cluster on the
 * right, two filled chip tabs, and every person in their own bordered white
 * card floating on `#F8FAFC`. Six of those are things the standard names
 * explicitly — the header is three parts with at most one text action, tabs
 * are plain text with a short underline (and come from `ProfileTabRow`, not
 * a second hand-rolled row), and a list of things is one white group on the
 * grey, not a stack of cards.
 *
 * The "Follows you" pill is gone from your own Followers tab, where it said
 * nothing: everyone in that list is there *because* they follow you. It
 * survives everywhere it still carries information — see `showFollowsYou`.
 */

import ProfileTabRow from "@/components/profile/ProfileTabRow";
import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import {
  fetchFollowers,
  fetchFollowing,
  followUser,
  FollowUser,
  unfollowUser,
} from "@/lib/followService";
import { useAppRouter } from "@/utils/navigation";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import { ChevronLeft, UserRound } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Modal,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface FollowRequestsOverlayProps {
  onClose: () => void;
  userId: string;
  actorUserId?: string;
  initialTab?: TabType;
}

type TabType = "followers" | "following";
type SortOrder = "asc" | "desc";

const AVATAR = 44;
/** Separators inset to where the row's text starts (§ Separators). */
const SEPARATOR_INSET = 16 + AVATAR + 12;
const GROUP_RADIUS = 18;

export default function FollowRequestsOverlay({
  onClose,
  userId,
  actorUserId,
  initialTab = "following",
}: FollowRequestsOverlayProps) {
  const router = useAppRouter();
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();
  const resolvedActorUserId = actorUserId || currentUser?.id || userId;
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [viewerFollowerIds, setViewerFollowerIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "error";
    title: string;
    message: string;
  }>({ visible: false, type: "error", title: "", message: "" });
  const showPopup = (title: string, message: string) =>
    setPopup({ visible: true, type: "error", title, message });
  const previousTab = useRef<TabType>("following");

  /** Whose list this is. On your own Followers tab the "Follows you" pill is
   *  a tautology — that is the definition of the tab — but on someone
   *  else's it still means something: this person follows *you*, not them. */
  const isOwnList = userId === resolvedActorUserId;

  useEffect(() => {
    loadData();
  }, [userId, resolvedActorUserId]);

  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    previousTab.current = activeTab;
    setActiveTab(tab);
  };

  const loadData = async () => {
    try {
      if (!refreshing) setLoading(true);

      // Always fetched desc and sorted locally, so toggling the order never
      // costs a round trip.
      const [followersData, followingData, viewerFollowers] = await Promise.all([
        fetchFollowers(userId, "desc"),
        fetchFollowing(userId, "desc"),
        fetchFollowers(resolvedActorUserId, "desc"),
      ]);

      setFollowers(followersData);
      setFollowing(followingData);
      setViewerFollowerIds(new Set(viewerFollowers.map((u) => u.id)));
    } catch (error) {
      console.error("Error loading follow data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleFollow = async (user: FollowUser) => {
    try {
      const result = await followUser(resolvedActorUserId, user.id);
      if (result.success) {
        if (activeTab === "following") {
          // Clear isUnfollowed flag when re-following
          setFollowing((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, isUnfollowed: false } : u)),
          );
        } else {
          setFollowers((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, isFollowingBack: true } : u)),
          );
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        showPopup("Follow Failed", result.error || "Could not follow this user. Try again.");
      }
    } catch (error) {
      console.error("Error following user:", error);
      showPopup("Follow Failed", "Could not follow this user. Try again.");
    }
  };

  const handleUnfollow = async (user: FollowUser) => {
    try {
      const result = await unfollowUser(resolvedActorUserId, user.id);
      if (result.success) {
        // Marked rather than removed, so the row doesn't vanish out from
        // under the finger that tapped it and can be undone in place.
        if (activeTab === "following") {
          setFollowing((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, isUnfollowed: true } : u)),
          );
        } else {
          setFollowers((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, isFollowingBack: false } : u)),
          );
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        showPopup("Unfollow Failed", result.error || "Could not unfollow this user. Try again.");
      }
    } catch (error) {
      console.error("Error unfollowing user:", error);
      showPopup("Unfollow Failed", "Could not unfollow this user. Try again.");
    }
  };

  const toggleSortOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  const currentListData = useMemo(() => {
    const data = activeTab === "followers" ? followers : following;

    return [...data].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });
  }, [activeTab, followers, following, sortOrder]);

  const renderUserItem = useCallback(
    ({ item, index }: { item: FollowUser; index: number }) => {
      const isFollowing = activeTab === "following" ? !item.isUnfollowed : item.isFollowingBack;
      // Not on your own Followers tab, where it restates the tab's title.
      const showFollowsYou =
        viewerFollowerIds.has(item.id) && !(activeTab === "followers" && isOwnList);
      const canShowAction = activeTab === "following" && item.id !== resolvedActorUserId;

      // One white group on the grey, not a card per person: only the ends
      // are rounded, and every row but the first carries an inset hairline.
      const first = index === 0;
      const last = index === currentListData.length - 1;

      return (
        <View
          style={{
            marginHorizontal: 16,
            backgroundColor: "#fff",
            borderTopLeftRadius: first ? GROUP_RADIUS : 0,
            borderTopRightRadius: first ? GROUP_RADIUS : 0,
            borderBottomLeftRadius: last ? GROUP_RADIUS : 0,
            borderBottomRightRadius: last ? GROUP_RADIUS : 0,
            borderCurve: "continuous",
            overflow: "hidden",
          }}
        >
          {!first && (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: "#f0f0f0",
                marginLeft: SEPARATOR_INSET,
              }}
            />
          )}
          <TouchableOpacity
            className="flex-row items-center px-4 py-3"
            // Dimmed while unfollowed, so the row reads as "changed, tap to
            // undo" rather than silently staying put.
            style={{ opacity: item.isUnfollowed ? 0.5 : 1 }}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(`/(users)/profile/${item.id}`);
            }}
            activeOpacity={0.7}
          >
            <View
              style={{
                width: AVATAR,
                height: AVATAR,
                borderRadius: AVATAR / 2,
                borderCurve: "continuous",
                backgroundColor: item.avatar_url ? "#E5E7EB" : "#F5F5F5",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              {item.avatar_url ? (
                <Image
                  source={{ uri: item.avatar_url }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <UserRound size={20} color="#9CA3AF" strokeWidth={1.8} />
              )}
            </View>

            <View className="flex-1 ml-3">
              <Text style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }} numberOfLines={1}>
                {item.name}
              </Text>
              {(!!item.phone || showFollowsYou) && (
                <View className="flex-row items-center mt-0.5">
                  {!!item.phone && (
                    <Text style={{ fontSize: 15, color: "#9CA3AF" }} numberOfLines={1}>
                      {item.phone}
                    </Text>
                  )}
                  {showFollowsYou && (
                    <View
                      style={{
                        marginLeft: item.phone ? 8 : 0,
                        backgroundColor: "#F5F5F5",
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "600", color: "#6B7280" }}>
                        Follows you
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {canShowAction && (
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                  if (isFollowing) {
                    handleUnfollow(item);
                  } else {
                    handleFollow(item);
                  }
                }}
                activeOpacity={0.8}
                style={{
                  marginLeft: 10,
                  paddingHorizontal: 16,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderCurve: "continuous",
                  // A white button on a white row is invisible, so the
                  // "already following" state carries the grey fill.
                  backgroundColor: isFollowing ? "#F5F5F5" : "#0369A1",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: isFollowing ? "#111" : "#fff",
                  }}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>
      );
    },
    [activeTab, resolvedActorUserId, viewerFollowerIds, isOwnList, currentListData.length, router],
  );

  const renderEmptyState = () => {
    const messages = {
      followers: {
        title: "No followers yet",
        subtitle: "People who follow you will appear here",
      },
      following: {
        title: "Not following anyone",
        subtitle: "People you follow will appear here",
      },
    };
    const message = messages[activeTab];

    return (
      <View className="flex-1 items-center justify-center px-8 py-20">
        <Text style={{ fontSize: 15, color: "#9CA3AF" }}>{message.title}</Text>
        <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center" }}>
          {message.subtitle}
        </Text>
      </View>
    );
  };

  // Counts live on the tabs rather than in a header subtitle: they are the
  // number for that list, and putting them anywhere else means reading two
  // places to answer one question.
  const tabs = useMemo(
    () => [
      { key: "following" as TabType, label: `${following.length} Following` },
      { key: "followers" as TabType, label: `${followers.length} Followers` },
    ],
    [following.length, followers.length],
  );

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: SETTINGS_BACKGROUND,
        paddingTop: insets.top,
        marginBottom: -insets.bottom,
        paddingBottom: insets.bottom,
      }}
    >
      {/* The profile underneath sets light-content for its cover gradient,
          and RN merges StatusBar props last-mounted-wins. */}
      <StatusBar barStyle="dark-content" />

      {/* Three parts: chevron, centred title, one text action (§ Header). */}
      <View className="flex-row items-center justify-between px-4 pb-3 pt-1">
        <TouchableOpacity onPress={onClose} className="py-1 -ml-1">
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
        <View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            justifyContent: "center",
            alignItems: "center",
          }}
          pointerEvents="none"
        >
          <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>Connections</Text>
        </View>
        {/* The label is the current order, and tapping it swaps — one text
            action instead of an icon-and-label pill in a cluster with an X. */}
        <TouchableOpacity onPress={toggleSortOrder} className="py-1">
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#0369A1" }}>
            {sortOrder === "asc" ? "Oldest" : "Latest"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* The row ends at its underline, so the gap to the list is added
          here rather than baked into the shared component. */}
      <View style={{ paddingBottom: 6 }}>
        <ProfileTabRow
          tabs={tabs}
          activeKey={activeTab}
          onChange={handleTabChange}
          background={SETTINGS_BACKGROUND}
        />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <CircularLoader size="large" color="#094569" />
        </View>
      ) : (
        <Animated.View
          key={activeTab}
          entering={
            previousTab.current === "followers" && activeTab === "following"
              ? SlideInRight.duration(250)
              : previousTab.current === "following" && activeTab === "followers"
                ? SlideInLeft.duration(250)
                : FadeIn.duration(250)
          }
          exiting={
            activeTab === "followers" ? SlideOutLeft.duration(250) : SlideOutRight.duration(250)
          }
          className="flex-1"
        >
          <FlashList
            data={currentListData}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#094569" />
            }
            ListEmptyComponent={renderEmptyState}
          />
        </Animated.View>
      )}

      <Modal visible={popup.visible} transparent animationType="none" statusBarTranslucent>
        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup((p) => ({ ...p, visible: false }))}
        />
      </Modal>
    </View>
  );
}
