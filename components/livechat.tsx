import MaskedView from "@react-native-masked-view/masked-view";
import { LinearGradient } from "expo-linear-gradient";
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
import { supabase } from "../lib/supabase";

interface Comment {
  id: string;
  text: string;
  user_id: string;
  created_at: string;
  profiles: { name: string; avatar_url: string };
}

export const LiveChat = ({
  liveStreamId,
  hostId,
  isHostView = false,
}: {
  liveStreamId: string | null | undefined;
  hostId?: string | null;
  isHostView: boolean;
}) => {
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState<Comment[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sharedProducts, setSharedProducts] = useState<any[]>([]);

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
      })
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
        }
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
        }
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
        }
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
        }
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

  const renderItem = ({ item }: { item: Comment }) => {
    const isHost = !!hostId && String(hostId) === String(item.user_id);
    const bubbleMaxWidth = isCurrentUserHost ? "100%" : "50%";

    return (
      <Animated.View
        entering={FadeInRight.springify().damping(20).stiffness(100)}
        layout={LinearTransition.springify?.()}
        style={styles.animatedRow}
      >
        <View
          style={[
            styles.commentBubble,
            isHost ? styles.hostBubble : styles.viewerBubble,
            { maxWidth: bubbleMaxWidth },
          ]}
        >
          <Image
            source={{
              uri:
                item.profiles?.avatar_url ||
                "https://www.gravatar.com/avatar/?d=mp",
            }}
            style={styles.avatar}
          />
          <View style={styles.bubbleContent}>
            <Text
              style={[
                styles.nameText,
                isHost ? styles.hostName : styles.viewerName,
              ]}
              numberOfLines={2}
            >
              {item.profiles?.name || "user"} {isHost ? "• Host" : ""}
            </Text>
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        </View>
      </Animated.View>
    );
  };

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
      pointerEvents="box-none"
    >
      <View
        style={[styles.panelContainer, { height: maxPanelHeight }]}
        pointerEvents="box-none"
      >
        {/* Mask to fade out top area */}
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
            data={comments}
            inverted
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 8, paddingTop: 8 }}
            style={{ flex: 1 }}
            pointerEvents="box-none"
            onScrollBeginDrag={Keyboard.dismiss}
          />
        </MaskedView>

        {/* INPUT AREA */}
        {/* SHARED PRODUCTS (viewers) & HOST PRODUCT STACK */}
        <View style={styles.sharedProductsWrapper} pointerEvents="box-none">
          {/* For viewers: show currently shared products */}
          {sharedProducts.length > 0 && (
            <View style={styles.sharedRow}>
              <FlatList
                horizontal
                data={sharedProducts}
                keyExtractor={(item) => item.id || item.product_id}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={styles.sharedCard}>
                    <Image
                      source={{
                        uri:
                          item.product?.image_url ||
                          item.product?.image ||
                          item.product?.thumbnail ||
                          item.product?.images?.[0] ||
                          "https://picsum.photos/100/100",
                      }}
                      style={styles.sharedImage}
                    />
                    <Text numberOfLines={1} style={styles.sharedTitle}>
                      {item.product?.name || item.product?.title || "Product"}
                    </Text>
                  </View>
                )}
              />
            </View>
          )}

          {/* Host product controls are displayed in the host area (Live.tsx) — not in the chat panel */}
        </View>
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
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  commentBubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 1,
    flexShrink: 1,
  },
  hostBubble: {
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.45)", // yellow-ish
    backgroundColor: "rgba(245,158,11,0.14)",
  },
  viewerBubble: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    borderWidth: 0.6,
    borderColor: "rgba(255,255,255,0.12)",
    flexShrink: 0,
  },
  bubbleContent: {
    flex: 1,
    flexShrink: 1,
  },
  nameText: {
    fontWeight: "700",
    fontSize: 12,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  hostName: {
    color: "rgb(234,179,8)",
  },
  viewerName: {
    color: "rgba(255,255,255,0.65)",
  },
  messageText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 18,
    marginTop: 4,
    flexWrap: "wrap",
    flexShrink: 1,
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
