import { supabase } from "@/lib/supabase";
import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ShoppingBag } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
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
}: {
  liveStreamId: string | null | undefined;
  hostId?: string | null;
  isHostView: boolean;
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<Comment[]>([]);
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sharedProducts, setSharedProducts] = useState<any[]>([]);
  const [viewerCount, setViewerCount] = useState<number>(0);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const joinedUsersRef = React.useRef<Set<string>>(new Set());

  const { height: windowHeight } = useWindowDimensions();
  const maxPanelHeight = Math.round(windowHeight * 0.45);

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

  // Real-time viewer count subscription
  useEffect(() => {
    if (!liveStreamId) return;

    // Initial fetch
    const fetchViewerCount = async () => {
      const { data, error } = await supabase
        .from("live_streams")
        .select("viewer_count")
        .eq("id", liveStreamId)
        .single();

      if (data && !error) {
        setViewerCount(data.viewer_count || 0);
      }
    };
    fetchViewerCount();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`viewer-count-${liveStreamId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_streams",
          filter: `id=eq.${liveStreamId}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new.viewer_count === "number") {
            setViewerCount(payload.new.viewer_count);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveStreamId]);

  // Track user joins via new comments (when someone sends their first message, show join notification)
  // This approach doesn't require a separate stream_viewers table
  useEffect(() => {
    if (!liveStreamId) return;

    // Listen for new comments and show join message for first-time commenters
    const channel = supabase
      .channel(`stream-joins-${liveStreamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stream_comments",
          filter: `live_stream_id=eq.${liveStreamId}`,
        },
        async (payload) => {
          const userId = payload.new?.user_id;
          if (!userId || joinedUsersRef.current.has(userId)) return;

          // Mark as seen to only show join once per user
          joinedUsersRef.current.add(userId);

          // Fetch user profile for the join message
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, avatar_url")
            .eq("id", userId)
            .single();

          const joinMessage: SystemMessage = {
            id: `join-${userId}-${Date.now()}`,
            type: "join",
            text: "joined the live",
            username: profile?.name || "Someone",
            avatar_url: profile?.avatar_url,
            created_at: new Date().toISOString(),
          };

          setSystemMessages((prev) => [joinMessage, ...prev]);

          // Remove join message after 5 seconds
          setTimeout(() => {
            setSystemMessages((prev) =>
              prev.filter((m) => m.id !== joinMessage.id),
            );
          }, 5000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      joinedUsersRef.current.clear();
    };
  }, [liveStreamId]);

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

    return (
      <Animated.View
        entering={FadeInRight.springify().damping(20).stiffness(100)}
        layout={LinearTransition.springify?.()}
        style={[styles.animatedRow, !isHostView && styles.viewerCommentRow]}
      >
        <View
          style={[styles.commentRow, !isHostView && styles.viewerCommentBubble]}
        >
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

  // Render viewer count badge
  const renderViewerCount = () => (
    <View style={styles.viewerCountContainer}>
      <View style={styles.viewerCountBadge}>
        <View style={styles.liveDot} />
        <Text style={styles.viewerCountText}>
          {viewerCount} {viewerCount === 1 ? "watching" : "watching"}
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={
        isHostView
          ? Platform.OS === "ios"
            ? 0
            : 20
          : Platform.OS === "ios"
            ? insets.bottom + 60
            : 0
      }
      style={{ flex: 1 }}
      pointerEvents="auto"
    >
      <View
        style={[styles.panelContainer, { height: maxPanelHeight }]}
        pointerEvents="auto"
      >
        {/* Mask to fade out top area */}
        {/* Viewer count badge */}
        {!isHostView && renderViewerCount()}

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
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              onPress={sendComment}
              disabled={!inputText.trim()}
              style={styles.sendButton}
            >
              <Text
                style={[
                  styles.sendText,
                  {
                    color: inputText.trim() ? "#fff" : "rgba(255,255,255,0.2)",
                  },
                ]}
              >
                Send
              </Text>
            </TouchableOpacity>
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
    maxWidth: "55%",
  },
  viewerCommentBubble: {
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 16,
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
    borderRadius: 24,
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
    paddingLeft: 12,
  },
  sendText: {
    fontWeight: "700",
    fontSize: 14,
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
  // Viewer count styles
  viewerCountContainer: {
    position: "absolute",
    top: -40,
    left: 0,
    right: 0,
    alignItems: "flex-start",
    zIndex: 100,
  },
  viewerCountBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
    marginRight: 6,
  },
  viewerCountText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
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
