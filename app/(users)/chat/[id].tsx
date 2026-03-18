// app/(users)/chat/[id].tsx
import PopupMessage from "@/components/ui/PopupMessage";
import MongooseInitiatorModal from "@/components/MongooseInitiatorModal";
import MongooseInviteCard, {
    type MongooseInviteData,
} from "@/components/MongooseInviteCard";
import MongooseResponderModal from "@/components/MongooseResponderModal";
import AudioMessagePlayer from "@/components/chat/AudioMessagePlayer";
import ChatAudioRecorder from "@/components/chat/ChatAudioRecorder";
import ChatImagePicker from "@/components/chat/ChatImagePicker";
import SingleLocationPicker from "@/components/location/SingleLocationPicker";
import TrackMongooseModal from "@/components/modals/TrackMongooseModal";
import { useAppearance } from "@/contexts/AppearanceContext";
import { useUnreadMessages } from "@/contexts/UnreadMessagesContext";
import { useUser } from "@/contexts/UserContext";
import users from "@/data/UserData";
import {
    EarlyAccessBadgeType,
    getEarlyAccessBadge,
} from "@/lib/earlyAccessService";
import { supabase } from "@/lib/supabase";
import { sendChatPushNotification } from "@/services/chatPushService";
import { playReceiveSound, playSendSound, preloadChatSounds, triggerReceiveHaptic, triggerSendHaptic, unloadChatSounds } from "@/utils/chatSounds";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Bike } from "lucide-react-native";

import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    Image,
    Keyboard,
    Linking,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import Reanimated, {
    Extrapolation,
    interpolate,
    runOnJS,
    useAnimatedKeyboard,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
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
const SWIPE_REPLY_MAX = 84;
const SWIPE_REPLY_TRIGGER = 52;
const REPLY_META_PREFIX = "[reply-meta]";
const REPLY_META_SUFFIX = "[/reply-meta]";
const PRODUCT_META_PREFIX = "[product-meta]";
const PRODUCT_META_SUFFIX = "[/product-meta]";

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
  source?: "product" | "marketplace";
};

type OutgoingDeliveryStatus = "sent" | "delivered" | "seen";

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

  // Fallback to local user data
  const cleanIdentifier = identifier.replace("+975", "");
  const user = Object.values(users).find(
    (u) =>
      u.phone_number === identifier ||
      u.phone_number === cleanIdentifier ||
      u.username === identifier ||
      u.username === cleanIdentifier,
  );

  if (user) {
    return user;
  }

  // Return a basic user object instead of the demo data
  return {
    id: identifier,
    username: `User ${identifier}`,
    phone_number: identifier,
    profileImg: null,
  };
};

// Typing indicator component
const TypingIndicator = () => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]),
      );
    };

    animationRef.current = Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 200),
      animateDot(dot3, 400),
    ]);

    animationRef.current.start();

    // CRITICAL: Stop animations on unmount to prevent memory leaks
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
    };
  }, []);

  return (
    <View className="mb-3 items-start">
      <View className="bg-gray-200 ml-2 px-4 py-3 rounded-lg max-w-[80%]">
        <View className="flex-row items-center space-x-1">
          <Animated.View
            className="w-2 h-2 bg-gray-500 rounded-full"
            style={{
              opacity: dot1,
              transform: [
                {
                  scale: dot1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.2],
                  }),
                },
              ],
            }}
          />
          <Animated.View
            className="w-2 h-2 bg-gray-500 rounded-full ml-1"
            style={{
              opacity: dot2,
              transform: [
                {
                  scale: dot2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.2],
                  }),
                },
              ],
            }}
          />
          <Animated.View
            className="w-2 h-2 bg-gray-500 rounded-full ml-1"
            style={{
              opacity: dot3,
              transform: [
                {
                  scale: dot3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.2],
                  }),
                },
              ],
            }}
          />
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
}: {
  children: React.ReactNode;
  onTriggered: () => void;
  isCurrentUser?: boolean;
}) {
  const translateX = useSharedValue(0);
  const hasFired = useSharedValue(false);

  const pan = Gesture.Pan()
    // Only claim gesture after 20px rightward movement.
    // 20px gives scroll a head-start and keeps clear of the iOS edge-back swipe.
    .activeOffsetX([20, Infinity])
    // Fail immediately if user moves left — let iOS back gesture win
    .failOffsetX(-8)
    // Fail as soon as there's ±5px vertical movement → scroll gets priority.
    // Previously ±20px which was too lenient and let swipe compete with scroll.
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

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Reply icon fades + scales in as the user drags right
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
    <GestureDetector gesture={pan}>
      {/*
       * OUTER: alignSelf:'stretch' so it fills the full row width.
       * This is essential — percentage-based maxWidth on Pressable children
       * (max-w-[72%]) would resolve against an unsized parent and collapse
       * without this explicit stretch.
       * overflow:'visible' lets the bubble translate past the edge.
       */}
      <Reanimated.View style={{ overflow: "visible", alignSelf: "stretch" }}>
        {/* Reply icon — always at the left margin, stays put while bubble slides */}
        <Reanimated.View
          pointerEvents="none"
          style={[
            replyIconStyle,
            {
              position: "absolute",
              left: 6,
              top: 0,
              bottom: 0,
              width: 36,
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
        {/*
         * Inner animated view fills full width and uses flexDirection:'row' +
         * justifyContent to align the bubble left or right — identical to what
         * the outer row container was doing before SwipeableRow was introduced.
         */}
        <Reanimated.View
          style={[
            animStyle,
            {
              flexDirection: "row",
              justifyContent: isCurrentUser ? "flex-end" : "flex-start",
            },
          ]}
        >
          {children}
        </Reanimated.View>
      </Reanimated.View>
    </GestureDetector>
  );
});

/**
 * Tracks which reaction pill key-combos have already played their entrance
 * animation. Module-level so it survives re-renders and re-visits to the chat.
 * Key format: `${messageId}::${reactions.join('')}`
 */
const _playedReactionPills = new Set<string>();

/**
 * AnimatedReactionPill — fades + scales in on first appearance only.
 * Pass a stable `animKey` (messageId + reaction content) — if that key has
 * already animated (even from a previous visit), the pill appears instantly.
 */
function AnimatedReactionPill({
  reactions,
  isCurrentUser,
  animKey,
}: {
  reactions: string[];
  isCurrentUser: boolean;
  animKey: string;
}) {
  const alreadyPlayed = _playedReactionPills.has(animKey);
  const scale = useSharedValue(alreadyPlayed ? 1 : 0.5);
  const opacity = useSharedValue(alreadyPlayed ? 1 : 0);

  useEffect(() => {
    if (!alreadyPlayed) {
      _playedReactionPills.add(animKey);
      scale.value = withSpring(1, { damping: 22, stiffness: 280, mass: 0.6 });
      opacity.value = withTiming(1, { duration: 180 });
    }
  }, []);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Reanimated.View
      style={[
        pillStyle,
        {
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
        },
      ]}
    >
      {reactions.map((emoji, i) => (
        <Text key={i} style={{ fontSize: 16, marginHorizontal: 2 }}>
          {emoji}
        </Text>
      ))}
    </Reanimated.View>
  );
}

