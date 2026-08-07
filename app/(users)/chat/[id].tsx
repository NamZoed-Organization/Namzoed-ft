// app/(users)/chat/[id].tsx
import MongooseInitiatorModal from "@/components/MongooseInitiatorModal";
import MongooseInviteCard, {
  type MongooseInviteData,
} from "@/components/MongooseInviteCard";
import MongooseResponderModal from "@/components/MongooseResponderModal";
import AudioMessagePlayer from "@/components/chat/AudioMessagePlayer";
import ChatImageViewer from "@/components/chat/ChatImageViewer";
import ChatMultiMediaPicker from "@/components/chat/ChatMultiMediaPicker";
import {
  GifStickerButton,
  GifStickerInlineDrawer,
  type GifStickerPayload,
} from "@/components/chat/GifStickerPicker";
import WeChatVoiceRecorder from "@/components/chat/WeChatVoiceRecorder";
import SingleLocationPicker from "@/components/location/SingleLocationPicker";
import MapPinMarker from "@/components/maps/MapPinMarker";
import ReportUserModal from "@/components/modals/ReportUserModal";
import TrackMongooseModal from "@/components/modals/TrackMongooseModal";
import ChatBackgroundPicker, {
  parseBackground,
} from "@/components/settings/ChatBackgroundPicker";
import ActionSheetModal from "@/components/ui/ActionSheetModal";
import MongooseWorkerNavBar, {
  MONGOOSE_WORKER_NAV_BAR_HEIGHT,
} from "@/components/ui/MongooseWorkerNavBar";
import PopupMessage from "@/components/ui/PopupMessage";
import { useAppearance } from "@/contexts/AppearanceContext";
import { useUnreadMessages } from "@/contexts/UnreadMessagesContext";
import { useUser } from "@/contexts/UserContext";
import { blockUser, isUserBlocked, unblockUser } from "@/lib/blockService";
import {
  EarlyAccessBadgeType,
  getEarlyAccessBadge,
} from "@/lib/earlyAccessService";
import { supabase } from "@/lib/supabase";
import { sendChatPushNotification } from "@/services/chatPushService";
import { notifyMongooseBookingConfirmed } from "@/services/notificationService";
import {
  playReceiveSound,
  playSendSound,
  preloadChatSounds,
  triggerReceiveHaptic,
  triggerSendHaptic,
  unloadChatSounds,
} from "@/utils/chatSounds";
import { useAppRouter } from "@/utils/navigation";
import { isMongooseUser } from "@/utils/roleCheck";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { AlertCircle, Ban, Bike, MoreVertical, Verified } from "lucide-react-native";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { androidMapProvider } from "@/utils/mapProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Gesture,
  GestureDetector,
  ScrollView as GestureScrollView,
} from "react-native-gesture-handler";
import MapView from "react-native-maps";
import Reanimated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Add this User type extension if not already present
type User = {
  id: string;
  username?: string;
  name?: string;
  full_name?: string;
  display_name?: string;
  phone?: string;
  phoneNumber?: string;
  mobile?: string;
  phone_number?: string; // <-- Add this line
  profileImg?: string | null;
};

const CHAT_INPUT_LINE_HEIGHT = 20;
const CHAT_INPUT_MAX_ROWS = 5;
const CHAT_INPUT_MAX_HEIGHT = CHAT_INPUT_LINE_HEIGHT * CHAT_INPUT_MAX_ROWS;
const CHAT_BUBBLE_GROUP_WINDOW_MS = 60 * 1000;
const CHAT_BUBBLE_MAX_WIDTH_RATIO = 0.75;
const CHAT_BUBBLE_MIN_WIDTH = 48;
const TYPING_START_DEBOUNCE_MS = 260;
const TYPING_IDLE_TIMEOUT_MS = 1800;
const TYPING_REMOTE_STALE_MS = 3600;
const TYPING_REFRESH_THROTTLE_MS = 1200;
const OUTGOING_BUBBLE_COLOR = "#094569";
const INCOMING_BUBBLE_COLOR = "#f7f8fa";
const INCOMING_BUBBLE_BORDER = "#eceff3";
const SWIPE_REPLY_MAX = 84;
const SWIPE_REPLY_TRIGGER = 52;
const REPLY_META_PREFIX = "[reply-meta]";
const REPLY_META_SUFFIX = "[/reply-meta]";
const PRODUCT_META_PREFIX = "[product-meta]";
const PRODUCT_META_SUFFIX = "[/product-meta]";
const CHAT_DRAFT_KEY_PREFIX = "@namzoed_chat_draft_";
const CHAT_DRAFT_DEBOUNCE_MS = 400;

type ReplyMeta = {
  id: string;
  senderId: string;
  senderName: string;
  snippet: string;
};

type ProductMeta = {
  id: string;
  title: string;
  price?: string;
  imageUrl?: string;
  source?: "product" | "marketplace" | "post" | "profile";
};

type OutgoingDeliveryStatus = "sent" | "delivered" | "seen";
type ComposerInputKind = "text" | "voice";

type TypingUser = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  lastTypedAt: number;
};

type PartnerPresence = {
  isOnline: boolean;
  lastSeenAt?: string | null;
};

type PopupAction = {
  label: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

const parseMessageMetaContent = (
  rawContent?: string | null,
): {
  text: string;
  replyMeta: ReplyMeta | null;
  productMeta: ProductMeta | null;
} => {
  let content = typeof rawContent === "string" ? rawContent : "";
  let replyMeta: ReplyMeta | null = null;
  let productMeta: ProductMeta | null = null;

  const tryParsePrefix = <T,>(prefix: string, suffix: string): T | null => {
    if (!content.startsWith(prefix)) return null;
    const suffixIndex = content.indexOf(suffix);
    if (suffixIndex < 0) return null;
    const encoded = content.slice(prefix.length, suffixIndex);
    content = content.slice(suffixIndex + suffix.length).replace(/^\n/, "");
    try {
      return JSON.parse(decodeURIComponent(encoded)) as T;
    } catch {
      return null;
    }
  };

  // Handle wrappers in any order, repeatedly, while parsing from start.
  for (let i = 0; i < 3; i++) {
    const parsedProduct = tryParsePrefix<ProductMeta>(
      PRODUCT_META_PREFIX,
      PRODUCT_META_SUFFIX,
    );
    if (parsedProduct) {
      productMeta = parsedProduct;
      continue;
    }
    const parsedReply = tryParsePrefix<ReplyMeta>(
      REPLY_META_PREFIX,
      REPLY_META_SUFFIX,
    );
    if (parsedReply) {
      replyMeta = parsedReply;
      continue;
    }
    break;
  }

  return { text: content, replyMeta, productMeta };
};

const buildMessageMetaContent = (
  text: string,
  opts?: { replyMeta?: ReplyMeta | null; productMeta?: ProductMeta | null },
): string => {
  const parts: string[] = [];
  if (opts?.productMeta) {
    parts.push(
      `${PRODUCT_META_PREFIX}${encodeURIComponent(
        JSON.stringify(opts.productMeta),
      )}${PRODUCT_META_SUFFIX}`,
    );
  }
  if (opts?.replyMeta) {
    parts.push(
      `${REPLY_META_PREFIX}${encodeURIComponent(
        JSON.stringify(opts.replyMeta),
      )}${REPLY_META_SUFFIX}`,
    );
  }
  parts.push(text);
  return parts.join("\n");
};

const parseGifStickerContent = (
  content?: string | null,
): GifStickerPayload | null => {
  if (typeof content !== "string" || !content.trim()) return null;
  try {
    const parsed = JSON.parse(content) as Partial<GifStickerPayload>;
    if (
      parsed.provider === "giphy" &&
      (parsed.type === "gif" || parsed.type === "sticker") &&
      typeof parsed.url === "string" &&
      typeof parsed.previewUrl === "string"
    ) {
      return {
        provider: "giphy",
        providerId:
          typeof parsed.providerId === "string" ? parsed.providerId : "",
        type: parsed.type,
        title: typeof parsed.title === "string" ? parsed.title : parsed.type,
        url: parsed.url,
        previewUrl: parsed.previewUrl,
        width: typeof parsed.width === "number" ? parsed.width : undefined,
        height: typeof parsed.height === "number" ? parsed.height : undefined,
      };
    }
  } catch {
    return null;
  }
  return null;
};

const getCopyableMessageText = (message: any): string => {
  if (message?.message_type === "gif" || message?.message_type === "sticker") {
    return "";
  }

  const content = typeof message?.content === "string" ? message.content : "";
  if (!content.trim()) return "";

  const parsed = parseMessageMetaContent(content);
  const visibleText = parsed.text.trim();
  if (visibleText) return visibleText;

  if (content.includes("📍 My Location:")) return content.trim();

  return "";
};

const canRetryFailedMessage = (message: any): boolean => {
  const messageType = message?.message_type || "text";
  return (
    messageType === "text" ||
    messageType === "gif" ||
    messageType === "sticker" ||
    typeof message?.content === "string"
  );
};

// Enhanced function to get user data from multiple sources
const getUserData = async (identifier: string) => {
  try {
    // First, try to get from Supabase profiles table using multiple query approaches
    let profileData = null;
    let error = null;

    // Try direct ID match first (for UUID)
    const { data: idData, error: idError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", identifier)
      .maybeSingle(); // Use maybeSingle to avoid error when no match

    if (!idError && idData) {
      profileData = idData;
    } else {
      // Try phone number match (with and without +975)
      const cleanPhone = identifier.replace("+975", "");
      const { data: phoneData, error: phoneError } = await supabase
        .from("profiles")
        .select("*")
        .or(`phone.eq.${identifier},phone.eq.${cleanPhone}`)
        .maybeSingle();

      if (!phoneError && phoneData) {
        profileData = phoneData;
      }
    }

    if (profileData) {
      // Handle different possible column names from Supabase
      const username =
        profileData.name ||
        profileData.username ||
        profileData.full_name ||
        profileData.display_name ||
        `User ${profileData.phone}`;

      return {
        id: profileData.id,
        username: username,
        phone_number: profileData.phone,
        profileImg: profileData.avatar_url,
        full_name: profileData.full_name || profileData.name,
        name: profileData.name,
      };
    }
  } catch (e) {}

  // Return a basic user object when no profile is found
  return {
    id: identifier,
    username: `User ${identifier}`,
    phone_number: identifier,
    profileImg: null,
  };
};

// Typing indicator component
const TypingIndicator = ({ users }: { users: TypingUser[] }) => {
  const dots = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const visibleUsers = users.slice(0, 3);
  const extraUserCount = Math.max(0, users.length - visibleUsers.length);
  const label =
    users.length <= 1
      ? `${users[0]?.name || "Someone"} is typing`
      : users.length === 2
        ? `${users[0]?.name || "Someone"} and ${users[1]?.name || "someone"} are typing`
        : `${users[0]?.name || "Someone"} and ${users.length - 1} others are typing`;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 360,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 420,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(80),
        ]),
      );
    };

    animationRef.current = Animated.stagger(
      130,
      dots.map((dot) => animateDot(dot, 0)),
    );

    animationRef.current.start();

    // CRITICAL: Stop animations on unmount to prevent memory leaks
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, [dots]);

  return (
    <View className="mb-3 items-start">
      <View className="ml-2 max-w-[82%] flex-row items-end">
        <View className="mr-2 flex-row">
          {visibleUsers.map((user, index) => (
            <View
              key={user.id}
              className="h-7 w-7 rounded-full border-2 border-white bg-gray-300 items-center justify-center overflow-hidden"
              style={{ marginLeft: index === 0 ? 0 : -9 }}
            >
              {user.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  className="h-full w-full"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-[11px] font-semibold text-gray-700">
                  {(user.name || "?").charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
          ))}
          {extraUserCount > 0 ? (
            <View
              className="h-7 w-7 rounded-full border-2 border-white bg-gray-700 items-center justify-center"
              style={{ marginLeft: -9 }}
            >
              <Text className="text-[10px] font-semibold text-white">
                +{extraUserCount}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="bg-[#f7f8fa] border border-[#eceff3] px-3.5 py-2.5 rounded-2xl">
          <View className="flex-row items-center">
            {dots.map((dot, index) => (
              <Animated.View
                key={index}
                className="w-2 h-2 bg-gray-500 rounded-full"
                style={{
                  marginLeft: index === 0 ? 0 : 5,
                  opacity: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.36, 1],
                  }),
                  transform: [
                    {
                      translateY: dot.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0, -3.5, 0],
                      }),
                    },
                    {
                      scale: dot.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.82, 1.18],
                      }),
                    },
                  ],
                }}
              />
            ))}
          </View>
          <Text className="mt-1 text-[10px] text-gray-500" numberOfLines={1}>
            {label}
          </Text>
        </View>
      </View>
    </View>
  );
};

/** Fires haptic feedback — must be called via runOnJS from a worklet. */
const triggerSwipeHaptic = () =>
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/**
 * SwipeableRow — wraps a chat message bubble in a native Pan gesture so the
 * user can swipe right to reply. Uses Reanimated (UI-thread) + RNGH v2
 * GestureDetector so it:
 *   - runs off the JS thread → no lag
 *   - uses activeOffsetX([20,∞]) to only claim deliberate right swipes
 *     → less competition with iOS back-swipe and diagonal scrolls
 *   - uses failOffsetY([-5,5]) so ANY vertical movement immediately yields
 *     to the ScrollView — no accidental swipe-to-reply while scrolling
 */
