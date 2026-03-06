import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import { useCallStateHooks } from "@stream-io/video-react-native-sdk";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ShoppingBag } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import Animated, {
    FadeInRight,
    LinearTransition,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Comment {
  id: string;
  text: string;
  user_id: string;
  created_at: string;
  profiles: { name: string; avatar_url: string };
}

interface SystemMessage {
  id: string;
  type: "guideline" | "join" | "system";
  text: string;
  username?: string;
  avatar_url?: string;
  created_at: string;
}

type ChatItem =
  | (Comment & { itemType: "comment" })
  | (SystemMessage & { itemType: "system" });

const COMMUNITY_GUIDELINES: SystemMessage[] = [
  {
    id: "guideline-1",
    type: "guideline",
    text: "Welcome to the live! Be respectful and kind to others.",
    created_at: new Date().toISOString(),
  },
  {
    id: "guideline-2",
    type: "guideline",
    text: "No spam, hate speech, or harassment.",
    created_at: new Date().toISOString(),
  },
  {
    id: "guideline-3",
    type: "guideline",
    text: "Keep comments relevant to the stream.",
    created_at: new Date().toISOString(),
  },
];

export const LiveChat = ({
  liveStreamId,
  hostId,
  isHostView = false,
  onNavigate,
}: {
  liveStreamId: string | null | undefined;
  hostId?: string | null;
  isHostView: boolean;
  onNavigate?: () => void;
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<Comment[]>([]);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sharedProducts, setSharedProducts] = useState<any[]>([]);
  const [showGuidelines, setShowGuidelines] = useState(true);
  // Android: track keyboard height to push input above keyboard
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Track participants seen so far to detect new joins
  const prevParticipantIdsRef = useRef<Set<string>>(new Set());
  const isParticipantFirstRenderRef = useRef(true);

  const { height: windowHeight } = useWindowDimensions();
  const maxPanelHeight = Math.round(windowHeight * (isHostView ? 0.45 : 0.33));

  // Android keyboard listener — KeyboardAvoidingView is unreliable in
  // absolute-positioned overlays on Android so we manually track keyboard height.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    })();
  }, []);

  // Show community guidelines when stream starts
  useEffect(() => {
    if (liveStreamId && showGuidelines) {
      // Add guidelines as system messages with staggered timing
      const guidelineMessages = COMMUNITY_GUIDELINES.map((g, index) => ({
        ...g,
        id: `${g.id}-${liveStreamId}`,
        created_at: new Date(
          Date.now() - (COMMUNITY_GUIDELINES.length - index) * 1000,
        ).toISOString(),
      }));
      setSystemMessages(guidelineMessages);

      // Auto-hide guidelines after 30 seconds
      const timer = setTimeout(() => {
        setShowGuidelines(false);
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [liveStreamId]);

  // Track user joins in real-time via Stream SDK participant list
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();

  useEffect(() => {
    if (!participants || participants.length === 0) return;

    const currentIds = new Set(participants.map((p) => p.userId));

    // On the very first render, just record who is already there — no join toasts
    if (isParticipantFirstRenderRef.current) {
      isParticipantFirstRenderRef.current = false;
      prevParticipantIdsRef.current = currentIds;
      return;
    }

    // Find participants who weren't in the previous snapshot
    const newJoiners = participants.filter(
      (p) => !prevParticipantIdsRef.current.has(p.userId),
    );

    // Update snapshot
    prevParticipantIdsRef.current = currentIds;

    for (const participant of newJoiners) {
      const userId = participant.userId;

      // Don't show "host joined the live" — host is always the stream owner
      if (hostId && userId === hostId) continue;

      // Fetch profile then display join toast
      (async () => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name, avatar_url")
          .eq("id", userId)
          .single();

        const joinMessage: SystemMessage = {
          id: `join-${userId}-${Date.now()}`,
          type: "join",
          text: "joined the live",
          username: profile?.name || participant.name || "Someone",
          avatar_url: profile?.avatar_url ?? participant.image,
          created_at: new Date().toISOString(),
        };

        setSystemMessages((prev) => [joinMessage, ...prev]);

        // Auto-remove after 5 seconds
        setTimeout(() => {
          setSystemMessages((prev) =>
            prev.filter((m) => m.id !== joinMessage.id),
          );
        }, 5000);
      })();
    }
  }, [participants, hostId]);

  // host products are displayed in the host UI (Live.tsx); viewers only need shared products here

  // Fetch products currently shared on this stream
  const fetchSharedProducts = useCallback(async () => {
    if (!liveStreamId) return;
    const { data, error } = await supabase
      .from("stream_products")
      .select("*")
      .eq("live_stream_id", liveStreamId)
      .order("display_order", { ascending: true });

    if (error) {
      console.error("Error fetching stream products:", error);
      return;
    }

    const rows = data || [];

    // Fetch full product details for each row
    const detailed = await Promise.all(
      rows.map(async (row: any) => {
        try {
          const { data: prod } = await supabase
            .from("products")
            .select("*")
            .eq("id", row.product_id)
            .single();
          return { ...row, product: prod };
        } catch (e) {
          return { ...row, product: null };
        }
      }),
    );

    setSharedProducts(detailed);
  }, [liveStreamId]);

  useEffect(() => {
    fetchSharedProducts();

    if (!liveStreamId) return;

    const channel = supabase
      .channel(`stream-products-${liveStreamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stream_products",
          filter: `live_stream_id=eq.${liveStreamId}`,
        },
        async (payload) => {
          await fetchSharedProducts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "stream_products",
          filter: `live_stream_id=eq.${liveStreamId}`,
        },
        async (payload) => {
          await fetchSharedProducts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "stream_products",
          filter: `live_stream_id=eq.${liveStreamId}`,
        },
        async (payload) => {
          await fetchSharedProducts();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [liveStreamId, fetchSharedProducts]);

  // Sharing handled in host UI (Live.tsx); viewers only subscribe to stream_products here

  const isCurrentUserHost =
    !!hostId && !!currentUserId && String(currentUserId) === String(hostId);

  useEffect(() => {
    if (!liveStreamId) return;

    const fetchComments = async () => {
      const { data } = await supabase
        .from("stream_comments")
        .select("*, profiles(name, avatar_url)")
        .eq("live_stream_id", liveStreamId)
        .order("created_at", { ascending: false })
        .limit(30);
      if (data) setComments(data);
    };
    fetchComments();

    const channel = supabase
      .channel(`live-comments-${liveStreamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stream_comments",
          filter: `live_stream_id=eq.${liveStreamId}`,
        },
        async (payload) => {
          const { data: userData } = await supabase
            .from("profiles")
            .select("name, avatar_url")
            .eq("id", payload.new.user_id)
            .single();
          const newComment = {
            ...payload.new,
            profiles: {
              name: userData?.name || "user",
              avatar_url: userData?.avatar_url,
            },
          } as Comment;
          setComments((prev) => [newComment, ...prev]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [liveStreamId]);

  const sendComment = async () => {
    if (!inputText.trim()) return;
    const textToSend = inputText;
    setInputText("");

    await supabase.from("stream_comments").insert({
      live_stream_id: liveStreamId,
      user_id: currentUserId,
      text: textToSend,
    });
  };

  // Combine comments and system messages into a single sorted list
  const chatItems: ChatItem[] = React.useMemo(() => {
    const commentItems: ChatItem[] = comments.map((c) => ({
      ...c,
      itemType: "comment" as const,
    }));
    const systemItems: ChatItem[] = systemMessages.map((s) => ({
      ...s,
      itemType: "system" as const,
    }));

    return [...commentItems, ...systemItems].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [comments, systemMessages]);

  const renderItem = ({ item }: { item: ChatItem }) => {
    // Render system messages (guidelines, join notifications)
    if (item.itemType === "system") {
      const sysItem = item as SystemMessage & { itemType: "system" };

      if (sysItem.type === "guideline") {
        return (
          <Animated.View
            entering={FadeInRight.springify().damping(20).stiffness(100)}
            layout={LinearTransition.springify?.()}
            style={styles.animatedRow}
          >
            <View style={styles.guidelineRow}>
              <View style={styles.guidelineIcon}>
                <Text style={styles.guidelineIconText}>📋</Text>
              </View>
              <Text style={styles.guidelineText}>{sysItem.text}</Text>
            </View>
          </Animated.View>
        );
      }

      if (sysItem.type === "join") {
        return (
          <Animated.View
            entering={FadeInRight.springify().damping(20).stiffness(100)}
            layout={LinearTransition.springify?.()}
            style={styles.animatedRow}
          >
            <View style={styles.joinRow}>
              {sysItem.avatar_url ? (
                <Image
                  source={{ uri: sysItem.avatar_url }}
                  style={styles.joinAvatar}
                />
              ) : (
                <View style={styles.joinAvatarPlaceholder}>
                  <Text style={styles.joinAvatarText}>
                    {sysItem.username?.charAt(0)?.toUpperCase() || "?"}
                  </Text>
                </View>
              )}
              <Text style={styles.joinText}>
                <Text style={styles.joinUsername}>{sysItem.username}</Text>{" "}
                {sysItem.text}
              </Text>
            </View>
          </Animated.View>
        );
      }

      return null;
    }

    // Render regular comments
    const commentItem = item as Comment & { itemType: "comment" };
    const isHost = !!hostId && String(hostId) === String(commentItem.user_id);

    if (!isHostView) {
      // Viewer: avatar + username on top + comment below, transparent background
      return (
        <Animated.View
          entering={FadeInRight.springify().damping(20).stiffness(100)}
          layout={LinearTransition.springify?.()}
          style={[styles.animatedRow, styles.viewerCommentRow]}
        >
          <View style={styles.commentRow}>
            <TouchableOpacity
              onPress={() => {
                onNavigate?.();
                router.push(`/(users)/profile/${commentItem.user_id}` as any);
              }}
              activeOpacity={0.8}
            >
              <Image
                source={{
                  uri:
                    commentItem.profiles?.avatar_url ||
                    "https://www.gravatar.com/avatar/?d=mp",
                }}
                style={styles.avatar}
              />
            </TouchableOpacity>
            <View style={styles.commentContent}>
              <View style={styles.nameRow}>
                <TouchableOpacity
                  onPress={() => {
                    onNavigate?.();
                    router.push(
                      `/(users)/profile/${commentItem.user_id}` as any,
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[styles.nameText, isHost && styles.hostName]}
                    numberOfLines={1}
                  >
                    {commentItem.profiles?.name || "user"}
                  </Text>
                </TouchableOpacity>
                {isHost && (
                  <View style={styles.hostBadge}>
                    <Text style={styles.hostBadgeText}>Host</Text>
                  </View>
                )}
              </View>
              <Text style={styles.messageText}>{commentItem.text}</Text>
            </View>
          </View>
        </Animated.View>
      );
    }

    return (
      <Animated.View
        entering={FadeInRight.springify().damping(20).stiffness(100)}
        layout={LinearTransition.springify?.()}
        style={styles.animatedRow}
      >
        <View style={styles.commentRow}>
          <Image
            source={{
              uri:
                commentItem.profiles?.avatar_url ||
                "https://www.gravatar.com/avatar/?d=mp",
            }}
            style={styles.avatar}
          />
          <View style={styles.commentContent}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.nameText, isHost && styles.hostName]}
                numberOfLines={1}
              >
                {commentItem.profiles?.name || "user"}
              </Text>
              {isHost && (
                <View style={styles.hostBadge}>
                  <Text style={styles.hostBadgeText}>Host</Text>
                </View>
              )}
            </View>
            <Text style={styles.messageText}>{commentItem.text}</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={
        Platform.OS === "ios"
          ? isHostView
            ? insets.bottom
            : insets.bottom + 60 // viewer: above bottom tab bar
          : 0
      }
      style={{ flex: 1 }}
      pointerEvents="auto"
    >
      {/* Android: push panel up by keyboard height */}
      <View
        style={[
          styles.panelContainer,
          { height: maxPanelHeight },
          Platform.OS === "android" && keyboardHeight > 0
            ? { bottom: keyboardHeight }
            : null,
        ]}
        pointerEvents="auto"
      >
        <MaskedView
          style={{ flex: 1 }}
          maskElement={
            <LinearGradient
              colors={["transparent", "black", "black"]}
              locations={[0, 0.25, 1]}
              style={{ flex: 1 }}
            />
          }
        >
          <FlatList
            data={chatItems}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8, paddingTop: 8 }}
            style={{ flex: 1 }}
            scrollEnabled
            nestedScrollEnabled
            onScrollBeginDrag={Keyboard.dismiss}
          />
        </MaskedView>

        {!isHostView && sharedProducts.length > 0 && (
          <Animated.View
            entering={FadeInRight.springify().damping(20).stiffness(100)}
            style={styles.viewerProductsContainer}
            pointerEvents="box-none"
          >
            <View style={styles.productStackHeader}>
              <ShoppingBag color="#fff" size={14} />
              <Text style={styles.productStackTitle}>
                {sharedProducts.length}
              </Text>
            </View>
            <FlatList
              data={sharedProducts}
              keyExtractor={(item) => item.id || item.product_id}
              showsVerticalScrollIndicator={false}
              inverted
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    const productId = item.product?.id || item.product_id;
                    if (productId) {
                      onNavigate?.();
                      router.push(`/(users)/marketplace/${productId}` as any);
                    }
                  }}
                  activeOpacity={0.8}
                  style={styles.viewerProductCard}
                >
                  <Image
                    source={{
                      uri:
                        item.product?.image_url ||
                        item.product?.image ||
                        item.product?.thumbnail ||
                        item.product?.images?.[0] ||
                        "https://picsum.photos/100/100",
                    }}
                    style={styles.viewerProductImage}
                  />
                  {item.product?.price && (
                    <View style={styles.viewerPriceBadge}>
                      <Text style={styles.viewerPriceText}>
                        Nu {item.product.price}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          </Animated.View>
        )}

        <View style={styles.inputWrapper}>
          <View style={styles.inputInner}>
            <TextInput
              style={styles.input}
              placeholder="Add comment..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={inputText}
              onChangeText={setInputText}
              autoCorrect={false}
              multiline={false}
              returnKeyType="send"
              onSubmitEditing={sendComment}
              blurOnSubmit={false}
            />
            {inputText.trim().length > 0 && (
              <TouchableOpacity
                onPress={sendComment}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={styles.sendButton}
              >
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  panelContainer: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 0,
    zIndex: 50,
  },
  animatedRow: {
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  viewerCommentRow: {
    maxWidth: "65%",
  },
  viewerCommentBubble: {
    backgroundColor: "transparent",
  },
  viewerCommentText: {
    color: "#fff",
    fontSize: 13,
    lineHeight: 18,
    flexWrap: "wrap",
  },
  hostBadgeInline: {
    color: "#FFD700",
    fontSize: 11,
    fontWeight: "700",
  },
  messageSeparator: {
    color: "transparent",
  },
  commentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "transparent",
    paddingVertical: 6,
    paddingHorizontal: 6,
    paddingRight: 12,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  commentContent: {
    flex: 1,
    justifyContent: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 1,
  },
  nameText: {
    fontWeight: "600",
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  hostName: {
    color: "#FFD700",
    fontWeight: "700",
  },
  hostBadge: {
    backgroundColor: "rgba(255,215,0,0.2)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginLeft: 6,
  },
  hostBadgeText: {
    color: "#FFD700",
    fontSize: 10,
    fontWeight: "700",
  },
  messageText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 18,
  },
  // Legacy styles kept for compatibility
  commentBubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexShrink: 1,
  },
  hostBubble: {
    backgroundColor: "transparent",
  },
  viewerBubble: {
    backgroundColor: "transparent",
  },
  bubbleContent: {
    flex: 1,
    flexShrink: 1,
  },
  legacyHostName: {
    color: "rgb(234,179,8)",
  },
  viewerName: {
    color: "rgba(255,255,255,0.65)",
  },
  inputWrapper: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "transparent",
  },
  inputInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    maxHeight: 140,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingTop: 4,
    paddingBottom: 4,
  },
  sendButton: {
    justifyContent: "center",
    alignItems: "center",
    paddingLeft: 8,
  },
  // Viewer products - vertical list on RIGHT side (opposite of chat)
  viewerProductsContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 100,
    width: 70,
    zIndex: 60,
  },
  productStackHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
    alignSelf: "center",
  },
  productStackTitle: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },
  viewerProductCard: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.4)",
    alignSelf: "center",
  },
  viewerProductImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  viewerProductInfo: {
    display: "none",
  },
  viewerProductTitle: {
    display: "none",
  },
  viewerPriceBadge: {
    position: "absolute",
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: "center",
  },
  viewerPriceText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
  viewerProductPrice: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 10,
    marginTop: 2,
  },
  viewProductBadge: {
    display: "none",
  },
  viewProductBadgeText: {
    display: "none",
  },
  // Guideline styles
  guidelineRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  guidelineIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(59, 130, 246, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  guidelineIconText: {
    fontSize: 12,
  },
  guidelineText: {
    color: "rgba(147, 197, 253, 1)",
    fontSize: 13,
    flex: 1,
  },
  // Join notification styles
  joinRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  joinAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  joinAvatarPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  joinAvatarText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  joinText: {
    color: "rgba(216, 180, 254, 1)",
    fontSize: 13,
  },
  joinUsername: {
    fontWeight: "700",
    color: "rgba(216, 180, 254, 1)",
  },
  // Legacy styles kept for compatibility
  sharedProductsWrapper: {
    paddingHorizontal: 6,
    paddingBottom: 8,
  },
  sharedRow: {
    marginBottom: 8,
  },
  sharedCard: {
    width: 92,
    marginRight: 8,
    alignItems: "center",
  },
  sharedImage: {
    width: 80,
    height: 56,
    borderRadius: 8,
    marginBottom: 4,
  },
  sharedTitle: {
    color: "#fff",
    fontSize: 12,
  },
  hostStackWrapper: {
    marginBottom: 8,
  },
  productCard: {
    width: 120,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 10,
    padding: 8,
    alignItems: "center",
    marginRight: 12,
  },
  productImage: {
    width: 96,
    height: 72,
    borderRadius: 8,
    marginBottom: 6,
  },
  productName: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  shareButton: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  shareButtonActive: {
    backgroundColor: "rgba(234,179,8,0.9)",
  },
  shareButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
});
