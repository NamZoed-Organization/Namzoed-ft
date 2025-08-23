import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Share,
  Users,
} from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface GetStreamLiveProps {
  user: {
    id: string;
    name: string;
    image?: string;
  };
}

// Fallback component for Expo Go (when GetStream modules are not available)
const GetStreamFallback: React.FC<GetStreamLiveProps> = ({ user }) => {
  const router = useRouter();

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
        <Text style={styles.headerTitle}>GetStream Live</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.messageContainer}>
          <Text style={styles.title}>GetStream Professional Mode</Text>
          <Text style={styles.message}>
            GetStream's professional live streaming requires a development build
            to access native modules.
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Development Build Required</Text>
            <Text style={styles.infoText}>
              GetStream uses native WebRTC modules that aren't available in Expo
              Go. To use GetStream:
            </Text>

            <View style={styles.steps}>
              <Text style={styles.step}>1. Create a development build</Text>
              <Text style={styles.step}>2. Install on device/simulator</Text>
              <Text style={styles.step}>3. Configure GetStream API keys</Text>
            </View>
          </View>

          <View style={styles.features}>
            <Text style={styles.featuresTitle}>
              Professional Features Available:
            </Text>
            <View style={styles.feature}>
              <Users size={16} color="#094569" />
              <Text style={styles.featureText}>HD Video Streaming</Text>
            </View>
            <View style={styles.feature}>
              <Heart size={16} color="#094569" />
              <Text style={styles.featureText}>Global CDN</Text>
            </View>
            <View style={styles.feature}>
              <MessageCircle size={16} color="#094569" />
              <Text style={styles.featureText}>Real-time Chat</Text>
            </View>
            <View style={styles.feature}>
              <Share size={16} color="#094569" />
              <Text style={styles.featureText}>Unlimited Viewers</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              Alert.alert(
                "Development Build Info",
                "To create a development build:\n\n1. Run: npx expo install --dev-client\n2. Run: npx expo run:ios or expo run:android\n3. Configure GetStream API keys in config/getstream.ts",
                [
                  {
                    text: "Learn More",
                    onPress: () => {
                      // In a real app, you might open a web browser to docs
                      console.log("Opening GetStream docs...");
                    },
                  },
                  { text: "OK" },
                ]
              );
            }}
          >
            <Text style={styles.buttonText}>How to Enable GetStream</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryButtonText}>
              Use Basic Camera Mode
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// Main component with conditional loading
export default function GetStreamLive({ user }: GetStreamLiveProps) {
  const [isGetStreamAvailable, setIsGetStreamAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkGetStreamAvailability();
  }, []);

  const checkGetStreamAvailability = async () => {
    try {
      // Try to import GetStream modules
      const { StreamVideoClient } = await import(
        "@stream-io/video-react-native-sdk"
      );

      if (StreamVideoClient) {
        setIsGetStreamAvailable(true);
      }
    } catch (error) {
      console.log("GetStream modules not available in Expo Go, using fallback");
      setIsGetStreamAvailable(false);
    } finally {
      setIsChecking(false);
    }
  };

  if (isChecking) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#094569" />
        <Text style={styles.loadingText}>
          Checking GetStream availability...
        </Text>
      </SafeAreaView>
    );
  }

  if (!isGetStreamAvailable) {
    return <GetStreamFallback user={user} />;
  }

  // If GetStream is available, dynamically import and render the real component
  // This would only work in a development build
  return <GetStreamFallback user={user} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#094569",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(0,0,0,0.8)",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    marginLeft: 16,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f8f9fa",
  },
  messageContainer: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#094569",
    textAlign: "center",
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#094569",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
    marginBottom: 12,
  },
  steps: {
    marginLeft: 16,
  },
  step: {
    fontSize: 14,
    color: "#374151",
    marginBottom: 4,
  },
  features: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#094569",
    marginBottom: 12,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  featureText: {
    marginLeft: 8,
    fontSize: 14,
    color: "#374151",
  },
  button: {
    backgroundColor: "#094569",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
  },
  secondaryButton: {
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: "#374151",
    fontSize: 16,
    textAlign: "center",
  },
});