const SwipeableRow = React.memo(function SwipeableRow({
  children,
  onTriggered,
  isCurrentUser = false,
  onPress,
  onLongPress,
}: {
  children: React.ReactNode;
  onTriggered: () => void;
  isCurrentUser?: boolean;
  onPress?: () => void;
  onLongPress?: (pageY: number) => void;
}) {
  const translateX = useSharedValue(0);
  const hasFired = useSharedValue(false);

  const pan = Gesture.Pan()
    .activeOffsetX([20, Infinity])
    .failOffsetX(-8)
    .failOffsetY([-5, 5])
    .onUpdate((e) => {
      "worklet";
      const clamped = Math.max(0, Math.min(SWIPE_REPLY_MAX, e.translationX));
      translateX.value = clamped;
      if (clamped >= SWIPE_REPLY_TRIGGER && !hasFired.value) {
        hasFired.value = true;
        runOnJS(triggerSwipeHaptic)();
      } else if (clamped < SWIPE_REPLY_TRIGGER * 0.6) {
        hasFired.value = false;
      }
    })
    .onEnd(() => {
      "worklet";
      const triggered = translateX.value >= SWIPE_REPLY_TRIGGER;
      translateX.value = withTiming(0, { duration: 180 });
      hasFired.value = false;
      if (triggered) {
        runOnJS(onTriggered)();
      }
    });

  // Tap and LongPress are composed at the RNGH level so they fire reliably
  // even though the GestureDetector is the sole touch responder.
  const tap = onPress
    ? Gesture.Tap().onEnd((_, success) => {
        "worklet";
        if (success) runOnJS(onPress)();
      })
    : null;

  const longPress = onLongPress
    ? Gesture.LongPress()
        .minDuration(400)
        .onEnd((e, success) => {
          "worklet";
          if (success) runOnJS(onLongPress)(e.absoluteY);
        })
    : null;

  const composed = (() => {
    const gestures = [longPress, tap, pan].filter(Boolean) as any[];
    return gestures.length > 1 ? Gesture.Race(...gestures) : pan;
  })();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const replyIconStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateX.value,
      [0, SWIPE_REPLY_TRIGGER],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: progress,
      transform: [
        { scale: interpolate(progress, [0, 1], [0.3, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <GestureDetector gesture={composed}>
      <Reanimated.View style={[animStyle, { overflow: "visible" }]}>
        <Reanimated.View
          pointerEvents="none"
          style={[
            replyIconStyle,
            {
              position: "absolute",
              right: "100%",
              top: 0,
              bottom: 0,
              width: 40,
              alignItems: "center",
              justifyContent: "center",
            },
          ]}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: "rgba(99,102,241,0.18)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="arrow-undo" size={14} color="#6366f1" />
          </View>
        </Reanimated.View>
        {children}
      </Reanimated.View>
    </GestureDetector>
  );
});

/** Static reaction pill shown beneath reacted messages. */
function ReactionPill({
  reactions,
  isCurrentUser,
}: {
  reactions: string[];
  isCurrentUser: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignSelf: isCurrentUser ? "flex-end" : "flex-start",
        marginTop: -8,
        marginBottom: 2,
        marginRight: isCurrentUser ? 10 : 0,
        marginLeft: isCurrentUser ? 0 : 10,
        backgroundColor: "rgba(255,255,255,0.95)",
        borderRadius: 20,
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      {reactions.map((emoji, i) => (
        <Text key={i} style={{ fontSize: 16, marginHorizontal: 2 }}>
          {emoji}
        </Text>
      ))}
    </View>
  );
}

export default function ChatScreen() {
  const { currentUser } = useUser();
  const showMongooseWorkerNav = isMongooseUser(currentUser?.email);
  const {
    setActiveChatPartnerId,
    markConversationAsRead,
    currentUserUUID: contextUserUUID,
  } = useUnreadMessages();
  const router = useAppRouter();
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser>>(
    {},
  );
  const [partnerPresence, setPartnerPresence] = useState<PartnerPresence>({
    isOnline: false,
    lastSeenAt: null,
  });
  const [currentUserUUID, setCurrentUserUUID] = useState<string | null>(null);
  const [chatPartnerData, setChatPartnerData] = useState<any>(null);
  const [partnerVerified, setPartnerVerified] = useState(false);
  const [isLoadingPartner, setIsLoadingPartner] = useState(true);
  const [isAnimatingMongoose, setIsAnimatingMongoose] = useState(false);
  const [showMongooseInitiator, setShowMongooseInitiator] = useState(false);
  const [showMongooseResponder, setShowMongooseResponder] = useState(false);
  const [pendingMongooseInvite, setPendingMongooseInvite] = useState<{
    messageId: string;
    data: MongooseInviteData;
  } | null>(null);
  const [showMongooseTracker, setShowMongooseTracker] = useState(false);
  const [mongooseTrackerBooking, setMongooseTrackerBooking] =
    useState<any>(null);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "warning" | "error" | "white";
    title: string;
    message: string;
    actions?: PopupAction[];
  }>({
    visible: false,
    type: "white",
    title: "",
    message: "",
    actions: undefined,
  });
  const showPopup = useCallback(
    (
      type: "success" | "warning" | "error" | "white",
      title: string,
      message: string,
      actions?: PopupAction[],
    ) => setPopup({ visible: true, type, title, message, actions }),
    [],
  );
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationPickerInitial, setLocationPickerInitial] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [selectedMessagePageY, setSelectedMessagePageY] = useState(0);
  const [selectedMessageIsCurrentUser, setSelectedMessageIsCurrentUser] =
    useState(false);
  // Local emoji reactions: { [messageId]: emoji[] }
  const [messageReactions, setMessageReactions] = useState<
    Record<string, string[]>
  >({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [replyFocusRequestToken, setReplyFocusRequestToken] = useState(0);
  const [pendingProductContext, setPendingProductContext] =
    useState<ProductMeta | null>(null);
  const [outgoingStatusById, setOutgoingStatusById] = useState<
    Record<string, OutgoingDeliveryStatus>
  >({});
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [nowTs, setNowTs] = useState(Date.now());
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const oldestCursorRef = useRef<string | null>(null);

  const flatListRef = useRef<FlatList<any>>(null);
  const chatInputRef = useRef<TextInput>(null);
  const messageTextRef = useRef(messageText);
  const composerFocusFrameRef = useRef<number | null>(null);
  const composerFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const channelRef = useRef<any>(null);
  const typingUserTimeoutsRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const typingStartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const typingSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isLocalTypingRef = useRef(false);
  const lastTypingRefreshRef = useRef(0);
  const messagesPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bikeAnimationX = useRef(new Animated.Value(0)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [iconsExpanded, setIconsExpanded] = useState(true);
  const [showGifStickerDrawer, setShowGifStickerDrawer] = useState(false);
  const [composerInputKind, setComposerInputKind] =
    useState<ComposerInputKind>("text");
  const [isHoldRecording, setIsHoldRecording] = useState(false);
  // Reanimated keyboard — tracks keyboard height on the native UI thread (zero JS jank)
  const keyboard = useAnimatedKeyboard();
  const keyboardAwareStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));
  const [inputBarHeight, setInputBarHeight] = useState(88);
  const [composerInputHeight, setComposerInputHeight] = useState(
    CHAT_INPUT_LINE_HEIGHT,
  );
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Keep insets.bottom in a ref so keyboard-listener callbacks always see the latest value.
  const insetsBottomRef = useRef(insets.bottom);
  useEffect(() => {
    insetsBottomRef.current = insets.bottom;
  }, [insets.bottom]);
  useEffect(() => {
    messageTextRef.current = messageText;
  }, [messageText]);

  // Early-access badge types for gradient chat bubbles
  const [, setCurrentUserBadgeType] = useState<EarlyAccessBadgeType>(null);
  const [, setChatPartnerBadgeType] = useState<EarlyAccessBadgeType>(null);
  const { bubbleSkin, globalChatBg, localChatBgs, setLocalChatBg } =
    useAppearance();

  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showChatActionsMenu, setShowChatActionsMenu] = useState(false);
  const [showReportChatModal, setShowReportChatModal] = useState(false);
  const [isPartnerBlocked, setIsPartnerBlocked] = useState(false);

  const {
    id: chatPartnerRouteParam,
    context_product_id,
    context_product_title,
    context_product_price,
    context_product_image,
    context_source,
  } = useLocalSearchParams<{
    id?: string | string[];
    context_product_id?: string;
    context_product_title?: string;
    context_product_price?: string;
    context_product_image?: string;
    context_source?: "product" | "marketplace" | "post" | "profile";
  }>();
  const isMongooseChat =
    typeof chatPartnerRouteParam === "string" &&
    chatPartnerRouteParam.startsWith("mongoose-");
  const mongooseName = isMongooseChat
    ? chatPartnerRouteParam.replace("mongoose-", "")
    : null;
  const chatPartnerId = Array.isArray(chatPartnerRouteParam)
    ? chatPartnerRouteParam[0]
    : chatPartnerRouteParam;
  const effectiveCurrentUserUUID = currentUserUUID || contextUserUUID;

  // Track whether the current user has blocked this chat partner, to render
  // the correct Block/Unblock option in the chat actions menu.
  useEffect(() => {
    if (isMongooseChat || !effectiveCurrentUserUUID || !chatPartnerId) return;
    let active = true;
    isUserBlocked(effectiveCurrentUserUUID, chatPartnerId as string).then((blocked) => {
      if (active) setIsPartnerBlocked(blocked);
    });
    return () => {
      active = false;
    };
  }, [effectiveCurrentUserUUID, chatPartnerId, isMongooseChat]);

  const handleBlockTogglePartner = () => {
    if (!effectiveCurrentUserUUID || !chatPartnerId) return;
    setShowChatActionsMenu(false);

    if (isPartnerBlocked) {
      Alert.alert(
        "Unblock User",
        `Unblock @${chatPartnerName || "this user"}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unblock",
            onPress: async () => {
              const result = await unblockUser(effectiveCurrentUserUUID, chatPartnerId as string);
              if (result.success) {
                setIsPartnerBlocked(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else {
                Alert.alert("Unblock Failed", result.error || "Failed to unblock user.");
              }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        "Block User",
        `Are you sure you want to block @${chatPartnerName || "this user"}? You won't be able to message each other anymore.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Block",
            style: "destructive",
            onPress: async () => {
              const result = await blockUser(effectiveCurrentUserUUID, chatPartnerId as string);
              if (result.success) {
                setIsPartnerBlocked(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.back();
              } else {
                Alert.alert("Block Failed", result.error || "Failed to block user.");
              }
            },
          },
        ],
      );
    }
  };

  // ── Draft message persistence (WhatsApp-style) ───────────────────────────────
  // Any unsent text in the composer is stored per-conversation so it reappears
  // when the user returns to the chat. The draft is cleared once sent (which
  // empties the field) or once the user clears it manually.
  const draftKey = chatPartnerId
    ? `${CHAT_DRAFT_KEY_PREFIX}${chatPartnerId}`
    : null;
  const draftLoadedRef = useRef(false);

  // Restore a saved draft when entering a conversation.
  useEffect(() => {
    if (!draftKey) return;
    let active = true;
    draftLoadedRef.current = false;
    AsyncStorage.getItem(draftKey)
      .then((saved) => {
        if (!active) return;
        if (saved && saved.length > 0) {
          setMessageText(saved);
        }
        draftLoadedRef.current = true;
      })
      .catch(() => {
        if (active) draftLoadedRef.current = true;
      });
    return () => {
      active = false;
    };
  }, [draftKey]);

  // Persist the composer text as a draft (debounced). Skipped while editing an
  // existing message, since the field then holds edit content, not a draft.
  useEffect(() => {
    if (!draftKey || !draftLoadedRef.current || isEditMode) return;
    const handle = setTimeout(() => {
      if (messageText.trim().length > 0) {
        AsyncStorage.setItem(draftKey, messageText).catch(() => {});
      } else {
        AsyncStorage.removeItem(draftKey).catch(() => {});
      }
    }, CHAT_DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [messageText, draftKey, isEditMode]);

  // Keep latest draft inputs in refs so the unmount flush sees current values.
  const draftFlushRef = useRef({ key: draftKey, text: messageText, isEditMode });
  draftFlushRef.current = { key: draftKey, text: messageText, isEditMode };
  // Flush immediately on unmount so a draft typed then left within the debounce
  // window isn't lost.
  useEffect(() => {
    return () => {
      const { key, text, isEditMode: editing } = draftFlushRef.current;
      if (!key || editing || !draftLoadedRef.current) return;
      if (text.trim().length > 0) {
        AsyncStorage.setItem(key, text).catch(() => {});
      } else {
        AsyncStorage.removeItem(key).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!context_product_id || !context_product_title) return;
    setPendingProductContext({
      id: String(context_product_id),
      title: String(context_product_title),
      price: context_product_price ? String(context_product_price) : undefined,
      imageUrl: context_product_image
        ? String(context_product_image)
        : undefined,
      source:
        context_source === "marketplace" ||
        context_source === "post" ||
        context_source === "profile"
          ? context_source
          : "product",
    });
  }, [
    context_product_id,
    context_product_title,
    context_product_price,
    context_product_image,
    context_source,
  ]);

  useEffect(() => {
    if (contextUserUUID) {
      setCurrentUserUUID(contextUserUUID);
    }
  }, [contextUserUUID]);

  useFocusEffect(
    useCallback(() => {
      if (!chatPartnerId || isMongooseChat) {
        setActiveChatPartnerId(null);
        return () => setActiveChatPartnerId(null);
      }

      setActiveChatPartnerId(String(chatPartnerId));
      return () => setActiveChatPartnerId(null);
    }, [chatPartnerId, isMongooseChat, setActiveChatPartnerId]),
  );

  // Dismiss keyboard on screen blur so useAnimatedKeyboard() resets its height
  // to 0. Prevents the composer from staying pushed up when revisiting the chat.
  useFocusEffect(
    useCallback(() => {
      return () => {
        Keyboard.dismiss();
      };
    }, []),
  );

  // Preload notification sound assets on chat screen mount
  useEffect(() => {
    void preloadChatSounds();
    return () => {
      void unloadChatSounds();
    };
  }, []);

  // Combine original messages with local messages
  const allMessages = useMemo(() => {
    // Merge and dedupe by id. Prefer server `messages` over `localMessages` when IDs collide.
    const map = new Map<string | number, any>();

    // Add server messages first
    for (const m of messages) {
      if (m && m.id != null) map.set(String(m.id), m);
    }

    // Add local messages only if id not present (optimistic temp ids preserved)
    for (const m of localMessages) {
      if (!m) continue;
      const key = String(m.id);
      if (!map.has(key)) map.set(key, m);
    }

    return Array.from(map.values()).sort((a, b) => {
      const aTime = new Date(a?.created_at || 0).getTime();
      const bTime = new Date(b?.created_at || 0).getTime();
      return aTime - bTime;
    });
  }, [messages, localMessages]);

  const chatImageUrls = useMemo(
    () =>
      allMessages.filter((m) => m?.image_url).map((m) => m.image_url as string),
    [allMessages],
  );
  const chatImageIndexByUrl = useMemo(() => {
    const indexByUrl: Record<string, number> = {};
    chatImageUrls.forEach((url, index) => {
      if (!(url in indexByUrl)) {
        indexByUrl[url] = index;
      }
    });
    return indexByUrl;
  }, [chatImageUrls]);

  const latestOutgoingMessageId = useMemo(() => {
    if (!effectiveCurrentUserUUID) return null;
    for (let i = allMessages.length - 1; i >= 0; i -= 1) {
      const message = allMessages[i];
      if (
        String(message?.sender_id || "") === String(effectiveCurrentUserUUID)
      ) {
        return message?.id != null ? String(message.id) : null;
      }
    }
    return null;
  }, [allMessages, effectiveCurrentUserUUID]);

  const replyCountByMessageId = useMemo(() => {
    const counts: Record<string, number> = {};
    allMessages.forEach((message) => {
      const parsed = parseMessageMetaContent(message?.content);
      const rootId = parsed.replyMeta?.id ? String(parsed.replyMeta.id) : null;
      if (!rootId) return;
      counts[rootId] = (counts[rootId] || 0) + 1;
    });
    return counts;
  }, [allMessages]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTs(Date.now());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const timelineItems = useMemo(() => {
    const items: Array<
      | { type: "separator"; id: string; label: string }
      | {
          type: "message";
          id: string;
          message: any;
          connectPrev: boolean;
          connectNext: boolean;
        }
    > = [];
    const groupWindowMs = 10 * 60 * 1000; // 10 minutes
    const bubbleWindowMs = CHAT_BUBBLE_GROUP_WINDOW_MS;
    let lastDividerTime: Date | null = null;
    const now = new Date(nowTs);

    const formatDividerLabel = (d: Date) => {
      const sameDay = d.toDateString() === now.toDateString();
      if (sameDay) {
        return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
      return d.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    const getKind = (m: any) => {
      if (m?.message_type === "image" || m?.image_url) return "image";
      if (m?.message_type === "audio" || m?.audio_url) return "audio";
      if (m?.message_type === "gif") return "gif";
      if (m?.message_type === "sticker") return "sticker";
      if (m?.content?.includes?.("📍 My Location:")) return "location";
      return "text";
    };

    for (let i = 0; i < allMessages.length; i++) {
      const message = allMessages[i];
      const messageDate = new Date(message?.created_at || Date.now());
      const needsDivider =
        !lastDividerTime ||
        messageDate.toDateString() !== lastDividerTime.toDateString() ||
        messageDate.getTime() - lastDividerTime.getTime() > groupWindowMs;

      if (needsDivider) {
        items.push({
          type: "separator",
          id: `sep-${messageDate.getTime()}`,
          label: formatDividerLabel(messageDate),
        });
        lastDividerTime = messageDate;
      }

      const prev = i > 0 ? allMessages[i - 1] : null;
      const next = i < allMessages.length - 1 ? allMessages[i + 1] : null;
      const messageTime = messageDate.getTime();
      const messageSender = String(message?.sender_id || "");
      const messageKind = getKind(message);

      const canConnect = (other: any) => {
        if (!other) return false;
        const otherSender = String(other?.sender_id || "");
        if (otherSender !== messageSender) return false;
        if (getKind(other) !== messageKind) return false;
        const otherTime = new Date(other?.created_at || 0).getTime();
        return Math.abs(messageTime - otherTime) <= bubbleWindowMs;
      };

      items.push({
        type: "message",
        id: `msg-${String(message?.id)}`,
        message,
        connectPrev: canConnect(prev),
        connectNext: canConnect(next),
      });
    }

    return items;
  }, [allMessages, nowTs]);

  const reversedTimelineItems = useMemo(
    () => [...timelineItems].reverse(),
    [timelineItems],
  );

  const chatPartnerName = useMemo(() => {
    if (isLoadingPartner) {
      return "Loading...";
    }

    if (isMongooseChat && mongooseName) {
      return `${mongooseName} (Mongoose)`;
    }

    if (chatPartnerData) {
      // Prioritize actual names over phone numbers
      // Use the hierarchy: name -> username -> full_name -> display_name
      const name =
        chatPartnerData.name ||
        chatPartnerData.username ||
        chatPartnerData.full_name ||
        chatPartnerData.display_name;

      // Only show phone number if no name is available or if it's a generic "User X" name
      if (
        name &&
        name !== chatPartnerData.phone_number &&
        !name.startsWith("User ")
      ) {
        return name;
      }

      // If we only have phone number, try to format it nicely
      if (chatPartnerData.phone_number) {
        return `+975${chatPartnerData.phone_number}`;
      }
    }

    return "Unknown User";
  }, [chatPartnerData, isMongooseChat, mongooseName, isLoadingPartner]);

  const chatPartnerAvatarUri = useMemo(() => {
    const raw =
      chatPartnerData?.profileImg ||
      chatPartnerData?.avatar_url ||
      chatPartnerData?.profile_url ||
      null;
    if (!raw) return null;
    return typeof raw === "string" ? raw : raw?.uri || null;
  }, [chatPartnerData]);

  const typingUsersList = useMemo(
    () =>
      Object.values(typingUsers).sort(
        (a, b) => b.lastTypedAt - a.lastTypedAt,
      ),
    [typingUsers],
  );
  const isPartnerTyping = typingUsersList.length > 0;
  const typingStatusText = useMemo(() => {
    if (typingUsersList.length === 0) return "";
    if (typingUsersList.length === 1) return "typing...";
    return `${typingUsersList.length} people typing...`;
  }, [typingUsersList]);
  const partnerPresenceText = useMemo(() => {
    if (isPartnerTyping) return typingStatusText;
    if (partnerPresence.isOnline) return "Online";
    return "Offline";
  }, [isPartnerTyping, partnerPresence.isOnline, typingStatusText]);

  const getMessagePreviewText = useCallback((message: any) => {
    if (!message) return "Message";
    const messageType = message.message_type || "text";
    if (messageType === "image" || message.image_url) return "Photo";
    if (messageType === "audio" || message.audio_url) return "Voice message";
    if (messageType === "gif") return "GIF";
    if (messageType === "sticker") return "Sticker";
    if (message.content?.includes?.("📍 My Location:")) return "Location";
    const parsed = parseMessageMetaContent(message.content);
    const text = parsed.text?.trim() || "Message";
    return text.length > 60 ? `${text.slice(0, 60)}...` : text;
  }, []);

  const updateOutgoingStatus = useCallback(
    (
      messageId: string | number | null | undefined,
      next: OutgoingDeliveryStatus,
    ) => {
      if (messageId == null) return;
      const id = String(messageId);
      const rank: Record<OutgoingDeliveryStatus, number> = {
        sent: 1,
        delivered: 2,
        seen: 3,
      };
      setOutgoingStatusById((prev) => {
        const current = prev[id];
        if (!current || rank[next] >= rank[current]) {
          return { ...prev, [id]: next };
        }
        return prev;
      });
    },
    [],
  );

  const loadMoreMessages = useCallback(async () => {
    if (
      isLoadingMore ||
      !hasMoreMessages ||
      !oldestCursorRef.current ||
      !effectiveCurrentUserUUID ||
      !chatPartnerId
    )
      return;
    setIsLoadingMore(true);
    try {
      const { data, error: loadErr } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${effectiveCurrentUserUUID},receiver_id.eq.${chatPartnerId}),and(sender_id.eq.${chatPartnerId},receiver_id.eq.${effectiveCurrentUserUUID})`,
        )
        .lt("created_at", oldestCursorRef.current)
        .order("created_at", { ascending: false })
        .limit(50);
      if (loadErr) throw loadErr;
      if (data && data.length > 0) {
        oldestCursorRef.current = data[data.length - 1].created_at;
        setMessages((prev) => [...data.slice().reverse(), ...prev]);
        setHasMoreMessages(data.length === 50);
      } else {
        setHasMoreMessages(false);
      }
    } catch {
      // silent — pagination will retry on next scroll
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreMessages, effectiveCurrentUserUUID, chatPartnerId]);

  const startReplyToMessage = useCallback((message: any) => {
    if (!message || message.isOptimistic) return;
    setReplyingToMessage(message);
    setReplyFocusRequestToken((prev) => prev + 1);
    setShowMessageActions(false);
    setSelectedMessage(null);
    setIsEditMode(false);
    setEditingMessageId(null);
  }, []);

  const buildReplyMetaForMessage = useCallback(
    (message: any): ReplyMeta | null => {
      if (!message?.id) return null;
      const senderId = String(message.sender_id || "");
      const senderName =
        effectiveCurrentUserUUID && senderId === effectiveCurrentUserUUID
          ? "You"
          : chatPartnerName || "User";
      return {
        id: String(message.id),
        senderId,
        senderName,
        snippet: getMessagePreviewText(message),
      };
    },
    [chatPartnerName, effectiveCurrentUserUUID, getMessagePreviewText],
  );

  const openProductContext = useCallback(
    (productMeta?: ProductMeta | null) => {
      if (!productMeta?.id) return;
      if (productMeta.source === "profile") {
        router.push(`/(users)/profile/${productMeta.id}`);
        return;
      }
      if (productMeta.source === "marketplace") {
        router.push(`/(users)/marketplace/${productMeta.id}`);
        return;
      }
      if (productMeta.source === "post") {
        router.push(`/(users)/post/${productMeta.id}`);
        return;
      }
      router.push(`/(users)/product/${productMeta.id}`);
    },
    [router],
  );

  // Load chat partner data
  useEffect(() => {
    const loadChatPartnerData = async () => {
      if (!chatPartnerId) return;

      setIsLoadingPartner(true);
      try {
        const partnerData = await getUserData(chatPartnerId as string);
        setChatPartnerData(partnerData);
      } catch (error) {
        console.error("Error loading chat partner data:", error);
        // Fallback to basic info
        setChatPartnerData({
          username: `User ${chatPartnerId}`,
          phone_number: chatPartnerId,
          id: chatPartnerId,
        });
      } finally {
        setIsLoadingPartner(false);
      }
    };

    loadChatPartnerData();
  }, [chatPartnerId]);

  // Load badge tiers so badge holders get gradient chat bubbles
  useEffect(() => {
    if (!effectiveCurrentUserUUID) return;
    getEarlyAccessBadge(effectiveCurrentUserUUID)
      .then(setCurrentUserBadgeType)
      .catch(() => {});
  }, [effectiveCurrentUserUUID]);

  useEffect(() => {
    if (!chatPartnerId) return;
    getEarlyAccessBadge(String(chatPartnerId))
      .then(setChatPartnerBadgeType)
      .catch(() => {});
    Promise.resolve(
      supabase
        .from("service_providers")
        .select("verification_status")
        .eq("user_id", String(chatPartnerId))
        .maybeSingle(),
    )
      .then(({ data }) =>
        setPartnerVerified(data?.verification_status === "verified"),
      )
      .catch(() => {});
  }, [chatPartnerId]);

  // Fetch initial messages and subscribe to real-time updates
  useEffect(() => {
    if (!chatPartnerId) {
      return;
    }

    let isSubscribed = true;
    const channelName = `chat_${[effectiveCurrentUserUUID, chatPartnerId]
      .map(String)
      .sort()
      .join("_")}`;

    const setupChatRealtime = async () => {
      console.log(
        "[Chat] Setting up chat. chatPartnerId:",
        chatPartnerId,
        "contextUserUUID:",
        contextUserUUID,
      );
      try {
        let userUUID = contextUserUUID;
        if (!userUUID && currentUser?.id) {
          const { data: profileById } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", currentUser.id)
            .maybeSingle();
          userUUID = profileById?.id || null;
        }

        if (!userUUID) {
          const userPhone =
            currentUser?.phone_number ||
            (currentUser as any)?.phone ||
            (currentUser as any)?.phoneNumber ||
            (currentUser as any)?.mobile;
          const cleanPhone = String(userPhone || "").replace("+975", "");

          if (userPhone || cleanPhone) {
            const { data: profileByPhone } = await supabase
              .from("profiles")
              .select("id")
              .or(`phone.eq.${userPhone},phone.eq.${cleanPhone}`)
              .maybeSingle();
            userUUID = profileByPhone?.id || null;
          }
        }

        if (!userUUID) {
          const { data: authData } = await supabase.auth.getUser();
          userUUID = authData.user?.id || null;
        }

        if (!userUUID) {
          console.error("❌ No UUID found for user");
          return;
        }

        console.log("✅ User UUID:", userUUID.substring(0, 8));
        if (isSubscribed) setCurrentUserUUID(userUUID);

        const fetchLatestMessages = async () => {
          // Check if the user previously deleted this conversation.
          // If so, only show messages created after the deletion.
          let deletedAt: string | null = null;
          try {
            const tsRaw = await AsyncStorage.getItem(
              `hidden_conversations_ts_${userUUID}`,
            );
            if (tsRaw) {
              const tsMap: Record<string, string> = JSON.parse(tsRaw);
              if (tsMap[chatPartnerId]) deletedAt = tsMap[chatPartnerId];
            }
          } catch {
            /* ignore parse errors */
          }

          let query = supabase
            .from("messages")
            .select("*")
            .or(
              `and(sender_id.eq.${userUUID},receiver_id.eq.${chatPartnerId}),and(sender_id.eq.${chatPartnerId},receiver_id.eq.${userUUID})`,
            )
            .order("created_at", { ascending: false })
            .limit(50);

          if (deletedAt) {
            query = query.gt("created_at", deletedAt);
          }

          const { data: messagesData, error: messagesError } = await query;

          if (messagesError) {
            console.error("❌ Error fetching messages:", messagesError);
            console.error(
              "[Chat] Query was: sender_id/receiver_id =",
              userUUID,
              "<->",
              chatPartnerId,
            );
            return;
          }
          if (!isSubscribed) return;
          // Data arrives newest-first; reverse to oldest-first for timelineItems
          const ordered = (messagesData || []).slice().reverse();
          setMessages(ordered);
          setHasMoreMessages((messagesData || []).length === 50);
          if (messagesData && messagesData.length > 0) {
            // Last item in desc order = oldest message
            oldestCursorRef.current =
              messagesData[messagesData.length - 1].created_at;
          }
          // Seed emoji reactions from the DB data on (re)load
          const initRxns: Record<string, string[]> = {};
          for (const m of messagesData || []) {
            const r = m.reactions;
            if (
              r &&
              typeof r === "object" &&
              !Array.isArray(r) &&
              Object.keys(r).length > 0
            ) {
              const emojis = [
                ...new Set(
                  Object.values(r as Record<string, string>).filter(Boolean),
                ),
              ];
              if (emojis.length > 0) initRxns[String(m.id)] = emojis;
            }
          }
          setMessageReactions(initRxns);
          (messagesData || []).forEach((m: any) => {
            if (String(m?.sender_id) === String(userUUID) && m?.id != null) {
              updateOutgoingStatus(m.id, m.is_read ? "seen" : "delivered");
            }
          });
        };

        // Fetch initial messages
        await fetchLatestMessages();

        // Clean up previous channel
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }

        // Set up real-time subscription - listen to ALL messages and filter in callback
        channelRef.current = supabase
          .channel(channelName)
          .on("presence", { event: "sync" }, () => {
            const presenceState = channelRef.current?.presenceState?.() || {};
            const presenceMetas = Object.values(presenceState).flat() as any[];
            const partnerMetas = presenceMetas.filter(
              (meta) => String(meta?.user_id) === String(chatPartnerId),
            );
            setPartnerPresence({
              isOnline: partnerMetas.length > 0,
              lastSeenAt: partnerMetas[0]?.online_at || null,
            });
          })
          .on("broadcast", { event: "typing" }, ({ payload }) => {
            if (!isSubscribed) return;
            if (!payload || payload.senderId === userUUID) return;
            if (payload.receiverId !== userUUID) return;

            const senderId = String(payload.senderId);
            const isTyping = Boolean(payload.isTyping);
            if (typingUserTimeoutsRef.current[senderId]) {
              clearTimeout(typingUserTimeoutsRef.current[senderId]);
              delete typingUserTimeoutsRef.current[senderId];
            }

            if (isTyping) {
              setTypingUsers((prev) => ({
                ...prev,
                [senderId]: {
                  id: senderId,
                  name:
                    typeof payload.senderName === "string" &&
                    payload.senderName.trim()
                      ? payload.senderName.trim()
                      : chatPartnerName,
                  avatarUrl:
                    typeof payload.senderAvatar === "string"
                      ? payload.senderAvatar
                      : chatPartnerAvatarUri,
                  lastTypedAt: Date.now(),
                },
              }));
              typingUserTimeoutsRef.current[senderId] = setTimeout(() => {
                setTypingUsers((prev) => {
                  const next = { ...prev };
                  delete next[senderId];
                  return next;
                });
                delete typingUserTimeoutsRef.current[senderId];
              }, TYPING_REMOTE_STALE_MS);
            } else {
              setTypingUsers((prev) => {
                const next = { ...prev };
                delete next[senderId];
                return next;
              });
            }
          })
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "messages",
            },
            (payload) => {
              if (!isSubscribed) return;

              const message = payload.new as any;
              const oldMessage = payload.old as any;

              // Check if this message involves current conversation
              const isRelevant =
                message &&
                ((message.sender_id === userUUID &&
                  message.receiver_id === chatPartnerId) ||
                  (message.sender_id === chatPartnerId &&
                    message.receiver_id === userUUID));

              if (!isRelevant && payload.eventType !== "DELETE") return;

              if (payload.eventType === "INSERT") {
                console.log(
                  "⚡ New message:",
                  message.content?.substring(0, 30),
                );

                // Add to messages if not duplicate
                setMessages((prev) => {
                  if (prev.some((m) => m.id === message.id)) {
                    return prev;
                  }
                  return [...prev, message];
                });
                if (String(message?.sender_id) === String(userUUID)) {
                  updateOutgoingStatus(
                    message?.id,
                    message?.is_read ? "seen" : "delivered",
                  );
                } else {
                  // Incoming message — play sound + haptic
                  setTypingUsers((prev) => {
                    const next = { ...prev };
                    delete next[String(message.sender_id)];
                    return next;
                  });
                  void playReceiveSound();
                  void triggerReceiveHaptic();
                }

                // Remove matching optimistic message
                setLocalMessages((prev) => {
                  const filtered = prev.filter((m) => {
                    if (!m.isOptimistic) return true;
                    const isSameContent = m.content === message.content;
                    const timeDiff = Math.abs(
                      new Date(m.created_at).getTime() -
                        new Date(message.created_at).getTime(),
                    );
                    if (isSameContent && timeDiff < 5000) {
                      return false;
                    }
                    return true;
                  });
                  return filtered;
                });
              } else if (payload.eventType === "UPDATE") {
                console.log("🔄 Message updated:", message.id?.substring(0, 8));

                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === message.id ? { ...m, ...message } : m,
                  ),
                );
                // Sync reactions when partner reacts (or reactions change)
                if (
                  message.reactions &&
                  typeof message.reactions === "object" &&
                  !Array.isArray(message.reactions)
                ) {
                  const rxnEmojis = [
                    ...new Set(
                      Object.values(
                        message.reactions as Record<string, string>,
                      ).filter(Boolean),
                    ),
                  ];
                  setMessageReactions((prev) => ({
                    ...prev,
                    [String(message.id)]: rxnEmojis,
                  }));
                }
                setLocalMessages((prev) =>
                  prev.map((m) =>
                    m.id === message.id ? { ...m, ...message } : m,
                  ),
                );
                if (
                  String(message?.sender_id) === String(userUUID) &&
                  message?.id != null
                ) {
                  updateOutgoingStatus(
                    message.id,
                    message.is_read ? "seen" : "delivered",
                  );
                }
              } else if (payload.eventType === "DELETE") {
                const deleteId = oldMessage?.id;
                if (deleteId) {
                  console.log("🗑️ Message deleted:", deleteId?.substring(0, 8));

                  setMessages((prev) => prev.filter((m) => m.id !== deleteId));
                  setLocalMessages((prev) =>
                    prev.filter((m) => m.id !== deleteId),
                  );
                }
              }
            },
          )
          .subscribe((status) => {
            if (!isSubscribed) return;
            if (status === "SUBSCRIBED") {
              void channelRef.current?.track?.({
                user_id: userUUID,
                name:
                  currentUser?.name ||
                  currentUser?.username ||
                  (currentUser as any)?.full_name ||
                  (currentUser as any)?.display_name ||
                  "Someone",
                online_at: new Date().toISOString(),
              });
              if (messagesPollRef.current) {
                clearInterval(messagesPollRef.current);
                messagesPollRef.current = null;
              }
            } else if (status === "CHANNEL_ERROR") {
              console.error("❌ Chat subscription ERROR");
              if (!messagesPollRef.current) {
                messagesPollRef.current = setInterval(() => {
                  if (!isSubscribed) return;
                  fetchLatestMessages();
                }, 3000);
              }
            } else if (status === "TIMED_OUT") {
              console.error("⏱️ Chat subscription TIMED OUT");
              if (!messagesPollRef.current) {
                messagesPollRef.current = setInterval(() => {
                  if (!isSubscribed) return;
                  fetchLatestMessages();
                }, 3000);
              }
            }
          });
      } catch (error) {
        console.error("❌ Setup error:", error);
      }
    };

    setupChatRealtime();

    return () => {
      isSubscribed = false;

      if (channelRef.current) {
        if (
          isLocalTypingRef.current &&
          effectiveCurrentUserUUID &&
          chatPartnerId
        ) {
          channelRef.current.send({
            type: "broadcast",
            event: "typing",
            payload: {
              senderId: effectiveCurrentUserUUID,
              receiverId: chatPartnerId,
              isTyping: false,
            },
          });
          isLocalTypingRef.current = false;
        }
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      Object.values(typingUserTimeoutsRef.current).forEach(clearTimeout);
      typingUserTimeoutsRef.current = {};
      setTypingUsers({});
      setPartnerPresence({ isOnline: false, lastSeenAt: null });
      if (typingStartTimeoutRef.current) {
        clearTimeout(typingStartTimeoutRef.current);
        typingStartTimeoutRef.current = null;
      }
      if (typingSendTimeoutRef.current) {
        clearTimeout(typingSendTimeoutRef.current);
        typingSendTimeoutRef.current = null;
      }
      if (messagesPollRef.current) {
        clearInterval(messagesPollRef.current);
        messagesPollRef.current = null;
      }
    };
  }, [
    chatPartnerId,
    chatPartnerAvatarUri,
    chatPartnerName,
    currentUser,
    currentUser?.id,
    currentUser?.phone_number,
    contextUserUUID,
    effectiveCurrentUserUUID,
    updateOutgoingStatus,
  ]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);

    return () => clearTimeout(timer);
  }, [allMessages, isPartnerTyping]);

  // Also scroll when component mounts or messages change
  useEffect(() => {
    if (allMessages.length > 0) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [allMessages.length]);

  // Mark messages as read when new messages arrive
  useEffect(() => {
    const markAsRead = async () => {
      if (!effectiveCurrentUserUUID || !chatPartnerId) return;
      await markConversationAsRead(String(chatPartnerId));
    };

    markAsRead();
  }, [
    messages,
    effectiveCurrentUserUUID,
    chatPartnerId,
    markConversationAsRead,
  ]);

  // Track keyboard visibility for scroll-to-end triggers.
  // The smooth animation is handled by keyboardAwareStyle (paddingBottom) via
  // useAnimatedKeyboard on the native UI thread.
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => {
        setIsKeyboardVisible(true);
        setTimeout(
          () =>
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
          80,
        );
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setIsKeyboardVisible(false);
        setIconsExpanded(true); // restore icons when keyboard closes
        setReplyingToMessage(null);
        setReplyFocusRequestToken(0);
        if (!messageTextRef.current.trim()) {
          setComposerInputHeight(CHAT_INPUT_LINE_HEIGHT);
        }
        setTimeout(
          () =>
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
          40,
        );
      },
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Keep latest bubble visible when keyboard is opened.
  useEffect(() => {
    if (!isKeyboardVisible) return;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 120);
    return () => clearTimeout(timer);
  }, [isKeyboardVisible]);

  // Keep the latest bubble visible if composer height changes while typing.
  useEffect(() => {
    if (!isKeyboardVisible) return;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 80);
    return () => clearTimeout(timer);
  }, [inputBarHeight, messageText, isKeyboardVisible]);

  const chatBottomPadding = useMemo(() => {
    // ScrollView and input bar are flex siblings inside the Reanimated container,
    // so they never overlap. paddingBottom just adds a small breathing gap at the
    // end of scroll content — it does NOT need to equal the input bar height.
    if (isKeyboardVisible) {
      return 8;
    }
    // Keyboard-closed: compact clearance above the composer.
    return Math.max(14, Math.round(inputBarHeight * 0.2));
  }, [isKeyboardVisible, inputBarHeight]);

  // Extra settle pass for keyboard-close + layout update.
  useEffect(() => {
    if (isKeyboardVisible) return;
    const timer = setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 220);
    return () => clearTimeout(timer);
  }, [isKeyboardVisible, chatBottomPadding, inputBarHeight]);

  const sendTypingEvent = useCallback(
    (typing: boolean) => {
      if (!channelRef.current || !effectiveCurrentUserUUID || !chatPartnerId)
        return;
      const senderName =
        currentUser?.name ||
        currentUser?.username ||
        (currentUser as any)?.full_name ||
        (currentUser as any)?.display_name ||
        "Someone";
      const senderAvatar =
        currentUser?.profileImg ||
        (currentUser as any)?.avatar_url ||
        (currentUser as any)?.profile_url ||
        null;
      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          senderId: effectiveCurrentUserUUID,
          receiverId: chatPartnerId,
          isTyping: typing,
          senderName,
          senderAvatar,
        },
      });
    },
    [effectiveCurrentUserUUID, chatPartnerId, currentUser],
  );

  const focusComposerInput = useCallback(() => {
    if (composerFocusFrameRef.current != null) {
      cancelAnimationFrame(composerFocusFrameRef.current);
    }
    if (composerFocusTimeoutRef.current) {
      clearTimeout(composerFocusTimeoutRef.current);
    }

    const performFocus = () => {
      chatInputRef.current?.focus();
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    };

    performFocus();
    composerFocusFrameRef.current = requestAnimationFrame(() => {
      performFocus();
      composerFocusFrameRef.current = null;
    });
    composerFocusTimeoutRef.current = setTimeout(() => {
      performFocus();
      composerFocusTimeoutRef.current = null;
    }, 80);
  }, []);

  useEffect(() => {
    return () => {
      if (composerFocusFrameRef.current != null) {
        cancelAnimationFrame(composerFocusFrameRef.current);
      }
      if (composerFocusTimeoutRef.current) {
        clearTimeout(composerFocusTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!replyingToMessage || replyFocusRequestToken === 0) {
      return;
    }
    focusComposerInput();
  }, [focusComposerInput, replyFocusRequestToken, replyingToMessage]);

  const handleBackNavigation = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(users)/messages" as any);
  }, [router]);

  const handleSendMessage = async () => {
    const baseMessageContent = messageText.trim();
    if (!baseMessageContent || !effectiveCurrentUserUUID || !chatPartnerId) {
      return;
    }
    // Natively clear the input first to flush any pending autocorrect,
    // preventing the corrected word from reappearing after send.
    chatInputRef.current?.clear();
    const replyMeta = replyingToMessage
      ? buildReplyMetaForMessage(replyingToMessage)
      : null;
    const messageContent = buildMessageMetaContent(baseMessageContent, {
      replyMeta,
      productMeta: pendingProductContext,
    });

    const optimisticId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticMessage = {
      id: optimisticId,
      sender_id: effectiveCurrentUserUUID,
      receiver_id: chatPartnerId,
      content: messageContent,
      created_at: new Date().toISOString(),
      is_read: false,
      isOptimistic: true,
      localStatus: "sending",
    };

    setLocalMessages((prev) => [...prev, optimisticMessage]);
    setMessageText("");
    setReplyingToMessage(null);
    setPendingProductContext(null);
    if (typingStartTimeoutRef.current) {
      clearTimeout(typingStartTimeoutRef.current);
      typingStartTimeoutRef.current = null;
    }
    if (typingSendTimeoutRef.current) {
      clearTimeout(typingSendTimeoutRef.current);
      typingSendTimeoutRef.current = null;
    }
    if (isLocalTypingRef.current) {
      isLocalTypingRef.current = false;
      channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: {
          senderId: effectiveCurrentUserUUID,
          receiverId: chatPartnerId,
          isTyping: false,
        },
      });
    }
    void triggerSendHaptic();
    void playSendSound();
    await sendMessageToServer({
      messageContent,
      optimisticId,
      messagePreview: baseMessageContent,
    });
  };

  const sendMessageToServer = useCallback(
    async ({
      messageContent,
      optimisticId,
      messagePreview,
    }: {
      messageContent: string;
      optimisticId: string;
      messagePreview: string;
    }) => {
      if (!effectiveCurrentUserUUID || !chatPartnerId) return;

      try {
        const { data, error } = await supabase
          .from("messages")
          .insert([
            {
              sender_id: effectiveCurrentUserUUID,
              receiver_id: chatPartnerId,
              content: messageContent,
              is_read: false,
            },
          ])
          .select()
          .single();

        if (error) {
          console.error("❌ Send error:", error.message);
          setLocalMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticId ? { ...m, localStatus: "failed" } : m,
            ),
          );
          return;
        }

        setLocalMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId ? { ...m, localStatus: "sent" } : m,
          ),
        );
        updateOutgoingStatus(data?.id, "sent");

        void sendChatPushNotification({
          senderId: String(effectiveCurrentUserUUID),
          receiverId: String(chatPartnerId),
          messageType: "text",
          messagePreview,
        });

        // Create a message request if the receiver doesn't follow the sender back
        // (i.e. not a mutual follow). Uses INSERT ... ON CONFLICT DO NOTHING so it
        // only fires once and never overwrites an already-accepted request.
        // Commerce context (product/marketplace inquiry) always goes to main inbox.
        void (async () => {
          const { data: reverseFollow } = await supabase
            .from("follows")
            .select("id")
            .eq("follower_id", chatPartnerId)
            .eq("following_id", effectiveCurrentUserUUID)
            .maybeSingle();

          if (!reverseFollow) {
            const msgContext = pendingProductContext ? "commerce" : "personal";
            if (msgContext === "commerce") {
              // Try to insert; if row already exists just upgrade its context column
              // (never touch status so we don't trample an 'accepted' row)
              const { error: insertErr } = await supabase
                .from("message_requests")
                .insert({
                  sender_id: effectiveCurrentUserUUID,
                  receiver_id: chatPartnerId,
                  status: "pending",
                  context: "commerce",
                });
              if (insertErr) {
                // Row already exists — upgrade context to 'commerce' without touching status
                await supabase
                  .from("message_requests")
                  .update({ context: "commerce" })
                  .eq("sender_id", effectiveCurrentUserUUID)
                  .eq("receiver_id", chatPartnerId)
                  .neq("context", "commerce");
              }
            } else {
              await supabase.from("message_requests").upsert(
                {
                  sender_id: effectiveCurrentUserUUID,
                  receiver_id: chatPartnerId,
                  status: "pending",
                  context: "personal",
                },
                { onConflict: "sender_id,receiver_id", ignoreDuplicates: true },
              );
            }
          }
        })();

        // Fallback: If realtime doesn't pick it up within 2 seconds, add it manually
        setTimeout(() => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) {
              return prev;
            }
            updateOutgoingStatus(
              data?.id,
              data?.is_read ? "seen" : "delivered",
            );
            return [...prev, data];
          });
          setLocalMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        }, 2000);
      } catch (error) {
        console.error("❌ Exception:", error);
        setLocalMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId ? { ...m, localStatus: "failed" } : m,
          ),
        );
      }
    },
    [
      chatPartnerId,
      effectiveCurrentUserUUID,
      pendingProductContext,
      updateOutgoingStatus,
    ],
  );

  // Debounced typing indicator - prevents timeout accumulation
  const handleTextChange = (text: string) => {
    setMessageText(text);
    const hasMeaningfulText = text.trim().length > 0;
    const now = Date.now();

    if (typingSendTimeoutRef.current) {
      clearTimeout(typingSendTimeoutRef.current);
      typingSendTimeoutRef.current = null;
    }

    if (hasMeaningfulText) {
      if (!isLocalTypingRef.current && !typingStartTimeoutRef.current) {
        typingStartTimeoutRef.current = setTimeout(() => {
          isLocalTypingRef.current = true;
          lastTypingRefreshRef.current = Date.now();
          sendTypingEvent(true);
          typingStartTimeoutRef.current = null;
        }, TYPING_START_DEBOUNCE_MS);
      } else if (
        now - lastTypingRefreshRef.current >
        TYPING_REFRESH_THROTTLE_MS
      ) {
        lastTypingRefreshRef.current = now;
        sendTypingEvent(true);
      }

      typingSendTimeoutRef.current = setTimeout(() => {
        isLocalTypingRef.current = false;
        sendTypingEvent(false);
        typingSendTimeoutRef.current = null;
      }, TYPING_IDLE_TIMEOUT_MS);
    } else {
      if (typingStartTimeoutRef.current) {
        clearTimeout(typingStartTimeoutRef.current);
        typingStartTimeoutRef.current = null;
      }
      if (isLocalTypingRef.current) {
        isLocalTypingRef.current = false;
        sendTypingEvent(false);
      }
    }
  };

  const handleShareLocation = async () => {
    // Ask for permission and pre-center the map on the user's position
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showPopup(
          "warning",
          "Location Permission Needed",
          "Enable location permission in Settings to share your current location.",
          [
            { label: "Not now", style: "cancel" },
            {
              label: "Open Settings",
              onPress: () => {
                void Linking.openSettings();
              },
            },
          ],
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLocationPickerInitial({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
    } catch {
      showPopup(
        "warning",
        "Location Unavailable",
        "Please enable location permission in Settings and try again.",
        [
          { label: "Not now", style: "cancel" },
          {
            label: "Open Settings",
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ],
      );
      return;
    }
    setShowLocationPicker(true);
  };

  const handleSendPickedLocation = async (loc: {
    latitude: number;
    longitude: number;
    address?: string;
  }) => {
    if (isSharingLocation || !effectiveCurrentUserUUID || !chatPartnerId)
      return;
    setIsSharingLocation(true);
    try {
      const locationMessage = `📍 My Location: https://maps.google.com/?q=${loc.latitude},${loc.longitude}`;

      // Optimistic message
      const optimisticId = `temp-${Date.now()}-${Math.random()}`;
      const optimisticMessage = {
        id: optimisticId,
        sender_id: effectiveCurrentUserUUID,
        receiver_id: chatPartnerId,
        content: locationMessage,
        created_at: new Date().toISOString(),
        is_read: false,
        isOptimistic: true,
        isLocation: true,
      };
      setLocalMessages((prev) => [...prev, optimisticMessage]);

      const { data, error } = await supabase
        .from("messages")
        .insert([
          {
            sender_id: effectiveCurrentUserUUID,
            receiver_id: chatPartnerId,
            content: locationMessage,
            is_read: false,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("❌ Location send error:", error.message);
        setLocalMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        showPopup(
          "error",
          "Share Failed",
          "Failed to share location. Please try again.",
        );
      } else {
        setTimeout(() => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [...prev, data];
          });
          setLocalMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        }, 1500);
      }
    } catch (err) {
      console.error("❌ Location error:", err);
      showPopup(
        "error",
        "Share Failed",
        "Failed to share location. Please try again.",
      );
    } finally {
      setIsSharingLocation(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!selectedMessage) return;

    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", selectedMessage.id);

      if (error) {
        console.error("Error deleting message:", error);
        alert("Failed to delete message");
      } else {
        // Remove from local state
        setMessages((prev) => prev.filter((m) => m.id !== selectedMessage.id));
        setLocalMessages((prev) =>
          prev.filter((m) => m.id !== selectedMessage.id),
        );
      }
    } catch (e) {
      console.error("Exception deleting message:", e);
      alert("Failed to delete message");
    } finally {
      setShowMessageActions(false);
      setSelectedMessage(null);
    }
  };

  const handleCopyMessage = async () => {
    if (!selectedMessage) return;

    const textToCopy = getCopyableMessageText(selectedMessage);
    if (!textToCopy) {
      setShowMessageActions(false);
      showPopup(
        "warning",
        "Nothing to Copy",
        "This message does not contain copyable text.",
      );
      return;
    }

    try {
      await Clipboard.setStringAsync(textToCopy);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
      setShowMessageActions(false);
      setSelectedMessage(null);
      showPopup("success", "Copied", "Message copied to clipboard.");
    } catch (error) {
      console.error("Clipboard copy failed:", error);
      setShowMessageActions(false);
      showPopup(
        "error",
        "Copy Failed",
        "Unable to copy this message right now.",
      );
    }
  };

  const handleReplyFromActions = () => {
    if (!selectedMessage) return;
    startReplyToMessage(selectedMessage);
  };

  const handleEditMessage = () => {
    if (!selectedMessage) return;

    const parsed = parseMessageMetaContent(selectedMessage.content);
    setIsEditMode(true);
    setEditingMessageId(selectedMessage.id);
    setMessageText(parsed.text);
    setShowMessageActions(false);
    setSelectedMessage(null);
  };

  const handleUpdateMessage = async () => {
    if (!editingMessageId || !messageText.trim()) return;

    const previousMessage =
      allMessages.find((m) => String(m?.id) === String(editingMessageId)) ||
      localMessages.find((m) => String(m?.id) === String(editingMessageId));
    const previousParsed = parseMessageMetaContent(previousMessage?.content);
    const updatedContent = buildMessageMetaContent(messageText.trim(), {
      replyMeta: previousParsed.replyMeta,
      productMeta: previousParsed.productMeta,
    });

    try {
      const { error } = await supabase
        .from("messages")
        .update({
          content: updatedContent,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingMessageId);

      if (error) {
        console.error("Error updating message:", error);
        alert("Failed to update message");
      } else {
        // Update local state
        setMessages((prev) =>
          prev.map((m) =>
            m.id === editingMessageId
              ? {
                  ...m,
                  content: updatedContent,
                  updated_at: new Date().toISOString(),
                }
              : m,
          ),
        );
        setLocalMessages((prev) =>
          prev.map((m) =>
            m.id === editingMessageId
              ? {
                  ...m,
                  content: updatedContent,
                  updated_at: new Date().toISOString(),
                }
              : m,
          ),
        );
      }
    } catch (e) {
      console.error("Exception updating message:", e);
      alert("Failed to update message");
    } finally {
      setIsEditMode(false);
      setEditingMessageId(null);
      setMessageText("");
    }
  };

  // Image picker handlers
  const handleOptimisticImage = (optimisticMsg: any) => {
    setLocalMessages((prev) => [...prev, optimisticMsg]);
  };

  const handleImageUploadSuccess = (finalMsg: any, optimisticId: string) => {
    // Fallback: add manually if realtime doesn't pick it up
    setTimeout(() => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === finalMsg.id)) {
          return prev;
        }
        return [...prev, finalMsg];
      });
      // Remove optimistic message
      setLocalMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    }, 2000);
  };

  const handleImageUploadError = (optimisticId: string) => {
    setLocalMessages((prev) =>
      prev.map((m) =>
        m.id === optimisticId ? { ...m, localStatus: "failed" } : m,
      ),
    );
  };

  // Audio recorder handlers
  const handleOptimisticAudio = (optimisticMsg: any) => {
    setLocalMessages((prev) => [...prev, optimisticMsg]);
  };

  const handleAudioUploadSuccess = (finalMsg: any, optimisticId: string) => {
    void triggerSendHaptic();
    // Fallback: add manually if realtime doesn't pick it up
    setTimeout(() => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === finalMsg.id)) {
          return prev;
        }
        return [...prev, finalMsg];
      });
      // Remove optimistic message
      setLocalMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    }, 2000);
  };

  const handleAudioUploadError = (optimisticId: string) => {
    setLocalMessages((prev) =>
      prev.map((m) =>
        m.id === optimisticId ? { ...m, localStatus: "failed" } : m,
      ),
    );
  };

  const sendGifStickerToServer = useCallback(
    async ({
      payload,
      optimisticId,
    }: {
      payload: GifStickerPayload;
      optimisticId: string;
    }) => {
      if (!effectiveCurrentUserUUID || !chatPartnerId) return;

      const content = JSON.stringify(payload);

      try {
        const { data, error } = await supabase
          .from("messages")
          .insert([
            {
              sender_id: effectiveCurrentUserUUID,
              receiver_id: chatPartnerId,
              content,
              message_type: payload.type,
              is_read: false,
            },
          ])
          .select()
          .single();

        if (error) {
          console.error("❌ GIF/sticker send error:", error.message);
          setLocalMessages((prev) =>
            prev.map((m) =>
              m.id === optimisticId ? { ...m, localStatus: "failed" } : m,
            ),
          );
          return;
        }

        setLocalMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId ? { ...m, localStatus: "sent" } : m,
          ),
        );
        updateOutgoingStatus(data?.id, "sent");

        setTimeout(() => {
          setMessages((prev) => {
            if (!data || prev.some((m) => m.id === data.id)) return prev;
            return [...prev, data];
          });
          setLocalMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        }, 1500);

        void sendChatPushNotification({
          senderId: String(effectiveCurrentUserUUID),
          receiverId: String(chatPartnerId),
          messageType: payload.type,
          messagePreview: payload.type === "gif" ? "GIF" : "Sticker",
        });
      } catch (error) {
        console.error("❌ GIF/sticker send exception:", error);
        setLocalMessages((prev) =>
          prev.map((m) =>
            m.id === optimisticId ? { ...m, localStatus: "failed" } : m,
          ),
        );
      }
    },
    [chatPartnerId, effectiveCurrentUserUUID, updateOutgoingStatus],
  );

  const handleSendGifSticker = async (payload: GifStickerPayload) => {
    if (!effectiveCurrentUserUUID || !chatPartnerId) return;

    const optimisticId = `temp-${payload.type}-${Date.now()}`;
    const content = JSON.stringify(payload);
    const optimisticMessage = {
      id: optimisticId,
      sender_id: effectiveCurrentUserUUID,
      receiver_id: chatPartnerId,
      content,
      message_type: payload.type,
      created_at: new Date().toISOString(),
      is_read: false,
      isOptimistic: true,
      localStatus: "sending",
    };

    setLocalMessages((prev) => [...prev, optimisticMessage]);
    void triggerSendHaptic();
    void playSendSound();
    await sendGifStickerToServer({ payload, optimisticId });
  };

  const handleMongooseClick = () => {
    if (isMongooseChat) {
      // Inside a mongoose-support chat: navigate to track tab
      router.push({
        pathname: "/(users)/messages" as any,
        params: { tab: "1" },
      });
      return;
    }
    // Regular chat: open initiator flow
    setShowMongooseInitiator(true);
  };

  /** Called by MongooseInitiatorModal after user fills in role/location/datetime */
  const handleMongooseInviteSent = async (inviteContent: string) => {
    if (!effectiveCurrentUserUUID || !chatPartnerId) return;
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert([
          {
            sender_id: effectiveCurrentUserUUID,
            receiver_id: chatPartnerId,
            content: inviteContent,
            message_type: "mongoose_invite",
            is_read: false,
          },
        ])
        .select()
        .single();
      if (error) {
        console.error("Failed to send mongoose invite:", error);
        return;
      }
      if (data) {
        // Add to local messages if not already added via realtime
        setTimeout(() => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === data.id)) return prev;
            return [...prev, data];
          });
        }, 1500);
      }
    } catch (err) {
      console.error("Unexpected error sending mongoose invite:", err);
    }
  };

  /** Called by MongooseInviteCard when the initiator taps "Cancel Request" */
  const handleMongooseCancelRequest = useCallback(
    async (messageId: string) => {
      const updatedContent = JSON.stringify({
        ...JSON.parse(
          messages.find((m) => String(m.id) === messageId)?.content ?? "{}",
        ),
        status: "cancelled",
      });
      await supabase
        .from("messages")
        .update({ content: updatedContent })
        .eq("id", messageId);
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id) === messageId ? { ...m, content: updatedContent } : m,
        ),
      );
    },
    [messages],
  );

  /** Called by MongooseInviteCard when the receiver taps "Confirm Your Location" */
  const handleMongooseInviteResponse = useCallback(
    (messageId: string, data: MongooseInviteData) => {
      setPendingMongooseInvite({ messageId, data });
      setShowMongooseResponder(true);
    },
    [],
  );

  /** Called by MongooseResponderModal after booking_request inserted successfully */
  const handleMongooseConfirmed = async (bookingRequestId: string) => {
    if (!pendingMongooseInvite) return;
    const { messageId, data } = pendingMongooseInvite;

    // Update the invite message content: mark as confirmed
    const updatedContent = JSON.stringify({
      ...data,
      status: "awaiting_mongoose",
      bookingRequestId,
    });

    // Persist to Supabase
    await supabase
      .from("messages")
      .update({ content: updatedContent })
      .eq("id", messageId);

    // Optimistic local update
    setMessages((prev) =>
      prev.map((m) =>
        String(m.id) === messageId ? { ...m, content: updatedContent } : m,
      ),
    );

    // Inform Person 1 (initiator) that the booking is now with Mongoose
    const submittedNotice =
      "Booking confirmed! Mongoose has been notified and will review your delivery request. You can track once they accept.";
    await supabase.from("messages").insert([
      {
        sender_id: effectiveCurrentUserUUID,
        receiver_id: chatPartnerId,
        content: submittedNotice,
        is_read: false,
      },
    ]);

    // Notify Person 1 (initiator) that Person 2 has confirmed the booking
    if (chatPartnerId && effectiveCurrentUserUUID) {
      notifyMongooseBookingConfirmed(
        chatPartnerId,
        effectiveCurrentUserUUID,
      ).catch((e) =>
        console.warn("[chat] notifyMongooseBookingConfirmed failed:", e),
      );
    }

    setPendingMongooseInvite(null);
    setShowMongooseResponder(false);
  };

  /** Called by MongooseInviteCard's confirmed-state "Track" button */
  const handleMongooseTrack = useCallback(async (bookingId: string) => {
    const { data } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("id", bookingId)
      .single();
    if (data) {
      setMongooseTrackerBooking(data);
      setShowMongooseTracker(true);
    }
  }, []);

  const openMessageActions = useCallback(
    (message: any, pageY?: number, isCurrentUser?: boolean) => {
      if (!message || message.isOptimistic) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      setSelectedMessage(message);
      setSelectedMessagePageY(pageY ?? 0);
      setSelectedMessageIsCurrentUser(isCurrentUser ?? false);
      setShowMessageActions(true);
    },
    [],
  );

  const retryFailedMessage = useCallback(
    (message: any) => {
      if (!message || message.localStatus !== "failed") return;
      if (!canRetryFailedMessage(message)) {
        showPopup(
          "warning",
          "Retry Unavailable",
          "Please choose this media again to resend it.",
        );
        return;
      }

      const optimisticId = String(message.id);
      const messageType = message.message_type || "text";

      setLocalMessages((prev) =>
        prev.map((m) =>
          String(m.id) === optimisticId ? { ...m, localStatus: "sending" } : m,
        ),
      );

      if (messageType === "gif" || messageType === "sticker") {
        const payload = parseGifStickerContent(message.content);
        if (!payload) {
          setLocalMessages((prev) =>
            prev.map((m) =>
              String(m.id) === optimisticId
                ? { ...m, localStatus: "failed" }
                : m,
            ),
          );
          return;
        }
        void sendGifStickerToServer({ payload, optimisticId });
        return;
      }

      const parsed = parseMessageMetaContent(message.content);
      const messagePreview =
        parsed.text?.trim() ||
        (message.content?.includes?.("📍 My Location:")
          ? "Location"
          : "Sent a message");

      void sendMessageToServer({
        messageContent: message.content,
        optimisticId,
        messagePreview,
      });
    },
    [sendGifStickerToServer, sendMessageToServer, showPopup],
  );

  const renderOutgoingStatus = useCallback(
    (
      message: any,
      isCurrentUser: boolean,
      isOptimistic: boolean,
      localStatus: string | undefined,
      connectNext: boolean,
      isLatestOutgoingMessage: boolean,
    ) => {
      if (!isCurrentUser || (connectNext && localStatus !== "failed"))
        return null;

      let label = "";
      let tone = "text-gray-400";
      const canRetry = canRetryFailedMessage(message);

      if (isOptimistic) {
        if (localStatus === "failed") {
          label = canRetry ? "Failed to send · Tap to retry" : "Failed to send";
          tone = "text-red-500";
        } else if (localStatus === "sent") {
          label = "Sent";
        } else {
          label = "Sending...";
        }
      } else if (isLatestOutgoingMessage) {
        const status = outgoingStatusById[String(message?.id)];
        if (message?.is_read || status === "seen") {
          label = "Seen";
          tone = "text-blue-500";
        } else if (status === "delivered") {
          label = "Delivered";
        } else {
          label = "Sent";
        }
      }

      if (!label) return null;

      if (isOptimistic && localStatus === "failed" && canRetry) {
        return (
          <TouchableOpacity
            onPress={() => retryFailedMessage(message)}
            className="mt-1 mr-3"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className={`text-[11px] font-semibold ${tone}`}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      }

      return <Text className={`text-[11px] mt-1 ${tone} mr-3`}>{label}</Text>;
    },
    [outgoingStatusById, retryFailedMessage],
  );

  const renderMessage = useCallback(
    (message: any, index: number, connectPrev = false, connectNext = false) => {
      const isCurrentUser = !!(
        effectiveCurrentUserUUID &&
        message.sender_id === effectiveCurrentUserUUID
      );
      const isOptimistic = message.isOptimistic;
      const localStatus = message.localStatus;
      const key = message.id != null ? String(message.id) : `idx-${index}`;
      const isLatestOutgoingMessage =
        latestOutgoingMessageId != null &&
        message?.id != null &&
        String(message.id) === latestOutgoingMessageId;
      const parentReplyCount =
        message?.id != null
          ? replyCountByMessageId[String(message.id)] || 0
          : 0;
      const messageType = message.message_type || "text";
      const isLocation = message.content?.includes("📍 My Location:");
      const isImage = messageType === "image" || message.image_url;
      const isAudio = messageType === "audio" || message.audio_url;
      const gifStickerPayload =
        messageType === "gif" || messageType === "sticker"
          ? parseGifStickerContent(message.content)
          : null;
      const parsedContent = parseMessageMetaContent(message.content);
      const visibleTextContent = parsedContent.text;
      const hasVisibleTextContent = visibleTextContent.trim().length > 0;
      const embeddedReplyMeta = parsedContent.replyMeta;
      const embeddedProductMeta = parsedContent.productMeta;
      const shouldRenderTextBubble =
        hasVisibleTextContent || !!embeddedReplyMeta;
      const RADIUS_LARGE = 20;
      const RADIUS_SMALL = 6;
      const rowSpacingClass = connectNext ? "mb-1" : "mb-3";
      const productCardWidth = Math.round(screenWidth * 0.6);
      const bubbleMaxWidth = Math.round(
        screenWidth * CHAT_BUBBLE_MAX_WIDTH_RATIO,
      );
      // Reactions stored locally for this message
      const reactionsForMsg =
        message?.id != null ? messageReactions[String(message.id)] || [] : [];
      const bubbleRadiusStyle = isCurrentUser
        ? {
            borderTopLeftRadius: RADIUS_LARGE,
            borderBottomLeftRadius: RADIUS_LARGE,
            borderTopRightRadius: connectPrev ? RADIUS_SMALL : RADIUS_LARGE,
            borderBottomRightRadius: connectNext ? RADIUS_SMALL : RADIUS_LARGE,
          }
        : {
            borderTopRightRadius: RADIUS_LARGE,
            borderBottomRightRadius: RADIUS_LARGE,
            borderTopLeftRadius: connectPrev ? RADIUS_SMALL : RADIUS_LARGE,
            borderBottomLeftRadius: connectNext ? RADIUS_SMALL : RADIUS_LARGE,
          };

      // Extract coordinates from location message
      let coordinates = null;
      if (isLocation) {
        const urlMatch = message.content.match(
          /https:\/\/maps\.google\.com\/\?q=([0-9.-]+),([0-9.-]+)/,
        );
        if (urlMatch) {
          coordinates = {
            latitude: parseFloat(urlMatch[1]),
            longitude: parseFloat(urlMatch[2]),
          };
        }
      }

      const handleLocationPress = () => {
        if (isLocation && coordinates) {
          setSelectedLocation(coordinates);
          setShowMapModal(true);
        }
      };

      const handleImagePress = () => {
        if (isImage && message.image_url) {
          const idx = chatImageIndexByUrl[message.image_url] ?? -1;
          setPreviewImageIndex(idx >= 0 ? idx : 0);
          setShowImagePreview(true);
        }
      };

      // Render mongoose invite card (before audio/image/text checks)
      if (message.message_type === "mongoose_invite") {
        return (
          <View
            key={key}
            className={`${rowSpacingClass} ${isCurrentUser ? "items-end" : "items-start"}`}
          >
            <MongooseInviteCard
              messageId={String(message.id)}
              rawContent={message.content}
              isCurrentUser={isCurrentUser}
              chatPartnerName={chatPartnerName}
              onTapToRespond={handleMongooseInviteResponse}
              onTrack={handleMongooseTrack}
              onCancel={handleMongooseCancelRequest}
            />
          </View>
        );
      }

      // Render audio message
      if (isAudio) {
        return (
          <View
            key={key}
            className={`${rowSpacingClass} ${isCurrentUser ? "items-end" : "items-start"}`}
          >
            <Pressable
              onLongPress={(e) =>
                openMessageActions(message, e.nativeEvent.pageY, isCurrentUser)
              }
              delayLongPress={400}
            >
              <View className={`${isCurrentUser ? "mr-2" : "ml-2"}`}>
                <AudioMessagePlayer
                  audioUrl={message.audio_url}
                  duration={message.audio_duration}
                  isCurrentUser={isCurrentUser}
                  isOptimistic={isOptimistic}
                />
              </View>
            </Pressable>
            {reactionsForMsg.length > 0 && (
              <ReactionPill
                key={reactionsForMsg.join("-")}
                reactions={reactionsForMsg}
                isCurrentUser={isCurrentUser}
              />
            )}
            {renderOutgoingStatus(
              message,
              isCurrentUser,
              isOptimistic,
              localStatus,
              connectNext,
              isLatestOutgoingMessage,
            )}
          </View>
        );
      }

      if (gifStickerPayload) {
        const mediaWidth = Math.min(220, Math.round(screenWidth * 0.58));
        const sourceWidth = gifStickerPayload.width || 1;
        const sourceHeight = gifStickerPayload.height || 1;
        const mediaHeight = Math.max(
          120,
          Math.min(260, Math.round(mediaWidth * (sourceHeight / sourceWidth))),
        );

        return (
          <View
            key={key}
            className={`${rowSpacingClass} ${isCurrentUser ? "items-end" : "items-start"}`}
          >
            <SwipeableRow
              onTriggered={() => startReplyToMessage(message)}
              isCurrentUser={isCurrentUser}
            >
              <Pressable
                onLongPress={(e) =>
                  openMessageActions(
                    message,
                    e.nativeEvent.pageY,
                    isCurrentUser,
                  )
                }
                delayLongPress={400}
                className={`${isCurrentUser ? "mr-2" : "ml-2"} ${
                  isOptimistic ? "opacity-70" : ""
                }`}
                style={[
                  bubbleRadiusStyle,
                  {
                    overflow: "hidden",
                    backgroundColor:
                      gifStickerPayload.type === "sticker"
                        ? "transparent"
                        : "#111827",
                  },
                ]}
              >
                <ExpoImage
                  source={{ uri: gifStickerPayload.url }}
                  style={{ width: mediaWidth, height: mediaHeight }}
                  contentFit="cover"
                />
                {isOptimistic && localStatus !== "failed" ? (
                  <View className="absolute inset-0 bg-black/20 items-center justify-center">
                    <ActivityIndicator color="white" />
                  </View>
                ) : null}
                {localStatus === "failed" ? (
                  <View className="absolute inset-0 bg-black/40 items-center justify-center">
                    <Text className="text-white text-xs font-semibold">
                      Failed to send
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            </SwipeableRow>
            {reactionsForMsg.length > 0 && (
              <ReactionPill
                key={reactionsForMsg.join("-")}
                reactions={reactionsForMsg}
                isCurrentUser={isCurrentUser}
              />
            )}
            {renderOutgoingStatus(
              message,
              isCurrentUser,
              isOptimistic,
              localStatus,
              connectNext,
              isLatestOutgoingMessage,
            )}
          </View>
        );
      }

      // Render image message
      if (isImage) {
        return (
          <View
            key={key}
            className={`${rowSpacingClass} ${isCurrentUser ? "items-end" : "items-start"}`}
          >
            <Pressable
              onPress={handleImagePress}
              onLongPress={(e) =>
                openMessageActions(message, e.nativeEvent.pageY, isCurrentUser)
              }
              delayLongPress={400}
            >
              <View
                style={[
                  bubbleRadiusStyle,
                  {
                    maxWidth: bubbleMaxWidth,
                    overflow: "hidden",
                    marginRight: isCurrentUser ? 8 : 0,
                    marginLeft: isCurrentUser ? 0 : 8,
                    opacity: isOptimistic ? 0.7 : 1,
                  },
                ]}
              >
                <Image
                  source={{ uri: message.image_url }}
                  style={{ width: 200, height: 200 }}
                  resizeMode="cover"
                />
                {isOptimistic && (
                  <View className="absolute inset-0 bg-black/30 items-center justify-center">
                    <ActivityIndicator color="white" />
                    <Text className="text-white text-xs mt-2">
                      Uploading...
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
            {reactionsForMsg.length > 0 && (
              <ReactionPill
                key={reactionsForMsg.join("-")}
                reactions={reactionsForMsg}
                isCurrentUser={isCurrentUser}
              />
            )}
            {renderOutgoingStatus(
              message,
              isCurrentUser,
              isOptimistic,
              localStatus,
              connectNext,
              isLatestOutgoingMessage,
            )}
          </View>
        );
      }

      // Render location message
      if (isLocation && coordinates) {
        return (
          <View
            key={key}
            className={`${rowSpacingClass} ${isCurrentUser ? "items-end" : "items-start"}`}
          >
            <SwipeableRow
              onTriggered={() => startReplyToMessage(message)}
              isCurrentUser={isCurrentUser}
            >
              <Pressable
                onPress={handleLocationPress}
                onLongPress={(e) =>
                  openMessageActions(
                    message,
                    e.nativeEvent.pageY,
                    isCurrentUser,
                  )
                }
                delayLongPress={400}
                className={`overflow-hidden ${
                  isCurrentUser ? "mr-2" : "ml-2"
                } ${isOptimistic ? "opacity-70" : ""}`}
                style={[bubbleRadiusStyle, { maxWidth: bubbleMaxWidth }]}
              >
                <View style={{ width: 250, height: 150 }} collapsable={false}>
                  <MapView
                    style={{ width: 250, height: 150 }}
                    provider={androidMapProvider()}
                    initialRegion={{
                      latitude: coordinates.latitude,
                      longitude: coordinates.longitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }}
                    scrollEnabled={false}
                    zoomEnabled={false}
                    rotateEnabled={false}
                    pitchEnabled={false}
                    toolbarEnabled={false}
                  >
                    <MapPinMarker
                      coordinate={coordinates}
                      preset="shared"
                      size={34}
                      title="Shared location"
                    />
                  </MapView>
                </View>
                <View
                  className={`px-3 py-2 ${
                    isCurrentUser ? "bg-primary" : "bg-gray-200"
                  }`}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name="location"
                      size={14}
                      color={isCurrentUser ? "white" : "#007AFF"}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      className={`text-xs ${
                        isCurrentUser ? "text-white" : "text-gray-700"
                      }`}
                    >
                      Tap to view full map
                    </Text>
                  </View>
                </View>
              </Pressable>
            </SwipeableRow>
            {reactionsForMsg.length > 0 && (
              <ReactionPill
                key={reactionsForMsg.join("-")}
                reactions={reactionsForMsg}
                isCurrentUser={isCurrentUser}
              />
            )}
            {renderOutgoingStatus(
              message,
              isCurrentUser,
              isOptimistic,
              localStatus,
              connectNext,
              isLatestOutgoingMessage,
            )}
          </View>
        );
      }

      // Render text message
      return (
        <View
          key={key}
          className={`${rowSpacingClass} ${isCurrentUser ? "items-end" : "items-start"}`}
        >
          {embeddedProductMeta ? (
            <Pressable
              onPress={() => openProductContext(embeddedProductMeta)}
              className={`mb-2 rounded-2xl border p-2.5 flex-row items-center ${
                isCurrentUser
                  ? "mr-2 border-primary/20 bg-[#e9f1f6]"
                  : "ml-2 border-gray-200 bg-white"
              }`}
              style={{ width: productCardWidth }}
            >
              {embeddedProductMeta.imageUrl ? (
                <Image
                  source={{ uri: embeddedProductMeta.imageUrl }}
                  className="w-12 h-12 rounded-xl mr-2.5"
                  resizeMode="cover"
                />
              ) : null}
              <View className="flex-1">
                <Text
                  className={`text-[11px] font-semibold ${
                    isCurrentUser ? "text-primary" : "text-primary"
                  }`}
                  numberOfLines={1}
                >
                  {embeddedProductMeta.source === "profile"
                    ? "Profile"
                    : embeddedProductMeta.source === "post"
                      ? "Post"
                      : embeddedProductMeta.source === "marketplace"
                        ? "Marketplace"
                        : "Product"}
                </Text>
                <Text
                  className="text-[13px] text-gray-800 font-medium"
                  numberOfLines={2}
                >
                  {embeddedProductMeta.title}
                </Text>
                {embeddedProductMeta.source !== "profile" &&
                embeddedProductMeta.price ? (
                  <Text
                    className="text-[12px] text-gray-500 mt-0.5"
                    numberOfLines={1}
                  >
                    Nu. {embeddedProductMeta.price}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ) : null}

          {shouldRenderTextBubble ? (
            <SwipeableRow
              onTriggered={() => startReplyToMessage(message)}
              isCurrentUser={isCurrentUser}
            >
              <View
                style={[
                  {
                    position: "relative",
                    minWidth: CHAT_BUBBLE_MIN_WIDTH,
                    maxWidth: bubbleMaxWidth,
                    marginRight: isCurrentUser ? 8 : 0,
                    marginLeft: isCurrentUser ? 0 : 8,
                  },
                ]}
              >
                <Pressable
                  onPress={() => {
                    if (localStatus === "failed") {
                      retryFailedMessage(message);
                    }
                  }}
                  onLongPress={(e) =>
                    openMessageActions(
                      message,
                      e.nativeEvent.pageY,
                      isCurrentUser,
                    )
                  }
                  delayLongPress={400}
                  className={`px-3 py-3 ${
                    isCurrentUser ? "bg-primary" : "bg-[#f7f8fa]"
                  } ${isOptimistic ? "opacity-70" : ""}`}
                  style={[
                    bubbleRadiusStyle,
                    {
                      overflow: "hidden",
                      minWidth: CHAT_BUBBLE_MIN_WIDTH,
                      maxWidth: bubbleMaxWidth,
                      borderWidth: isCurrentUser ? 0 : 1,
                      borderColor: isCurrentUser
                        ? "transparent"
                        : INCOMING_BUBBLE_BORDER,
                    },
                  ]}
                >
                  {embeddedReplyMeta ? (
                    <View
                      className={`mb-2 rounded-xl px-2 py-1.5 border-l-2 ${
                        isCurrentUser
                          ? "bg-white/15 border-white/80"
                          : "bg-white/90 border-gray-300"
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-semibold ${
                          isCurrentUser ? "text-blue-100" : "text-gray-700"
                        }`}
                        numberOfLines={1}
                      >
                        {embeddedReplyMeta.senderName}
                      </Text>
                      <Text
                        className={`text-[11px] ${
                          isCurrentUser ? "text-blue-100" : "text-gray-600"
                        }`}
                        numberOfLines={1}
                      >
                        {embeddedReplyMeta.snippet}
                      </Text>
                    </View>
                  ) : null}
                  {hasVisibleTextContent ? (
                    <Text
                      className={`${isCurrentUser ? "text-white" : "text-gray-800"} text-[15px]`}
                      style={{ lineHeight: 20 }}
                    >
                      {visibleTextContent}
                    </Text>
                  ) : null}
                </Pressable>
              </View>
            </SwipeableRow>
          ) : null}
          {/* Emoji reactions pill */}
          {reactionsForMsg.length > 0 && (
            <ReactionPill
              key={reactionsForMsg.join("-")}
              reactions={reactionsForMsg}
              isCurrentUser={isCurrentUser}
            />
          )}
          {parentReplyCount > 0 ? (
            <View
              className={`mt-1 flex-row items-center ${
                isCurrentUser ? "justify-end mr-3" : "justify-start ml-3"
              }`}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderLeftWidth: 2,
                  borderBottomWidth: 2,
                  borderColor: isCurrentUser ? "#93c5fd" : "#60a5fa",
                  borderBottomLeftRadius: 8,
                  marginRight: 4,
                  transform: [{ scaleX: isCurrentUser ? -1 : 1 }],
                }}
              />
              <Text
                className={`text-[12px] font-semibold ${
                  isCurrentUser ? "text-blue-200" : "text-blue-600"
                }`}
              >
                {parentReplyCount}{" "}
                {parentReplyCount === 1 ? "reply" : "replies"}
              </Text>
            </View>
          ) : null}
          {embeddedReplyMeta ? (
            <View
              className={`mt-1 flex-row items-center ${
                isCurrentUser ? "justify-end mr-3" : "justify-start ml-3"
              }`}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderLeftWidth: 2,
                  borderBottomWidth: 2,
                  borderColor: isCurrentUser ? "#93c5fd" : "#9ca3af",
                  borderBottomLeftRadius: 8,
                  marginRight: 4,
                  transform: [{ scaleX: isCurrentUser ? -1 : 1 }],
                }}
              />
              <Text
                className={`text-[11px] ${
                  isCurrentUser ? "text-blue-100" : "text-gray-500"
                }`}
              >
                Reply to {embeddedReplyMeta.senderName}
              </Text>
            </View>
          ) : null}
          {renderOutgoingStatus(
            message,
            isCurrentUser,
            isOptimistic,
            localStatus,
            connectNext,
            isLatestOutgoingMessage,
          )}
        </View>
      );
    },
    [
      chatImageIndexByUrl,
      chatPartnerName,
      effectiveCurrentUserUUID,
      latestOutgoingMessageId,
      messageReactions,
      openMessageActions,
      openProductContext,
      renderOutgoingStatus,
      retryFailedMessage,
      replyCountByMessageId,
      screenWidth,
      startReplyToMessage,
      handleMongooseCancelRequest,
      handleMongooseInviteResponse,
      handleMongooseTrack,
    ],
  );
  const renderTimelineItem = useCallback(
    ({ item, index }: any) => {
      if (item.type === "separator") {
        return (
          <View key={item.id} className="items-center my-3">
            <View className="px-3 py-1 rounded-full">
              <Text className="text-[11px] text-white font-medium">
                {item.label}
              </Text>
            </View>
          </View>
        );
      }
      return renderMessage(
        item.message,
        index,
        item.connectPrev,
        item.connectNext,
      );
    },
    [renderMessage],
  );
  const timelineKeyExtractor = useCallback((item: any) => item.id, []);
  const renderGestureScrollComponent = useCallback(
    (props: any) => <GestureScrollView {...props} />,
    [],
  );
  const timelineContentContainerStyle = useMemo(
    () => ({
      paddingHorizontal: 16,
      paddingVertical: 8,
      paddingTop:
        chatBottomPadding +
        (showMongooseWorkerNav && !isKeyboardVisible
          ? MONGOOSE_WORKER_NAV_BAR_HEIGHT
          : 0),
      flexGrow: 1,
    }),
    [chatBottomPadding, showMongooseWorkerNav, isKeyboardVisible],
  );
  const typingHeaderComponent = useMemo(
    () =>
      typingUsersList.length > 0 ? (
        <TypingIndicator users={typingUsersList} />
      ) : null,
    [typingUsersList],
  );
  const emptyChatComponent = useMemo(
    () => (
      <View className="flex-1 items-center justify-center min-h-[200px]">
        <View className="w-16 h-16 bg-primary rounded-full items-center justify-center mb-4">
          <Text className="text-white font-bold text-xl">
            {chatPartnerName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text className="text-gray-800 font-semibold text-lg mb-2">
          {chatPartnerName}
        </Text>
        <Text className="text-gray-500 text-center px-8">
          {chatPartnerName.startsWith("+975") ||
          chatPartnerName === "Unknown User"
            ? "No messages yet. Start the conversation!"
            : `No messages yet. Start the conversation with ${chatPartnerName}!`}
        </Text>
      </View>
    ),
    [chatPartnerName],
  );
  const loadingMoreFooterComponent = useMemo(
    () =>
      isLoadingMore ? (
        <View className="items-center py-3">
          <ActivityIndicator size="small" color="#9ca3af" />
        </View>
      ) : null,
    [isLoadingMore],
  );
  // Whether the composer action area (icons + chevron) can show at all.
  // No longer depends on isKeyboardVisible — collapse/expand is user-controlled
  // via iconsExpanded while the keyboard is up.
  const canShowComposerActions =
    !isHoldRecording &&
    !messageText.trim() &&
    !replyingToMessage &&
    !isEditMode;

  // In voice mode, only the keypad-toggle icon shows — photo/gif/location
  // icons and the collapse chevron are irrelevant once the pill takes over.
  const showIcons =
    canShowComposerActions && iconsExpanded && composerInputKind !== "voice";
  const showChevron =
    canShowComposerActions && !iconsExpanded && composerInputKind !== "voice";
  const showMicToggle = canShowComposerActions;

  // Keep the old name so nothing else in the file breaks
  const showExpandedComposerActions = showIcons;

  if (!currentUser) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Ionicons name="person-circle-outline" size={80} color="#9ca3af" />
        <Text className="text-gray-500 text-lg mt-4">
          Please login to view messages
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/login")}
          className="mt-6 bg-primary px-6 py-3 rounded-full"
        >
          <Text className="text-white font-semibold">Go to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoadingPartner) {
    return (
      <View className="flex-1 bg-background">
        {/* Status Bar Space */}
        <View style={{ height: insets.top, backgroundColor: "white" }} />

        {/* Loading Header */}
        <View className="flex-row items-center p-4 border-b border-gray-200 bg-white">
          <TouchableOpacity onPress={handleBackNavigation} className="mr-3">
            <Ionicons name="chevron-back-outline" size={24} color="#007AFF" />
          </TouchableOpacity>

          <View className="w-10 h-10 bg-gray-300 rounded-full items-center justify-center mr-3 animate-pulse">
            <Text className="text-gray-500 font-bold">...</Text>
          </View>

          <View className="flex-1">
            <View
              className="h-5 bg-gray-300 rounded animate-pulse mb-1"
              style={{ width: "60%" }}
            />
            <View
              className="h-3 bg-gray-200 rounded animate-pulse"
              style={{ width: "40%" }}
            />
          </View>
        </View>

        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Loading chat...</Text>
        </View>
      </View>
    );
  }

  const activeBgId = chatPartnerId
    ? localChatBgs[chatPartnerId] || globalChatBg
    : globalChatBg;
  const activeBg = parseBackground(activeBgId);

  return (
    <View
      className="flex-1"
      style={
        activeBg.type === "default" ? { backgroundColor: "#fcfcfc" } : undefined
      }
    >
      {/* Background layer */}
      {activeBg.type === "default" && (
        <Image
          source={require("@/assets/chatbackground/chatbg.png")}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            resizeMode: "cover",
            opacity: 0.8,
          }}
        />
      )}
      {activeBg.type === "solid" && (
        <View
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            backgroundColor: activeBg.color,
          }}
        />
      )}
      {activeBg.type === "gradient" && activeBg.colors && (
        <LinearGradient
          colors={activeBg.colors as [string, string]}
          style={{ position: "absolute", width: "100%", height: "100%" }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      {/* Chat Actions Menu */}
      {!isMongooseChat && (
        <ActionSheetModal
          visible={showChatActionsMenu}
          onClose={() => setShowChatActionsMenu(false)}
        >
          <View className="bg-white rounded-t-3xl pb-8">
            <View className="px-6 py-4 border-b border-gray-200">
              <Text className="text-lg font-mbold text-gray-900">Chat Actions</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setShowChatActionsMenu(false);
                // ActionSheetModal's own native Modal is still mid-dismiss
                // animation (~240ms) when this fires — presenting the
                // background picker's Modal while it's still up causes iOS
                // to silently drop the new presentation. Wait for the
                // close animation to finish first.
                setTimeout(() => setShowBgPicker(true), 300);
              }}
              className="flex-row items-center px-6 py-4 border-b border-gray-100"
            >
              <MoreVertical size={24} color="#374151" />
              <Text className="ml-4 text-base font-msemibold text-gray-900">
                Change Chat Background
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleBlockTogglePartner}
              className="flex-row items-center px-6 py-4 border-b border-gray-100"
            >
              <Ban size={24} color={isPartnerBlocked ? "#10B981" : "#EF4444"} />
              <View className="ml-4 flex-1">
                <Text className="text-base font-msemibold text-gray-900">
                  {isPartnerBlocked ? "Unblock User" : "Block User"}
                </Text>
                <Text className="text-sm text-gray-500 font-regular">
                  {isPartnerBlocked
                    ? "You'll be able to message again"
                    : "They won't be able to message you"}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowChatActionsMenu(false);
                setShowReportChatModal(true);
              }}
              className="flex-row items-center px-6 py-4"
            >
              <AlertCircle size={24} color="#F59E0B" />
              <View className="ml-4 flex-1">
                <Text className="text-base font-msemibold text-gray-900">Report User</Text>
                <Text className="text-sm text-gray-500 font-regular">
                  Report for violating guidelines
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowChatActionsMenu(false)}
              className="mx-6 mt-4 py-3 rounded-2xl bg-gray-100"
            >
              <Text className="text-center text-gray-900 font-msemibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </ActionSheetModal>
      )}

      {!isMongooseChat && effectiveCurrentUserUUID && chatPartnerId && (
        <ReportUserModal
          visible={showReportChatModal}
          onClose={() => setShowReportChatModal(false)}
          targetUserId={chatPartnerId as string}
          targetUserName={chatPartnerName || "user"}
          currentUserId={effectiveCurrentUserUUID}
        />
      )}

      {/* Chat Background Picker Modal */}
      <Modal
        visible={showBgPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBgPicker(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
          activeOpacity={1}
          onPress={() => setShowBgPicker(false)}
        >
          <View
            style={{
              marginTop: "auto",
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingBottom: 40,
              paddingTop: 16,
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: "#d1d5db",
                borderRadius: 2,
                alignSelf: "center",
                marginBottom: 20,
              }}
            />

            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#111827",
                textAlign: "center",
                marginBottom: 8,
              }}
            >
              Chat Settings
            </Text>
            <Text
              style={{
                fontSize: 13,
                color: "#6b7280",
                textAlign: "center",
                marginBottom: 24,
                paddingHorizontal: 32,
              }}
            >
              Set a background specifically for your chat with {chatPartnerName}
              .
            </Text>

            <ChatBackgroundPicker
              selectedBgId={activeBgId}
              allowClear={true}
              onClear={() => {
                setLocalChatBg(chatPartnerId as string, null);
                setShowBgPicker(false);
              }}
              onSelectBg={(bgId) => {
                setLocalChatBg(chatPartnerId as string, bgId);
                setShowBgPicker(false);
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        actions={popup.actions}
        onHide={() =>
          setPopup((p) => ({
            ...p,
            visible: false,
            actions: undefined,
          }))
        }
      />
      {/* Status Bar Space */}
      <View
        style={{ height: insets.top, backgroundColor: "white", zIndex: 10 }}
      />

      {/* Fixed Header */}
      <View
        className="flex-row items-center p-4 border-b border-gray-200 bg-white"
        style={{ zIndex: 10 }}
      >
        <TouchableOpacity onPress={handleBackNavigation} className="mr-3">
          <Ionicons name="chevron-back-outline" size={24} color="#007AFF" />
        </TouchableOpacity>

        {/* Profile Image or Avatar */}
        <TouchableOpacity
          onPress={() =>
            chatPartnerId && router.push(`/(users)/profile/${chatPartnerId}`)
          }
          activeOpacity={0.7}
          className="mr-3"
          style={{ position: "relative" }}
        >
          {chatPartnerAvatarUri ? (
            <Image
              source={{ uri: chatPartnerAvatarUri }}
              className="w-10 h-10 rounded-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-10 h-10 bg-primary rounded-full items-center justify-center">
              <Text className="text-white font-bold">
                {chatPartnerName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {!isMongooseChat ? (
            <View
              className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-white"
              style={{
                backgroundColor:
                  isPartnerTyping || partnerPresence.isOnline
                    ? "#22c55e"
                    : "#d1d5db",
              }}
            />
          ) : null}
        </TouchableOpacity>

        <View className="flex-1">
          <View className="flex-row items-center gap-1.5 flex-wrap">
            <Text className="font-semibold text-gray-800 text-lg">
              {chatPartnerName}
            </Text>
            {partnerVerified && (
              <View className="flex-row items-center bg-blue-50 border border-[#094569] rounded-full px-2 py-0.5 gap-1">
                <Verified size={11} color="#094569" />
                <Text className="text-[10px] font-msemibold text-[#094569] leading-none">
                  Verified
                </Text>
              </View>
            )}
          </View>

          {/* Online Status or Additional Info */}
          {isMongooseChat ? (
            <Text className="text-sm text-gray-500">Delivery Person</Text>
          ) : (
            <Text
              className={`text-sm ${
                isPartnerTyping || partnerPresence.isOnline
                  ? "text-green-500"
                  : "text-gray-500"
              }`}
            >
              {partnerPresenceText}
            </Text>
          )}
        </View>

        {/* Optional: Add call or video call buttons */}
        <TouchableOpacity
          className="ml-2 w-10 h-10 border border-blue-600 rounded-full items-center justify-center overflow-hidden"
          onPress={handleMongooseClick}
          disabled={isAnimatingMongoose}
          style={{ position: "relative" }}
        >
          {isAnimatingMongoose ? (
            <View className="flex-row items-center justify-center">
              <Animated.View
                style={{
                  transform: [
                    {
                      translateX: bikeAnimationX.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-30, 30],
                      }),
                    },
                  ],
                }}
              >
                <Bike size={20} color="#edc06c" strokeWidth={1.5} />
              </Animated.View>
            </View>
          ) : (
            <Bike size={20} color="#2563eb" strokeWidth={1.5} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="ml-2 w-10 h-10 rounded-full items-center justify-center bg-gray-100/50"
          onPress={() =>
            isMongooseChat ? setShowBgPicker(true) : setShowChatActionsMenu(true)
          }
        >
          <MoreVertical size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      <Reanimated.View style={[{ flex: 1 }, keyboardAwareStyle]}>
        {/* Scrollable Messages Area */}
        <FlatList
          ref={flatListRef}
          data={reversedTimelineItems}
          keyExtractor={timelineKeyExtractor}
          inverted
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          contentContainerStyle={timelineContentContainerStyle}
          renderScrollComponent={renderGestureScrollComponent}
          removeClippedSubviews={Platform.OS === "android"}
          initialNumToRender={12}
          maxToRenderPerBatch={6}
          updateCellsBatchingPeriod={32}
          windowSize={5}
          renderItem={renderTimelineItem}
          ListHeaderComponent={typingHeaderComponent}
          ListEmptyComponent={emptyChatComponent}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMoreFooterComponent}
        />

        {/* Grey out the chat behind the mic while holding to talk, so the
            recording UI (dome/waveform/pills) reads as the sole focus.
            Sits above the message list but below the input bar it
            precedes, so it never covers the recording controls themselves. */}
        {isHoldRecording && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(17,24,39,0.20)",
            }}
          />
        )}

        {/* Fixed Input Bar */}
        <View className="mb-0">
          <View
            className={`flex-row items-center px-4 pt-2`}
            style={{
              paddingBottom:
                (isKeyboardVisible ? 8 : Math.max(insets.bottom, 12)) +
                (showMongooseWorkerNav && !isKeyboardVisible
                  ? MONGOOSE_WORKER_NAV_BAR_HEIGHT
                  : 0),
            }}
            onLayout={(e) => {
              const measured = Math.round(e.nativeEvent.layout.height);
              if (measured > 0 && Math.abs(measured - inputBarHeight) > 2) {
                setInputBarHeight(measured);
              }
            }}
          >
            <View className="w-full rounded-[26px] border border-gray-200 bg-gray-100">
              {replyingToMessage ? (
                <View className="px-3 py-4 border-b border-gray-200/80 flex-row items-center">
                  <View className="flex-1">
                    <Text className="text-[11px] font-semibold text-primary">
                      Replying to{" "}
                      {effectiveCurrentUserUUID &&
                      String(replyingToMessage.sender_id) ===
                        String(effectiveCurrentUserUUID)
                        ? "yourself"
                        : chatPartnerName}
                    </Text>
                    <Text
                      className="text-[12px] text-gray-600"
                      numberOfLines={1}
                    >
                      {getMessagePreviewText(replyingToMessage)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setReplyingToMessage(null)}
                    className="ml-2 w-7 h-7 items-center justify-center"
                  >
                    <Ionicons name="close" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              ) : null}
              {pendingProductContext ? (
                <View className="px-3 pt-2 pb-2 border-b border-gray-200/80">
                  <Pressable
                    onPress={() => openProductContext(pendingProductContext)}
                    className="rounded-xl border border-gray-200 bg-white p-2 flex-row items-center"
                  >
                    {pendingProductContext.imageUrl ? (
                      <Image
                        source={{ uri: pendingProductContext.imageUrl }}
                        className="w-10 h-10 rounded-lg mr-2"
                        resizeMode="cover"
                      />
                    ) : null}
                    <View className="flex-1">
                      <Text
                        className="text-[11px] font-semibold text-primary"
                        numberOfLines={1}
                      >
                        {pendingProductContext.source === "profile"
                          ? "Shared profile"
                          : pendingProductContext.source === "post"
                            ? "Shared post"
                            : pendingProductContext.source === "marketplace"
                              ? "Shared marketplace item"
                              : "Interested in this product"}
                      </Text>
                      <Text
                        className="text-[12px] text-gray-700"
                        numberOfLines={1}
                      >
                        {pendingProductContext.title}
                      </Text>
                      {pendingProductContext.source !== "profile" &&
                      pendingProductContext.price ? (
                        <Text
                          className="text-[11px] text-gray-500"
                          numberOfLines={1}
                        >
                          Nu. {pendingProductContext.price}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => setPendingProductContext(null)}
                      className="ml-2 w-7 h-7 items-center justify-center"
                    >
                      <Ionicons name="close" size={16} color="#6b7280" />
                    </TouchableOpacity>
                  </Pressable>
                </View>
              ) : null}

              <View className="flex-row items-center px-2 py-2">
                {/* Chevron — tap to bring back the icons while keyboard is up */}
                {showChevron && (
                  <TouchableOpacity
                    onPress={() => setIconsExpanded(true)}
                    className="w-9 h-9 items-center justify-center mr-1"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                )}

                {/* Collapsible icons: photo, camera, location — hidden in voice mode */}
                {showIcons && (
                  <View className="mr-1 flex-row items-center">
                    <ChatMultiMediaPicker
                      currentUserUUID={effectiveCurrentUserUUID || ""}
                      chatPartnerId={chatPartnerId as string}
                      onOptimisticImage={handleOptimisticImage}
                      onUploadSuccess={handleImageUploadSuccess}
                      onUploadError={handleImageUploadError}
                    />
                    <GifStickerButton
                      visible={showGifStickerDrawer}
                      onVisibleChange={(nextVisible) => {
                        setShowGifStickerDrawer(nextVisible);
                        if (nextVisible) {
                          setIconsExpanded(true);
                          Keyboard.dismiss();
                        }
                      }}
                    />
                    <TouchableOpacity
                      onPress={handleShareLocation}
                      disabled={isSharingLocation}
                      className="w-9 h-9 items-center justify-center"
                    >
                      {isSharingLocation ? (
                        <Text className="text-xs text-gray-500">...</Text>
                      ) : (
                        <Ionicons
                          name="location-outline"
                          size={20}
                          color="#6b7280"
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Mic toggle — switches the composer into hold-to-talk mode */}
                {showMicToggle && composerInputKind !== "voice" && (
                  <TouchableOpacity
                    onPress={() => {
                      setComposerInputKind("voice");
                      setShowGifStickerDrawer(false);
                      Keyboard.dismiss();
                    }}
                    className="w-9 h-9 items-center justify-center mr-1"
                  >
                    <Ionicons name="mic-outline" size={20} color="#6b7280" />
                  </TouchableOpacity>
                )}

                {/* Keyboard toggle — floats out of flex flow in voice mode so
                    "Hold to talk" can center against the whole input field
                    rather than the space left over next to this icon. */}
                {showMicToggle && composerInputKind === "voice" && (
                  <TouchableOpacity
                    onPress={() => {
                      setComposerInputKind("text");
                      setShowGifStickerDrawer(false);
                      Keyboard.dismiss();
                    }}
                    className="absolute left-2 top-0 bottom-0 w-9 items-center justify-center"
                    style={{ zIndex: 10 }}
                  >
                    <MaterialIcons name="keyboard" size={22} color="#6b7280" />
                  </TouchableOpacity>
                )}

                {/* Text input + send/edit buttons */}
                <>
                    {composerInputKind === "voice" &&
                    !isEditMode &&
                    !replyingToMessage &&
                    !pendingProductContext &&
                    !messageText.trim() ? (
                      <View className="flex-1 self-center min-h-[38px] justify-center">
                        <WeChatVoiceRecorder
                          currentUserUUID={effectiveCurrentUserUUID || ""}
                          chatPartnerId={chatPartnerId as string}
                          onOptimisticAudio={handleOptimisticAudio}
                          onUploadSuccess={handleAudioUploadSuccess}
                          onUploadError={handleAudioUploadError}
                          onRecordingStateChange={setIsHoldRecording}
                        />
                      </View>
                    ) : (
                      <Pressable
                        onPressIn={focusComposerInput}
                        className="flex-1 self-center min-h-[36px] justify-center"
                      >
                        <TextInput
                          ref={chatInputRef}
                          className="w-full px-3 text-[16px]"
                          style={{
                            paddingTop: 0,
                            paddingBottom: 0,
                            marginVertical: 0,
                            lineHeight: CHAT_INPUT_LINE_HEIGHT,
                            minHeight: CHAT_INPUT_LINE_HEIGHT,
                            maxHeight: CHAT_INPUT_MAX_HEIGHT,
                            ...(Platform.OS === "android"
                              ? { includeFontPadding: false }
                              : {}),
                          }}
                          placeholder="Type a message..."
                          value={messageText}
                          onChangeText={handleTextChange}
                          onFocus={() => {
                            setComposerInputKind("text");
                            setIconsExpanded(false);
                            setShowGifStickerDrawer(false);
                          }}
                          multiline
                          maxLength={500}
                          textAlignVertical="center"
                          onContentSizeChange={(e) => {
                            const nextHeight = Math.round(
                              e.nativeEvent.contentSize.height ||
                                CHAT_INPUT_LINE_HEIGHT,
                            );
                            const clamped = Math.max(
                              CHAT_INPUT_LINE_HEIGHT,
                              Math.min(nextHeight, CHAT_INPUT_MAX_HEIGHT),
                            );
                            if (Math.abs(clamped - composerInputHeight) > 1) {
                              setComposerInputHeight(clamped);
                            }
                          }}
                        />
                      </Pressable>
                    )}

                    {isEditMode && (
                      <TouchableOpacity
                        onPress={() => {
                          setIsEditMode(false);
                          setEditingMessageId(null);
                          setMessageText("");
                        }}
                        className="mr-2 w-9 h-9 items-center justify-center"
                      >
                        <Ionicons name="close" size={18} color="#6b7280" />
                      </TouchableOpacity>
                    )}

                    {messageText.trim() ? (
                      <TouchableOpacity
                        onPress={() => {
                          if (isEditMode) {
                            handleUpdateMessage();
                          } else {
                            handleSendMessage();
                          }
                        }}
                        className={`w-9 h-9 rounded-full items-center justify-center ${
                          isEditMode ? "bg-green-600" : "bg-primary"
                        }`}
                      >
                        <Ionicons
                          name={isEditMode ? "checkmark" : "send"}
                          size={18}
                          color="white"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </>
              </View>
              <GifStickerInlineDrawer
                visible={showGifStickerDrawer}
                onClose={() => setShowGifStickerDrawer(false)}
                onSelect={handleSendGifSticker}
              />
            </View>
          </View>
        </View>
      </Reanimated.View>

      {/* Full-Screen Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        onRequestClose={() => setShowMapModal(false)}
      >
        <View className="flex-1">
          {/* Header */}
          <View
            className="bg-white px-4 py-4 border-b border-gray-200"
            style={{ paddingTop: Platform.OS === "ios" ? 50 : 20 }}
          >
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => setShowMapModal(false)}
                className="p-2"
              >
                <Ionicons name="close" size={28} color="#007AFF" />
              </TouchableOpacity>
              <Text className="text-lg font-semibold text-gray-800">
                Location
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (selectedLocation) {
                    const url = `https://maps.google.com/?q=${selectedLocation.latitude},${selectedLocation.longitude}`;
                    Linking.openURL(url);
                  }
                }}
                className="p-2"
              >
                <Ionicons name="navigate" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Full Map */}
          {selectedLocation && (
            <View
              style={{
                flex: 1,
                minHeight:
                  Platform.OS === "android"
                    ? Math.max(320, Dimensions.get("window").height * 0.55)
                    : 0,
              }}
              collapsable={false}
            >
              <MapView
                style={{ flex: 1 }}
                provider={androidMapProvider()}
                initialRegion={{
                  latitude: selectedLocation.latitude,
                  longitude: selectedLocation.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                toolbarEnabled={false}
                moveOnMarkerPress={false}
              >
                <MapPinMarker
                  coordinate={selectedLocation}
                  preset="shared"
                  size={44}
                  title="Shared location"
                  description="Tap navigate icon to open in Maps app"
                />
              </MapView>
            </View>
          )}
        </View>
      </Modal>

      {/* Message Actions Modal — WhatsApp / Instagram style */}
      <Modal
        visible={showMessageActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMessageActions(false)}
        statusBarTranslucent
      >
        <View style={{ flex: 1 }}>
          {/* Blurred backdrop */}
          <BlurView
            intensity={55}
            tint="dark"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          {/* Dismiss on background tap */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowMessageActions(false)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />

          {selectedMessage &&
            (() => {
              const parsed = parseMessageMetaContent(selectedMessage.content);
              const msgText = parsed.text;
              const isOwnMsg =
                String(selectedMessage.sender_id) ===
                String(effectiveCurrentUserUUID);
              const isImg =
                selectedMessage.message_type === "image" ||
                selectedMessage.image_url;
              const isAud =
                selectedMessage.message_type === "audio" ||
                selectedMessage.audio_url;
              const isGif = selectedMessage.message_type === "gif";
              const isSticker = selectedMessage.message_type === "sticker";
              const isLoc =
                selectedMessage.content?.includes?.("📍 My Location:");
              const previewText = isImg
                ? "📷  Photo"
                : isAud
                  ? "🎵  Voice message"
                  : isGif
                    ? "GIF"
                    : isSticker
                      ? "Sticker"
                      : isLoc
                        ? "📍  Location"
                        : msgText;
              // Compute safe vertical position so the full card fits on screen
              const BUBBLE_H = 72;
              const REACTIONS_H = 58;
              const copyRow = 52;
              const editRow =
                isOwnMsg &&
                !isImg &&
                !isGif &&
                !isSticker &&
                selectedMessage.message_type !== "mongoose_invite"
                  ? 52
                  : 0;
              const deleteRow = isOwnMsg ? 52 : 0;
              const ACTIONS_H = 52 + copyRow + editRow + deleteRow + 52;
              const TOTAL_H = BUBBLE_H + REACTIONS_H + ACTIONS_H + 32;
              const rawTop = selectedMessagePageY - BUBBLE_H - 4;
              const cardTop = Math.min(
                Math.max(rawTop, 60),
                screenHeight - TOTAL_H - 40,
              );

              const EMOJIS: string[] = ["❤️", "😂", "😮", "😢", "👏", "👍"];
              const SEP = "rgba(0,0,0,0.06)";
              const currentReactions =
                messageReactions[String(selectedMessage.id)] || [];

              return (
                <View
                  pointerEvents="box-none"
                  style={{
                    position: "absolute",
                    top: cardTop,
                    left: 0,
                    right: 0,
                    paddingHorizontal: 14,
                  }}
                >
                  {/* Mini message bubble preview */}
                  <View
                    style={{
                      alignItems: isOwnMsg ? "flex-end" : "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        maxWidth: "72%",
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 18,
                        backgroundColor: isOwnMsg ? "#094569" : "#e5e7eb",
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.2,
                        shadowRadius: 6,
                        elevation: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: isOwnMsg ? "white" : "#1f2937",
                          fontSize: 15,
                          lineHeight: 20,
                        }}
                        numberOfLines={3}
                      >
                        {previewText}
                      </Text>
                    </View>
                  </View>

                  {/* Emoji reaction strip */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignSelf: "center",
                      backgroundColor: "rgba(255,255,255,0.97)",
                      borderRadius: 36,
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      marginBottom: 8,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.15,
                      shadowRadius: 8,
                      elevation: 6,
                    }}
                  >
                    {EMOJIS.map((emoji) => {
                      const isSelected = currentReactions.includes(emoji);
                      return (
                        <TouchableOpacity
                          key={emoji}
                          onPress={() => {
                            Haptics.impactAsync(
                              Haptics.ImpactFeedbackStyle.Light,
                            ).catch(() => {});
                            const msgId = String(selectedMessage.id);
                            // Build updated per-user reactions object
                            const currentDb: Record<string, string> = {
                              ...(selectedMessage.reactions &&
                              typeof selectedMessage.reactions === "object" &&
                              !Array.isArray(selectedMessage.reactions)
                                ? (selectedMessage.reactions as Record<
                                    string,
                                    string
                                  >)
                                : {}),
                            };
                            const userId = String(effectiveCurrentUserUUID);
                            if (currentDb[userId] === emoji) {
                              delete currentDb[userId]; // toggle off
                            } else {
                              currentDb[userId] = emoji; // switch / add
                            }
                            const rxnEmojis = [
                              ...new Set(
                                Object.values(currentDb).filter(Boolean),
                              ),
                            ];
                            // Optimistic local update
                            setMessageReactions((prev) => ({
                              ...prev,
                              [msgId]: rxnEmojis,
                            }));
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === selectedMessage.id
                                  ? { ...m, reactions: currentDb }
                                  : m,
                              ),
                            );
                            // Persist to Supabase (fire-and-forget)
                            supabase
                              .from("messages")
                              .update({ reactions: currentDb })
                              .eq("id", selectedMessage.id)
                              .then(({ error: rxnErr }) => {
                                if (rxnErr)
                                  console.warn(
                                    "⚠️ Reaction save failed:",
                                    rxnErr.message,
                                  );
                              });
                            setShowMessageActions(false);
                          }}
                          activeOpacity={0.65}
                          style={[
                            {
                              marginHorizontal: 4,
                              borderRadius: 20,
                              padding: 4,
                            },
                            isSelected && {
                              backgroundColor: "rgba(99,102,241,0.12)",
                            },
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 26,
                              opacity: isSelected ? 1 : 0.85,
                            }}
                          >
                            {emoji}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Action list */}
                  <View
                    style={{
                      backgroundColor: "rgba(255,255,255,0.97)",
                      borderRadius: 16,
                      overflow: "hidden",
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.12,
                      shadowRadius: 14,
                      elevation: 8,
                    }}
                  >
                    {/* Reply */}
                    <TouchableOpacity
                      onPress={handleReplyFromActions}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 20,
                        paddingVertical: 15,
                        borderBottomWidth: 0.5,
                        borderBottomColor: SEP,
                      }}
                    >
                      <Ionicons
                        name="arrow-undo-outline"
                        size={22}
                        color="#374151"
                      />
                      <Text
                        style={{
                          marginLeft: 14,
                          fontSize: 16,
                          color: "#111827",
                          fontWeight: "500",
                        }}
                      >
                        Reply
                      </Text>
                    </TouchableOpacity>

                    {/* Copy */}
                    <TouchableOpacity
                      onPress={handleCopyMessage}
                      activeOpacity={0.7}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        paddingHorizontal: 20,
                        paddingVertical: 15,
                        borderBottomWidth: 0.5,
                        borderBottomColor: SEP,
                      }}
                    >
                      <Ionicons
                        name="copy-outline"
                        size={22}
                        color="#374151"
                      />
                      <Text
                        style={{
                          marginLeft: 14,
                          fontSize: 16,
                          color: "#111827",
                          fontWeight: "500",
                        }}
                      >
                        Copy
                      </Text>
                    </TouchableOpacity>

                    {/* Edit — own non-image, non-invite messages only */}
                    {isOwnMsg &&
                      !isImg &&
                      !isGif &&
                      !isSticker &&
                      selectedMessage.message_type !== "mongoose_invite" && (
                        <TouchableOpacity
                          onPress={handleEditMessage}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingHorizontal: 20,
                            paddingVertical: 15,
                            borderBottomWidth: 0.5,
                            borderBottomColor: SEP,
                          }}
                        >
                          <Ionicons
                            name="create-outline"
                            size={22}
                            color="#374151"
                          />
                          <Text
                            style={{
                              marginLeft: 14,
                              fontSize: 16,
                              color: "#111827",
                              fontWeight: "500",
                            }}
                          >
                            Edit
                          </Text>
                        </TouchableOpacity>
                      )}

                    {/* Delete — own messages only */}
                    {isOwnMsg && (
                      <TouchableOpacity
                        onPress={handleDeleteMessage}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 20,
                          paddingVertical: 15,
                        }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={22}
                          color="#ef4444"
                        />
                        <Text
                          style={{
                            marginLeft: 14,
                            fontSize: 16,
                            color: "#ef4444",
                            fontWeight: "500",
                          }}
                        >
                          Delete
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* Cancel — for received messages (no delete row to close with) */}
                    {!isOwnMsg && (
                      <TouchableOpacity
                        onPress={() => setShowMessageActions(false)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 20,
                          paddingVertical: 15,
                        }}
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={22}
                          color="#6b7280"
                        />
                        <Text
                          style={{
                            marginLeft: 14,
                            fontSize: 16,
                            color: "#6b7280",
                            fontWeight: "500",
                          }}
                        >
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })()}
        </View>
      </Modal>

      {/* ── Location Picker Modal ────────────────────────────── */}
      <SingleLocationPicker
        visible={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onConfirm={(loc) => {
          setShowLocationPicker(false);
          handleSendPickedLocation(loc);
        }}
        initialLocation={locationPickerInitial}
        title="Pick a Location to Share"
      />

      {/* ── Mongoose Initiator Modal ─────────────────────────── */}
      <MongooseInitiatorModal
        visible={showMongooseInitiator}
        onClose={() => setShowMongooseInitiator(false)}
        chatPartnerName={chatPartnerName}
        currentUserName={
          currentUser?.name || (currentUser as any)?.username || "You"
        }
        currentUserId={effectiveCurrentUserUUID || ""}
        onInviteSent={(content) => {
          setShowMongooseInitiator(false);
          handleMongooseInviteSent(content);
        }}
      />

      {/* ── Mongoose Responder Modal ─────────────────────────── */}
      {pendingMongooseInvite && (
        <MongooseResponderModal
          visible={showMongooseResponder}
          onClose={() => {
            setShowMongooseResponder(false);
            setPendingMongooseInvite(null);
          }}
          messageId={pendingMongooseInvite.messageId}
          inviteData={pendingMongooseInvite.data}
          responderName={
            currentUser?.name || (currentUser as any)?.username || "You"
          }
          responderId={effectiveCurrentUserUUID || ""}
          onConfirmed={handleMongooseConfirmed}
        />
      )}

      {/* ── Mongoose Tracker Modal ───────────────────────────── */}
      {mongooseTrackerBooking && (
        <TrackMongooseModal
          visible={showMongooseTracker}
          onClose={() => {
            setShowMongooseTracker(false);
            setMongooseTrackerBooking(null);
          }}
          booking={mongooseTrackerBooking}
        />
      )}

      {/* Image Preview Modal */}
      <ChatImageViewer
        visible={showImagePreview}
        images={chatImageUrls}
        initialIndex={previewImageIndex}
        onClose={() => setShowImagePreview(false)}
      />


      <MongooseWorkerNavBar />
    </View>
  );
}
