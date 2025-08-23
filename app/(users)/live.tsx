import { Ionicons } from "@expo/vector-icons";
import { CameraType, CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Mic,
  MicOff,
  Settings,
  Share,
  Users,
  VideoIcon,
  VideoOff,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GetStreamLive from "./getstream-live";

const { width, height } = Dimensions.get("window");

export default function LiveScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraType, setCameraType] = useState<CameraType>("front");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState<string[]>([]);
  const [useGetStream, setUseGetStream] = useState(false); // Start with basic mode
  const [showSettings, setShowSettings] = useState(false);

  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  // Mock user data - in production, get this from your auth context
  const currentUser = {
    id: `user_${Date.now()}`,
    name: "Demo User",
    image: "https://picsum.photos/100/100?random=1",
  };

  useEffect(() => {
    // Simulate viewer count changes
    const interval = setInterval(() => {
      if (isStreaming) {
        setViewerCount((prev) => prev + Math.floor(Math.random() * 3) - 1);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const startStream = () => {
    setIsStreaming(true);
    setViewerCount(1);
    Alert.alert(
      "Stream Started!",
      useGetStream
        ? "Your professional live stream is now broadcasting with GetStream!"
        : "Your basic live stream is now active!"
    );
  };

  const stopStream = () => {
    setIsStreaming(false);
    setViewerCount(0);
    setLikes(0);
    setComments([]);
    Alert.alert("Stream Ended", "Your live stream has been stopped.");
  };

  const toggleCamera = () => {
    setCameraType((prev) => (prev === "front" ? "back" : "front"));
  };

  const toggleAudio = () => {
    setIsAudioEnabled((prev) => !prev);
  };

  const toggleVideo = () => {
    setIsVideoEnabled((prev) => !prev);
  };

  const handleLike = () => {
    setLikes((prev) => prev + 1);
  };

  // Mock adding comments for demo
  useEffect(() => {
    if (isStreaming) {
      const commentInterval = setInterval(() => {
        const mockComments = [
          "Great stream! 🔥",
          "Looking good!",
          "Love this content 😍",
          "Keep it up!",
          "Amazing quality!",
        ];
        const randomComment =
          mockComments[Math.floor(Math.random() * mockComments.length)];
        setComments((prev) => [...prev, randomComment].slice(-10)); // Keep last 10 comments
      }, 5000);

      return () => clearInterval(commentInterval);
    }
  }, [isStreaming]);

  if (!permission) {
    // Camera permissions are still loading
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            Please grant camera permission to start live streaming
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </View>
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
          <ArrowLeft size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Stream</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setShowSettings(!showSettings)}
            style={styles.settingsButton}
          >
            <Settings size={20} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(users)/live-viewer")}>
            <Text style={styles.viewStreamsButton}>View Streams</Text>
          </TouchableOpacity>
          {isStreaming && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>
      </View>

      {/* Settings Panel */}
      {showSettings && (
        <View style={styles.settingsPanel}>
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>
              Use GetStream (Professional)
            </Text>
            <Switch
              value={useGetStream}
              onValueChange={setUseGetStream}
              trackColor={{ false: "#767577", true: "#094569" }}
              thumbColor={useGetStream ? "#EDC06D" : "#f4f3f4"}
            />
          </View>
          <Text style={styles.settingDescription}>
            {useGetStream
              ? "Professional live streaming with HD quality, global CDN, and real-time features"
              : "Basic camera preview mode for testing"}
          </Text>
        </View>
      )}

      {/* Conditional Rendering: GetStream vs Basic Camera */}
      {useGetStream ? (
        // GetStream Professional Mode
        <GetStreamLive user={currentUser} />
      ) : (
        // Basic Camera Mode
        <View style={styles.cameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing={cameraType}
            mode="video"
          >
            {/* Overlay UI */}
            <View style={styles.overlay}>
              {/* Top Stats */}
              <View style={styles.topStats}>
                <View style={styles.statItem}>
                  <Users size={16} color="white" />
                  <Text style={styles.statText}>{viewerCount}</Text>
                </View>
                <View style={styles.statItem}>
                  <Heart size={16} color="white" />
                  <Text style={styles.statText}>{likes}</Text>
                </View>
              </View>

              {/* Side Controls */}
              <View style={styles.sideControls}>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={handleLike}
                >
                  <Heart
                    size={24}
                    color="white"
                    fill={likes > 0 ? "red" : "transparent"}
                  />
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton}>
                  <MessageCircle size={24} color="white" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton}>
                  <Share size={24} color="white" />
                </TouchableOpacity>
              </View>

              {/* Bottom Controls */}
              <View style={styles.bottomControls}>
                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    !isAudioEnabled && styles.disabledButton,
                  ]}
                  onPress={toggleAudio}
                >
                  {isAudioEnabled ? (
                    <Mic size={24} color="white" />
                  ) : (
                    <MicOff size={24} color="white" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.controlButton,
                    !isVideoEnabled && styles.disabledButton,
                  ]}
                  onPress={toggleVideo}
                >
                  {isVideoEnabled ? (
                    <VideoIcon size={24} color="white" />
                  ) : (
                    <VideoOff size={24} color="white" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={toggleCamera}
                >
                  <Ionicons name="camera-reverse" size={24} color="white" />
                </TouchableOpacity>

                {!isStreaming ? (
                  <TouchableOpacity
                    style={styles.startButton}
                    onPress={startStream}
                  >
                    <Text style={styles.startButtonText}>Go Live</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.stopButton}
                    onPress={stopStream}
                  >
                    <Text style={styles.stopButtonText}>End Stream</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Stream Info */}
              {isStreaming && (
                <View style={styles.streamInfo}>
                  <Text style={styles.streamTitle}>Live Stream Active</Text>
                  <Text style={styles.streamSubtitle}>
                    Broadcasting in basic mode
                  </Text>
                </View>
              )}

              {/* Comments Overlay */}
              {comments.length > 0 && (
                <View style={styles.commentsOverlay}>
                  {comments.slice(-3).map((comment, index) => (
                    <View key={index} style={styles.commentBubble}>
                      <Text style={styles.commentText}>{comment}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </CameraView>
        </View>
      )}

      {/* Stream Info for when not streaming */}
      {!isStreaming && !useGetStream && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Ready to go live?</Text>
          <Text style={styles.infoText}>
            Share your moments with your audience. You can showcase products,
            provide tutorials, or just connect with your community.
          </Text>

          <View style={styles.features}>
            <View style={styles.feature}>
              <Users size={20} color="#094569" />
              <Text style={styles.featureText}>Real-time audience</Text>
            </View>
            <View style={styles.feature}>
              <Heart size={20} color="#094569" />
              <Text style={styles.featureText}>Live interactions</Text>
            </View>
            <View style={styles.feature}>
              <MessageCircle size={20} color="#094569" />
              <Text style={styles.featureText}>Live chat</Text>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingText: {
    color: "white",
    fontSize: 16,
    textAlign: "center",
    marginTop: height / 2,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  permissionTitle: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  permissionText: {
    color: "#ccc",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: "#EDC06D",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
  },
  permissionButtonText: {
    color: "#094569",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 16,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingsButton: {
    padding: 8,
  },
  viewStreamsButton: {
    color: "#EDC06D",
    fontSize: 14,
    fontWeight: "500",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "red",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "white",
  },
  liveText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  settingsPanel: {
    backgroundColor: "rgba(0,0,0,0.8)",
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  settingLabel: {
    color: "white",
    fontSize: 16,
    fontWeight: "500",
  },
  settingDescription: {
    color: "#ccc",
    fontSize: 14,
    lineHeight: 20,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: "space-between",
  },
  topStats: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: 16,
    gap: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  sideControls: {
    position: "absolute",
    right: 16,
    top: height / 2 - 100,
    alignItems: "center",
    gap: 16,
  },
  controlButton: {
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 12,
    borderRadius: 50,
  },
  disabledButton: {
    backgroundColor: "rgba(255,0,0,0.5)",
  },
  bottomControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 16,
  },
  startButton: {
    backgroundColor: "#EDC06D",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startButtonText: {
    color: "#094569",
    fontSize: 16,
    fontWeight: "600",
  },
  stopButton: {
    backgroundColor: "red",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  stopButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  streamInfo: {
    position: "absolute",
    top: 100,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 12,
    borderRadius: 8,
  },
  streamTitle: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  streamSubtitle: {
    color: "#ccc",
    fontSize: 14,
  },
  commentsOverlay: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 80,
    gap: 8,
  },
  commentBubble: {
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 8,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  commentText: {
    color: "white",
    fontSize: 14,
  },
  infoContainer: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    padding: 20,
    borderRadius: 16,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#094569",
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: "#333",
    lineHeight: 24,
    marginBottom: 20,
  },
  features: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  feature: {
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 12,
    color: "#094569",
    fontWeight: "500",
  },
});
