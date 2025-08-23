import { useRouter } from "expo-router";
import { ArrowLeft, Heart, Send, Share, Users } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width, height } = Dimensions.get("window");

interface LiveStream {
  id: string;
  title: string;
  thumbnail: string;
  streamerName: string;
  streamerAvatar: string;
  viewerCount: number;
  isLive: boolean;
  category: string;
}

interface Comment {
  id: string;
  username: string;
  message: string;
  timestamp: Date;
}

export default function LiveStreamViewer() {
  const [activeStreams, setActiveStreams] = useState<LiveStream[]>([]);
  const [selectedStream, setSelectedStream] = useState<LiveStream | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [likes, setLikes] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  const router = useRouter();

  useEffect(() => {
    // Mock data for active streams
    const mockStreams: LiveStream[] = [
      {
        id: "1",
        title: "Traditional Bhutanese Cooking Live",
        thumbnail: "https://picsum.photos/300/200?random=1",
        streamerName: "Chef Tenzin",
        streamerAvatar: "https://picsum.photos/50/50?random=1",
        viewerCount: 124,
        isLive: true,
        category: "Cooking",
      },
      {
        id: "2",
        title: "Handmade Crafts Workshop",
        thumbnail: "https://picsum.photos/300/200?random=2",
        streamerName: "Artisan Pema",
        streamerAvatar: "https://picsum.photos/50/50?random=2",
        viewerCount: 89,
        isLive: true,
        category: "Crafts",
      },
      {
        id: "3",
        title: "Local Market Tour",
        thumbnail: "https://picsum.photos/300/200?random=3",
        streamerName: "Guide Dorji",
        streamerAvatar: "https://picsum.photos/50/50?random=3",
        viewerCount: 67,
        isLive: true,
        category: "Travel",
      },
    ];
    setActiveStreams(mockStreams);

    // Mock comments
    const mockComments: Comment[] = [
      {
        id: "1",
        username: "user123",
        message: "This looks amazing!",
        timestamp: new Date(),
      },
      {
        id: "2",
        username: "viewer456",
        message: "Can you show the ingredients again?",
        timestamp: new Date(),
      },
    ];
    setComments(mockComments);
  }, []);

  const joinStream = (stream: LiveStream) => {
    setSelectedStream(stream);
  };

  const leaveStream = () => {
    setSelectedStream(null);
  };

  const sendComment = () => {
    if (newComment.trim()) {
      const comment: Comment = {
        id: Date.now().toString(),
        username: "You",
        message: newComment.trim(),
        timestamp: new Date(),
      };
      setComments((prev) => [...prev, comment]);
      setNewComment("");
    }
  };

  const toggleLike = () => {
    setIsLiked(!isLiked);
    setLikes((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  if (selectedStream) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Stream Header */}
        <View style={styles.streamHeader}>
          <TouchableOpacity onPress={leaveStream} style={styles.backButton}>
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.streamInfo}>
            <Text style={styles.streamTitle}>{selectedStream.title}</Text>
            <Text style={styles.streamerName}>
              {selectedStream.streamerName}
            </Text>
          </View>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* Stream Video Area */}
        <View style={styles.streamVideo}>
          <Image
            source={{ uri: selectedStream.thumbnail }}
            style={styles.streamImage}
            resizeMode="cover"
          />
          <View style={styles.streamOverlay}>
            <View style={styles.topStats}>
              <View style={styles.statItem}>
                <Users size={16} color="white" />
                <Text style={styles.statText}>
                  {selectedStream.viewerCount}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Heart size={16} color="white" />
                <Text style={styles.statText}>{likes}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stream Controls */}
        <View style={styles.streamControls}>
          <TouchableOpacity
            style={[styles.controlButton, isLiked && styles.likedButton]}
            onPress={toggleLike}
          >
            <Heart
              size={24}
              color={isLiked ? "red" : "white"}
              fill={isLiked ? "red" : "transparent"}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton}>
            <Share size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <Text style={styles.commentsTitle}>Live Chat</Text>
          <ScrollView style={styles.commentsList}>
            {comments.map((comment) => (
              <View key={comment.id} style={styles.commentItem}>
                <Text style={styles.commentUsername}>{comment.username}:</Text>
                <Text style={styles.commentMessage}>{comment.message}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.commentInput}>
            <TextInput
              style={styles.textInput}
              value={newComment}
              onChangeText={setNewComment}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={sendComment}>
              <Send size={20} color="#094569" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft size={24} color="#094569" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Streams</Text>
        <TouchableOpacity onPress={() => router.push("/(users)/live")}>
          <Text style={styles.goLiveButton}>Go Live</Text>
        </TouchableOpacity>
      </View>

      {/* Active Streams */}
      <ScrollView style={styles.streamsList}>
        <Text style={styles.sectionTitle}>Live Now</Text>
        {activeStreams.map((stream) => (
          <TouchableOpacity
            key={stream.id}
            style={styles.streamCard}
            onPress={() => joinStream(stream)}
          >
            <Image
              source={{ uri: stream.thumbnail }}
              style={styles.streamThumbnail}
              resizeMode="cover"
            />
            <View style={styles.streamCardOverlay}>
              <View style={styles.streamCardHeader}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
                <View style={styles.viewerCount}>
                  <Users size={14} color="white" />
                  <Text style={styles.viewerCountText}>
                    {stream.viewerCount}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.streamCardInfo}>
              <Image
                source={{ uri: stream.streamerAvatar }}
                style={styles.streamerAvatar}
              />
              <View style={styles.streamCardText}>
                <Text style={styles.streamCardTitle}>{stream.title}</Text>
                <Text style={styles.streamCardStreamer}>
                  {stream.streamerName}
                </Text>
                <Text style={styles.streamCardCategory}>{stream.category}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#094569",
  },
  goLiveButton: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#ef4444",
  },
  streamsList: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#094569",
    marginBottom: 16,
  },
  streamCard: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  streamThumbnail: {
    width: "100%",
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  streamCardOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  streamCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "red",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "white",
    marginRight: 4,
  },
  liveText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  viewerCount: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  viewerCountText: {
    color: "white",
    fontSize: 12,
    marginLeft: 4,
  },
  streamCardInfo: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
  },
  streamerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  streamCardText: {
    flex: 1,
  },
  streamCardTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#094569",
    marginBottom: 4,
  },
  streamCardStreamer: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 2,
  },
  streamCardCategory: {
    fontSize: 12,
    color: "#9ca3af",
  },
  // Stream viewer styles
  streamHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  streamInfo: {
    flex: 1,
    marginLeft: 16,
  },
  streamTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  streamerName: {
    fontSize: 14,
    color: "#d1d5db",
  },
  streamVideo: {
    flex: 1,
    position: "relative",
  },
  streamImage: {
    width: "100%",
    height: "100%",
  },
  streamOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "space-between",
  },
  topStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statText: {
    color: "white",
    marginLeft: 4,
    fontSize: 14,
    fontWeight: "bold",
  },
  streamControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  controlButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
    padding: 12,
    borderRadius: 24,
  },
  likedButton: {
    backgroundColor: "rgba(255,0,0,0.3)",
  },
  commentsSection: {
    height: 200,
    backgroundColor: "white",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#094569",
    marginBottom: 12,
  },
  commentsList: {
    flex: 1,
    marginBottom: 12,
  },
  commentItem: {
    flexDirection: "row",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  commentUsername: {
    fontWeight: "bold",
    color: "#094569",
    marginRight: 8,
  },
  commentMessage: {
    color: "#374151",
    flex: 1,
  },
  commentInput: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 12,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 80,
  },
  sendButton: {
    backgroundColor: "#f3f4f6",
    padding: 8,
    borderRadius: 20,
  },
});
