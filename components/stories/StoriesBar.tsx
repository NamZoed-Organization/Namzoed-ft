/**
 * StoriesBar
 *
 * Instagram-style horizontal row combining story rings AND live avatars in a
 * single line. The leading ring is always "Your Story" — tapping it opens a
 * combined create menu (Your Story / Post / Live). What follows is one ring
 * per other user who is either live or has an active (non-expired) story —
 * live takes visual priority (red pulsing ring + LIVE badge, tapping joins
 * the stream) when a user is both, otherwise it's the usual gradient story
 * ring (colorful when unseen, gray when fully seen).
 *
 * Owns its own `useLivestreams()` subscription (mirroring how it used to
 * live in the now-removed LivesBar) but is handed the parent's `useStories()`
 * state rather than owning that too, so the viewer's "mark seen" updates
 * land in the same state this bar reads.
 */
import { useUser } from "@/contexts/UserContext";
import { useLivestreams } from "@/hooks/useLivestreams";
import type { UserStoryGroup } from "@/lib/storiesService";
import type { Livestream } from "@/services/livestreamService";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Plus, Radio, Sparkles } from "lucide-react-native";
import React, { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

interface StoriesBarProps {
  storyGroups: UserStoryGroup[];
  isUserSeen: (userId: string) => boolean;
  /** Called when the "Your Story" option is picked and there's no active story yet */
  onAddStory: () => void;
  /** Called when the user taps a ring with an active story (their own or someone else's) */
  onOpenStory: (group: UserStoryGroup, groupIndex: number, allGroups: UserStoryGroup[]) => void;
  /** Called when "Live" is picked from the combined create menu */
  onGoLive: () => void;
  /** Called when "Post" is picked from the combined create menu */
  onCreatePost: () => void;
  /** Called when the user taps a live ring to join that stream */
  onJoinLive: (stream: Livestream) => void;
  /** Changes when the parent wants to force a live list refresh */
  liveRefreshKey?: number;
  currentUserId?: string;
}

// Same glassmorphism recipe as the floating tab bar (components/ui/FloatingTabBar.tsx).
const MENU_BLUR_INTENSITY = 50;
const MENU_ANDROID_BACKGROUND = "rgba(255, 255, 255, 0.85)";

const UNSEEN_GRADIENT = ["#F58529", "#DD2A7B", "#8134AF"] as const;
const SEEN_GRADIENT = ["#D1D5DB", "#D1D5DB"] as const;
const LIVE_GRADIENT = ["#FF3B30", "#FF6B35", "#FF3B30"] as const;

const RingAvatar = React.memo(function RingAvatar({
  name,
  avatarUrl,
  seen,
  isLive,
  showAddBadge,
  onPress,
}: {
  name: string;
  avatarUrl?: string | null;
  seen: boolean;
  isLive?: boolean;
  showAddBadge?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{ alignItems: "center", marginRight: 14, width: 68 }}
    >
      <View style={{ borderRadius: 36, padding: 2.5 }}>
        <LinearGradient
          colors={isLive ? LIVE_GRADIENT : seen ? SEEN_GRADIENT : UNSEEN_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 34, padding: 2 }}
        >
          <View style={{ borderRadius: 30, padding: 2, backgroundColor: "white" }}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: 52, height: 52, borderRadius: 26 }}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: "#094569",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700", fontSize: 20 }}>
                  {name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {showAddBadge && (
          <View
            style={{
              position: "absolute",
              bottom: 0,
              right: 0,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: "#094569",
              borderWidth: 2,
              borderColor: "white",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Plus size={12} color="white" strokeWidth={3} />
          </View>
        )}
      </View>

      {isLive ? (
        <View
          style={{
            backgroundColor: "#FF3B30",
            borderRadius: 4,
            paddingHorizontal: 5,
            paddingVertical: 1,
            marginTop: -8,
            zIndex: 1,
            borderWidth: 1.5,
            borderColor: "white",
          }}
        >
          <Text style={{ color: "white", fontSize: 10, fontWeight: "800" }}>LIVE</Text>
        </View>
      ) : null}

      <Text
        style={{ fontSize: 11, color: "#374151", marginTop: 4, textAlign: "center" }}
        numberOfLines={1}
      >
        {name.length > 9 ? name.slice(0, 8) + "…" : name}
      </Text>
    </TouchableOpacity>
  );
});

type RowItem =
  | { kind: "live"; key: string; stream: Livestream }
  | { kind: "story"; key: string; group: UserStoryGroup };

