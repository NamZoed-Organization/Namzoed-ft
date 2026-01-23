import { AlertCircle, Radio, X } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface LiveWrapperProps {
  onClose: () => void;
}

// Try to import LiveScreen with error handling
let LiveScreen: React.ComponentType<{ onClose: () => void }> | null = null;
let importError: Error | null = null;

try {
  // Attempt to load the Live component
  const LiveModule = require("@/components/livestream/Live");
  LiveScreen = LiveModule.default || LiveModule;
} catch (error) {
  console.warn("Live streaming module unavailable:", error);
  importError = error as Error;
}

/**
 * Safe wrapper for LiveScreen component that handles WebRTC module errors gracefully
 * This prevents the entire app from crashing if the Live streaming feature is unavailable
 */
export default function LiveWrapper({ onClose }: LiveWrapperProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  // If Live component loaded successfully, render it
  if (LiveScreen) {
    return <LiveScreen onClose={onClose} />;
  }

  // Handle retry attempt
  const handleRetry = () => {
    setIsRetrying(true);

    // Attempt to reload the module
    setTimeout(() => {
      try {
        delete require.cache[require.resolve("@/components/livestream/Live")];
        const LiveModule = require("@/components/livestream/Live");
        LiveScreen = LiveModule.default || LiveModule;

        if (LiveScreen) {
          // Force re-render
          setIsRetrying(false);
          onClose();
          // User would need to reopen, but at least we tried
        } else {
          setIsRetrying(false);
        }
      } catch (error) {
        console.warn("Retry failed:", error);
        setIsRetrying(false);
      }
    }, 1000);
  };

  // Show error UI if Live component failed to load
  return (
    <SafeAreaView style={styles.container}>
      {/* Header with close button */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={24} color="#111" />
        </TouchableOpacity>
      </View>

      {/* Error content */}
      <View style={styles.content}>
        <View style={styles.errorIcon}>
          <AlertCircle size={64} color="#DC2626" />
        </View>

        <Text style={styles.errorTitle}>Live Streaming Unavailable</Text>

        <Text style={styles.errorMessage}>
          Live streaming is not available in Expo Go. This feature requires
          native WebRTC modules that are not included in the Expo Go app.
        </Text>

        <View style={styles.reasonsList}>
          <Text style={styles.reasonItem}>
            • WebRTC is not supported in Expo Go
          </Text>
          <Text style={styles.reasonItem}>
            • Native modules need to be compiled
          </Text>
          <Text style={styles.reasonItem}>
            • Build a development build to test this feature
          </Text>
        </View>

        <Text style={styles.solutionText}>
          To test live streaming, build a development build:
        </Text>

        <View style={styles.codeBlock}>
          <Text style={styles.codeText}>npx expo run:android</Text>
          <Text style={styles.codeText}>or</Text>
          <Text style={styles.codeText}>npx expo run:ios</Text>
        </View>

        {/* Retry button */}
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          disabled={isRetrying}
        >
          {isRetrying ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Radio size={20} color="#fff" />
              <Text style={styles.retryButtonText}>Try Again</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Technical details (collapsible in production) */}
        {__DEV__ && importError && (
          <View style={styles.technicalDetails}>
            <Text style={styles.technicalTitle}>Technical Details:</Text>
            <Text style={styles.technicalText}>
              {importError.message || "Unknown error"}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111",
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  errorIcon: {
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 12,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 24,
  },
  reasonsList: {
    alignSelf: "stretch",
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  reasonItem: {
    fontSize: 14,
    color: "#991B1B",
    marginBottom: 8,
    lineHeight: 20,
  },
  solutionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
    textAlign: "center",
  },
  codeBlock: {
    backgroundColor: "#1F2937",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    alignSelf: "stretch",
  },
  codeText: {
    fontSize: 13,
    color: "#10B981",
    fontFamily: "monospace",
    textAlign: "center",
    marginVertical: 2,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
    minWidth: 160,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  technicalDetails: {
    marginTop: 32,
    padding: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    alignSelf: "stretch",
  },
  technicalTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 8,
  },
  technicalText: {
    fontSize: 11,
    color: "#9CA3AF",
    fontFamily: "monospace",
  },
});
