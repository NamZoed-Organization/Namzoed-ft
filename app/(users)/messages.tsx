// app/(tabs)/messages.tsx
import BookMongooseModal from "@/components/BookMongooseModal";
import FollowRequests from "@/components/modals/FollowRequests";
import TrackMongooseModal from "@/components/modals/TrackMongooseModal";
import { useUnreadMessages } from "@/contexts/UnreadMessagesContext";
import { useUser } from "@/contexts/UserContext";
import userData17123456 from "@/data/17123456";
import users from "@/data/UserData";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  FlatList,
  Image,

  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import Reanimated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

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

// Get user data based on phone number
const getUserData = (phoneNumber: string): IUserData | null => {
  // Clean phone number - remove +975 prefix if exists
  const cleanPhone = phoneNumber?.replace("+975", "").replace(/\D/g, "");

  switch (cleanPhone) {
    case "17123456":
      return userData17123456;
    default:
      // For demo purposes, always return the 17123456 data so messages show
      return userData17123456;
  }
};

/**
 * PressableRow — tap to navigate, long press to delete.
 */
const PressableRow = React.memo(function PressableRow({
  children,
  onDelete,
  onPress,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  onPress: () => void;
}) {
  const heldProgress = useSharedValue(0);

  const heldBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      heldProgress.value,
      [0, 1],
      ['#ffffff', '#dbeafe'],
    ),
  }));

  return (
    <Reanimated.View style={[heldBgStyle, { width: '100%' }]}>
      <TouchableOpacity
        onPress={onPress}
        onLongPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          heldProgress.value = withTiming(1, { duration: 150 });
          onDelete();
        }}
        onPressOut={() => {
          heldProgress.value = withTiming(0, { duration: 300 });
        }}
        delayLongPress={500}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    </Reanimated.View>
  );
});

