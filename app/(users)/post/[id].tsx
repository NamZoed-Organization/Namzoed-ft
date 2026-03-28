/**
 * Post detail screen
 *
 * Navigated to from notifications when a user taps a post_liked,
 * post_commented, or new_post notification.
 * Shows the single post using the existing FeedPost component.
 */

import FeedPost from "@/components/FeedPost";
import { useUser } from "@/contexts/UserContext";
import { fetchPostById, PostWithUser } from "@/lib/postsService";
import { PostData } from "@/types/post";
import { useAppRouter } from "@/utils/navigation";
import { useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function toPostData(post: PostWithUser): PostData {
  const username =
    post.profiles?.name ||
    post.profiles?.email?.split("@")[0] ||
    "Unknown User";
  return {
    id: post.id,
    userId: post.user_id,
    username,
    profilePic: post.profiles?.avatar_url || undefined,
    content: post.content,
    images: post.images,
    date: new Date(post.created_at),
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    tagged_products: (post as any).tagged_products ?? undefined,
    tagged_accounts: (post as any).tagged_accounts ?? undefined,
  };
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();

  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchPostById(id)
      .then((raw) => {
        if (raw) setPost(toPostData(raw));
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <View style={{ flex: 1, backgroundColor: "#f3f4f6" }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: "#fff",
          borderBottomWidth: 1,
          borderBottomColor: "#f3f4f6",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: 12 }}
          >
            <ChevronLeft size={24} color="#111" />
          </TouchableOpacity>
          <Text style={{ fontSize: 17, fontWeight: "700", color: "#111" }}>
            Post
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#094569" />
        </View>
      ) : error || !post ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ fontSize: 15, color: "#6b7280", textAlign: "center" }}>
            This post is no longer available.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, backgroundColor: "#094569", borderRadius: 20 }}
          >
            <Text style={{ color: "#fff", fontWeight: "600" }}>Go back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          <FeedPost post={post} isVisible />
        </ScrollView>
      )}
    </View>
  );
}
