// app/(users)/(tabs)/messages.tsx
import ConversationRow, {
  CONVERSATION_GROUP_RADIUS,
} from "@/components/messages/ConversationRow";
import FrequentContacts from "@/components/messages/FrequentContacts";
import PeopleGroup, { type PeopleGroupRow } from "@/components/ui/PeopleGroup";
import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import MongooseWorkerNavBar, {
  MONGOOSE_WORKER_NAV_BAR_HEIGHT,
} from "@/components/ui/MongooseWorkerNavBar";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUnreadMessages } from "@/contexts/UnreadMessagesContext";
import { useUser } from "@/contexts/UserContext";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { Screens } from "@/lib/analyticsService";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useAppRouter } from "@/utils/navigation";
import { isMongooseUser, MONGOOSE_EMAIL } from "@/utils/roleCheck";
import JoinLogSheet from "@/components/setlog/JoinLogSheet";
import SlotPlayer from "@/components/setlog/SlotPlayer";
import {
  FeedDayLabel,
  FeedActions,
  SetlogClipCard,
  SetlogEmptyCard,
  SETLOG_GROUP_INSET,
} from "@/components/setlog/SetlogFeed";
import SetlogNavBar, {
  SETLOG_NAV_HEIGHT,
  type SetlogNavKey,
} from "@/components/setlog/SetlogNavBar";
import FilterPills from "@/components/ui/FilterPills";
import FeedDaySheet from "@/components/setlog/FeedDaySheet";
import SquadLogs from "@/components/setlog/SquadLogs";
import StartSquadSheet from "@/components/setlog/StartSquadSheet";
import {
  currentSlot,
  formatDay,
  invalidateFeedCache,
  invalidateSquadLogs,
  isFeedImmutable,
  listFeed,
  listMyLogIds,
  listSquadLogs,
  localDay,
  readCachedFeed,
  readCachedSquadLogs,
  type FeedScope,
  type SetlogFeedItem,
  type SetlogMember,
  type SquadLogSummary,
} from "@/lib/setlogService";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { useTutorial } from "@/contexts/TutorialContext";
import TutorialAnchor from "@/components/tutorial/TutorialAnchor";
import { TUTORIAL_SCREENS } from "@/lib/tutorialTours";
import { useIsFocused } from "@react-navigation/native";
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
import {
  loadMutedConversations,
  toggleMutedConversation,
} from "@/lib/mutedConversations";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  Alert,
  Dimensions,
  FlatList,
  InteractionManager,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BellOff,
  Bell,
  ChevronLeft,
  ChevronRight,
  MailQuestion,
  Search,
  Trash2,
} from "lucide-react-native";
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
// § Colour — destructive is #DC2626, and the quieter action beside it is a
// neutral grey rather than a second hue. iOS red (#FF3B30) and iOS grey
// (#8E8E93) were the system's palette showing through, not this app's.
const DELETE_COLOR = "#DC2626";
const MUTE_COLOR = "#6B7280";
/** Group inset from the screen edges, matching every other white group. */
const GROUP_INSET = 16;
// Must match CHAT_DRAFT_KEY_PREFIX in app/(users)/chat/[id].tsx
const CHAT_DRAFT_KEY_PREFIX = "@namzoed_chat_draft_";

const TABS = ["Messages", "Setlog"] as const;

/** Hoisted so closing the player doesn't hand it a fresh Map to re-memo. */
const EMPTY_MEMBERS = new Map<string, SetlogMember>();

/**
 * The inbox's filter pills (§ Tabs and pills). One is always on, All
 * included, so the row always says what you are looking at — nothing here
 * relies on the user remembering that no selection means everything.
 */
const MESSAGE_FILTERS = ["all", "personal", "business", "mongoose"] as const;
type MessageFilter = (typeof MESSAGE_FILTERS)[number];
/** The three kinds a conversation can actually be; All is not one of them. */
type MessageCategory = Exclude<MessageFilter, "all">;
const MESSAGE_FILTER_LABELS: Record<MessageFilter, string> = {
  all: "All",
  personal: "Personal",
  business: "Business",
  mongoose: "Mongoose",
};

/** § Type — the one empty/explanatory voice on this screen. */
const EMPTY_TEXT = {
  fontSize: 16,
  lineHeight: 22,
  color: "#9CA3AF",
  textAlign: "center",
  paddingHorizontal: 24,
  paddingTop: 32,
} as const;

/**
 * The screen's header (§ Header): three parts, with the title absolutely
 * centred against the row's full height rather than sitting in flow — a
 * bare absolutely-positioned Text does not centre reliably against sibling
 * buttons.
 *
 * Used by the two views that need a title of their own: the signed-out
 * state and the message-requests list, which is this same screen showing
 * different rows rather than a route of its own — hence `onBack`. The tab
 * root has no header at all; its tab row is its chrome.
 */