export default function ChatScreen() {
  const { currentUser } = useUser();
  const {
    setActiveChatPartnerId,
    markConversationAsRead,
    currentUserUUID: contextUserUUID,
  } = useUnreadMessages();
  const router = useRouter();
  const {
    id,
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
    context_source?: "product" | "marketplace";
  }>();
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [localMessages, setLocalMessages] = useState<any[]>([]);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [currentUserUUID, setCurrentUserUUID] = useState<string | null>(null);
  const [chatPartnerData, setChatPartnerData] = useState<any>(null);
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
  const [popup, setPopup] = useState<{visible: boolean; type: 'success'|'warning'|'error'|'white'; title: string; message: string}>({visible: false, type: 'white', title: '', message: ''});
  const showPopup = (type: 'success'|'warning'|'error'|'white', title: string, message: string) => setPopup({visible: true, type, title, message});
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
  // Shared values for the context-menu card entry animation
  const modalCardScale = useSharedValue(0.88);
  const modalCardOpacity = useSharedValue(0);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
  const [pendingProductContext, setPendingProductContext] =
    useState<ProductMeta | null>(null);
  const [outgoingStatusById, setOutgoingStatusById] = useState<
    Record<string, OutgoingDeliveryStatus>
  >({});
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  const scrollViewRef = useRef<ScrollView>(null);
  const chatInputRef = useRef<TextInput>(null);
  const channelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isLocalTypingRef = useRef(false);
  const messagesPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bikeAnimationX = useRef(new Animated.Value(0)).current;
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  // Reanimated keyboard — tracks keyboard height on the native UI thread (zero JS jank)
  const keyboard = useAnimatedKeyboard();
  const keyboardAwareStyle = useAnimatedStyle(() => ({
    paddingBottom: keyboard.height.value,
  }));
  const [inputBarHeight, setInputBarHeight] = useState(88);
  const [composerInputHeight, setComposerInputHeight] = useState(
    CHAT_INPUT_LINE_HEIGHT,
  );
  const [areComposerActionsCollapsed, setAreComposerActionsCollapsed] =
    useState(false);
  const composerActionsProgress = useRef(new Animated.Value(1)).current;
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Keep insets.bottom in a ref so keyboard-listener callbacks always see the latest value.
  const insetsBottomRef = useRef(insets.bottom);
  useEffect(() => {
    insetsBottomRef.current = insets.bottom;
  }, [insets.bottom]);

  // Early-access badge types for gradient chat bubbles
  const [currentUserBadgeType, setCurrentUserBadgeType] =
    useState<EarlyAccessBadgeType>(null);
  const [chatPartnerBadgeType, setChatPartnerBadgeType] =
    useState<EarlyAccessBadgeType>(null);
  const { bubbleSkin } = useAppearance();

  // Animated style for the context-menu card (scale spring on open)
  const modalCardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: modalCardScale.value }],
  }));
  // Animated style for the backdrop (fade in/out)
  const modalBackdropAnimStyle = useAnimatedStyle(() => ({
    opacity: modalCardOpacity.value,
  }));

  // Drive modal card animation whenever the sheet opens / closes
  useEffect(() => {
    if (showMessageActions) {
      modalCardScale.value = withTiming(1, { duration: 160 });
      modalCardOpacity.value = withTiming(1, { duration: 160 });
    } else {
      modalCardScale.value = withTiming(0.88, { duration: 100 });
      modalCardOpacity.value = withTiming(0, { duration: 100 });
    }
  }, [showMessageActions]);

  const isMongooseChat = typeof id === "string" && id.startsWith("mongoose-");
  const mongooseName = isMongooseChat ? id.replace("mongoose-", "") : null;
  const chatPartnerId = Array.isArray(id) ? id[0] : id;
  const effectiveCurrentUserUUID = currentUserUUID || contextUserUUID;

  useEffect(() => {
    if (!context_product_id || !context_product_title) return;
    setPendingProductContext({
      id: String(context_product_id),
      title: String(context_product_title),
      price: context_product_price ? String(context_product_price) : undefined,
      imageUrl: context_product_image
        ? String(context_product_image)
        : undefined,
      source: context_source === "marketplace" ? "marketplace" : "product",
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

  // Preload notification sound assets on chat screen mount
  useEffect(() => {
    void preloadChatSounds();
    return () => { void unloadChatSounds(); };
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
    const bubbleWindowMs = 5 * 60 * 1000; // 5 minutes
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
          id: `sep-${messageDate.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
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

  const getMessagePreviewText = useCallback((message: any) => {
    if (!message) return "Message";
    const messageType = message.message_type || "text";
    if (messageType === "image" || message.image_url) return "Photo";
    if (messageType === "audio" || message.audio_url) return "Voice message";
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

  const startReplyToMessage = useCallback(
    (message: any) => {
      if (!message || message.isOptimistic) return;
      setReplyingToMessage(message);
      setShowMessageActions(false);
      setSelectedMessage(null);
      setIsEditMode(false);
      setEditingMessageId(null);
      setAreComposerActionsCollapsed(true);
      Animated.timing(composerActionsProgress, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [composerActionsProgress],
  );

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
      if (productMeta.source === "marketplace") {
        router.push(`/(users)/marketplace/${productMeta.id}`);
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
            const tsRaw = await AsyncStorage.getItem(`hidden_conversations_ts_${userUUID}`);
            if (tsRaw) {
              const tsMap: Record<string, string> = JSON.parse(tsRaw);
              if (tsMap[chatPartnerId]) deletedAt = tsMap[chatPartnerId];
            }
          } catch { /* ignore parse errors */ }

          let query = supabase
            .from("messages")
            .select("*")
            .or(
              `and(sender_id.eq.${userUUID},receiver_id.eq.${chatPartnerId}),and(sender_id.eq.${chatPartnerId},receiver_id.eq.${userUUID})`,
            )
            .order("created_at", { ascending: true })
            .limit(200);

          if (deletedAt) {
            query = query.gt("created_at", deletedAt);
          }

          const { data: messagesData, error: messagesError } = await query;

          if (messagesError) {
            console.error("❌ Error fetching messages:", messagesError);
            return;
          }
          if (!isSubscribed) return;
          setMessages(messagesData || []);
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
          .on("broadcast", { event: "typing" }, ({ payload }) => {
            if (!isSubscribed) return;
            if (!payload || payload.senderId === userUUID) return;
            if (payload.receiverId !== userUUID) return;

            const isTyping = Boolean(payload.isTyping);
            setIsPartnerTyping(isTyping);

            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = null;
            }

            if (isTyping) {
              typingTimeoutRef.current = setTimeout(() => {
                setIsPartnerTyping(false);
                typingTimeoutRef.current = null;
              }, 3000);
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

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
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
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    return () => clearTimeout(timer);
  }, [allMessages, isPartnerTyping]);

  // Also scroll when component mounts or messages change
  useEffect(() => {
    if (allMessages.length > 0) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
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
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 80);
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setIsKeyboardVisible(false);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 40);
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
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
    return () => clearTimeout(timer);
  }, [isKeyboardVisible]);

  // Keep the latest bubble visible if composer height changes while typing.
  useEffect(() => {
    if (!isKeyboardVisible) return;
    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
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
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 220);
    return () => clearTimeout(timer);
  }, [isKeyboardVisible, chatBottomPadding, inputBarHeight]);

  const sendTypingEvent = useCallback(
    (typing: boolean) => {
      if (!channelRef.current || !effectiveCurrentUserUUID || !chatPartnerId)
        return;
      channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          senderId: effectiveCurrentUserUUID,
          receiverId: chatPartnerId,
          isTyping: typing,
        },
      });
    },
    [effectiveCurrentUserUUID, chatPartnerId],
  );

  const setComposerActionsCollapsed = useCallback(
    (collapsed: boolean) => {
      setAreComposerActionsCollapsed(collapsed);
      Animated.timing(composerActionsProgress, {
        toValue: collapsed ? 0 : 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [composerActionsProgress],
  );

  const handleBackNavigation = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(users)/messages");
  }, [router]);

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
        <View style={{ height: insets.top, backgroundColor: 'white' }} />

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

  const sendMessageToServer = async ({
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
          updateOutgoingStatus(data?.id, data?.is_read ? "seen" : "delivered");
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
  };

  // Debounced typing indicator - prevents timeout accumulation
  const handleTextChange = (text: string) => {
    if (text.length > 0 && !areComposerActionsCollapsed) {
      setComposerActionsCollapsed(true);
    }
    setMessageText(text);

    // Clear previous timeout to prevent accumulation
    if (typingSendTimeoutRef.current) {
      clearTimeout(typingSendTimeoutRef.current);
      typingSendTimeoutRef.current = null;
    }

    // Debounced typing indicator (500ms delay)
    if (text.length > 0) {
      if (!isLocalTypingRef.current) {
        isLocalTypingRef.current = true;
        sendTypingEvent(true);
      }

      typingSendTimeoutRef.current = setTimeout(() => {
        isLocalTypingRef.current = false;
        sendTypingEvent(false);
        typingSendTimeoutRef.current = null;
      }, 2000);
    } else {
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
      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocationPickerInitial({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      }
    } catch {
      setLocationPickerInitial(null);
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
        showPopup('error', 'Share Failed', 'Failed to share location. Please try again.');
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
      showPopup('error', 'Share Failed', 'Failed to share location. Please try again.');
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
    setLocalMessages((prev) => prev.filter((m) => m.id !== optimisticId));
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
    setLocalMessages((prev) => prev.filter((m) => m.id !== optimisticId));
  };

  const handleMongooseClick = () => {
    if (isMongooseChat) {
      // Inside a mongoose-support chat: navigate to track tab
      router.push("/(users)/messages?tab=1");
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
  const handleMongooseCancelRequest = async (messageId: string) => {
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
  };

  /** Called by MongooseInviteCard when the receiver taps "Confirm Your Location" */
  const handleMongooseInviteResponse = (
    messageId: string,
    data: MongooseInviteData,
  ) => {
    setPendingMongooseInvite({ messageId, data });
    setShowMongooseResponder(true);
  };

  /** Called by MongooseResponderModal after booking_request inserted successfully */
  const handleMongooseConfirmed = async (bookingRequestId: string) => {
    if (!pendingMongooseInvite) return;
    const { messageId, data } = pendingMongooseInvite;

    // Update the invite message content: mark as confirmed
    const updatedContent = JSON.stringify({
      ...data,
      status: "confirmed",
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

    // Send a plain-text success message into the chat
    await supabase.from("messages").insert([
      {
        sender_id: effectiveCurrentUserUUID,
        receiver_id: chatPartnerId,
        content:
          " Mongoose delivery booking confirmed! Use the 'Check Status & Track' button to follow your delivery.",
        is_read: false,
      },
    ]);

    setPendingMongooseInvite(null);
    setShowMongooseResponder(false);
  };

  /** Called by MongooseInviteCard's confirmed-state "Track" button */
  const handleMongooseTrack = async (bookingId: string) => {
    const { data } = await supabase
      .from("booking_requests")
      .select("*")
      .eq("id", bookingId)
      .single();
    if (data) {
      setMongooseTrackerBooking(data);
      setShowMongooseTracker(true);
    }
  };

  const openMessageActions = (
    message: any,
    pageY?: number,
    isCurrentUser?: boolean,
  ) => {
    if (!message || message.isOptimistic) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectedMessage(message);
    setSelectedMessagePageY(pageY ?? 0);
    setSelectedMessageIsCurrentUser(isCurrentUser ?? false);
    setShowMessageActions(true);
  };

  const renderOutgoingStatus = (
    message: any,
    isCurrentUser: boolean,
    isOptimistic: boolean,
    localStatus: string | undefined,
    connectNext: boolean,
    isLatestOutgoingMessage: boolean,
  ) => {
    if (!isCurrentUser || connectNext || !isLatestOutgoingMessage) return null;

    let label = "";
    let tone = "text-gray-400";

    if (isOptimistic) {
      if (localStatus === "failed") {
        label = "Failed to send";
        tone = "text-red-500";
      } else if (localStatus === "sent") {
        label = "Sent";
      } else {
        label = "Sending...";
      }
    } else {
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

    return <Text className={`text-[11px] mt-1 ${tone} mr-3`}>{label}</Text>;
  };

  /** Metallic border gradient — matches the badge's outer frame per tier. */
  /** Neon glow color per tier. */
  const getBubbleNeonColor = (badge: EarlyAccessBadgeType): string => {
    if (badge === "founding") return "#ff6eb4";
    if (badge === "waitlist") return "#ffd235";
    return "#3de4ff";
  };

  /** Frosted semi-transparent fill per tier + sender/receiver. */
  const getBubbleFrostedBg = (
    badge: EarlyAccessBadgeType,
    forCurrentUser: boolean,
  ): string => {
    if (badge === "founding")
      return forCurrentUser ? "rgba(100,0,160,0.44)" : "rgba(70,0,110,0.36)";
    if (badge === "waitlist")
      return forCurrentUser ? "rgba(150,70,0,0.44)" : "rgba(100,50,0,0.36)";
    return forCurrentUser ? "rgba(0,50,140,0.44)" : "rgba(0,35,100,0.36)";
  };

  /**
   * Metallic border gradient — matches the badge’s outer frame per tier.
   * Sender (you) → vivid full-brightness metal.
   * Receiver (them) → muted, aged version of the same metal.
   */
  const getBubbleBorderColors = (
    badge: EarlyAccessBadgeType,
    forCurrentUser: boolean,
  ): [string, string, string, string] => {
    if (badge === "founding") {
      return forCurrentUser
        ? ["#c9a96e", "#f0d79a", "#e8c07a", "#c9a96e"] // vivid rose-gold
        : ["#5a4535", "#7a6048", "#968060", "#7a6048"]; // muted aged bronze
    }
    if (badge === "waitlist") {
      return forCurrentUser
        ? ["#a16207", "#d97706", "#f5d264", "#d97706"] // vivid 24k gold
        : ["#4a3200", "#6a4e00", "#8a6a14", "#6a4e00"]; // muted antique gold
    }
    return forCurrentUser
      ? ["#475569", "#94a3b8", "#e2e8f0", "#94a3b8"] // vivid brushed steel
      : ["#1e2530", "#2d3748", "#3d4e62", "#2d3748"]; // muted gunmetal
  };

  /**
   * Inner dark fill.
   * Sender → warm, rich tier material (deep violet / cognac / sapphire).
   * Receiver → cool slate-charcoal — clearly a different read.
   */
  const getBubbleGradient = (
    badge: EarlyAccessBadgeType,
    forCurrentUser: boolean,
  ): [string, string, string] => {
    if (badge === "founding") {
      return forCurrentUser
        ? ["#3b0f5e", "#200838", "#13042a"] // sender — rich violet-obsidian
        : ["#12162e", "#0d1124", "#080c1c"]; // receiver — cool slate-indigo
    }
    if (badge === "waitlist") {
      return forCurrentUser
        ? ["#3d1b00", "#261100", "#160900"] // sender — warm cognac
        : ["#141008", "#0e0b06", "#090704"]; // receiver — cool espresso-charcoal
    }
    return forCurrentUser
      ? ["#072040", "#041628", "#020f1c"] // sender — deep sapphire
      : ["#171c24", "#10141c", "#090d14"]; // receiver — cool steel-charcoal
  };

  const renderMessage = (
    message: any,
    index: number,
    connectPrev = false,
    connectNext = false,
  ) => {
    const isCurrentUser = !!(
      effectiveCurrentUserUUID && message.sender_id === effectiveCurrentUserUUID
    );
    const isOptimistic = message.isOptimistic;
    const localStatus = message.localStatus;
    const key = message.id != null ? String(message.id) : `idx-${index}`;
    const isLatestOutgoingMessage =
      latestOutgoingMessageId != null &&
      message?.id != null &&
      String(message.id) === latestOutgoingMessageId;
    const parentReplyCount =
      message?.id != null ? replyCountByMessageId[String(message.id)] || 0 : 0;
    const messageType = message.message_type || "text";
    const isLocation = message.content?.includes("📍 My Location:");
    const isImage = messageType === "image" || message.image_url;
    const isAudio = messageType === "audio" || message.audio_url;
    const parsedContent = parseMessageMetaContent(message.content);
    const visibleTextContent = parsedContent.text;
    const embeddedReplyMeta = parsedContent.replyMeta;
    const embeddedProductMeta = parsedContent.productMeta;
    // Badge tier for this specific message's sender (drives gradient bubbles)
    const senderBadgeType: EarlyAccessBadgeType = isCurrentUser
      ? currentUserBadgeType
      : chatPartnerBadgeType;
    const RADIUS_LARGE = 20;
    const RADIUS_SMALL = 6;
    const rowSpacingClass = connectNext ? "mb-1" : "mb-3";
    const productCardWidth = Math.round(screenWidth * 0.6);
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
        setPreviewImageUrl(message.image_url);
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
          <SwipeableRow
            onTriggered={() => startReplyToMessage(message)}
            isCurrentUser={isCurrentUser}
          >
            <Pressable
              onLongPress={(e) =>
                openMessageActions(message, e.nativeEvent.pageY, isCurrentUser)
              }
              delayLongPress={400}
              className={`${isCurrentUser ? "mr-2" : "ml-2"}`}
            >
              <AudioMessagePlayer
                audioUrl={message.audio_url}
                duration={message.audio_duration}
                isCurrentUser={isCurrentUser}
                isOptimistic={isOptimistic}
              />
            </Pressable>
          </SwipeableRow>
          {reactionsForMsg.length > 0 && (
            <AnimatedReactionPill
              key={reactionsForMsg.join("-")}
              animKey={`${key}::${reactionsForMsg.join("")}`}
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
          <SwipeableRow
            onTriggered={() => startReplyToMessage(message)}
            isCurrentUser={isCurrentUser}
          >
            <Pressable
              onPress={handleImagePress}
              onLongPress={(e) =>
                openMessageActions(message, e.nativeEvent.pageY, isCurrentUser)
              }
              delayLongPress={400}
              className={`max-w-[72%] overflow-hidden ${
                isCurrentUser ? "mr-2" : "ml-2"
              } ${isOptimistic ? "opacity-70" : ""}`}
              style={bubbleRadiusStyle}
            >
              <Image
                source={{ uri: message.image_url }}
                style={{ width: 200, height: 200 }}
                resizeMode="cover"
              />
              {isOptimistic && (
                <View className="absolute inset-0 bg-black/30 items-center justify-center">
                  <ActivityIndicator color="white" />
                  <Text className="text-white text-xs mt-2">Uploading...</Text>
                </View>
              )}
            </Pressable>
          </SwipeableRow>
          {reactionsForMsg.length > 0 && (
            <AnimatedReactionPill
              key={reactionsForMsg.join("-")}
              animKey={`${key}::${reactionsForMsg.join("")}`}
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
                openMessageActions(message, e.nativeEvent.pageY, isCurrentUser)
              }
              delayLongPress={400}
              className={`max-w-[72%] overflow-hidden ${
                isCurrentUser ? "mr-2" : "ml-2"
              } ${isOptimistic ? "opacity-70" : ""}`}
              style={bubbleRadiusStyle}
            >
              <MapView
                style={{ width: 250, height: 150 }}
                provider={
                  Platform.OS === "android" ? PROVIDER_GOOGLE : undefined
                }
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
              >
                <Marker coordinate={coordinates} title="Shared Location" />
              </MapView>
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
            <AnimatedReactionPill
              key={reactionsForMsg.join("-")}
              animKey={`${key}::${reactionsForMsg.join("")}`}
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
                ? "mr-2 border-primary/20 bg-primary/5"
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
                Product
              </Text>
              <Text
                className="text-[13px] text-gray-800 font-medium"
                numberOfLines={2}
              >
                {embeddedProductMeta.title}
              </Text>
              {embeddedProductMeta.price ? (
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

        <SwipeableRow
          onTriggered={() => startReplyToMessage(message)}
          isCurrentUser={isCurrentUser}
        >
          <Pressable
            onPress={() => {
              if (localStatus === "failed") {
                setLocalMessages((prev) =>
                  prev.map((m) =>
                    m.id === message.id ? { ...m, localStatus: "sending" } : m,
                  ),
                );
                const retryPreview = parseMessageMetaContent(
                  message.content,
                ).text;
                void sendMessageToServer({
                  messageContent: message.content,
                  optimisticId: String(message.id),
                  messagePreview: retryPreview || "Sent a message",
                });
              }
            }}
            onLongPress={(e) =>
              openMessageActions(message, e.nativeEvent.pageY, isCurrentUser)
            }
            delayLongPress={400}
            className={`max-w-[72%] px-3 py-3 ${
              isCurrentUser
                ? senderBadgeType
                  ? "mr-2"
                  : "bg-primary mr-2"
                : senderBadgeType
                  ? "ml-2"
                  : "bg-gray-200 ml-2"
            } ${isOptimistic ? "opacity-70" : ""}`}
            style={[bubbleRadiusStyle, { overflow: "hidden" }]}
          >
            {/* ── Badge-holder bubble: metallic gradient per tier ── */}
            {senderBadgeType ? (
              <>
                <LinearGradient
                  colors={getBubbleBorderColors(senderBadgeType, isCurrentUser)}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
                <LinearGradient
                  colors={getBubbleGradient(senderBadgeType, isCurrentUser)}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    position: "absolute",
                    top: 1.5,
                    left: 1.5,
                    right: 1.5,
                    bottom: 1.5,
                    borderRadius: 18,
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    top: 1.5,
                    bottom: 1.5,
                    left: "22%",
                    width: 36,
                    backgroundColor: "rgba(255,255,255,0.045)",
                    transform: [{ skewX: "-18deg" }],
                  }}
                  pointerEvents="none"
                />
                <View
                  style={{
                    position: "absolute",
                    top: 1.5,
                    bottom: 1.5,
                    left: "55%",
                    width: 14,
                    backgroundColor: "rgba(255,255,255,0.025)",
                    transform: [{ skewX: "-18deg" }],
                  }}
                  pointerEvents="none"
                />
              </>
            ) : null}
            {embeddedReplyMeta ? (
              <View
                className={`mb-2 rounded-xl px-2 py-1.5 border-l-2 ${
                  isCurrentUser || senderBadgeType
                    ? "bg-white/15 border-white/80"
                    : "bg-white border-gray-300"
                }`}
              >
                <Text
                  className={`text-[11px] font-semibold ${
                    isCurrentUser || senderBadgeType
                      ? "text-blue-100"
                      : "text-gray-700"
                  }`}
                  numberOfLines={1}
                >
                  {embeddedReplyMeta.senderName}
                </Text>
                <Text
                  className={`text-[11px] ${
                    isCurrentUser || senderBadgeType
                      ? "text-blue-100"
                      : "text-gray-600"
                  }`}
                  numberOfLines={1}
                >
                  {embeddedReplyMeta.snippet}
                </Text>
              </View>
            ) : null}
            <Text
              className={`${isCurrentUser || senderBadgeType ? "text-white" : "text-gray-800"} text-[15px]`}
              style={{ lineHeight: 20 }}
            >
              {visibleTextContent}
            </Text>
          </Pressable>
        </SwipeableRow>
        {/* Emoji reactions pill */}
        {reactionsForMsg.length > 0 && (
          <AnimatedReactionPill
            key={reactionsForMsg.join("-")}
            animKey={`${key}::${reactionsForMsg.join("")}`}
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
              {parentReplyCount} {parentReplyCount === 1 ? "reply" : "replies"}
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
  };

  return (
    <View className="flex-1 bg-white">
      <PopupMessage visible={popup.visible} type={popup.type} title={popup.title} message={popup.message} onHide={() => setPopup(p => ({...p, visible: false}))} />
      {/* Status Bar Space */}
      <View style={{ height: insets.top, backgroundColor: 'white', zIndex: 10 }} />

      {/* Fixed Header */}
      <View className="flex-row items-center p-4 border-b border-gray-200 bg-white" style={{ zIndex: 10 }}>
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
        </TouchableOpacity>

        <View className="flex-1">
          <Text className="font-semibold text-gray-800 text-lg">
            {chatPartnerName}
          </Text>

          {/* Online Status or Additional Info */}
          {isMongooseChat ? (
            <Text className="text-sm text-gray-500">Delivery Person</Text>
          ) : (
            <Text className="text-sm text-gray-500">
              {chatPartnerData?.name ||
                chatPartnerData?.username ||
                chatPartnerData?.full_name ||
                "Unknown User"}
            </Text>
          )}

          {isPartnerTyping && (
            <Text className="text-sm text-green-500">typing...</Text>
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
      </View>

      {/* Keyboard-aware body — slides up with the keyboard on the native UI thread */}
      <Reanimated.View style={[{ flex: 1 }, keyboardAwareStyle]}>
      {/* Scrollable Messages Area */}
      <ScrollView
        ref={scrollViewRef}
        className="flex-1 px-4 py-2"
        showsVerticalScrollIndicator={false}
        // "always": taps anywhere never dismiss the keyboard — no accidental
        // keyboard-close when touching a bubble or empty space between messages.
        keyboardShouldPersistTaps="always"
        // "on-drag": keyboard dismisses as soon as the user intentionally drags
        // to scroll — mirrors WhatsApp / iMessage behaviour.
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: allMessages.length > 0 ? "flex-end" : "center",
          paddingBottom: chatBottomPadding,
        }}
      >
        {allMessages.length > 0 ? (
          timelineItems.map((item, index) => {
            if (item.type === "separator") {
              return (
                <View key={item.id} className="items-center my-3">
                  <View className=" px-3 py-1 rounded-full">
                    <Text className="text-[11px] text-gray-600 font-medium">
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
          })
        ) : (
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
              {/* Show a more natural message */}
              {chatPartnerName.startsWith("+975") ||
              chatPartnerName === "Unknown User"
                ? "No messages yet. Start the conversation!"
                : `No messages yet. Start the conversation with ${chatPartnerName}!`}
            </Text>
          </View>
        )}

        {/* Typing indicator */}
        {isPartnerTyping && <TypingIndicator />}
      </ScrollView>

      {/* Fixed Input Bar */}
      <View
        className="mb-0"
      >
        <View
          className={`flex-row items-center px-4 pt-2`}
          style={{
            paddingBottom: isKeyboardVisible ? 8 : Math.max(insets.bottom, 12),
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
                  <Text className="text-[12px] text-gray-600" numberOfLines={1}>
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
                      Interested in this product
                    </Text>
                    <Text
                      className="text-[12px] text-gray-700"
                      numberOfLines={1}
                    >
                      {pendingProductContext.title}
                    </Text>
                    {pendingProductContext.price ? (
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
              {/* Action tray (image + location) — hidden while recording */}
              {!isVoiceRecording && (
                <Animated.View
                  className="relative h-9 mr-1 overflow-hidden justify-center"
                  style={{
                    width: composerActionsProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [36, 116],
                    }),
                  }}
                >
                  <Animated.View
                    pointerEvents={areComposerActionsCollapsed ? "none" : "auto"}
                    className="absolute left-0 right-0 flex-row items-center"
                    style={{
                      opacity: composerActionsProgress,
                      transform: [
                        {
                          translateX: composerActionsProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-14, 0],
                          }),
                        },
                      ],
                    }}
                  >
                    <ChatImagePicker
                      currentUserUUID={effectiveCurrentUserUUID || ""}
                      chatPartnerId={chatPartnerId as string}
                      onOptimisticImage={handleOptimisticImage}
                      onUploadSuccess={handleImageUploadSuccess}
                      onUploadError={handleImageUploadError}
                    />
                    <ChatImagePicker
                      mode="camera"
                      currentUserUUID={effectiveCurrentUserUUID || ""}
                      chatPartnerId={chatPartnerId as string}
                      onOptimisticImage={handleOptimisticImage}
                      onUploadSuccess={handleImageUploadSuccess}
                      onUploadError={handleImageUploadError}
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
                  </Animated.View>

                  <Animated.View
                    pointerEvents={areComposerActionsCollapsed ? "auto" : "none"}
                    className="absolute left-0 right-0 items-center"
                    style={{
                      opacity: composerActionsProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 0],
                      }),
                      transform: [
                        {
                          translateX: composerActionsProgress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 10],
                          }),
                        },
                      ],
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setComposerActionsCollapsed(false)}
                      className="w-9 h-9 items-center justify-center"
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color="#6b7280"
                      />
                    </TouchableOpacity>
                  </Animated.View>
                </Animated.View>
              )}

              {/* Voice recorder — always mounted so recording state is preserved.
                  hidden={collapsed} collapses it to 0×0 when typing (tray is closed),
                  becomes full-width flex:1 bar while recording. */}
              <ChatAudioRecorder
                currentUserUUID={effectiveCurrentUserUUID || ""}
                chatPartnerId={chatPartnerId as string}
                onOptimisticAudio={handleOptimisticAudio}
                onUploadSuccess={handleAudioUploadSuccess}
                onUploadError={handleAudioUploadError}
                onRecordingStateChange={setIsVoiceRecording}
                hidden={areComposerActionsCollapsed && !isVoiceRecording}
                style={isVoiceRecording ? { flex: 1 } : undefined}
              />

              {/* Text input + send/edit buttons — hidden while recording */}
              {!isVoiceRecording && (
                <>
                  <View className="flex-1 self-center min-h-[36px] justify-center">
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
                      onFocus={() => setComposerActionsCollapsed(true)}
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
                  </View>

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
              )}
            </View>
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
            <MapView
              style={{ flex: 1 }}
              provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
              initialRegion={{
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker
                coordinate={selectedLocation}
                title="Shared Location"
                description="Tap navigate icon to open in Maps app"
              />
            </MapView>
          )}
        </View>
      </Modal>

      {/* Message Actions Modal — WhatsApp / Instagram style */}
      <Modal
        visible={showMessageActions}
        transparent
        animationType="none"
        onRequestClose={() => setShowMessageActions(false)}
        statusBarTranslucent
      >
        {/* Outer animated wrapper — fades the whole overlay in/out */}
        <Reanimated.View style={[modalBackdropAnimStyle, { flex: 1 }]}>
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
              const isLoc =
                selectedMessage.content?.includes?.("📍 My Location:");
              const previewText = isImg
                ? "📷  Photo"
                : isAud
                  ? "🎵  Voice message"
                  : isLoc
                    ? "📍  Location"
                    : msgText;

              // Compute safe vertical position so the full card fits on screen
              const BUBBLE_H = 72;
              const REACTIONS_H = 58;
              const editRow =
                isOwnMsg &&
                !isImg &&
                selectedMessage.message_type !== "mongoose_invite"
                  ? 52
                  : 0;
              const deleteRow = isOwnMsg ? 52 : 0;
              const ACTIONS_H = 52 + editRow + deleteRow + 52;
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
                <Reanimated.View
                  pointerEvents="box-none"
                  style={[
                    modalCardAnimStyle,
                    {
                      position: "absolute",
                      top: cardTop,
                      left: 0,
                      right: 0,
                      paddingHorizontal: 14,
                    },
                  ]}
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

                    {/* Edit — own non-image, non-invite messages only */}
                    {isOwnMsg &&
                      !isImg &&
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
                </Reanimated.View>
              );
            })()}
        </Reanimated.View>
        {/* end backdrop wrapper */}
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
      <Modal
        visible={showImagePreview}
        animationType="fade"
        onRequestClose={() => setShowImagePreview(false)}
      >
        <View className="flex-1 bg-black">
          {/* Header */}
          <View
            className="bg- px-4 py-4 border-b border-gray-800"
            style={{ paddingTop: Platform.OS === "ios" ? 50 : 20 }}
          >
            <View className="flex-row items-center justify-between">
              <TouchableOpacity
                onPress={() => setShowImagePreview(false)}
                className="p-2"
              >
                <Ionicons name="close" size={28} color="white" />
              </TouchableOpacity>
              <Text className="text-lg font-semibold text-white">Image</Text>
              <View className="w-10" />
            </View>
          </View>

          {/* Image */}
          <View className="flex-1 items-center justify-center">
            {previewImageUrl && (
              <Image
                source={{ uri: previewImageUrl }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="contain"
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