export default function StoriesBar({
  storyGroups,
  isUserSeen,
  onAddStory,
  onOpenStory,
  onGoLive,
  onCreatePost,
  onJoinLive,
  liveRefreshKey,
  currentUserId,
}: StoriesBarProps) {
  const { currentUser } = useUser();
  const { livestreams } = useLivestreams(liveRefreshKey);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const ringRef = useRef<View>(null);

  const myGroup = currentUserId
    ? storyGroups.find((g) => g.userId === currentUserId) ?? null
    : null;
  const otherGroups = storyGroups.filter((g) => g.userId !== currentUserId);

  // Live users first (more urgent/time-sensitive), then everyone else with
  // just an active story. A user who is both live and has a story shows as
  // a single live-styled ring — tapping it joins the stream, matching
  // Instagram's convention of live taking priority over the story.
  const rowItems = useMemo<RowItem[]>(() => {
    const items: RowItem[] = [];
    const seen = new Set<string>();
    for (const stream of livestreams) {
      if (!stream.user_id || stream.user_id === currentUserId || seen.has(stream.user_id)) continue;
      seen.add(stream.user_id);
      items.push({ kind: "live", key: stream.user_id, stream });
    }
    for (const group of otherGroups) {
      if (seen.has(group.userId)) continue;
      seen.add(group.userId);
      items.push({ kind: "story", key: group.userId, group });
    }
    return items;
  }, [livestreams, otherGroups, currentUserId]);

  const handlePressGroup = (group: UserStoryGroup) => {
    const index = storyGroups.findIndex((g) => g.userId === group.userId);
    onOpenStory(group, index === -1 ? 0 : index, storyGroups);
  };

  const openCreateMenu = () => {
    ringRef.current?.measureInWindow((x, y, _w, h) => {
      setMenuPos({ top: y + h + 4, left: x });
      setShowCreateMenu(true);
    });
  };

  const handlePickYourStory = () => {
    setShowCreateMenu(false);
    if (myGroup) handlePressGroup(myGroup);
    else onAddStory();
  };

  return (
    <View
      style={{
        backgroundColor: "white",
        borderBottomWidth: 1,
        borderBottomColor: "#f3f4f6",
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "flex-start",
      }}
    >
      <View ref={ringRef} collapsable={false} style={{ marginLeft: 12 }}>
        <RingAvatar
          name="Your Story"
          avatarUrl={myGroup ? myGroup.avatarUrl : currentUser?.avatar_url}
          seen={myGroup ? isUserSeen(currentUserId!) : true}
          showAddBadge={!myGroup}
          onPress={openCreateMenu}
        />
      </View>

      {/* Combined create menu — glassmorphism dropdown matching the floating
          tab bar, anchored below the "Your Story" ring. */}
      <Modal
        visible={showCreateMenu}
        transparent
        animationType="none"
        onRequestClose={() => setShowCreateMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCreateMenu(false)}>
          <View style={{ flex: 1 }}>
            <View
              style={{
                position: "absolute",
                top: menuPos.top,
                left: menuPos.left,
                width: 168,
                borderRadius: 18,
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 14,
                elevation: 14,
                borderWidth: StyleSheet.hairlineWidth,
                borderTopColor: "rgba(255, 255, 255, 0.65)",
                borderLeftColor: "rgba(255, 255, 255, 0.35)",
                borderRightColor: "rgba(255, 255, 255, 0.35)",
                borderBottomColor: "rgba(0, 0, 0, 0.08)",
                backgroundColor: Platform.OS === "ios" ? "transparent" : MENU_ANDROID_BACKGROUND,
              }}
            >
              {Platform.OS === "ios" && (
                <BlurView
                  tint="systemChromeMaterial"
                  intensity={MENU_BLUR_INTENSITY}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(255, 255, 255, 0.5)", "rgba(255, 255, 255, 0)"]}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.6, y: 0.7 }}
                style={StyleSheet.absoluteFill}
              />

              <TouchableOpacity
                onPress={handlePickYourStory}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13 }}
              >
                <Sparkles size={16} color="#DD2A7B" strokeWidth={1.5} />
                <Text style={{ marginLeft: 10, fontSize: 13, fontWeight: "600", color: "#111827" }}>
                  Your Story
                </Text>
              </TouchableOpacity>

              <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)", marginHorizontal: 12 }} />

              <TouchableOpacity
                onPress={() => { setShowCreateMenu(false); onCreatePost(); }}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13 }}
              >
                <Plus size={16} color="#1877F2" strokeWidth={1.5} />
                <Text style={{ marginLeft: 10, fontSize: 13, fontWeight: "600", color: "#111827" }}>
                  Post
                </Text>
              </TouchableOpacity>

              <View style={{ height: 1, backgroundColor: "rgba(0,0,0,0.06)", marginHorizontal: 12 }} />

              <TouchableOpacity
                onPress={() => { setShowCreateMenu(false); onGoLive(); }}
                activeOpacity={0.7}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 13 }}
              >
                <Radio size={16} color="#DC2626" strokeWidth={1.5} />
                <Text style={{ marginLeft: 10, fontSize: 13, fontWeight: "600", color: "#111827" }}>
                  Live
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <FlatList
        horizontal
        data={rowItems}
        keyExtractor={(item) => item.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 12 }}
        style={{ flex: 1 }}
        renderItem={({ item }) =>
          item.kind === "live" ? (
            <RingAvatar
              name={item.stream.username ?? item.stream.user_id?.slice(0, 6) ?? "Live"}
              avatarUrl={item.stream.profile_image}
              seen={false}
              isLive
              onPress={() => onJoinLive(item.stream)}
            />
          ) : (
            <RingAvatar
              name={item.group.username}
              avatarUrl={item.group.avatarUrl}
              seen={isUserSeen(item.group.userId)}
              onPress={() => handlePressGroup(item.group)}
            />
          )
        }
      />
    </View>
  );
}