export default function MessageScreen() {
  const { currentUser } = useUser();
  const { refreshUnreadCount, currentUserUUID } = useUnreadMessages();
  const router = useRouter();
  const { tab } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFollowRequests, setShowFollowRequests] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [requestConversations, setRequestConversations] = useState<any[]>([]);
  const [showMessageRequests, setShowMessageRequests] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [mongooseUsers, setMongooseUsers] = useState<any[]>([]);
  const [isLoadingMongoose, setIsLoadingMongoose] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [mongooseBookings, setMongooseBookings] = useState<any[]>([]);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [selectedBookingForTracking, setSelectedBookingForTracking] =
    useState<any>(null);
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

  const formatConversationPreview = (message: any, isMine: boolean) => {
    if (!message) return "No messages yet";
    let content =
      typeof message.content === "string" ? message.content : message.content;

    // Strip embedded metadata wrappers used by chat screen persistence.
    if (typeof content === "string") {
      for (let i = 0; i < 3; i++) {
        if (content.startsWith("[product-meta]") && content.includes("[/product-meta]")) {
          const suffixIndex = content.indexOf("[/product-meta]");
          content = content
            .slice(suffixIndex + "[/product-meta]".length)
            .replace(/^\n/, "");
          continue;
        }
        if (content.startsWith("[reply-meta]") && content.includes("[/reply-meta]")) {
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
      return isMine ? "You:  Mongoose delivery request" : " Mongoose delivery request";
    if (message.message_type === "image" || message.image_url) return "Photo";
    if (message.message_type === "audio" || message.audio_url)
      return "Voice message";
    if (
      typeof content === "string" &&
      content.includes("📍 My Location:")
    ) {
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

  // Get userData - will be null if currentUser is null
  const userData = currentUser
    ? getUserData(currentUser.phone_number || "")
    : null;

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

        const followingIds = (followData ?? []).map((r: any) => r.following_id as string);

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
          .select("id, name, phone, avatar_url")
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
          .select("sender_id, status")
          .eq("receiver_id", resolvedUUID);
        // Map sender_id → status
        const requestStatusMap = new Map<string, string>(
          (incomingRequests ?? []).map((r: any) => [String(r.sender_id), r.status]),
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
          const requestStatus = requestStatusMap.get(pid); // only set when partner sent me a request

          if (isMutual || requestStatus === "accepted") {
            // Mutual follow or accepted request → main inbox
            mainConvos.push(convo);
          } else if (requestStatus === "pending") {
            // Partner sent me a message request → requests tray
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
        setDebugInfo(`${mainConvos.length} chats · ${reqConvos.length} requests`);
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
    // Fetch conversations from Supabase (prioritize database over local data)
    fetchConversations(true);
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
    // Fetch mongoose users when component mounts
    fetchMongooseUsers();
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
    // Fetch bookings when component mounts
    if (currentUser?.id) {
      fetchMongooseBookings();
    }
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

  const getUserByPhone = (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace("+975", "");
    return Object.values(users).find((u) => u.phone_number === cleanPhone);
  };

  const handleFollowBack = (phoneNumber: string) => {
    // Here you would update the backend and local state
  };

  const handleReject = (phoneNumber: string) => {
    // Here you would remove from followers or block
  };

  const handleAcceptMessageRequest = async (senderId: string) => {
    const myId = currentUserUUID || currentUser?.id;
    if (!myId) {
      Alert.alert("Error", "Could not identify your account. Please try again.");
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
          Alert.alert("Error", "Failed to accept request: " + error.message);
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
      Alert.alert("Error", e?.message || "An unexpected error occurred.");
    }
  };

  const handleDeclineMessageRequest = async (senderId: string, partnerName: string) => {
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
              Alert.alert("Error", "Could not identify your account. Please try again.");
              return;
            }

            try {
              // Upsert declined status (handles missing row gracefully)
              const { error } = await supabase
                .from("message_requests")
                .upsert(
                  { sender_id: senderId, receiver_id: myId, status: "declined" },
                  { onConflict: "sender_id,receiver_id" },
                );

              if (error) {
                console.warn("Decline request error (proceeding anyway):", error.message);
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

  const renderMessageItem = ({ item: phoneNumber }: { item: string }) => {
    const user = getUserByPhone(phoneNumber);
    const messagesObj = userData?.messages as Record<string, IMessage[]>;
    const conversation = messagesObj[phoneNumber];
    const lastMessage = conversation?.[conversation.length - 1];

    return (
      <TouchableOpacity
        className="flex-row items-center p-4 border-b border-gray-200"
        onPress={() =>
          router.push(`/(users)/chat/${phoneNumber.replace("+975", "")}`)
        }
      >
        <View className="w-12 h-12 bg-primary rounded-full items-center justify-center mr-3">
          <Text className="text-white font-bold">
            {user?.username.charAt(0).toUpperCase() || "U"}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-semibold text-gray-800">
            {user?.username || phoneNumber}
          </Text>
          <Text className="text-sm text-gray-500 mt-1" numberOfLines={1}>
            {lastMessage?.content || "No messages yet"}
          </Text>
        </View>
        <Text className="text-xs text-gray-400">
          {lastMessage?.timestamp
            ? new Date(lastMessage.timestamp).toLocaleDateString()
            : ""}
        </Text>
      </TouchableOpacity>
    );
  };

  const handleDeleteConversation = async (
    partnerId: string,
    partnerName: string,
  ) => {
    Alert.alert(
      "Delete Conversation",
      `Are you sure you want to delete all messages with ${partnerName}? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // Get current user's UUID
              const resolvedUUID = await resolveCurrentUserUUID();
              if (!resolvedUUID) {
                return;
              }

              // Delete all messages between current user and partner
              const { error } = await supabase
                .from("messages")
                .delete()
                .or(
                  `and(sender_id.eq.${resolvedUUID},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${resolvedUUID})`,
                );

              if (error) {
                console.error("Error deleting conversation:", error);
                Alert.alert(
                  "Error",
                  "Failed to delete conversation. Please try again.",
                );
              } else {
                // Remove from local state immediately
                setConversations((prev) =>
                  prev.filter((c) => c.partnerId !== partnerId),
                );
                Alert.alert(
                  "Success",
                  `Conversation with ${partnerName} has been deleted.`,
                );
              }
            } catch (e) {
              console.error("Error deleting conversation:", e);
              Alert.alert("Error", "An unexpected error occurred.");
            }
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
    const hasUnreadIncoming = !isLastMessageMine && conversation.unreadCount > 0;
    const conversationId = String(conversation.partnerId);

    return (
      <PressableRow
        onPress={() => router.push(`/(users)/chat/${conversation.partnerId}`)}
        onDelete={() =>
          Alert.alert(
            "Delete Chat?",
            `Do you want to delete your chat with ${userName}?`,
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => handleDeleteConversation(conversation.partnerId, userName),
              },
            ],
          )
        }
      >
        <View className="flex-row items-center py-4 px-4">
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              className="w-12 h-12 rounded-full mr-3"
              resizeMode="cover"
            />
          ) : (
            <View className="w-12 h-12 bg-primary rounded-full items-center justify-center mr-3">
              <Text className="text-white font-bold">
                {userName?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
          )}
          <View className="flex-1 flex-row items-center border-b border-gray-200 pb-4 -mb-4">
            <View className="flex-1">
              <Text
                className={`text-gray-800 ${hasUnreadIncoming ? "font-bold" : "font-semibold"}`}
              >
                {userName}
              </Text>
              <Text
                className={`text-sm mt-1 ${hasUnreadIncoming ? "text-gray-800 font-semibold" : "text-gray-500"}`}
                numberOfLines={1}
              >
                {formatConversationPreview(lastMessage, isLastMessageMine)}
              </Text>
            </View>
            <Text className="text-xs text-gray-400 mr-2">
              {formatConversationTime(conversation.lastMessage?.created_at)}
            </Text>
            {conversation.unreadCount > 0 && (
              <View className="mr-2 min-w-[22px] h-[22px] px-1 rounded-full bg-primary items-center justify-center">
                <Text className="text-white text-[11px] font-bold">
                  {conversation.unreadCount > 99
                    ? "99+"
                    : conversation.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </PressableRow>
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
      pending: { label: "Pending", bg: "#fef3c7", text: "#92400e", icon: "time-outline" },
      accepted: { label: "Accepted", bg: "#dbeafe", text: "#1e40af", icon: "checkmark-circle-outline" },
      rejected: { label: "Rejected", bg: "#fee2e2", text: "#991b1b", icon: "close-circle-outline" },
      completed: { label: "Delivered", bg: "#d1fae5", text: "#065f46", icon: "checkmark-done-outline" },
    };
    const statusCfg = userBooking ? bookingStatusConfig[userBooking.status] : null;

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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
                {userName}
              </Text>
              {/* Free / Busy badge */}
              <View
                style={{
                  backgroundColor: isBusy ? "#fff7ed" : "#f0fdf4",
                  borderRadius: 10,
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
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  alignSelf: "flex-start",
                }}
              >
                <Ionicons name={statusCfg.icon as any} size={13} color={statusCfg.text} />
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
                flexDirection: "row",
                alignItems: "center",
              }}
              onPress={handleTrackPress}
            >
              <Ionicons name="navigate" size={17} color="white" />
              <Text style={{ color: "white", fontWeight: "600", marginLeft: 5, fontSize: 13 }}>
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
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Ionicons name="checkmark-done" size={17} color="#065f46" />
              <Text style={{ color: "#065f46", fontWeight: "600", marginLeft: 5, fontSize: 13 }}>
                Done
              </Text>
            </View>
          ) : userBooking?.status === "pending" || userBooking?.status === "accepted" ? (
            <View
              style={{
                backgroundColor: "#f3f4f6",
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#6b7280", fontWeight: "600", fontSize: 13 }}>
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
                flexDirection: "row",
                alignItems: "center",
              }}
              onPress={() => !isBusy && setShowBookingModal(true)}
              disabled={isBusy}
            >
              <Ionicons name="calendar-outline" size={17} color="white" />
              <Text style={{ color: "white", fontWeight: "600", marginLeft: 5, fontSize: 13 }}>
                {isBusy ? "Busy" : "Book"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Early returns AFTER all hooks are defined to avoid hook order violations
  // Check if user is logged in
  if (!currentUser) {
    return (
      <View className="flex-1 bg-background">
        {/* Status Bar Space */}
        <View className="h-12 bg-white" />

        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-base font-regular text-gray-500 text-center">
            Please login to view messages
          </Text>
        </View>
      </View>
    );
  }

  // Check if userData is available
  if (!userData) {
    return (
      <View className="flex-1 bg-background">
        {/* Status Bar Space */}
        <View className="h-12 bg-white" />

        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-base font-regular text-gray-500 text-center">
            No user data found
          </Text>
        </View>
      </View>
    );
  }

  // If showing follow requests, render the FollowRequests component
  if (showFollowRequests) {
    return (
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
    );
  }

  const tabs = ["Messages", "Mongoose"];

  return (
    <View className="flex-1 bg-background">
      {/* Status Bar Space */}
      <View className="h-12 bg-white" />

      {/* Fixed Header with spacing */}
      <View className="bg-white px-4 py-3 ">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-mbold text-primary">
              Conversations
            </Text>
            <Text className="text-base font-medium text-gray-700">
              {currentUser.name || "User"}
            </Text>
          </View>
        </View>
      </View>

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
        <FlatList
          style={{ flex: 1 }}
          data={searchQuery.trim() ? searchResults : conversations}
          renderItem={
            searchQuery.trim() ? renderSearchResultItem : renderConversationItem
          }
          keyExtractor={(item) =>
            item.id || item.partnerId || item.phone || item.phone_number
          }
          ListHeaderComponent={() => (
            <>
              {/* Search Bar */}
              <View className="p-4 bg-white border-b border-gray-200">
                <View className="flex-row items-center bg-gray-100 rounded-lg px-3 py-2">
                  <Ionicons name="search" size={20} color="#666" />
                  <TextInput
                    className="flex-1 ml-2 text-base"
                    placeholder="Search conversations or find new users..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  {isSearching && (
                    <View className="ml-2">
                      <Text className="text-xs text-gray-500">Searching...</Text>
                    </View>
                  )}
                </View>
              </View>

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
                  <View style={{ width: 46, height: 46, marginRight: 12, position: "relative" }}>
                    <View
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 19,
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
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
                      Message Requests
                    </Text>
                    <Text style={{ fontSize: 13, color: "#6b7280", marginTop: 1 }}>
                      {requestConversations.length}{" "}
                      {requestConversations.length === 1 ? "request" : "requests"}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View
                      style={{
                        minWidth: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: "#094569",
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 5,
                      }}
                    >
                      <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>
                        {requestConversations.length}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
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
                    No followed users match "{searchQuery}".
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

      {/* Message Requests view */}
      {activeTab === 0 && showMessageRequests && (
        <FlatList
          style={{ flex: 1 }}
          data={requestConversations}
          keyExtractor={(item) => item.partnerId}
          renderItem={({ item: convo }) => {
            const name =
              convo.partnerProfile?.name ||
              convo.partnerProfile?.username ||
              "Unknown";
            const preview = formatConversationPreview(
              convo.lastMessage,
              false,
            );
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
                        />
                      ) : (
                        <Text style={{ fontSize: 18, fontWeight: "700", color: "#6b7280" }}>
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
                    <Text style={{ fontSize: 15, fontWeight: "600", color: "#111827" }}>
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
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>
                      Accept
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeclineMessageRequest(convo.partnerId, name)}
                    style={{
                      flex: 1,
                      backgroundColor: "#f3f4f6",
                      paddingVertical: 9,
                      borderRadius: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: "#374151", fontWeight: "600", fontSize: 14 }}>
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
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
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
            <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48 }}>
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
    </View>
  );
}