function MessagesHeader({
  title = "Messages",
  onBack,
}: {
  title?: string;
  onBack?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        paddingTop: 2,
        paddingBottom: 12,
      }}
    >
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={{ paddingVertical: 4, paddingHorizontal: 2 }}>
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
      ) : (
        <View style={{ width: 32 }} />
      )}

      <View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
        pointerEvents="none"
      >
        <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>{title}</Text>
      </View>

      {/* Spacer opposite the chevron so the title stays optically centred. */}
      <View style={{ width: 32 }} />
    </View>
  );
}

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
  first,
  last,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onMute: () => void;
  onPress: () => void;
  isMuted?: boolean;
  /** The row is part of one white group, so only its ends round — and the
   *  clip has to live here, on the container the actions are revealed
   *  inside, or a full swipe paints a square corner behind the rounded row. */
  first?: boolean;
  last?: boolean;
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
        [SETTINGS_BACKGROUND, DELETE_COLOR, DELETE_COLOR],
      ),
    };
  });

  /**
   * Nothing is behind a closed row.
   *
   * The actions are revealed by the row sliding off them, so at rest they
   * are covered rather than absent — and the row content fades to 0.7 under
   * a press, which made the Mute button *show through* for exactly as long
   * as a finger was down. Tapping into a chat blinked a mute icon on the
   * way. Hiding them until the row has actually moved costs nothing: at
   * rest there is no gap for them to show in anyway.
   */
  const actionsStyle = useAnimatedStyle(() => ({
    opacity: translateX.value < -1 ? 1 : 0,
  }));

  // Close the row — no bounce
  function closeRow() {
    translateX.value = withTiming(0, SNAP);
  }

  return (
    <GestureDetector gesture={pan}>
      <View
        style={{
          overflow: "hidden",
          borderTopLeftRadius: first ? CONVERSATION_GROUP_RADIUS : 0,
          borderTopRightRadius: first ? CONVERSATION_GROUP_RADIUS : 0,
          borderBottomLeftRadius: last ? CONVERSATION_GROUP_RADIUS : 0,
          borderBottomRightRadius: last ? CONVERSATION_GROUP_RADIUS : 0,
          borderCurve: "continuous",
        }}
      >
        {/* ── Action buttons (behind the row, and only once it moves) ── */}
        <Reanimated.View
          style={[
            {
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: FULL_SWIPE_THRESHOLD,
              flexDirection: "row",
              alignItems: "stretch",
              justifyContent: "flex-end",
              backgroundColor: SETTINGS_BACKGROUND,
            },
            actionsStyle,
          ]}
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
              {isMuted ? (
                <Bell size={22} color="#fff" strokeWidth={1.8} />
              ) : (
                <BellOff size={22} color="#fff" strokeWidth={1.8} />
              )}
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
              <Trash2 size={22} color="#fff" strokeWidth={1.8} />
              <Reanimated.Text
                style={{ color: "white", fontSize: 12, marginTop: 4 }}
              >
                Delete
              </Reanimated.Text>
            </TouchableOpacity>
          </Reanimated.View>
        </Reanimated.View>

        {/* ── Main row content (slides left) ── */}
        <Reanimated.View style={[rowStyle, { width: "100%" }]}>
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
  const { setTabBarHidden } = useTabBarScroll();
  const isScreenFocused = useIsFocused();

  const { currentUser } = useUser();
  const { arrive, notify } = useTutorial();
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
  /**
   * The floating pill is hidden on the Setlog tab.
   *
   * It is the app's navigation, and Setlog is a place you go *into* — the
   * feed's cards run to the bottom edge and the pill sat on top of them,
   * over a video, saying nothing about where you are. The Messages tab
   * keeps it, because that is a destination you pass through.
   *
   * The bar belongs to the Tabs navigator, outside this screen's view tree,
   * so it can only be reached through the context — see
   * `contexts/TabBarScrollContext.tsx`.
   */
  useEffect(() => {
    setTabBarHidden(isScreenFocused && activeTab === 1);
  }, [isScreenFocused, activeTab, setTabBarHidden]);

  // The safety net: leaving this screen with Setlog selected must not take
  // the app's navigation with it.
  useEffect(() => () => setTabBarHidden(false), [setTabBarHidden]);
  const [searchQuery, setSearchQuery] = useState("");
  const [messageFilter, setMessageFilter] = useState<MessageFilter>("all");
  // ── Setlog (tab 1) ──
  const [setlogs, setSetlogs] = useState<SetlogFeedItem[]>([]);
  /** Which cards are on screen enough to be worth a video decoder. */
  const [visibleClips, setVisibleClips] = useState<Set<string>>(new Set());
  /** The clip opened full screen, if any. */
  const [openClip, setOpenClip] = useState<SetlogFeedItem | null>(null);
  // Today by default: a log is about the day you are having, and the
  // archive is a place you go on purpose. `null` is all time.
  const [feedDay, setFeedDay] = useState<string | null>(() => localDay());
  /** Which of Setlog's own two places is open. */
  const [feedScope, setFeedScope] = useState<FeedScope>("mine");
  const [showDaySheet, setShowDaySheet] = useState(false);
  const [isLoadingSetlogs, setIsLoadingSetlogs] = useState(true);
  const [showJoinSheet, setShowJoinSheet] = useState(false);
  /** Squad Logs is a list of rooms, not a feed, so it has its own data —
   *  see `components/setlog/SquadLogs.tsx` for why the two halves of this
   *  tab are deliberately not the same screen. */
  const [squadLogs, setSquadLogs] = useState<SquadLogSummary[]>([]);
  const [isLoadingSquads, setIsLoadingSquads] = useState(true);
  const [showStartSheet, setShowStartSheet] = useState(false);
  // The open hour, held in state rather than read at render time: a row
  // that says "3pm" while the grid behind it has moved on to 4pm is the
  // one thing this screen must never do.
  const [slot, setSlot] = useState(() => currentSlot());
  // Partner ids the current user has a commerce (product/marketplace)
  // message request with, in either direction — see fetchConversations.
  const [commercePartnerIds, setCommercePartnerIds] = useState<Set<string>>(
    new Set(),
  );
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [requestConversations, setRequestConversations] = useState<any[]>([]);
  const [showMessageRequests, setShowMessageRequests] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
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

  /**
   * Which filter pill a conversation belongs to. Mongoose wins over the
   * rest — a delivery account is a service, not a contact — and a chat is
   * business when a commerce request row exists in either direction. The
   * remainder is personal, so every conversation lands in exactly one pill.
   */
  const conversationCategory = useCallback(
    (convo: any): MessageCategory => {
      const email = String(convo.partnerProfile?.email ?? "")
        .trim()
        .toLowerCase();
      if (email.startsWith(MONGOOSE_EMAIL)) return "mongoose";
      if (commercePartnerIds.has(String(convo.partnerId))) return "business";
      return "personal";
    },
    [commercePartnerIds],
  );

  const filteredConversations = useMemo(
    () =>
      messageFilter === "all"
        ? visibleConversations
        : visibleConversations.filter(
            (c) => conversationCategory(c) === messageFilter,
          ),
    [visibleConversations, messageFilter, conversationCategory],
  );

  // ── AsyncStorage keys (per-user so multi-account works) ──────────────────
  const hiddenKey = useMemo(
    () =>
      currentUserUUID || currentUser?.id
        ? `hidden_conversations_${currentUserUUID ?? currentUser?.id}`
        : null,
    [currentUserUUID, currentUser?.id],
  );
  // The mute list's key and shape live in lib/mutedConversations.ts — a
  // chat's details screen sets it too, and two hand-written copies of the
  // key is a mute that only half works.
  const muteOwnerId = currentUserUUID ?? currentUser?.id ?? null;

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

  // Re-read on focus, not just on mount: muting now also happens on a
  // chat's details screen, and coming back to an inbox still showing the
  // old state is the kind of thing people report as "mute doesn't work".
  useFocusEffect(
    useCallback(() => {
      if (!muteOwnerId) return;
      let alive = true;
      const task = InteractionManager.runAfterInteractions(() => {
        loadMutedConversations(muteOwnerId).then((set) => {
          if (alive) setMutedConversations(set);
        });
      });
      return () => {
        alive = false;
        task.cancel();
      };
    }, [muteOwnerId]),
  );

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
      if (!mutedConversations.has(partnerId)) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      setMutedConversations(
        await toggleMutedConversation(muteOwnerId, partnerId, mutedConversations),
      );
    },
    [mutedConversations, muteOwnerId],
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
    if (typeof content === "string" && content.includes("My Location:")) {
      return "Location";
    }
    const preview = content || "No messages yet";
    return isMine ? `You: ${preview}` : preview;
  };

  /** Today reads as a clock time, the recent past as a word, and only
   *  beyond a week as a date. `toLocaleDateString()` for everything but
   *  today printed "3/5/2026" on a message from yesterday, which is a
   *  worse answer to "how long ago" than the four characters it costs. */
  const formatConversationTime = (iso?: string) => {
    if (!iso) return "";
    const date = new Date(iso);
    const now = new Date();

    const startOfDay = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const daysApart = Math.round(
      (startOfDay(now) - startOfDay(date)) / 86_400_000,
    );

    if (daysApart <= 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (daysApart === 1) return "Yesterday";
    if (daysApart < 7) return date.toLocaleDateString([], { weekday: "short" });
    return date.toLocaleDateString([], { day: "numeric", month: "short" });
  };

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

        // 4. Commerce context, both directions. The request row only ever
        //    exists on the sender's side, so the incoming set alone would
        //    call every enquiry the current user *sent* a personal chat.
        const { data: outgoingRequests } = await supabase
          .from("message_requests")
          .select("receiver_id, context")
          .eq("sender_id", resolvedUUID);
        const commerceSet = new Set<string>();
        for (const r of incomingRequests ?? []) {
          if (String(r.context) === "commerce") commerceSet.add(String(r.sender_id));
        }
        for (const r of outgoingRequests ?? []) {
          if (String(r.context) === "commerce")
            commerceSet.add(String(r.receiver_id));
        }
        setCommercePartnerIds(commerceSet);

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
      } catch (e) {
        console.error("Error fetching conversations:", e);
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

  const renderConversationItem = ({
    item: conversation,
    index,
  }: {
    item: any;
    index: number;
  }) => {
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
    const isMuted = mutedConversations.has(String(conversation.partnerId));
    const draftText = drafts[String(conversation.partnerId)]?.replace(
      /\s+/g,
      " ",
    );

    // One white group on the grey: only the ends round, and every row but
    // the first carries the inset hairline (§ People lists).
    const first = index === 0;
    const last = index === filteredConversations.length - 1;

    return (
      <View style={{ marginHorizontal: GROUP_INSET }}>
        <SwipeableConversationRow
          first={first}
          last={last}
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
          <ConversationRow
            name={userName}
            avatarUrl={avatarUri}
            time={formatConversationTime(conversation.lastMessage?.created_at)}
            preview={formatConversationPreview(lastMessage, isLastMessageMine)}
            draft={draftText}
            // Only incoming messages count as unread — your own last message
            // sitting there is not something to catch up on.
            unreadCount={isLastMessageMine ? 0 : conversation.unreadCount || 0}
            muted={isMuted}
            first={first}
            last={last}
          />
        </SwipeableConversationRow>
      </View>
    );
  };

  const renderSearchResultItem = ({
    item: user,
    index,
  }: {
    item: any;
    index: number;
  }) => {
    // Handle different possible column names
    const userName =
      user.name || user.username || user.full_name || "Unknown User";
    const userPhone = user.phone || user.phone_number || user.mobile || "";
    const userId = user.id; // This should be the UUID from profiles table

    return (
      <View style={{ marginHorizontal: GROUP_INSET }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            setSearchQuery(""); // Clear search
            router.push(`/(users)/chat/${userId}`); // Use UUID instead of phone
          }}
        >
          {/* The same row as a conversation, because it becomes one the
              moment it is tapped. A second row design for search results
              made the list re-shuffle its own geometry as you typed. */}
          <ConversationRow
            name={userName}
            avatarUrl={user.avatar_url || user.profile_url || null}
            preview={userPhone || "Tap to start a chat"}
            first={index === 0}
            last={index === searchResults.length - 1}
          />
        </TouchableOpacity>
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

  // ── Setlog ───────────────────────────────────────────────────────────

  /**
   * Cache first, then the network — and for a day that has already
   * happened, no network at all.
   *
   * A past day cannot gain a clip (capture is real-time only, and a clip
   * files under the recorder's own local day), so its cached feed is a
   * finished answer. Only today revalidates. `force` is what the realtime
   * subscription and a fresh recording use to override that.
   */
  const fetchSetlogs = useCallback(
    async (showLoader = false, force = false) => {
      try {
        const cached = await readCachedFeed(currentUser?.id, feedDay, "mine");
        if (cached) {
          setSetlogs(cached);
          setIsLoadingSetlogs(false);
          if (!force && isFeedImmutable(feedDay)) return;
        } else if (showLoader) {
          setIsLoadingSetlogs(true);
        }

        setSetlogs(await listFeed(currentUser?.id, feedDay, "mine"));
      } catch (e) {
        console.error("Error fetching setlogs:", e);
        setSetlogs((prev) => prev);
      } finally {
        setIsLoadingSetlogs(false);
      }
    },
    [currentUser?.id, feedDay],
  );

  /**
   * The squads, cache first.
   *
   * A list of rooms rather than a day of clips, so it is not the feed's
   * fetch with a different argument — it reads the members and today's
   * activity in one go (`listSquadLogs`) and has no day to filter by. It
   * revalidates every time, because a squad's day is other people's and can
   * change while you are looking at it.
   */
  const fetchSquadLogs = useCallback(
    async (showLoader = false) => {
      try {
        const cached = await readCachedSquadLogs(currentUser?.id);
        if (cached) {
          setSquadLogs(cached);
          setIsLoadingSquads(false);
        } else if (showLoader) {
          setIsLoadingSquads(true);
        }
        setSquadLogs(await listSquadLogs(currentUser?.id));
      } catch (e) {
        console.error("Error fetching squad logs:", e);
      } finally {
        setIsLoadingSquads(false);
      }
    },
    [currentUser?.id],
  );

  // Only once the tab is actually opened: a user who never taps Setlog
  // should not be paying for its queries on every visit to their inbox.
  useEffect(() => {
    if (activeTab !== 1) return;
    const task = InteractionManager.runAfterInteractions(() => {
      if (feedScope === "squad") fetchSquadLogs(true);
      else fetchSetlogs(true);
    });
    return () => task.cancel();
  }, [activeTab, feedScope, fetchSetlogs, fetchSquadLogs]);

  // Setlog is its own thing inside the app, so it teaches itself the first
  // time the tab is opened rather than on the way past.
  useEffect(() => {
    if (activeTab === 1) arrive(TUTORIAL_SCREENS.SETLOG);
  }, [activeTab, arrive]);

  // Coming back from the camera, the row that said "Record" has to stop
  // saying it — and the clip just recorded has to appear, which the write
  // through in the capture screen has already put in the cache.
  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 1) return;
      if (feedScope === "squad") fetchSquadLogs();
      else fetchSetlogs();
    }, [activeTab, feedScope, fetchSetlogs, fetchSquadLogs]),
  );

  /**
   * Somebody else recording, without polling for it.
   *
   * Only inserts into a log this user is actually in are worth reacting to,
   * so the membership ids are held rather than queried per event. The day
   * being shown refetches; any other day is simply dropped from the cache,
   * so it reloads if it is ever looked at again — cheaper than fetching a
   * day nobody is currently reading.
   */
  const myLogIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (activeTab !== 1 || !currentUser?.id) return;
    let subscribed = true;

    listMyLogIds(currentUser.id)
      .then((ids) => {
        if (subscribed) myLogIds.current = new Set(ids);
      })
      .catch(() => {});

    const channel = supabase
      .channel(`setlog_clips_${currentUser.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "setlog_clips" },
        (payload) => {
          if (!subscribed) return;
          const row = payload.new as any;
          const logId = String(row?.setlog_id ?? "");
          if (!myLogIds.current.has(logId)) return;
          // Your own clip is already in the cache, put there on capture.
          if (String(row?.user_id ?? "") === currentUser.id) return;

          // On the Squad half what changed is a room's line — "3 of 5
          // recorded today" — not a card in a feed, so the list is what
          // gets refreshed.
          if (feedScope === "squad") {
            const uid = currentUser.id;
            if (uid) {
              invalidateSquadLogs(uid)
                .then(() => fetchSquadLogs())
                .catch(() => {});
            }
            return;
          }

          const clipDay = String(row?.day ?? "");
          if (clipDay === feedDay) {
            fetchSetlogs(false, true);
          } else if (currentUser.id) {
            invalidateFeedCache(currentUser.id, clipDay).catch(() => {});
          }
        },
      )
      .subscribe();

    return () => {
      subscribed = false;
      supabase.removeChannel(channel);
    };
  }, [activeTab, currentUser?.id, feedDay, feedScope, fetchSetlogs, fetchSquadLogs]);

  // The hour turning over is the whole mechanic, so the screen notices it
  // rather than waiting for the next navigation. Checked once a minute; the
  // state only changes on the turn, so this re-renders 24 times a day.
  useEffect(() => {
    if (activeTab !== 1) return;
    const tick = setInterval(() => {
      const next = currentSlot();
      setSlot((prev) =>
        prev.day === next.day && prev.hour === next.hour ? prev : next,
      );
    }, 60_000);
    return () => clearInterval(tick);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 1) fetchSetlogs();
    // A new hour is a new set of empty slots — the counts on every row are
    // stale the moment it turns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.hour, slot.day]);

  // RN throws if this identity changes between renders, so both the handler
  // and its config are held in refs rather than rebuilt each time.
  const onClipsViewable = useRef(
    ({ viewableItems }: { viewableItems: { key?: string | null }[] }) => {
      setVisibleClips(
        new Set(
          viewableItems
            .map((v) => v.key)
            .filter((k): k is string => typeof k === "string"),
        ),
      );
    },
  ).current;
  const clipViewabilityConfig = useRef({
    // Over half on screen: enough that a card is being looked at, not
    // enough that two adjacent cards both count on a slow scroll.
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 120,
  }).current;

  // Early returns AFTER all hooks are defined to avoid hook order violations
  if (!currentUser) {
    return (
      <EdgeSwipeBack onSwipeBack={() => router.back()}>
        <View style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}>
          <StatusBar barStyle="dark-content" />
          <MessagesHeader />
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
            <Text style={EMPTY_TEXT}>Sign in to see your messages.</Text>
          </View>
        </View>
      </EdgeSwipeBack>
    );
  }

  const showMongooseWorkerNav = isMongooseUser(currentUser?.email);
  // No pill on the Setlog tab means no pill to clear — the cards run to the
  // bottom edge instead of stopping short of something that is not there.
  const listBottomPad = showMongooseWorkerNav
    ? insets.bottom + MONGOOSE_WORKER_NAV_BAR_HEIGHT + 8
    : activeTab === 1
      ? insets.bottom + SETLOG_NAV_HEIGHT + 16
      : tabBarHeight + insets.bottom + 16;

  const searching = !!searchQuery.trim();

  /** Message requests, as the shared people-list rows with two pills —
   *  the same shape Add Friends uses for the same kind of decision
   *  (§ People lists). What it replaces was a card per person with two
   *  full-width buttons stacked underneath. */
  const messageRequestRows: PeopleGroupRow[] = requestConversations.map((convo: any) => {
    const name =
      convo.partnerProfile?.name || convo.partnerProfile?.username || "Unknown";
    return {
      key: convo.partnerId,
      name,
      avatarUrl: convo.partnerProfile?.avatar_url ?? null,
      secondary: formatConversationPreview(convo.lastMessage, false),
      actions: [
        {
          label: "Delete",
          tone: "quiet" as const,
          onPress: () => handleDeclineMessageRequest(convo.partnerId, name),
        },
        {
          label: "Accept",
          tone: "action" as const,
          onPress: () => handleAcceptMessageRequest(convo.partnerId),
        },
      ],
      onPress: () => {
        setShowMessageRequests(false);
        router.push(`/(users)/chat/${convo.partnerId}`);
      },
    };
  });

  return (
    <EdgeSwipeBack onSwipeBack={() => router.back()}>
      <View style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}>
        {/* A screen mounted underneath in the stack may have set
            light-content (§ Form screens), and this one is grey. */}
        <StatusBar barStyle="dark-content" />

        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup((p) => ({ ...p, visible: false }))}
        />

        {/* ── Message requests, as its own screen ───────────────────── */}
        {showMessageRequests ? (
          <>
            <MessagesHeader
              title="Message requests"
              onBack={() => setShowMessageRequests(false)}
            />
            <FlatList
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: GROUP_INSET,
                paddingBottom: listBottomPad,
              }}
              data={[0]}
              keyExtractor={() => "requests"}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              renderItem={() => (
                <PeopleGroup label="Waiting for you" rows={messageRequestRows} />
              )}
              ListEmptyComponent={null}
              ListFooterComponent={
                messageRequestRows.length === 0 ? (
                  <Text style={[EMPTY_TEXT, { paddingTop: 24 }]}>
                    No message requests.
                  </Text>
                ) : null
              }
            />
          </>
        ) : (
          <>
            {/* No header on the tab root: it said "Messages" directly above
                a tab row whose first tab says "Messages", and a label that
                restates what is under it is not a label (§ The conversation
                list). The tab row is this screen's chrome, so it carries
                the top padding the header used to. */}

            {/* ── Tabs — plain text, short underline (§ Tabs and pills) ── */}
            <View
              style={{
                flexDirection: "row",
                gap: 18,
                paddingHorizontal: GROUP_INSET,
                paddingTop: 8,
                paddingBottom: 12,
              }}
            >
              {TABS.map((tab, index) => {
                const active = activeTab === index;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => setActiveTab(index)}
                    activeOpacity={0.7}
                    style={{ alignItems: "center" }}
                  >
                    <Text
                      style={{
                        fontSize: active ? 17 : 15,
                        fontWeight: active ? "700" : "500",
                        color: active ? "#111827" : "#9CA3AF",
                      }}
                    >
                      {tab}
                    </Text>
                    <View
                      style={{
                        marginTop: 4,
                        // 24x2, the width `ProfileTabRow` uses (§ Tabs and
                        // pills). At 6 it read as a dot rather than a rule
                        // under the word it marks.
                        width: 24,
                        height: 2,
                        borderRadius: 1,
                        borderCurve: "continuous",
                        backgroundColor: active ? "#111827" : "transparent",
                      }}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Tab 0: Messages ──────────────────────────────────── */}
            {activeTab === 0 && (
              <>
                {/* Outside the FlatList so the keyboard never dismisses on
                    a re-render. */}
                <View style={{ paddingHorizontal: GROUP_INSET, paddingBottom: 10 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      backgroundColor: "#fff",
                      borderRadius: 999,
                      borderCurve: "continuous",
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                    }}
                  >
                    <Search size={18} color="#9CA3AF" strokeWidth={1.8} />
                    <TextInput
                      style={{
                        flex: 1,
                        marginLeft: 8,
                        fontSize: 15,
                        color: "#111",
                        paddingVertical: 0,
                      }}
                      placeholderTextColor="#9CA3AF"
                      placeholder="Search"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onFocus={() => setIsSearchFocused(true)}
                      onBlur={() => setIsSearchFocused(false)}
                    />
                    {isSearching && <CircularLoader size="small" color="#9CA3AF" />}
                  </View>
                </View>

                <FilterPills
                  options={MESSAGE_FILTERS.map((f) => ({
                    value: f,
                    label: MESSAGE_FILTER_LABELS[f],
                  }))}
                  value={messageFilter}
                  onChange={setMessageFilter}
                  inset={GROUP_INSET}
                />

                {isLoadingConversations && conversations.length === 0 ? (
                  <View style={{ flex: 1, paddingBottom: listBottomPad }}>
                    <ConversationSkeleton count={8} />
                  </View>
                ) : (
                  <FlatList
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: listBottomPad }}
                    keyboardShouldPersistTaps="handled"
                    data={searching ? searchResults : filteredConversations}
                    renderItem={
                      searching ? renderSearchResultItem : renderConversationItem
                    }
                    keyExtractor={(item) =>
                      item.id || item.partnerId || item.phone || item.phone_number
                    }
                    ListHeaderComponent={
                      <View style={{ paddingHorizontal: GROUP_INSET }}>
                        {/* Offered only while the field is focused and
                            empty — see `showSuggestions`. */}
                        <Reanimated.View style={suggestionStyle}>
                          <FrequentContacts
                            contacts={recentContacts}
                            onPress={handleSuggestionPress}
                          />
                        </Reanimated.View>

                        {/* One row in its own group, above the chats.
                            "Your Chats (12)" is gone with it: a label that
                            restates the screen it is on is not a label. */}
                        {!searching && requestConversations.length > 0 && (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => setShowMessageRequests(true)}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              backgroundColor: "#fff",
                              borderRadius: CONVERSATION_GROUP_RADIUS,
                              borderCurve: "continuous",
                              paddingHorizontal: 16,
                              paddingVertical: 12,
                              marginBottom: 14,
                            }}
                          >
                            <View
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 22,
                                borderCurve: "continuous",
                                backgroundColor: "#F5F5F5",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <MailQuestion size={20} color="#9CA3AF" strokeWidth={1.8} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text
                                style={{ fontSize: 15.5, fontWeight: "600", color: "#111" }}
                              >
                                Message requests
                              </Text>
                              <Text style={{ fontSize: 15, color: "#9CA3AF", marginTop: 1 }}>
                                {requestConversations.length}{" "}
                                {requestConversations.length === 1
                                  ? "person"
                                  : "people"}{" "}
                                you don&apos;t follow
                              </Text>
                            </View>
                            <ChevronRight size={18} color="#C7C7CC" />
                          </TouchableOpacity>
                        )}
                      </View>
                    }
                    ListEmptyComponent={
                      searching ? (
                        isSearching ? null : (
                          <Text style={EMPTY_TEXT}>
                            Nobody you follow matches &quot;{searchQuery.trim()}&quot;. You can
                            only message people you follow.
                          </Text>
                        )
                      ) : messageFilter !== "all" ? (
                        <Text style={EMPTY_TEXT}>
                          No {MESSAGE_FILTER_LABELS[messageFilter].toLowerCase()}{" "}
                          conversations yet. Tap All to see the whole inbox.
                        </Text>
                      ) : (
                        <Text style={EMPTY_TEXT}>
                          No conversations yet. Search for someone you follow to start one.
                        </Text>
                      )
                    }
                    showsVerticalScrollIndicator={false}
                  />
                )}
              </>
            )}

            {/* ── Tab 1: Setlog ────────────────────────────────────── */}
            {activeTab === 1 && (
              <>
              {/* The two halves are two different screens on purpose. Your
                  own log is a stream of clips; a squad is a place with
                  people in it, so it is a list of rooms whose first job is
                  getting you into one (§ Setlog). */}
              {feedScope === "squad" ? (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{
                    paddingTop: 4,
                    paddingBottom: listBottomPad,
                  }}
                  showsVerticalScrollIndicator={false}
                >
                  <SquadLogs
                    logs={squadLogs}
                    loading={isLoadingSquads}
                    width={SCREEN_WIDTH - SETLOG_GROUP_INSET * 2}
                    onOpen={(id) => router.push(`/(users)/setlog/${id}`)}
                    onJoin={() => setShowJoinSheet(true)}
                    onCreate={() => setShowStartSheet(true)}
                    onSettings={() => router.push("/(users)/setlog/settings")}
                  />
                </ScrollView>
              ) : (
              <FlatList
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: listBottomPad }}
                data={setlogs}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                onViewableItemsChanged={onClipsViewable}
                viewabilityConfig={clipViewabilityConfig}
                // Only the cards near the viewport hold a decoder, and the
                // window is deliberately small: these are videos, not rows.
                windowSize={5}
                maxToRenderPerBatch={4}
                removeClippedSubviews
                ListHeaderComponent={
                  // Which day the cards below are from, and the way to
                  // change it. It heads the list rather than floating above
                  // it, because it is a caption on what follows, not a
                  // control over the whole tab. The plus row that used to
                  // sit above it is gone: the camera is in the nav now, and
                  // a screen with a camera button in its navigation does
                  // not need a second one in its list.
                  //
                  // Export/settings/join sit above the day rather than in a
                  // group at the foot of the list: they are chrome for the
                  // day, and at the bottom they were three labelled rows you
                  // had to scroll the whole feed to reach.
                  <>
                    <FeedActions
                      // A day with nothing in it has nothing to export.
                      exportLabel={
                        feedDay && setlogs.length > 0
                          ? formatDay(feedDay)
                          : undefined
                      }
                      onExport={() =>
                        router.push(`/(users)/setlog/export?day=${feedDay}`)
                      }
                      onSettings={() => router.push("/(users)/setlog/settings")}
                      onJoin={() => setShowJoinSheet(true)}
                    />
                    <TutorialAnchor id="setlog.day" radius={10}>
                      <FeedDayLabel
                        label={feedDay ? formatDay(feedDay) : "All time"}
                        onPress={() => setShowDaySheet(true)}
                      />
                    </TutorialAnchor>
                  </>
                }
                renderItem={({ item }) => (
                  <SetlogClipCard
                    clip={item}
                    width={SCREEN_WIDTH - SETLOG_GROUP_INSET * 2}
                    playing={visibleClips.has(item.id)}
                    // A tap plays the clip full screen — that is what a
                    // card of a video is offering. The log's day grid is a
                    // different thing entirely, and it is on the hold.
                    onPress={() => setOpenClip(item)}
                    onLongPress={() =>
                      router.push(`/(users)/setlog/${item.setlogId}`)
                    }
                  />
                )}
                ListEmptyComponent={
                  // The card that isn't there yet, in the shape of the one
                  // that would be: same geometry as a clip, drawn as an
                  // outline, and the whole of it opens the camera.
                  <SetlogEmptyCard
                    width={SCREEN_WIDTH - SETLOG_GROUP_INSET * 2}
                    message={
                      isLoadingSetlogs
                        ? "Loading…"
                        : feedDay === localDay()
                          ? "Nothing today yet. Two seconds is enough, and the day puts itself together."
                          : feedDay
                            ? "Nothing recorded that day."
                            : "Nothing recorded yet. Two seconds is enough, and the day puts itself together."
                    }
                    // Nothing to offer while the answer is still loading.
                    onPress={
                      isLoadingSetlogs
                        ? undefined
                        : () => router.push("/(users)/setlog/capture")
                    }
                  />
                }
                contentInset={{ bottom: 0 }}
              />
              )}
              <SetlogNavBar
                active={feedScope as SetlogNavKey}
                onSelect={setFeedScope}
                onCamera={() => {
                  notify("setlog.camera-opened");
                  router.push("/(users)/setlog/capture");
                }}
              />
              </>
            )}
          </>
        )}

        {/* One clip, full screen, looping until it is dismissed — the same
            player the day grid and the export reel use, given a single
            clip. The by-line comes from a one-entry member map rather than
            a fetch: the feed already knows whose it is. */}
        <SlotPlayer
          slot={openClip ? { hour: openClip.slotHour, clips: [openClip] } : null}
          members={
            openClip
              ? new Map([
                  [
                    openClip.userId,
                    {
                      userId: openClip.userId,
                      name: openClip.authorName,
                      avatarUrl: openClip.authorAvatarUrl,
                      role: "member" as const,
                    },
                  ],
                ])
              : EMPTY_MEMBERS
          }
          currentUserId={openClip?.isMine ? openClip.userId : null}
          onClose={() => setOpenClip(null)}
        />

        <FeedDaySheet
          visible={showDaySheet}
          onClose={() => setShowDaySheet(false)}
          day={feedDay}
          onChange={setFeedDay}
          // The calendar marks the days that have something in them, so it
          // reads the same scope the feed under it is showing.
          scope={feedScope}
          userId={currentUser?.id}
        />

        <JoinLogSheet
          visible={showJoinSheet}
          onClose={() => setShowJoinSheet(false)}
          onDone={(id) => {
            setShowJoinSheet(false);
            // A squad you just joined is a squad the list does not know
            // about yet, whichever half you came from.
            if (currentUser?.id) {
              invalidateSquadLogs(currentUser.id)
                .then(() => fetchSquadLogs())
                .catch(() => {});
            }
            fetchSetlogs();
            router.push(`/(users)/setlog/${id}`);
          }}
          onError={(message) => showPopup("error", "Setlog", message)}
        />

        {/* Starting one is the second answer, so it lands you in the room
            it made — where Invite is, and where the code lives. */}
        <StartSquadSheet
          visible={showStartSheet}
          onClose={() => setShowStartSheet(false)}
          onDone={(id) => {
            setShowStartSheet(false);
            if (currentUser?.id) {
              invalidateSquadLogs(currentUser.id)
                .then(() => fetchSquadLogs())
                .catch(() => {});
            }
            router.push(`/(users)/setlog/${id}`);
          }}
          onError={(message) => showPopup("error", "Setlog", message)}
        />

        <MongooseWorkerNavBar />
      </View>
    </EdgeSwipeBack>
  );
}
