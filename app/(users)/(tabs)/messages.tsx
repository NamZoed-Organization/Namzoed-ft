// app/(users)/(tabs)/messages.tsx
import BookMongooseModal from "@/components/BookMongooseModal";
import FollowRequests from "@/components/modals/FollowRequests";
import TrackMongooseModal from "@/components/modals/TrackMongooseModal";
import MongooseWorkerNavBar, {
  MONGOOSE_WORKER_NAV_BAR_HEIGHT,
} from "@/components/ui/MongooseWorkerNavBar";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUnreadMessages } from "@/contexts/UnreadMessagesContext";
import { useUser } from "@/contexts/UserContext";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useAppRouter } from "@/utils/navigation";
import { isMongooseUser } from "@/utils/roleCheck";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ConversationSkeleton from "@/components/ui/ConversationSkeleton";
import EdgeSwipeBack from "@/components/ui/EdgeSwipeBack";
import CircularLoader from "@/components/ui/CircularLoader";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Image } from "expo-image";
import {
  Alert,
  Dimensions,
  FlatList,
  InteractionManager,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Reanimated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const SCREEN_WIDTH = Dimensions.get("window").width;
// Width of each action button (Mute + Delete)
const ACTION_BTN_W = 80;
const ACTIONS_TOTAL = ACTION_BTN_W * 2; // 160px — fully revealed area
// Drag past this threshold → snap to full-width delete
const FULL_SWIPE_THRESHOLD = SCREEN_WIDTH * 0.6;
const DELETE_COLOR = "#FF3B30";
const MUTE_COLOR = "#8E8E93";
// Must match CHAT_DRAFT_KEY_PREFIX in app/(users)/chat/[id].tsx
const CHAT_DRAFT_KEY_PREFIX = "@namzoed_chat_draft_";
const DRAFT_LABEL_COLOR = "#EF4444";

// Types
interface IMessage {
  sender: string;
  content: string;
  timestamp: Date;
}

interface IUserData {
  messages: { [phoneNumber: string]: IMessage[] };
  following: string[];
  followers: string[];
  requests: { sender: string; content: string; timestamp: Date }[];
  userProfile: {
    phoneNumber: string;
    followingCount: number;
    followersCount: number;
    requestsCount: number;
  };
}

const getUserData = (_phoneNumber: string): IUserData => ({
  messages: {},
  following: [],
  followers: [],
  requests: [],
  userProfile: {
    phoneNumber: _phoneNumber,
    followingCount: 0,
    followersCount: 0,
    requestsCount: 0,
  },
});

/**
 * SwipeableConversationRow — iMessage-style left-swipe to reveal
 * Mute + Delete actions. Dragging all the way (≥ 60% screen width)
 * auto-triggers delete. Uses RNGH v2 GestureDetector so gesture
 * runs on the UI thread — no JS-thread lag.
 */
const SwipeableConversationRow = React.memo(function SwipeableConversationRow({
  children,
  onDelete,
  onMute,
  onPress,
  isMuted,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onMute: () => void;
  onPress: () => void;
  isMuted?: boolean;
}) {
  const translateX = useSharedValue(0);
  // Starting offset for the current gesture (so open → drag works correctly)
  const gestureStartX = useSharedValue(0);
  const isFullSwiped = useSharedValue(false);
  // Timing config — no bounce
  const SNAP = { duration: 240 };

  function triggerHaptic() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
  function doDelete() {
    onDelete();
  }

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .onBegin(() => {
      "worklet";
      gestureStartX.value = translateX.value;
    })
    .onUpdate((e) => {
      "worklet";
      const next = gestureStartX.value + e.translationX;
      translateX.value = Math.min(0, Math.max(-FULL_SWIPE_THRESHOLD, next));

      if (translateX.value <= -FULL_SWIPE_THRESHOLD && !isFullSwiped.value) {
        isFullSwiped.value = true;
        runOnJS(triggerHaptic)();
      } else if (translateX.value > -FULL_SWIPE_THRESHOLD * 0.8) {
        isFullSwiped.value = false;
      }
    })
    .onEnd(() => {
      "worklet";
      const pos = translateX.value;

      if (pos <= -FULL_SWIPE_THRESHOLD || isFullSwiped.value) {
        isFullSwiped.value = false;
        translateX.value = withTiming(0, SNAP);
        runOnJS(doDelete)();
        return;
      }

      // Snap open / shut — no bounce, plain ease-out
      if (pos < -ACTIONS_TOTAL / 2) {
        translateX.value = withTiming(-ACTIONS_TOTAL, SNAP);
      } else {
        translateX.value = withTiming(0, SNAP);
      }
    });

  // Row slides left
  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Progress 0→1 as drag goes from ACTIONS_TOTAL to FULL_SWIPE_THRESHOLD
  // (the "full-swipe expansion" zone)

  // Mute: fades out and collapses as drag enters the expansion zone
  const muteStyle = useAnimatedStyle(() => {
    const drag = Math.abs(translateX.value);
    const p = interpolate(
      drag,
      [ACTIONS_TOTAL, FULL_SWIPE_THRESHOLD * 0.7],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return {
      width: interpolate(
        drag,
        [ACTIONS_TOTAL, FULL_SWIPE_THRESHOLD * 0.7],
        [ACTION_BTN_W, 0],
        Extrapolation.CLAMP,
      ),
      opacity: p,
      overflow: "hidden" as const,
    };
  });

  // Delete: expands from ACTION_BTN_W to fill all revealed space
  const deleteStyle = useAnimatedStyle(() => {
    const drag = Math.abs(translateX.value);
    return {
      width: interpolate(
        drag,
        [ACTIONS_TOTAL, FULL_SWIPE_THRESHOLD],
        [ACTION_BTN_W, FULL_SWIPE_THRESHOLD],
        Extrapolation.CLAMP,
      ),
      backgroundColor: interpolateColor(
        drag,
        [0, ACTIONS_TOTAL, FULL_SWIPE_THRESHOLD],
        ["#f2f2f7", DELETE_COLOR, DELETE_COLOR],
      ),
    };
  });

  // Close the row — no bounce
  function closeRow() {
    translateX.value = withTiming(0, SNAP);
  }

  return (
    <GestureDetector gesture={pan}>
      <View style={{ overflow: "hidden" }}>
        {/* ── Action buttons (behind the row) ── */}
        <View
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: FULL_SWIPE_THRESHOLD,
            flexDirection: "row",
            alignItems: "stretch",
            justifyContent: "flex-end",
            backgroundColor: "#f2f2f7",
          }}
        >
          {/* Mute / Unmute — shrinks and fades as delete expands */}
          <Reanimated.View style={muteStyle}>
            <TouchableOpacity
              onPress={() => {
                closeRow();
                onMute();
              }}
              style={{
                flex: 1,
                minWidth: ACTION_BTN_W,
                backgroundColor: MUTE_COLOR,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons
                name={isMuted ? "notifications" : "notifications-off"}
                size={22}
                color="white"
              />
              <Reanimated.Text
                style={{ color: "white", fontSize: 12, marginTop: 4 }}
              >
                {isMuted ? "Unmute" : "Mute"}
              </Reanimated.Text>
            </TouchableOpacity>
          </Reanimated.View>

          {/* Delete — expands to fill revealed area on full swipe */}
          <Reanimated.View style={deleteStyle}>
            <TouchableOpacity
              onPress={() => {
                closeRow();
                onDelete();
              }}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="trash" size={22} color="white" />
              <Reanimated.Text
                style={{ color: "white", fontSize: 12, marginTop: 4 }}
              >
                Delete
              </Reanimated.Text>
            </TouchableOpacity>
          </Reanimated.View>
        </View>

        {/* ── Main row content (slides left) ── */}
        <Reanimated.View
          style={[rowStyle, { backgroundColor: "white", width: "100%" }]}
        >
          <TouchableOpacity
            onPress={() => {
              if (translateX.value < -10) {
                closeRow();
              } else {
                onPress();
              }
            }}
            activeOpacity={0.7}
          >
            {children}
          </TouchableOpacity>
        </Reanimated.View>
      </View>
    </GestureDetector>
  );
});

export default function MessageScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { currentUser } = useUser();
  const { trackTap } = useScreenAnalytics(Screens.MESSAGES);
  const { refreshUnreadCount, currentUserUUID, setIsOnMessagesScreen } =
    useUnreadMessages();

  // Tell the unread-messages context we're on the conversations screen
  // so it suppresses in-app chat banners while we're here.
  useFocusEffect(
    useCallback(() => {
      setIsOnMessagesScreen(true);
      return () => setIsOnMessagesScreen(false);
    }, [setIsOnMessagesScreen]),
  );

  // Unsent composer drafts keyed by partnerId, shown as "Draft: …" in the list
  // (WhatsApp-style). Refreshed each time the screen regains focus so a draft
  // typed in a chat appears immediately on returning here.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const keys = await AsyncStorage.getAllKeys();
          const draftKeys = keys.filter((k) =>
            k.startsWith(CHAT_DRAFT_KEY_PREFIX),
          );
          const next: Record<string, string> = {};
          if (draftKeys.length > 0) {
            const entries = await AsyncStorage.multiGet(draftKeys);
            for (const [key, value] of entries) {
              const text = (value ?? "").trim();
              if (!text) continue;
              const partnerId = key.slice(CHAT_DRAFT_KEY_PREFIX.length);
              next[partnerId] = text;
            }
          }
          if (active) setDrafts(next);
        } catch {
          if (active) setDrafts({});
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );
  const router = useAppRouter();
  const { tab } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [requestConversations, setRequestConversations] = useState<any[]>([]);
  const [showMessageRequests, setShowMessageRequests] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "warning" | "error" | "white";
    title: string;
    message: string;
  }>({ visible: false, type: "white", title: "", message: "" });
  const showPopup = (
    type: "success" | "warning" | "error" | "white",
    title: string,
    message: string,
  ) => setPopup({ visible: true, type, title, message });
  const [mongooseUsers, setMongooseUsers] = useState<any[]>([]);
  const [isLoadingMongoose, setIsLoadingMongoose] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [mongooseBookings, setMongooseBookings] = useState<any[]>([]);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [selectedBookingForTracking, setSelectedBookingForTracking] =
    useState<any>(null);
  // hiddenConversations: Set of partnerIds the current user has hidden (soft-deleted).
  // Stored in AsyncStorage so it persists across sessions.
  // Messages remain in the DB so the other person is unaffected.
  const [hiddenConversations, setHiddenConversations] = useState<Set<string>>(
    new Set(),
  );
  // Ref mirror so real-time callbacks (stale closures) can read the latest value.
  const hiddenConversationsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    hiddenConversationsRef.current = hiddenConversations;
  }, [hiddenConversations]);

  // mutedConversations: Set of partnerIds whose notifications are silenced.
  const [mutedConversations, setMutedConversations] = useState<Set<string>>(
    new Set(),
  );
  const conversationsPollRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const bookingsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const candidateUserIds = useMemo(() => {
    const ids = new Set<string>();
    if (currentUserUUID) ids.add(String(currentUserUUID));
    if (currentUser?.id) ids.add(String(currentUser.id));
    return Array.from(ids);
  }, [currentUserUUID, currentUser?.id]);

  // Conversations visible to the current user (hidden ones filtered out).
  // Re-computes whenever either the raw list or the hidden set changes.
  const visibleConversations = useMemo(
    () =>
      conversations.filter(
        (c) => !hiddenConversations.has(String(c.partnerId)),
      ),
    [conversations, hiddenConversations],
  );

  // ── AsyncStorage keys (per-user so multi-account works) ──────────────────
  const hiddenKey = useMemo(
    () =>
      currentUserUUID || currentUser?.id
        ? `hidden_conversations_${currentUserUUID ?? currentUser?.id}`
        : null,
    [currentUserUUID, currentUser?.id],
  );
  const mutedKey = useMemo(
    () =>
      currentUserUUID || currentUser?.id
        ? `muted_conversations_${currentUserUUID ?? currentUser?.id}`
        : null,
    [currentUserUUID, currentUser?.id],
  );

  // Load hidden/muted sets from AsyncStorage once the user key is known
  useEffect(() => {
    if (!hiddenKey) return;
    const task = InteractionManager.runAfterInteractions(() => {
      AsyncStorage.getItem(hiddenKey).then((val) => {
        if (val) {
          setHiddenConversations(new Set(JSON.parse(val) as string[]));
        }
      });
    });
    return () => task.cancel();
  }, [hiddenKey]);

  useEffect(() => {
    if (!mutedKey) return;
    const task = InteractionManager.runAfterInteractions(() => {
      AsyncStorage.getItem(mutedKey).then((val) => {
        if (val) {
          setMutedConversations(new Set(JSON.parse(val) as string[]));
        }
      });
    });
    return () => task.cancel();
  }, [mutedKey]);

  /** Hide a conversation for the current user only (soft-delete). */
  const hideConversation = useCallback(
    async (partnerId: string) => {
      const next = new Set(hiddenConversations);
      next.add(partnerId);
      setHiddenConversations(next);
      if (hiddenKey) {
        await AsyncStorage.setItem(hiddenKey, JSON.stringify(Array.from(next)));
      }
      // Record the deletion timestamp so the chat screen can hide
      // all messages that existed before this point.
      const uid = currentUserUUID || currentUser?.id;
      if (uid) {
        const tsKey = `hidden_conversations_ts_${uid}`;
        const raw = await AsyncStorage.getItem(tsKey);
        const tsMap: Record<string, string> = raw ? JSON.parse(raw) : {};
        tsMap[partnerId] = new Date().toISOString();
        await AsyncStorage.setItem(tsKey, JSON.stringify(tsMap));
      }
      // Also immediately remove from local conversation list
      setConversations((prev) => prev.filter((c) => c.partnerId !== partnerId));
      setRequestConversations((prev) =>
        prev.filter((c) => c.partnerId !== partnerId),
      );
    },
    [hiddenConversations, hiddenKey, currentUserUUID, currentUser?.id],
  );

  /** Toggle mute for a conversation. */
  const toggleMuteConversation = useCallback(
    async (partnerId: string) => {
      const next = new Set(mutedConversations);
      if (next.has(partnerId)) {
        next.delete(partnerId);
      } else {
        next.add(partnerId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setMutedConversations(next);
      if (mutedKey) {
        await AsyncStorage.setItem(mutedKey, JSON.stringify(Array.from(next)));
      }
    },
    [mutedConversations, mutedKey],
  );

  const formatConversationPreview = (message: any, isMine: boolean) => {
    if (!message) return "No messages yet";
    let content =
      typeof message.content === "string" ? message.content : message.content;

    // Strip embedded metadata wrappers used by chat screen persistence.
    if (typeof content === "string") {
      for (let i = 0; i < 3; i++) {
        if (
          content.startsWith("[product-meta]") &&
          content.includes("[/product-meta]")
        ) {
          const suffixIndex = content.indexOf("[/product-meta]");
          content = content
            .slice(suffixIndex + "[/product-meta]".length)
            .replace(/^\n/, "");
          continue;
        }
        if (
          content.startsWith("[reply-meta]") &&
          content.includes("[/reply-meta]")
        ) {
          const suffixIndex = content.indexOf("[/reply-meta]");
          content = content
            .slice(suffixIndex + "[/reply-meta]".length)
            .replace(/^\n/, "");
          continue;
        }
        break;
      }
    }

    if (message.message_type === "mongoose_invite")
      return isMine
        ? "You:  Mongoose delivery request"
        : " Mongoose delivery request";
    if (message.message_type === "image" || message.image_url) return "Photo";
    if (message.message_type === "audio" || message.audio_url)
      return "Voice message";
    if (message.message_type === "gif") return isMine ? "You: GIF" : "GIF";
    if (message.message_type === "sticker")
      return isMine ? "You: Sticker" : "Sticker";
    if (typeof content === "string" && content.includes("📍 My Location:")) {
      return "Location";
    }
    const preview = content || "No messages yet";
    return isMine ? `You: ${preview}` : preview;
  };

  const formatConversationTime = (iso?: string) => {
    if (!iso) return "";
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleDateString();
  };

  const userData = getUserData(currentUser?.phone_number || "");

  // Get follow requests (followers who user hasn't followed back)
  // Make conditional to avoid accessing userData when it's null
  const followRequests = useMemo(() => {
    if (!userData) return [];
    return userData.followers.filter(
      (follower) => !userData.following.includes(follower),
    );
  }, [userData]);

  // Get all conversations (only show users who have messages)
  // Make conditional to avoid accessing userData when it's null
  const conversationPartners = useMemo(() => {
    if (!userData) return [];
    return Object.keys(userData.messages as Record<string, IMessage[]>);
  }, [userData]);

  // Handle tab navigation from URL parameters
  useEffect(() => {
    if (tab) {
      const tabIndex = parseInt(tab as string, 10);
      if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 2) {
        setActiveTab(tabIndex);
      }
    }
  }, [tab]);

  // Search only among users the current user follows
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      const myId = currentUserUUID || currentUser?.id;
      if (!myId) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        // 1. Fetch the IDs of users I follow
        const { data: followData, error: followError } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", myId);

        if (followError) {
          console.error("Error fetching following list:", followError);
          setSearchResults([]);
          return;
        }

        const followingIds = (followData ?? []).map(
          (r: any) => r.following_id as string,
        );

        if (followingIds.length === 0) {
          // Not following anyone — no results to show
          setSearchResults([]);
          return;
        }

        // 2. Search by name only within followed users
        const { data: searchData, error: searchError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", followingIds)
          .ilike("name", `%${searchQuery}%`)
          .limit(10);

        if (searchError) {
          console.error("Error searching users:", searchError);
          setSearchResults([]);
        } else {
          setSearchResults(searchData || []);
        }
      } catch (e) {
        console.error("Search error:", e);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, currentUserUUID, currentUser?.id]);

  const resolveCurrentUserUUID = useCallback(async () => {
    if (currentUserUUID) return currentUserUUID;
    if (!currentUser) {
      const { data: authData } = await supabase.auth.getUser();
      return authData.user?.id ?? null;
    }

    if (currentUser.id) {
      const { data: byId } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (byId?.id) return byId.id;
    }

    const userPhone =
      currentUser.phone_number ||
      (currentUser as any)?.phone ||
      (currentUser as any)?.phoneNumber ||
      (currentUser as any)?.mobile;
    const cleanPhone = String(userPhone || "").replace("+975", "");

    if (userPhone || cleanPhone) {
      const { data: byPhone } = await supabase
        .from("profiles")
        .select("id")
        .or(`phone.eq.${userPhone},phone.eq.${cleanPhone}`)
        .maybeSingle();
      if (byPhone?.id) return byPhone.id;
    }

    const { data: authData } = await supabase.auth.getUser();
    return authData.user?.id ?? null;
  }, [currentUserUUID, currentUser]);

  // Fetch conversations from Supabase
  const fetchConversations = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setIsLoadingConversations(true);
      }
      try {
        const resolvedUUID = await resolveCurrentUserUUID();
        if (!resolvedUUID) {
          setConversations([]);
          setDebugInfo("Current user not found in profiles table");
          if (showLoader) setIsLoadingConversations(false);
          return;
        }

        // Fetch all messages where current user is sender or receiver using UUID
        const idsForQuery = Array.from(
          new Set([resolvedUUID, ...candidateUserIds].filter(Boolean)),
        );
        const inClause = idsForQuery.join(",");
        const { data: messages, error } = await supabase
          .from("messages")
          .select("*")
          .or(`sender_id.in.(${inClause}),receiver_id.in.(${inClause})`)
          .order("created_at", { ascending: false });

        if (error || !messages || messages.length === 0) {
          setConversations([]);
          setDebugInfo("No conversations for this user");
          setIsLoadingConversations(false);
          return;
        }

        // Extract unique partner UUIDs
        const partnerMap = new Map();
        const unreadMap = new Map<string, number>();
        for (const message of messages) {
          const isCurrentUserSender = idsForQuery.includes(
            String(message.sender_id),
          );
          const partnerId = isCurrentUserSender
            ? message.receiver_id
            : message.sender_id;

          if (
            !partnerMap.has(partnerId) ||
            new Date(message.created_at) >
              new Date(partnerMap.get(partnerId).created_at)
          ) {
            partnerMap.set(partnerId, message);
          }

          if (
            idsForQuery.includes(String(message.receiver_id)) &&
            message.sender_id === partnerId &&
            !message.is_read
          ) {
            unreadMap.set(partnerId, (unreadMap.get(partnerId) || 0) + 1);
          }
        }

        const partnerIds = Array.from(partnerMap.keys());

        let profiles: any[] = [];

        if (partnerIds.length > 0) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("id, name, phone, avatar_url, email")
            .in("id", partnerIds);

          profiles = profileData || [];
        }

        // --- Mutual-follow + request gating ---
        // 1. Who does the current user follow?
        const { data: myFollowingData } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", resolvedUUID);
        const myFollowingSet = new Set<string>(
          (myFollowingData ?? []).map((r: any) => String(r.following_id)),
        );

        // 2. Who follows the current user?
        const { data: myFollowersData } = await supabase
          .from("follows")
          .select("follower_id")
          .eq("following_id", resolvedUUID);
        const myFollowersSet = new Set<string>(
          (myFollowersData ?? []).map((r: any) => String(r.follower_id)),
        );

        // 3. Fetch message_requests where I am the receiver
        const { data: incomingRequests } = await supabase
          .from("message_requests")
          .select("sender_id, status, context")
          .eq("receiver_id", resolvedUUID);
        // Map sender_id → { status, context }
        const requestMap = new Map<string, { status: string; context: string }>(
          (incomingRequests ?? []).map((r: any) => [
            String(r.sender_id),
            {
              status: String(r.status),
              context: String(r.context ?? "personal"),
            },
          ]),
        );

        const allConversations = partnerIds
          .map((pid) => {
            const lastMessage = partnerMap.get(pid);
            const partnerProfile = profiles.find((p) => p.id === pid);
            return {
              partnerId: pid,
              partnerProfile,
              lastMessage,
              unreadCount: unreadMap.get(pid) || 0,
              created_at: lastMessage.created_at,
            };
          })
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          );

        // Classify each conversation
        const mainConvos: any[] = [];
        const reqConvos: any[] = [];

        for (const convo of allConversations) {
          const pid = String(convo.partnerId);
          const isMutual = myFollowingSet.has(pid) && myFollowersSet.has(pid);
          const requestEntry = requestMap.get(pid); // only set when partner sent me a request
          const requestStatus = requestEntry?.status;
          const requestContext = requestEntry?.context ?? "personal";
          // Mongoose delivery users always land in the main inbox — they are
          // service accounts, not social contacts, so the follow gate doesn't apply.
          const isMongoosePartner = String(
            convo.partnerProfile?.email ?? "",
          ).startsWith("mongoose@gmail.com");

          if (isMutual || requestStatus === "accepted" || isMongoosePartner) {
            // Mutual follow, accepted request, or mongoose service user → main inbox
            mainConvos.push(convo);
          } else if (
            requestStatus === "pending" &&
            requestContext === "commerce"
          ) {
            // Commerce inquiry (product/marketplace) → always in main inbox,
            // no follow required — this is a legitimate buyer→seller interaction
            mainConvos.push(convo);
          } else if (requestStatus === "pending") {
            // Personal message request → requests tray
            reqConvos.push(convo);
          } else {
            // No request row yet — check who sent the last message.
            // If I sent it, I'm the initiator → show in my main inbox.
            // If they sent it to me without mutual follow, treat as a pending request.
            const lastSenderId = String(convo.lastMessage?.sender_id || "");
            const iAmSender = idsForQuery.includes(lastSenderId);
            if (iAmSender) {
              mainConvos.push(convo);
            } else {
              reqConvos.push(convo);
            }
          }
        }

        setConversations(mainConvos);
        setRequestConversations(reqConvos);
        await refreshUnreadCount();
        setDebugInfo(
          `${mainConvos.length} chats · ${reqConvos.length} requests`,
        );
      } catch (e) {
        console.error("Error fetching conversations:", e);
        setDebugInfo(`Error: ${(e as any).message}`);
        setConversations([]);
      } finally {
        if (showLoader) {
          setIsLoadingConversations(false);
        }
      }
    },
    [candidateUserIds, currentUser, refreshUnreadCount, resolveCurrentUserUUID],
  );

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchConversations(true);
    });
    return () => task.cancel();
  }, [fetchConversations]);

  // Fetch mongoose users (users with email starting with mongoose@gmail.com)
  const fetchMongooseUsers = async () => {
    setIsLoadingMongoose(true);
    try {
      const { data: mongooseProfiles, error } = await supabase
        .from("profiles")
        .select("*")
        .ilike("email", "mongoose@gmail.com%")
        .order("name", { ascending: true });

      if (error) {
        console.error("❌ Error fetching mongoose users:", error);
        setMongooseUsers([]);
      } else {
        setMongooseUsers(mongooseProfiles || []);
      }
    } catch (e) {
      console.error("Error fetching mongoose users:", e);
      setMongooseUsers([]);
    } finally {
      setIsLoadingMongoose(false);
    }
  };

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchMongooseUsers();
    });
    return () => task.cancel();
  }, []);

  // Fetch ALL mongoose bookings to properly determine mongoose availability
  const fetchMongooseBookings = useCallback(async () => {
    if (!currentUser?.id) return;

    try {
      // Fetch ALL bookings (not just current user's) to determine mongoose availability
      const { data: allBookings, error: allError } = await supabase
        .from("booking_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (allError) {
        console.error("Error fetching all bookings:", allError);
      } else {
        // Store ALL bookings to properly calculate mongoose availability
        setMongooseBookings(allBookings || []);
      }
    } catch (e) {
      console.error("Error fetching mongoose bookings:", e);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) return;
    const task = InteractionManager.runAfterInteractions(() => {
      fetchMongooseBookings();
    });
    return () => task.cancel();
  }, [currentUser?.id]);

  // Subscribe to real-time booking updates (listen to ALL bookings to detect when mongoose becomes available)
  useEffect(() => {
    if (!currentUser?.id) return;

    // Use unique channel name to prevent conflicts on reload
    const channelName = `all_bookings_${Date.now()}`;
    let isSubscribed = true;

    // Subscribe to ALL booking changes to get instant updates for all mongooses
    const bookingsChannel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "booking_requests",
        },
        (payload) => {
          if (!isSubscribed) return; // Ignore if already unsubscribed

          // Handle different event types
          if (
            payload.eventType === "INSERT" ||
            payload.eventType === "UPDATE"
          ) {
            const newBooking = payload.new as any;

            // Update bookings immediately (optimistic update)
            setMongooseBookings((prev) => {
              const filtered = prev.filter((b) => b.id !== newBooking.id);
              const updated = [newBooking, ...filtered].sort(
                (a, b) =>
                  new Date(b.created_at).getTime() -
                  new Date(a.created_at).getTime(),
              );
              return updated;
            });
          } else if (payload.eventType === "DELETE") {
            const deletedBooking = payload.old as any;

            setMongooseBookings((prev) => {
              const updated = prev.filter((b) => b.id !== deletedBooking.id);
              return updated;
            });
          }
        },
      )
      .subscribe((status) => {
        if (!isSubscribed) return;
        if (status === "SUBSCRIBED") {
          if (bookingsPollRef.current) {
            clearInterval(bookingsPollRef.current);
            bookingsPollRef.current = null;
          }
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Real-time subscription ERROR");
          if (!bookingsPollRef.current) {
            bookingsPollRef.current = setInterval(() => {
              if (!isSubscribed) return;
              fetchMongooseBookings();
            }, 8000);
          }
        } else if (status === "TIMED_OUT") {
          console.error("⏱️ Real-time subscription TIMED OUT");
          if (!bookingsPollRef.current) {
            bookingsPollRef.current = setInterval(() => {
              if (!isSubscribed) return;
              fetchMongooseBookings();
            }, 8000);
          }
        } else if (status === "CLOSED") {
        }
      });

    return () => {
      isSubscribed = false;
      supabase.removeChannel(bookingsChannel);
      if (bookingsPollRef.current) {
        clearInterval(bookingsPollRef.current);
        bookingsPollRef.current = null;
      }
    };
  }, [currentUser?.id]);

  // Subscribe to real-time updates for new messages
  useEffect(() => {
    let isSubscribed = true;
    const setupRealtimeSubscription = async () => {
      const userUUID = await resolveCurrentUserUUID();
      if (!isSubscribed) return;

      if (!userUUID) {
        return;
      }

      const channel = supabase
        .channel(`conversations_${userUUID}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "messages",
          },
          (payload) => {
            if (!isSubscribed) return;
            const next = payload.new as any;
            const old = payload.old as any;
            const senderId = String(next?.sender_id || old?.sender_id || "");
            const receiverId = String(
              next?.receiver_id || old?.receiver_id || "",
            );
            const isRelevant =
              candidateUserIds.includes(senderId) ||
              candidateUserIds.includes(receiverId) ||
              senderId === String(userUUID) ||
              receiverId === String(userUUID);

            if (!isRelevant) return;

            // If a new message arrives from a hidden partner, un-hide them
            // (mirrors iMessage behaviour: receiving a new message resurfaces the chat).
            if (payload.eventType === "INSERT" && next) {
              const partnerId = candidateUserIds.includes(senderId)
                ? receiverId
                : senderId;
              if (partnerId && hiddenConversationsRef.current.has(partnerId)) {
                const next2 = new Set(hiddenConversationsRef.current);
                next2.delete(partnerId);
                setHiddenConversations(next2);
                // Persist removal to AsyncStorage
                const key = `hidden_conversations_${userUUID}`;
                AsyncStorage.setItem(key, JSON.stringify(Array.from(next2)));
              }
            }

            fetchConversations(false);
          },
        )
        .subscribe((status) => {
          if (!isSubscribed) return;
          if (status === "SUBSCRIBED") {
            if (conversationsPollRef.current) {
              clearInterval(conversationsPollRef.current);
              conversationsPollRef.current = null;
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            if (!conversationsPollRef.current) {
              conversationsPollRef.current = setInterval(() => {
                if (!isSubscribed) return;
                fetchConversations(false);
              }, 5000);
            }
          }
        });

      return () => {
        supabase.removeChannel(channel);
        if (conversationsPollRef.current) {
          clearInterval(conversationsPollRef.current);
          conversationsPollRef.current = null;
        }
      };
    };

    let cleanup: (() => void) | undefined;
    setupRealtimeSubscription().then((fn) => {
      cleanup = fn;
    });

    return () => {
      isSubscribed = false;
      cleanup?.();
      if (conversationsPollRef.current) {
        clearInterval(conversationsPollRef.current);
        conversationsPollRef.current = null;
      }
    };
  }, [
    candidateUserIds,
    currentUserUUID,
    fetchConversations,
    resolveCurrentUserUUID,
  ]);

  const handleFollowBack = (phoneNumber: string) => {
    // Here you would update the backend and local state
  };

  const handleReject = (phoneNumber: string) => {
    // Here you would remove from followers or block
  };

  const handleAcceptMessageRequest = async (senderId: string) => {
    const myId = currentUserUUID || currentUser?.id;
    if (!myId) {
      showPopup(
        "error",
        "Account Error",
        "Could not identify your account. Please try again.",
      );
      return;
    }

    try {
      // Upsert so it works whether or not the row was pre-created by the sender
      const { error } = await supabase
        .from("message_requests")
        .upsert(
          { sender_id: senderId, receiver_id: myId, status: "accepted" },
          { onConflict: "sender_id,receiver_id" },
        );

      if (error) {
        console.error("Accept request error:", error.message);
        // If the table doesn't exist, still move the conversation optimistically
        if (!error.message.includes("does not exist")) {
          showPopup(
            "error",
            "Accept Failed",
            "Failed to accept request: " + error.message,
          );
          return;
        }
      }

      // Move from requests tray → main inbox
      setRequestConversations((prev) => {
        const moved = prev.find((c) => c.partnerId === senderId);
        if (moved) setConversations((main) => [moved, ...main]);
        return prev.filter((c) => c.partnerId !== senderId);
      });
    } catch (e: any) {
      console.error("Accept request exception:", e);
      showPopup(
        "error",
        "Something Went Wrong",
        e?.message || "An unexpected error occurred.",
      );
    }
  };

  const handleDeclineMessageRequest = async (
    senderId: string,
    partnerName: string,
  ) => {
    Alert.alert(
      "Delete Request",
      `Delete the message request from ${partnerName}? They won't be notified.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const myId = currentUserUUID || currentUser?.id;
            if (!myId) {
              showPopup(
                "error",
                "Account Error",
                "Could not identify your account. Please try again.",
              );
              return;
            }

            try {
              // Upsert declined status (handles missing row gracefully)
              const { error } = await supabase.from("message_requests").upsert(
                {
                  sender_id: senderId,
                  receiver_id: myId,
                  status: "declined",
                },
                { onConflict: "sender_id,receiver_id" },
              );

              if (error) {
                console.warn(
                  "Decline request error (proceeding anyway):",
                  error.message,
                );
              }

              // Always remove from UI regardless of DB result
              setRequestConversations((prev) =>
                prev.filter((c) => c.partnerId !== senderId),
              );
            } catch (e: any) {
              console.error("Decline request exception:", e);
              // Still remove from UI
              setRequestConversations((prev) =>
                prev.filter((c) => c.partnerId !== senderId),
              );
            }
          },
        },
      ],
    );
  };

  const handleDeleteConversation = (partnerId: string, partnerName: string) => {
    Alert.alert(
      "Delete Chat?",
      `This will remove the conversation with ${partnerName} from your inbox. ${partnerName} will still be able to see it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            // Soft-delete: hide only for the current user.
            // Messages remain in the DB so the other person is unaffected.
            hideConversation(partnerId);
          },
        },
      ],
    );
  };

  const renderConversationItem = ({ item: conversation }: { item: any }) => {
    // Handle both UUID-based profiles and phone-based profiles
    const userName =
      conversation.partnerProfile?.name ||
      conversation.partnerProfile?.username ||
      conversation.partnerId?.substring(0, 8) ||
      "Unknown";
    const avatarUri =
      conversation.partnerProfile?.avatar_url ||
      conversation.partnerProfile?.profile_url ||
      null;
    const lastMessage = conversation.lastMessage;
    const senderId = String(lastMessage?.sender_id || "");
    const isLastMessageMine = candidateUserIds.includes(senderId);
    const hasUnreadIncoming =
      !isLastMessageMine && conversation.unreadCount > 0;
    const isMuted = mutedConversations.has(String(conversation.partnerId));
    const draftText = drafts[String(conversation.partnerId)]?.replace(
      /\s+/g,
      " ",
    );

    return (
      <SwipeableConversationRow
        onPress={() => {
          trackTap("chat_row", "chat_open", { partner_id: conversation.partnerId });
          router.push(`/(users)/chat/${conversation.partnerId}`);
        }}
        onDelete={() =>
          handleDeleteConversation(conversation.partnerId, userName)
        }
        onMute={() => toggleMuteConversation(String(conversation.partnerId))}
        isMuted={isMuted}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 13,
            backgroundColor: "white",
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: "#e5e7eb",
          }}
        >
          {/* Avatar 56px */}
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                marginRight: 12,
              }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                borderCurve: "continuous",
                marginRight: 12,
                backgroundColor: "#094569",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "700", fontSize: 20 }}>
                {userName?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
          )}

          {/* Right column */}
          <View style={{ flex: 1 }}>
            {/* Top row: name + timestamp */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 3,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  flex: 1,
                  marginRight: 8,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 15,
                    color: "#111827",
                    fontWeight: hasUnreadIncoming ? "700" : "600",
                  }}
                >
                  {userName}
                </Text>
                {isMuted && (
                  <Ionicons
                    name="notifications-off"
                    size={12}
                    color="#8E8E93"
                  />
                )}
              </View>
              <Text style={{ fontSize: 12, color: "#9ca3af", flexShrink: 0 }}>
                {formatConversationTime(conversation.lastMessage?.created_at)}
              </Text>
            </View>

            {/* Bottom row: preview + unread indicator */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  flex: 1,
                  marginRight: 8,
                  color: hasUnreadIncoming ? "#1f2937" : "#6b7280",
                  fontWeight: hasUnreadIncoming ? "600" : "400",
                }}
              >
                {draftText ? (
                  <>
                    <Text
                      style={{
                        color: DRAFT_LABEL_COLOR,
                        fontWeight: "500",
                      }}
                    >
                      Draft:{" "}
                    </Text>
                    {draftText}
                  </>
                ) : (
                  formatConversationPreview(lastMessage, isLastMessageMine)
                )}
              </Text>
              {conversation.unreadCount > 0 &&
                (conversation.unreadCount <= 9 ? (
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      borderCurve: "continuous",
                      backgroundColor: "#094569",
                    }}
                  />
                ) : (
                  <View
                    style={{
                      minWidth: 18,
                      height: 18,
                      borderRadius: 9,
                      borderCurve: "continuous",
                      backgroundColor: "#094569",
                      paddingHorizontal: 4,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontSize: 10,
                        fontWeight: "700",
                      }}
                    >
                      9+
                    </Text>
                  </View>
                ))}
            </View>
          </View>
        </View>
      </SwipeableConversationRow>
    );
  };

  const renderSearchResultItem = ({ item: user }: { item: any }) => {
    // Handle different possible column names
    const userName =
      user.name || user.username || user.full_name || "Unknown User";
    const userPhone =
      user.phone || user.phone_number || user.mobile || "Unknown";
    const userId = user.id; // This should be the UUID from profiles table

    return (
      <TouchableOpacity
        className="flex-row items-center p-4 border-b border-gray-200"
        onPress={() => {
          setSearchQuery(""); // Clear search
          router.push(`/(users)/chat/${userId}`); // Use UUID instead of phone
        }}
      >
        <View className="w-12 h-12 bg-blue-500 rounded-full items-center justify-center mr-3">
          <Text className="text-white font-bold">
            {userName?.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-800">{userName}</Text>
          <Text className="text-sm text-gray-500 mt-1">{userPhone}</Text>
        </View>
        <Ionicons name="chatbubble-outline" size={20} color="#666" />
      </TouchableOpacity>
    );
  };

  const renderMongooseUserItem = ({ item: user }: { item: any }) => {
    const userName =
      user.name || user.username || user.full_name || "Mongoose User";
    const userEmail = user.email || "No email";

    // Latest booking from current user for this mongoose
    const userBooking = mongooseBookings
      .filter(
        (b) => b.mongoose_email === userEmail && b.user_id === currentUser?.id,
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0];

    // Is this mongoose currently busy with ANY user's accepted booking?
    const isBusy = mongooseBookings.some(
      (b) => b.mongoose_email === userEmail && b.status === "accepted",
    );

    const hasLocationData =
      userBooking?.pickup_latitude && userBooking?.delivery_latitude;

    const handleTrackPress = () => {
      if (userBooking && hasLocationData) {
        setSelectedBookingForTracking(userBooking);
        setShowTrackingModal(true);
      }
    };

    // Booking status label + color for the current user's request
    const bookingStatusConfig: Record<
      string,
      { label: string; bg: string; text: string; icon: string }
    > = {
      pending: {
        label: "Pending",
        bg: "#fef3c7",
        text: "#92400e",
        icon: "time-outline",
      },
      accepted: {
        label: "Accepted",
        bg: "#dbeafe",
        text: "#1e40af",
        icon: "checkmark-circle-outline",
      },
      rejected: {
        label: "Rejected",
        bg: "#fee2e2",
        text: "#991b1b",
        icon: "close-circle-outline",
      },
      completed: {
        label: "Delivered",
        bg: "#d1fae5",
        text: "#065f46",
        icon: "checkmark-done-outline",
      },
    };
    const statusCfg = userBooking
      ? bookingStatusConfig[userBooking.status]
      : null;

    return (
      <View
        style={{
          backgroundColor: "white",
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
          padding: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* Avatar */}
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              borderCurve: "continuous",
              backgroundColor: isBusy ? "#f97316" : "#094569",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Ionicons name="bicycle" size={22} color="white" />
          </View>

          {/* Name + email */}
          <View style={{ flex: 1 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <Text
                style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}
              >
                {userName}
              </Text>
              {/* Free / Busy badge */}
              <View
                style={{
                  backgroundColor: isBusy ? "#fff7ed" : "#f0fdf4",
                  borderRadius: 10,
                  borderCurve: "continuous",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: isBusy ? "#fed7aa" : "#bbf7d0",
                }}
              >
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    borderCurve: "continuous",
                    backgroundColor: isBusy ? "#f97316" : "#16a34a",
                    marginRight: 4,
                  }}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: isBusy ? "#c2410c" : "#15803d",
                  }}
                >
                  {isBusy ? "Busy" : "Free"}
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              {userEmail}
            </Text>

            {/* Current user's booking status chip */}
            {statusCfg && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 5,
                  backgroundColor: statusCfg.bg,
                  borderRadius: 8,
                  borderCurve: "continuous",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  alignSelf: "flex-start",
                }}
              >
                <Ionicons
                  name={statusCfg.icon as any}
                  size={13}
                  color={statusCfg.text}
                />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: statusCfg.text,
                    marginLeft: 4,
                  }}
                >
                  Your booking: {statusCfg.label}
                </Text>
              </View>
            )}
          </View>

          {/* Action button */}
          {userBooking?.status === "accepted" && hasLocationData ? (
            <TouchableOpacity
              style={{
                backgroundColor: "#f97316",
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 10,
                borderCurve: "continuous",
                flexDirection: "row",
                alignItems: "center",
              }}
              onPress={handleTrackPress}
            >
              <Ionicons name="navigate" size={17} color="white" />
              <Text
                style={{
                  color: "white",
                  fontWeight: "600",
                  marginLeft: 5,
                  fontSize: 13,
                }}
              >
                Track
              </Text>
            </TouchableOpacity>
          ) : userBooking?.status === "completed" ? (
            <View
              style={{
                backgroundColor: "#d1fae5",
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 10,
                borderCurve: "continuous",
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons name="checkmark-done" size={17} color="#065f46" />
              <Text
                style={{
                  color: "#065f46",
                  fontWeight: "600",
                  marginLeft: 5,
                  fontSize: 13,
                }}
              >
                Done
              </Text>
            </View>
          ) : userBooking?.status === "pending" ||
            userBooking?.status === "accepted" ? (
            <View
              style={{
                backgroundColor: "#f3f4f6",
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 10,
                borderCurve: "continuous",
              }}
            >
              <Text
                style={{ color: "#6b7280", fontWeight: "600", fontSize: 13 }}
              >
                Booked
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={{
                backgroundColor: isBusy ? "#d1d5db" : "#094569",
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 10,
                borderCurve: "continuous",
                flexDirection: "row",
                alignItems: "center",
              }}
              onPress={() => !isBusy && setShowBookingModal(true)}
              disabled={isBusy}
            >
              <Ionicons name="calendar-outline" size={17} color="white" />
              <Text
                style={{
                  color: "white",
                  fontWeight: "600",
                  marginLeft: 5,
                  fontSize: 13,
                }}
              >
                {isBusy ? "Busy" : "Book"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ── Frequent contacts suggestion panel (hooks must be before early returns) ──
  const recentContacts = useMemo(
    () =>
      visibleConversations.slice(0, 12).map((c) => ({
        id: String(c.partnerId),
        name: c.partnerProfile?.name || c.partnerProfile?.username || "Unknown",
        avatar:
          c.partnerProfile?.avatar_url || c.partnerProfile?.profile_url || null,
      })),
    [visibleConversations],
  );

  const suggestionProgress = useSharedValue(0);
  const SUGGESTION_MAX_H = 315;

  const suggestionStyle = useAnimatedStyle(() => ({
    maxHeight: suggestionProgress.value * SUGGESTION_MAX_H,
    opacity: suggestionProgress.value,
    overflow: "hidden",
  }));

  const showSuggestions =
    isSearchFocused && !searchQuery.trim() && recentContacts.length > 0;

  useEffect(() => {
    suggestionProgress.value = withTiming(showSuggestions ? 1 : 0, {
      duration: showSuggestions ? 260 : 180,
    });
  }, [showSuggestions]);

  const handleSuggestionPress = (contactId: string) => {
    setIsSearchFocused(false);
    setSearchQuery("");
    router.push(`/(users)/chat/${contactId}`);
  };

  // Early returns AFTER all hooks are defined to avoid hook order violations
  // Check if user is logged in
  if (!currentUser) {
    return (
      <EdgeSwipeBack onSwipeBack={() => router.back()}>
        <View className="flex-1 bg-background">
          {/* Status Bar Space */}
          <View className="h-12 bg-white" />

          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-base font-regular text-gray-500 text-center">
              Please login to view messages
            </Text>
          </View>
        </View>
      </EdgeSwipeBack>
    );
  }

  // Check if userData is available
  if (!userData) {
    return (
      <EdgeSwipeBack onSwipeBack={() => router.back()}>
        <View className="flex-1 bg-background">
          {/* Status Bar Space */}
          <View className="h-12 bg-white" />

          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-base font-regular text-gray-500 text-center">
              No user data found
            </Text>
          </View>
        </View>
      </EdgeSwipeBack>
    );
  }

  // If showing follow requests, render the FollowRequests component
  if (showFollowRequests) {
    return (
      <EdgeSwipeBack onSwipeBack={() => router.back()}>
        <View className="flex-1 bg-background">
          {/* Status Bar Space */}
          <View className="h-12 bg-white" />

          {/* Fixed Header */}
          <View className="bg-white px-4 py-6 border-b border-gray-200">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setShowFollowRequests(false)}
                className="mr-3"
              >
                <Ionicons name="arrow-back" size={24} color="#007AFF" />
              </TouchableOpacity>

              <Text className="text-xl font-bold text-gray-800">
                Follow Requests
              </Text>

              <View className="flex-1" />

              {followRequests.length > 0 && (
                <View className="bg-red-500 rounded-full w-6 h-6 items-center justify-center">
                  <Text className="text-white text-xs font-bold">
                    {followRequests.length}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <FollowRequests
            onClose={() => setShowFollowRequests(false)}
            userId={currentUser.id || ""}
          />
        </View>
      </EdgeSwipeBack>
    );
  }

  const tabs = ["Messages", "Mongoose"];
  const showMongooseWorkerNav = isMongooseUser(currentUser?.email);
  const listBottomPad = showMongooseWorkerNav
    ? insets.bottom + MONGOOSE_WORKER_NAV_BAR_HEIGHT + 8
    : tabBarHeight + insets.bottom + 16;

  return (
    <EdgeSwipeBack onSwipeBack={() => router.back()}>
    <View className="flex-1 bg-background">
      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup((p) => ({ ...p, visible: false }))}
      />
      {/* Status Bar Space */}
      <View className="h-12 bg-white" />

      {/* Tabs — fixed below the header */}
      <View className="flex-row bg-white border-b border-gray-200">
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={index}
            className={`flex-1 py-4 items-center ${
              activeTab === index ? "border-b-2 border-primary" : ""
            }`}
            onPress={() => setActiveTab(index)}
          >
            <Text
              className={`font-medium ${
                activeTab === index ? "text-primary" : "text-gray-500"
              }`}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab 0: Messages */}
      {activeTab === 0 && !showMessageRequests && (
        <>
          {/* Search Bar — lives outside FlatList so the keyboard never dismisses on re-render */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              backgroundColor: "white",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#f3f4f6",
                borderRadius: 24,
                borderCurve: "continuous",
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Ionicons name="search" size={18} color="#9ca3af" />
              <TextInput
                style={{
                  flex: 1,
                  marginLeft: 8,
                  fontSize: 15,
                  color: "#000",
                  paddingVertical: 0,
                }}
                placeholderTextColor="#9ca3af"
                placeholder="Search"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
              />
              {isSearching && (
                <CircularLoader
                  size="small"
                  color="#9ca3af"
                  style={{ marginLeft: 6 }}
                />
              )}
            </View>
          </View>

          {/* ── Frequent-contacts suggestion panel ── */}
          <Reanimated.View style={suggestionStyle}>
            <View
              style={{
                backgroundColor: "white",
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: "#e5e7eb",
                paddingBottom: 14,
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "600",
                  color: "#9ca3af",
                  letterSpacing: 0.6,
                  textTransform: "uppercase",
                  paddingHorizontal: 16,
                  paddingTop: 10,
                  paddingBottom: 10,
                }}
              >
                Frequent Contacts
              </Text>
              {/* Vertical grid — 4 cols, max 3 rows visible, scrollable beyond */}
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 87 * 3 }}
                contentContainerStyle={{ paddingHorizontal: 8 }}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {recentContacts.map((contact) => (
                    <TouchableOpacity
                      key={contact.id}
                      onPress={() => handleSuggestionPress(contact.id)}
                      activeOpacity={0.75}
                      style={{
                        width: "25%",
                        alignItems: "center",
                        paddingVertical: 8,
                        paddingHorizontal: 4,
                      }}
                    >
                      {contact.avatar ? (
                        <Image
                          source={{ uri: contact.avatar }}
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 26,
                            backgroundColor: "#e5e7eb",
                          }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: 26,
                            borderCurve: "continuous",
                            backgroundColor: "#094569",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              color: "white",
                              fontWeight: "700",
                              fontSize: 20,
                            }}
                          >
                            {contact.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 11,
                          color: "#374151",
                          marginTop: 5,
                          textAlign: "center",
                          width: "100%",
                        }}
                      >
                        {contact.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </Reanimated.View>

          {isLoadingConversations && conversations.length === 0 ? (
            <View style={{ flex: 1, paddingBottom: listBottomPad }}>
              <ConversationSkeleton count={8} />
            </View>
          ) : (
            <FlatList
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: listBottomPad }}
              keyboardShouldPersistTaps="handled"
              data={searchQuery.trim() ? searchResults : visibleConversations}
              renderItem={
                searchQuery.trim()
                  ? renderSearchResultItem
                  : renderConversationItem
              }
              keyExtractor={(item) =>
                item.id || item.partnerId || item.phone || item.phone_number
              }
              ListHeaderComponent={() => (
                <>
                  {/* Message Requests banner */}
                  {!searchQuery.trim() && requestConversations.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setShowMessageRequests(true)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        backgroundColor: "white",
                        borderBottomWidth: 1,
                        borderBottomColor: "#f3f4f6",
                      }}
                    >
                      {/* Avatar stack */}
                      <View
                        style={{
                          width: 46,
                          height: 46,
                          marginRight: 12,
                          position: "relative",
                        }}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            borderCurve: "continuous",
                            backgroundColor: "#e0e7ef",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "absolute",
                            top: 0,
                            left: 0,
                            borderWidth: 2,
                            borderColor: "white",
                          }}
                        >
                          <Ionicons name="person" size={18} color="#6b7280" />
                        </View>
                        {requestConversations.length > 1 && (
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              borderCurve: "continuous",
                              backgroundColor: "#cbd5e1",
                              alignItems: "center",
                              justifyContent: "center",
                              position: "absolute",
                              bottom: 0,
                              right: 0,
                              borderWidth: 2,
                              borderColor: "white",
                            }}
                          >
                            <Ionicons name="person" size={14} color="#6b7280" />
                          </View>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "600",
                            color: "#111827",
                          }}
                        >
                          Message Requests
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            color: "#6b7280",
                            marginTop: 1,
                          }}
                        >
                          {requestConversations.length}{" "}
                          {requestConversations.length === 1
                            ? "request"
                            : "requests"}
                        </Text>
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <View
                          style={{
                            minWidth: 20,
                            height: 20,
                            borderRadius: 10,
                            borderCurve: "continuous",
                            backgroundColor: "#094569",
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 5,
                          }}
                        >
                          <Text
                            style={{
                              color: "white",
                              fontSize: 11,
                              fontWeight: "700",
                            }}
                          >
                            {requestConversations.length}
                          </Text>
                        </View>
                        <Ionicons
                          name="chevron-forward"
                          size={16}
                          color="#9ca3af"
                        />
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Section label */}
                  {searchQuery.trim() && searchResults.length > 0 && (
                    <View className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <Text className="text-sm font-medium text-gray-600">
                        Search Results ({searchResults.length})
                      </Text>
                    </View>
                  )}
                  {!searchQuery.trim() && conversations.length > 0 && (
                    <View className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                      <Text className="text-sm font-medium text-gray-600">
                        Your Chats ({conversations.length})
                      </Text>
                    </View>
                  )}
                </>
              )}
              ListEmptyComponent={() => {
                if (searchQuery.trim() && !isSearching) {
                  return (
                    <View className="items-center justify-center py-8 px-6">
                      <Text className="text-gray-500 text-center">
                        No followed users match &quot;{searchQuery}&quot;.
                      </Text>
                      <Text className="text-gray-400 text-center text-xs mt-1">
                        You can only message people you follow.
                      </Text>
                    </View>
                  );
                }
                if (!searchQuery.trim()) {
                  return (
                    <View className="items-center justify-center py-8">
                      <Text className="text-gray-500 text-center">
                        No conversations yet.
                      </Text>
                      <Text className="text-gray-500 text-center mt-1">
                        Search for someone you follow to start chatting.
                      </Text>
                    </View>
                  );
                }
                return null;
              }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </>
      )}

      {/* Message Requests view */}
      {activeTab === 0 && showMessageRequests && (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: listBottomPad }}
          data={requestConversations}
          keyExtractor={(item) => item.partnerId}
          renderItem={({ item: convo }) => {
            const name =
              convo.partnerProfile?.name ||
              convo.partnerProfile?.username ||
              "Unknown";
            const preview = formatConversationPreview(convo.lastMessage, false);
            const initials = name.charAt(0).toUpperCase();
            return (
              <View
                style={{
                  backgroundColor: "white",
                  borderBottomWidth: 1,
                  borderBottomColor: "#f3f4f6",
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  {/* Avatar */}
                  <TouchableOpacity
                    onPress={() => {
                      setShowMessageRequests(false);
                      router.push(`/(users)/chat/${convo.partnerId}`);
                    }}
                  >
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        borderCurve: "continuous",
                        backgroundColor: "#e0e7ef",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}
                    >
                      {convo.partnerProfile?.avatar_url ? (
                        <Image
                          source={{ uri: convo.partnerProfile.avatar_url }}
                          style={{ width: 50, height: 50, borderRadius: 25 }}
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: "700",
                            color: "#6b7280",
                          }}
                        >
                          {initials}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Name + preview */}
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => {
                      setShowMessageRequests(false);
                      router.push(`/(users)/chat/${convo.partnerId}`);
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "600",
                        color: "#111827",
                      }}
                    >
                      {name}
                    </Text>
                    <Text
                      style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {preview}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Accept / Delete buttons */}
                <View
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginTop: 12,
                    marginLeft: 62,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => handleAcceptMessageRequest(convo.partnerId)}
                    style={{
                      flex: 1,
                      backgroundColor: "#094569",
                      paddingVertical: 9,
                      borderRadius: 10,
                      borderCurve: "continuous",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "white",
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                    >
                      Accept
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      handleDeclineMessageRequest(convo.partnerId, name)
                    }
                    style={{
                      flex: 1,
                      backgroundColor: "#f3f4f6",
                      paddingVertical: 9,
                      borderRadius: 10,
                      borderCurve: "continuous",
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#374151",
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                    >
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListHeaderComponent={() => (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 16,
                paddingVertical: 14,
                backgroundColor: "white",
                borderBottomWidth: 1,
                borderBottomColor: "#e5e7eb",
              }}
            >
              <TouchableOpacity
                onPress={() => setShowMessageRequests(false)}
                style={{ marginRight: 12 }}
              >
                <Ionicons name="arrow-back" size={22} color="#094569" />
              </TouchableOpacity>
              <Text
                style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}
              >
                Message Requests
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={{ fontSize: 13, color: "#6b7280" }}>
                {requestConversations.length}{" "}
                {requestConversations.length === 1 ? "request" : "requests"}
              </Text>
            </View>
          )}
          ListEmptyComponent={() => (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 48,
              }}
            >
              <Ionicons name="chatbubbles-outline" size={48} color="#d1d5db" />
              <Text style={{ color: "#6b7280", marginTop: 12, fontSize: 15 }}>
                No message requests
              </Text>
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Tab 1: Mongoose — single native FlatList */}
      {activeTab === 1 && (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: listBottomPad }}
          data={mongooseUsers}
          renderItem={renderMongooseUserItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            mongooseUsers.length > 0
              ? () => (
                  <View className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <Text className="text-sm font-medium text-gray-600">
                      Mongoose Support ({mongooseUsers.length})
                    </Text>
                  </View>
                )
              : undefined
          }
          ListEmptyComponent={() => (
            <View className="items-center justify-center py-8">
              <Text className="text-gray-500 text-center">
                {isLoadingMongoose
                  ? "Loading mongoose users..."
                  : "No mongoose support users found."}
              </Text>
              {!isLoadingMongoose && (
                <Text className="text-gray-500 text-center mt-1">
                  Contact admin to add mongoose support.
                </Text>
              )}
            </View>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Booking Modal */}
      <BookMongooseModal
        visible={showBookingModal}
        onClose={() => {
          setShowBookingModal(false);
          fetchMongooseBookings(); // Refresh bookings when modal closes
        }}
      />

      {/* Tracking Modal */}
      {selectedBookingForTracking && (
        <TrackMongooseModal
          visible={showTrackingModal}
          onClose={() => {
            setShowTrackingModal(false);
            setSelectedBookingForTracking(null);
          }}
          booking={selectedBookingForTracking}
        />
      )}

      <MongooseWorkerNavBar />
    </View>
    </EdgeSwipeBack>
  );
}
