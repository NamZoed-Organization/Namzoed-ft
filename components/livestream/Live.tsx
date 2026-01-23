import { Camera } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Radio,
  X,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import getStreamService, {
  type StreamIdentity,
} from "@/services/getStreamService";
import {
  addCoHostToLivestream,
  adjustLivestreamViewerCount,
  cancelCoHostRequest,
  createCoHostRequest,
  createLivestreamRecord,
  endLivestreamRecord,
  fetchActiveLivestreams,
  fetchPendingCoHostRequests,
  incrementLivestreamViewerCountAtomic,
  subscribeToCoHostRequests,
  subscribeToLivestreams,
  subscribeToViewerCount,
  updateCoHostRequestStatus,
  type CoHostRequest,
  type Livestream,
  type LivestreamType,
} from "@/services/livestreamService";
import { Ionicons } from "@expo/vector-icons";
import {
  ParticipantView,
  StreamCall,
  StreamVideo,
  useCall,
  useCallStateHooks,
  type Call,
  type StreamVideoClient,
} from "@stream-io/video-react-native-sdk";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LiveChat } from "./livechat";

interface LiveScreenProps {
  onClose: () => void;
}

const FALLBACK_THUMBNAIL =
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80";

const sanitizeIdentifier = (value: string | number | undefined | null) => {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "-");
};

const deriveUserIdentifier = (user: unknown) => {
  if (!user || typeof user !== "object") {
    return null;
  }

  const source = user as Record<string, unknown> & {
    user_metadata?: Record<string, unknown>;
  };

  const fromMetadata = source.user_metadata ?? {};

  const candidates = [
    source.username,
    source.id,
    source.user_id,
    source.email,
    source.name,
    source.phone,
    fromMetadata.username,
    fromMetadata.name,
    fromMetadata.email,
    fromMetadata.phone,
  ];

  const candidate = candidates.find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0
  );

  if (!candidate) {
    return null;
  }

  const sanitized = sanitizeIdentifier(candidate).trim();
  return sanitized.length > 0 ? sanitized : null;
};

const buildPlaybackUrl = (playbackId?: string | null) => {
  if (!playbackId) {
    return null;
  }
  return `https://stream-io-global-cdn.stream-io-video.com/video/${playbackId}/hls/playlist.m3u8`;
};

interface IngestDetails {
  streamKey: string | null;
  rtmpAddress: string | null;
  hlsUrl: string | null;
  dashUrl: string | null;
  playbackId: string | null;
}

interface StreamLiveStream {
  id?: string;
  name?: string | null;
  description?: string | null;
  playback_ids?: Array<{ policy?: string | null; id?: string | null }>;
  playback_url?: string | null;
  hls_url?: string | null;
  dash_url?: string | null;
  stream_key?: string | null;
  rtmp_address?: string | null;
  playback_policy?: string | null;
  record?: boolean;
  recording?: boolean;
  broadcaster_host_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

type ActiveCallRole = "host" | "viewer" | "cohost" | null;

const LiveScreen: React.FC<LiveScreenProps> = ({ onClose }) => {
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();
  const [livestreams, setLivestreams] = useState<Livestream[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<Livestream | null>(null);
  const [hostingRecord, setHostingRecord] = useState<Livestream | null>(null);
  const [viewerSession, setViewerSession] = useState<{
    streamId: string;
  } | null>(null);
  const [creatingStream, setCreatingStream] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinLoadingId, setJoinLoadingId] = useState<string | null>(null);
  const [endingStream, setEndingStream] = useState(false);
  const [liveTitle, setLiveTitle] = useState("Going live on Namzoed");
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [streamClient, setStreamClient] = useState<StreamVideoClient | null>(
    null
  );
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callRole, setCallRole] = useState<ActiveCallRole>(null);
  const [initializingCall, setInitializingCall] = useState(false);

  // New states for stream type and co-host functionality
  const [streamType, setStreamType] = useState<LivestreamType>("business");
  const [filterType, setFilterType] = useState<LivestreamType | "all">("all");
  const [coHostRequests, setCoHostRequests] = useState<CoHostRequest[]>([]);
  const [hasRequestedCoHost, setHasRequestedCoHost] = useState(false);

  const hostingRecordRef = useRef<Livestream | null>(null);
  const viewerSessionRef = useRef<{ streamId: string } | null>(null);
  const supabaseUserIdRef = useRef<string | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const callRoleRef = useRef<ActiveCallRole>(null);

  const userId = useMemo(
    () => deriveUserIdentifier(currentUser),
    [currentUser]
  );

  const supabaseUserId = useMemo(() => {
    const candidate = (currentUser as any)?.id;
    return typeof candidate === "string" && candidate.length > 0
      ? candidate
      : null;
  }, [currentUser]);

  const displayName = useMemo(() => {
    if (!currentUser) {
      return "";
    }
    const candidate =
      (currentUser as any)?.username ??
      (currentUser as any)?.name ??
      (currentUser as any)?.email ??
      userId ??
      "";
    return typeof candidate === "string" && candidate.length > 0
      ? candidate
      : String(candidate ?? "");
  }, [currentUser, userId]);

  useEffect(() => {
    hostingRecordRef.current = hostingRecord;
  }, [hostingRecord]);

  useEffect(() => {
    viewerSessionRef.current = viewerSession;
  }, [viewerSession]);

  useEffect(() => {
    supabaseUserIdRef.current = supabaseUserId;
  }, [supabaseUserId]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    callRoleRef.current = callRole;
  }, [callRole]);

  useEffect(() => {
    return () => {
      const viewer = viewerSessionRef.current;
      if (viewer?.streamId) {
        adjustLivestreamViewerCount(viewer.streamId, -1).catch(() => undefined);
      }

      const host = hostingRecordRef.current;
      const ownerId = supabaseUserIdRef.current;
      if (host?.id && ownerId) {
        endLivestreamRecord(host.id, ownerId).catch(() => undefined);
      }

      const call = activeCallRef.current;
      if (call) {
        call.leave().catch(() => undefined);
      }

      getStreamService.disconnect().catch(() => undefined);
    };
  }, []);

  const loadLivestreams = useCallback(async (showSpinner = false) => {
    try {
      if (showSpinner) {
        setLoadingStreams(true);
      }
      const data = await fetchActiveLivestreams();
      setLivestreams(data);
      setListError(null);
    } catch (error) {
      console.error("Error loading livestreams", error);
      setListError("Unable to load livestreams. Pull to refresh.");
    } finally {
      setLoadingStreams(false);
    }
  }, []);

  const ensureStreamIdentity = useCallback((): StreamIdentity | null => {
    if (!currentUser || !supabaseUserId) {
      return null;
    }

    const profileImage =
      typeof (currentUser as any)?.profileImg === "string"
        ? (currentUser as any).profileImg
        : null;

    return {
      id: supabaseUserId,
      name: displayName || supabaseUserId,
      image: profileImage,
      custom: {
        email:
          (currentUser as unknown as Record<string, unknown>)?.email ?? null,
        username: displayName,
      },
    };
  }, [currentUser, displayName, supabaseUserId]);

  const ensureStreamClient = useCallback(async () => {
    const identity = ensureStreamIdentity();
    if (!identity) {
      throw new Error("Please sign in before joining a livestream.");
    }

    const client = await getStreamService.ensureClient(identity);
    setStreamClient(client);
    return { identity, client };
  }, [ensureStreamIdentity]);

  const resetActiveCallState = useCallback(() => {
    setActiveCall(null);
    setStreamClient(null);
    setCallRole(null);
    setInitializingCall(false);
  }, []);

  const cleanupActiveCall = useCallback(
    async (options: { keepSelection?: boolean } = {}) => {
      const call = activeCallRef.current;
      if (call) {
        try {
          await call.leave();
        } catch (error) {
          console.warn("Failed to leave Stream call", error);
        }
      }

      await getStreamService.disconnect().catch(() => undefined);

      if (!options.keepSelection) {
        setSelectedStream(null);
      }

      resetActiveCallState();
    },
    [resetActiveCallState]
  );

  const handleClose = useCallback(async () => {
    if (activeCallRef.current) {
      await cleanupActiveCall();
    }
    onClose();
  }, [cleanupActiveCall, onClose]);

  const handleStartLivestream = useCallback(async () => {
    if (!currentUser || !supabaseUserId) {
      setErrorMessage("Please sign in before going live.");
      return;
    }

    try {
      setCreatingStream(true);
      setErrorMessage(null);
      setInitializingCall(true);

      const { identity, client } = await ensureStreamClient();

      const callIdentifier = `namzoed-${sanitizeIdentifier(
        identity.id
      )}-${Date.now()}`;

      const call = await getStreamService.createHostCall(
        identity,
        callIdentifier,
        {
          title: liveTitle.trim().length > 0 ? liveTitle.trim() : liveTitle,
        }
      );

      const record = await createLivestreamRecord({
        user_id: supabaseUserId,
        username: displayName,
        profile_image:
          typeof currentUser.profileImg === "string"
            ? currentUser.profileImg
            : typeof currentUser.avatar_url === "string"
            ? currentUser.avatar_url
            : null,
        title: liveTitle,
        description: null,
        stream_provider_id: callIdentifier,
        recording_enabled: recordingEnabled,
        call_id: callIdentifier,
        call_cid: call.cid,
        call_type: "livestream",
        stream_type: streamType,
        external_metadata: {
          playback_mode: "webrtc",
        },
      });

      setLivestreams((prev) => [record, ...prev]);
      setSelectedStream(record);
      setHostingRecord(record);
      setViewerSession(null);
      setActiveCall(call);
      setStreamClient(client);
      setCallRole("host");
      setShowCreateModal(false);
    } catch (error) {
      console.error("Failed to start livestream", error);
      const message =
        error instanceof Error ? error.message : "Unable to start livestream.";
      setErrorMessage(message);
    } finally {
      setCreatingStream(false);
      setInitializingCall(false);
    }
  }, [
    currentUser,
    displayName,
    ensureStreamClient,
    liveTitle,
    recordingEnabled,
    streamType,
    supabaseUserId,
  ]);

  const resolveCallIdentifier = useCallback((stream: Livestream) => {
    if (stream.stream_provider_id) {
      return stream.stream_provider_id;
    }

    const external = stream.external_metadata;
    if (external && typeof external === "object") {
      const key = (external as Record<string, unknown>).call_id;
      if (typeof key === "string" && key.length > 0) {
        return key;
      }
    }

    return null;
  }, []);

  const handleJoinStream = useCallback(
    async (stream: Livestream) => {
      const callId = resolveCallIdentifier(stream);
      if (!callId) {
        setErrorMessage(
          "This livestream is not ready. Please try again later."
        );
        return;
      }

      setJoinLoadingId(stream.id);
      setErrorMessage(null);
      setInitializingCall(true);

      try {
        const { identity, client } = await ensureStreamClient();
        const call = await getStreamService.prepareViewerCall(identity, callId);

        setSelectedStream(stream);
        setViewerSession({ streamId: stream.id });
        setActiveCall(call);
        setStreamClient(client);
        setCallRole("viewer");
        setHostingRecord(null);
      } catch (error) {
        console.error("Failed to join livestream", error);
        const message =
          error instanceof Error ? error.message : "Unable to join livestream.";
        setErrorMessage(message);
      } finally {
        setJoinLoadingId(null);
        setInitializingCall(false);
      }
    },
    [ensureStreamClient, resolveCallIdentifier]
  );

  useEffect(() => {
    if (!selectedStream?.id || callRole !== "viewer" || !activeCall) return;

    // Increment viewer count when joining
    incrementLivestreamViewerCountAtomic(selectedStream.id, 1).catch(() => {});

    return () => {
      // Decrement viewer count when leaving
      incrementLivestreamViewerCountAtomic(selectedStream.id, -1).catch(
        () => {}
      );
    };
  }, [selectedStream?.id, callRole, activeCall?.id]);

  // Stable callback reference for subscription
  const handleLivestreamsChange = useCallback(() => {
    loadLivestreams(false);
  }, [loadLivestreams]);

  useEffect(() => {
    loadLivestreams(true);
    const unsubscribe = subscribeToLivestreams(handleLivestreamsChange);
    return () => {
      unsubscribe();
    };
  }, [loadLivestreams, handleLivestreamsChange]);

  const activeViewerCount = useMemo(() => {
    if (!selectedStream) {
      return 0;
    }
    const updated = livestreams.find((item) => item.id === selectedStream.id);
    return updated?.viewer_count ?? selectedStream.viewer_count ?? 0;
  }, [livestreams, selectedStream]);

  const handleViewerLeave = useCallback(async () => {
    if (viewerSession?.streamId) {
      await adjustLivestreamViewerCount(viewerSession.streamId, -1);
    }

    setViewerSession(null);
    await cleanupActiveCall();
  }, [cleanupActiveCall, viewerSession]);

  const handleHostStreamEnd = useCallback(async () => {
    const hostRecord = hostingRecordRef.current;
    const ownerId = supabaseUserIdRef.current;
    if (!hostRecord?.id || !ownerId) {
      await cleanupActiveCall();
      return;
    }

    setEndingStream(true);
    try {
      const call = activeCallRef.current;
      if (call) {
        try {
          await call.stopLive?.();
        } catch (stopError) {
          console.warn("Unable to stop live broadcast", stopError);
        }
      }

      await endLivestreamRecord(hostRecord.id, ownerId);
      setLivestreams((prev) =>
        prev.filter((item) => item.id !== hostRecord.id)
      );
    } catch (error) {
      console.error("Failed to end livestream", error);
      setErrorMessage("Unable to end livestream. Please try again.");
    } finally {
      setEndingStream(false);
      setHostingRecord(null);
      setViewerSession(null);
      await cleanupActiveCall();
    }
  }, [cleanupActiveCall]);

  const handleLeaveCurrentCall = useCallback(async () => {
    if (callRole === "host") {
      await handleHostStreamEnd();
      return;
    }
    await handleViewerLeave();
  }, [callRole, handleHostStreamEnd, handleViewerLeave]);

  const handleViewerCallStart = useCallback(() => {
    // no-op for now, placeholder for analytics
  }, []);

  const handleHostCallStart = useCallback(() => {
    setLivestreams((prev) => {
      if (!hostingRecordRef.current) {
        return prev;
      }
      return prev.map((item) =>
        item.id === hostingRecordRef.current?.id
          ? { ...item, started_at: new Date().toISOString(), is_active: true }
          : item
      );
    });
  }, []);

  const renderActiveCallScreen = () => {
    if (!selectedStream || !streamClient || !activeCall || !callRole) {
      return (
        <SafeAreaView
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#000",
          }}
        >
          <ActivityIndicator color="#fff" />
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
        <StreamVideo client={streamClient}>
          <StreamCall call={activeCall}>
            <View className="flex-1">
              {callRole === "host" ? (
                <HostCallContainer
                  onEndStream={handleHostStreamEnd}
                  onStartStream={handleHostCallStart}
                  ending={endingStream}
                  livestreamId={selectedStream?.id}
                  hostId={selectedStream?.user_id}
                  currentUserId={supabaseUserId}
                  streamType={
                    (selectedStream as any)?.stream_type ?? "business"
                  }
                />
              ) : callRole === "cohost" ? (
                <HostCallContainer
                  onEndStream={handleViewerLeave}
                  ending={endingStream}
                  livestreamId={selectedStream?.id}
                  hostId={selectedStream?.user_id}
                  currentUserId={supabaseUserId}
                  streamType={
                    (selectedStream as any)?.stream_type ?? "business"
                  }
                />
              ) : (
                <ViewerCallContainer
                  onLeaveStream={handleViewerLeave}
                  onCallJoined={handleViewerCallStart}
                  ending={endingStream}
                  livestreamId={selectedStream?.id}
                  hostId={selectedStream?.user_id}
                  streamType={
                    (selectedStream as any)?.stream_type ?? "business"
                  }
                  onNavigateAway={() => {
                    // Reset state to close the livestream overlay
                    setSelectedStream(null);
                    setActiveCall(null);
                    setCallRole(null);
                    setViewerSession(null);
                  }}
                  onBecomeCoHost={() => setCallRole("cohost")}
                />
              )}

              <ActiveCallHeader
                role={callRole}
                username={selectedStream.username ?? "Live"}
                viewerCount={activeViewerCount}
                livestreamId={selectedStream.id}
                onClose={handleLeaveCurrentCall}
                busy={endingStream || initializingCall}
                profileImage={
                  (selectedStream as any)?.profile_image ??
                  (selectedStream as any)?.thumbnail ??
                  null
                }
                recording={Boolean((selectedStream as any)?.recording)}
                hostId={selectedStream?.user_id}
                onNavigateToProfile={() => {
                  // Reset state to close the livestream overlay
                  setSelectedStream(null);
                  setActiveCall(null);
                  setCallRole(null);
                  setViewerSession(null);
                }}
              />
            </View>
          </StreamCall>
        </StreamVideo>
        {initializingCall && (
          <View className="absolute inset-0 items-center justify-center bg-black/70">
            <ActivityIndicator color="#fff" size="large" />
            <Text className="mt-3 text-sm font-semibold text-white/80">
              Connecting to Stream…
            </Text>
          </View>
        )}
      </SafeAreaView>
    );
  };

  const renderLivestreamCard = ({ item }: { item: Livestream }) => (
    <LivestreamCard
      stream={item}
      onPress={() => handleJoinStream(item)}
      loading={joinLoadingId === item.id}
      disabled={Boolean(joinLoadingId && joinLoadingId !== item.id)}
    />
  );

  const renderListScreen = () => {
    const isCreateDisabled = creatingStream;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }} className="">
        <View
          className="flex-row items-center justify-between px-4"
          style={{ paddingTop: Math.max(12, insets.top) }}
        >
          <Text className="text-xl font-semibold text-gray-900">Live</Text>
          <TouchableOpacity
            onPress={() => setShowCreateModal(true)}
            className={`flex-row items-center rounded-full px-4 py-2 ${
              isCreateDisabled ? "bg-red-200" : "bg-red-500"
            }`}
            disabled={isCreateDisabled}
            activeOpacity={isCreateDisabled ? 1 : 0.8}
          >
            <Radio color={isCreateDisabled ? "#9CA3AF" : "#fff"} size={18} />
            <Text
              className="ml-2 font-semibold"
              style={{ color: isCreateDisabled ? "#9CA3AF" : "#fff" }}
            >
              Create my livestream
            </Text>
          </TouchableOpacity>
          <Pressable onPress={handleClose} className="ml-3">
            <X color="#111" size={22} />
          </Pressable>
        </View>

        {errorMessage && (
          <View className="mx-4 mb-3 rounded-lg bg-red-50 p-3">
            <Text className="text-sm font-medium text-red-600">
              {errorMessage}
            </Text>
            <Text className="mt-1 text-xs text-red-500">
              Please verify your Stream configuration and try again.
            </Text>
          </View>
        )}

        {listError && (
          <View className="mx-4 mb-3 rounded-lg bg-yellow-50 p-3">
            <Text className="text-sm font-medium text-yellow-700">
              {listError}
            </Text>
          </View>
        )}

        <View className="flex-row items-center justify-between px-4 pb-2">
          <Text className="text-base font-semibold text-gray-800">
            Live now
          </Text>
          <Text className="text-xs text-gray-500">
            Updated {new Date().toLocaleTimeString()}
          </Text>
        </View>

        {/* Filter Tabs */}
        <View className="flex-row px-4 mb-3">
          <TouchableOpacity
            onPress={() => setFilterType("all")}
            className={`px-4 py-2 rounded-full mr-2 ${
              filterType === "all" ? "bg-gray-900" : "bg-gray-100"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                filterType === "all" ? "text-white" : "text-gray-600"
              }`}
            >
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterType("business")}
            className={`px-4 py-2 rounded-full mr-2 flex-row items-center ${
              filterType === "business" ? "bg-blue-600" : "bg-blue-50"
            }`}
          >
            <Ionicons
              name="storefront"
              size={14}
              color={filterType === "business" ? "#fff" : "#2563EB"}
            />
            <Text
              className={`text-sm font-medium ml-1.5 ${
                filterType === "business" ? "text-white" : "text-blue-600"
              }`}
            >
              Business
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setFilterType("entertainment")}
            className={`px-4 py-2 rounded-full flex-row items-center ${
              filterType === "entertainment" ? "bg-purple-600" : "bg-purple-50"
            }`}
          >
            <Ionicons
              name="sparkles"
              size={14}
              color={filterType === "entertainment" ? "#fff" : "#9333EA"}
            />
            <Text
              className={`text-sm font-medium ml-1.5 ${
                filterType === "entertainment"
                  ? "text-white"
                  : "text-purple-600"
              }`}
            >
              Entertainment
            </Text>
          </TouchableOpacity>
        </View>

        {loadingStreams ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#DC2626" />
            <Text className="mt-2 text-sm text-gray-500">
              Fetching active livestreams...
            </Text>
          </View>
        ) : (
          (() => {
            const filteredLivestreams =
              filterType === "all"
                ? livestreams
                : livestreams.filter(
                    (stream) => (stream as any)?.stream_type === filterType
                  );

            if (livestreams.length === 0) {
              return (
                <View className="flex-1 items-center justify-center px-6">
                  <Text className="text-base font-semibold text-gray-700">
                    No one is live yet
                  </Text>
                  <Text className="mt-2 text-center text-sm text-gray-500">
                    Be the first to go live with Stream Live Streams.
                  </Text>
                </View>
              );
            }

            if (filteredLivestreams.length === 0) {
              return (
                <View className="flex-1 items-center justify-center px-6">
                  <Ionicons
                    name={filterType === "business" ? "storefront" : "sparkles"}
                    size={48}
                    color={filterType === "business" ? "#2563EB" : "#9333EA"}
                  />
                  <Text className="text-base font-semibold text-gray-700 mt-4">
                    No {filterType} streams live
                  </Text>
                  <Text className="mt-2 text-center text-sm text-gray-500">
                    Check back later or browse other categories.
                  </Text>
                  <TouchableOpacity
                    onPress={() => setFilterType("all")}
                    className="mt-4 bg-gray-100 px-4 py-2 rounded-full"
                  >
                    <Text className="text-gray-700 font-medium">Show All</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            return (
              <FlatList
                data={filteredLivestreams}
                keyExtractor={(item) => item.id}
                renderItem={renderLivestreamCard}
                numColumns={2}
                columnWrapperStyle={{
                  paddingHorizontal: 16,
                  gap: 12,
                  marginBottom: 12,
                }}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={async () => {
                      setRefreshing(true);
                      await loadLivestreams(false);
                      setRefreshing(false);
                    }}
                    tintColor="#DC2626"
                  />
                }
              />
            );
          })()
        )}

        <CreateLivestreamModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onConfirm={handleStartLivestream}
          title={liveTitle}
          onTitleChange={setLiveTitle}
          recordingEnabled={recordingEnabled}
          onToggleRecording={setRecordingEnabled}
          loading={creatingStream}
          streamType={streamType}
          onStreamTypeChange={setStreamType}
        />
      </SafeAreaView>
    );
  };

  return selectedStream && activeCall
    ? renderActiveCallScreen()
    : renderListScreen();
};

interface LivestreamCardProps {
  stream: Livestream;
  onPress: () => void;
  loading: boolean;
  disabled?: boolean;
}

const LivestreamCard: React.FC<LivestreamCardProps> = ({
  stream,
  onPress,
  loading,
  disabled = false,
}) => {
  const viewerCount = stream.viewer_count || 0;
  const thumbnail = stream.thumbnail || FALLBACK_THUMBNAIL;

  return (
    <TouchableOpacity
      className="relative w-[48%] overflow-hidden rounded-3xl"
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.8}
    >
      <ImageBackground
        source={{ uri: thumbnail }}
        style={{ height: 220, justifyContent: "flex-end" }}
      >
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={{ padding: 16 }}
        >
          <View className="mb-2 flex-row items-center">
            <View className="mr-2 h-2 w-2 rounded-full bg-red-500" />
            <Text className="text-xs font-semibold text-white">LIVE</Text>
            {(stream as any)?.stream_type === "business" && (
              <View className="ml-2 bg-blue-500/80 px-2 py-0.5 rounded-sm flex-row items-center">
                <Ionicons name="storefront" size={10} color="#fff" />
                <Text className="text-[10px] text-white ml-1 font-medium">
                  SHOP
                </Text>
              </View>
            )}
            {(stream as any)?.stream_type === "entertainment" && (
              <View className="ml-2 bg-purple-500/80 px-2 py-0.5 rounded-sm flex-row items-center">
                <Ionicons name="sparkles" size={10} color="#fff" />
                <Text className="text-[10px] text-white ml-1 font-medium">
                  FUN
                </Text>
              </View>
            )}
          </View>
          <Text className="text-base font-semibold text-white">
            {stream.title || stream.username || "Namzoed"}
          </Text>
          <Text className="mt-1 text-xs text-white/80">
            {viewerCount} watching
          </Text>
        </LinearGradient>
      </ImageBackground>
      {loading && (
        <View className="absolute inset-0 items-center justify-center bg-black/40">
          <ActivityIndicator color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
};

interface CreateLivestreamModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  onTitleChange: (value: string) => void;
  recordingEnabled: boolean;
  onToggleRecording: (value: boolean) => void;
  loading: boolean;
  streamType: LivestreamType;
  onStreamTypeChange: (type: LivestreamType) => void;
}

const CreateLivestreamModal: React.FC<CreateLivestreamModalProps> = ({
  visible,
  onClose,
  onConfirm,
  title,
  onTitleChange,
  recordingEnabled,
  onToggleRecording,
  loading,
  streamType,
  onStreamTypeChange,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView
        edges={["bottom"]}
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      >
        <View
          style={{
            paddingBottom: Math.max(16, insets.bottom + 8),
          }}
        >
          <View className="rounded-t-3xl bg-white px-6 pb-8 pt-6">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-gray-900">
                Create livestream
              </Text>
              <Pressable onPress={onClose}>
                <X color="#111" size={22} />
              </Pressable>
            </View>

            {/* Stream Type Selection */}
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Choose stream type
            </Text>
            <View className="flex-row mb-4">
              <TouchableOpacity
                onPress={() => onStreamTypeChange("business")}
                className={`flex-1 py-3 mr-2 rounded-xl items-center ${
                  streamType === "business" ? "bg-blue-500" : "bg-gray-100"
                }`}
              >
                <Ionicons
                  name="storefront-outline"
                  size={20}
                  color={streamType === "business" ? "#fff" : "#6B7280"}
                />
                <Text
                  className={`text-sm font-medium mt-1 ${
                    streamType === "business" ? "text-white" : "text-gray-600"
                  }`}
                >
                  Business
                </Text>
                <Text
                  className={`text-xs ${
                    streamType === "business"
                      ? "text-white/80"
                      : "text-gray-400"
                  }`}
                >
                  Showcase products
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onStreamTypeChange("entertainment")}
                className={`flex-1 py-3 ml-2 rounded-xl items-center ${
                  streamType === "entertainment"
                    ? "bg-purple-500"
                    : "bg-gray-100"
                }`}
              >
                <Ionicons
                  name="sparkles-outline"
                  size={20}
                  color={streamType === "entertainment" ? "#fff" : "#6B7280"}
                />
                <Text
                  className={`text-sm font-medium mt-1 ${
                    streamType === "entertainment"
                      ? "text-white"
                      : "text-gray-600"
                  }`}
                >
                  Entertainment
                </Text>
                <Text
                  className={`text-xs ${
                    streamType === "entertainment"
                      ? "text-white/80"
                      : "text-gray-400"
                  }`}
                >
                  Just go live
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="text-sm text-gray-600">
              {streamType === "business"
                ? "Share your products with viewers while streaming."
                : "Go live for entertainment - no products will be shown."}
            </Text>
            <TextInput
              value={title}
              onChangeText={onTitleChange}
              placeholder="Describe what you will stream..."
              className="mt-4 rounded-2xl border border-gray-200 px-4 py-3 text-base text-gray-900"
              placeholderTextColor="#9CA3AF"
              maxLength={80}
            />

            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading}
              className={`mt-6 items-center rounded-full py-3 ${
                streamType === "business" ? "bg-blue-500" : "bg-purple-500"
              }`}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  Start{" "}
                  {streamType === "business" ? "Business" : "Entertainment"}{" "}
                  Stream
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

interface ActiveCallHeaderProps {
  role: Exclude<ActiveCallRole, null>;
  username: string;
  viewerCount: number;
  livestreamId?: string | null;
  onClose: () => void | Promise<void>;
  busy?: boolean;
  profileImage?: string | null;
  recording?: boolean;
  hostId?: string | null;
  onNavigateToProfile?: () => void;
}

const ActiveCallHeader: React.FC<ActiveCallHeaderProps> = ({
  role,
  username,
  viewerCount: initialViewerCount,
  livestreamId,
  onClose,
  busy = false,
  profileImage,
  recording = false,
  hostId,
  onNavigateToProfile,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [viewerCount, setViewerCount] = useState(initialViewerCount);

  // Real-time viewer count subscription
  useEffect(() => {
    setViewerCount(initialViewerCount);
  }, [initialViewerCount]);

  useEffect(() => {
    if (!livestreamId) return;

    const unsubscribe = subscribeToViewerCount(livestreamId, (count) => {
      setViewerCount(count);
    });

    return () => {
      unsubscribe();
    };
  }, [livestreamId]);

  const handleAvatarPress = () => {
    if (hostId) {
      // Navigate to profile first, then close the stream overlay
      router.push(`/(users)/profile/${hostId}` as any);
      // Call the callback to close the livestream overlay
      if (onNavigateToProfile) {
        onNavigateToProfile();
      }
    }
  };

  return (
    <View
      className="absolute inset-x-0 top-0 flex-row items-center justify-between px-4"
      style={{ paddingTop: Math.max(12, insets.top) }}
    >
      <TouchableOpacity
        onPress={handleAvatarPress}
        activeOpacity={0.8}
        className="flex-row items-center rounded-full bg-black/30 px-3 py-1"
      >
        {profileImage ? (
          <Image
            source={{ uri: profileImage }}
            style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }}
          />
        ) : (
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.2)",
              marginRight: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
              {username?.charAt(0)?.toUpperCase() || "?"}
            </Text>
          </View>
        )}

        <View>
          <Text className="text-sm font-semibold text-white">{username}</Text>
          {recording && (
            <View className="mt-1 flex-row items-center">
              <View className="h-2 w-2 rounded-full bg-red-500 mr-2" />
              <Text className="text-xs text-white/90">Live</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <View className="flex-row items-center space-x-3">
        <View className="rounded-full bg-black/50 px-3 py-1">
          <Text className="text-xs font-semibold text-white">
            {viewerCount} watching
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          className={`flex-row items-center rounded-full px-3 py-1 ${
            role === "host" ? "bg-red-500" : "bg-white/20"
          }`}
          disabled={busy}
          activeOpacity={busy ? 1 : 0.85}
        >
          <Text className={`mr-2 text-xs font-semibold text-white`}>
            {role === "host" ? "End" : "Leave"}
          </Text>
          <X color="#fff" size={18} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface HostCallContainerProps {
  onEndStream: () => void | Promise<void>;
  onStartStream?: () => void | Promise<void>;
  ending: boolean;
  livestreamId?: string | null;
  hostId?: string | null;
  currentUserId?: string | null;
  streamType?: LivestreamType | null;
}

const HostCallContainer: React.FC<HostCallContainerProps> = ({
  onStartStream,
  onEndStream,
  livestreamId,
  hostId,
  currentUserId,
  streamType = "business",
}) => {
  const call = useCall();
  const { useCameraState, useMicrophoneState, useParticipants } =
    useCallStateHooks();
  const participants = useParticipants();

  const { camera, isMute: isCameraMuted, direction } = useCameraState();
  const { microphone, isMute: isMicMuted } = useMicrophoneState();

  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [myProducts, setMyProducts] = useState<any[]>([]);
  const [sharedProducts, setSharedProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productPanelExpanded, setProductPanelExpanded] = useState(false);

  // Co-host request states
  const [pendingRequests, setPendingRequests] = useState<CoHostRequest[]>([]);
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const previousRequestCountRef = useRef(0);
  const [acceptedCoHostIds, setAcceptedCoHostIds] = useState<string[]>([]);

  const ensureCameraPermission = useCallback(async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera Permission Needed",
        "Please enable camera access to use live video."
      );
      return false;
    }
    return true;
  }, []);

  // --- ANIMATION LOGIC ---
  const [isFullWidth, setIsFullWidth] = useState(false);
  const layoutAnim = useSharedValue(0); // 0 = split, 1 = full

  const toggleLayout = () => {
    const nextValue = isFullWidth ? 0 : 1;
    layoutAnim.value = withSpring(nextValue, {
      damping: 15,
      stiffness: 90,
    });
    setIsFullWidth(!isFullWidth);
  };

  const animatedVideoStyle = useAnimatedStyle<ViewStyle>(() => ({
    width: `${interpolate(layoutAnim.value, [0, 1], [50, 100], "clamp")}%`,
  }));

  const animatedChatStyle = useAnimatedStyle<ViewStyle>(() => ({
    width: `${interpolate(layoutAnim.value, [0, 1], [50, 100], "clamp")}%`,
    position:
      layoutAnim.value > 0.5 ? ("absolute" as const) : ("relative" as const),
    right: 0,
    height: "100%",
    zIndex: 50,
  }));

  // --- STREAM LOGIC ---
  useEffect(() => {
    if (!call) return;
    const joinCall = async () => {
      try {
        if (call.state.callingState === "idle") {
          await call.join({ create: true });
        }
      } catch (err) {
        console.error("Host join failed", err);
      }
    };
    joinCall();

    const sub = call.state.backstage$.subscribe((bg) => setIsLive(!bg));
    return () => sub.unsubscribe();
  }, [call?.id]);

  // Fetch and subscribe to co-host requests
  useEffect(() => {
    if (!livestreamId) return;

    const fetchRequests = async () => {
      try {
        const requests = await fetchPendingCoHostRequests(livestreamId);

        // Auto-open modal if new request arrives (and host is present)
        if (
          String(currentUserId) === String(hostId) &&
          requests.length > previousRequestCountRef.current
        ) {
          setShowRequestsModal(true);
        }

        previousRequestCountRef.current = requests.length;
        setPendingRequests(requests);
      } catch (error) {
        console.error("Error fetching co-host requests:", error);
      }
    };

    fetchRequests();

    const unsubscribe = subscribeToCoHostRequests(livestreamId, () => {
      fetchRequests();
    });

    return () => {
      unsubscribe();
    };
  }, [livestreamId, currentUserId, hostId]);

  // Subscribe to accepted co-hosts from database
  useEffect(() => {
    if (!livestreamId) return;

    const fetchAcceptedCoHosts = async () => {
      const { data } = await supabase
        .from("cohost_requests")
        .select("user_id")
        .eq("livestream_id", livestreamId)
        .eq("status", "accepted");

      if (data) {
        setAcceptedCoHostIds(data.map((r) => r.user_id));
      }
    };

    fetchAcceptedCoHosts();

    // Subscribe to changes
    const channel = supabase
      .channel(`accepted-cohosts-${livestreamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cohost_requests",
          filter: `livestream_id=eq.${livestreamId}`,
        },
        () => {
          fetchAcceptedCoHosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [livestreamId]);

  const handleAcceptCoHost = async (request: CoHostRequest) => {
    try {
      // Update status in database first
      await updateCoHostRequestStatus(request.id, "accepted");
      await addCoHostToLivestream(livestreamId!, request.user_id);

      // Grant speaking permissions to the co-host using Stream SDK
      if (call) {
        try {
          // Update user capabilities to allow them to publish audio/video
          await call.updateUserPermissions({
            user_id: request.user_id,
            grant_permissions: ["send-audio", "send-video", "screenshare"],
          });
          console.log(`Granted speaking permissions to ${request.username}`);
        } catch (permError) {
          console.warn("Could not grant permissions via SDK:", permError);
          // Continue anyway - the viewer side will try to enable camera/mic
        }
      }

      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (error) {
      console.error("Error accepting co-host:", error);
    }
  };

  const handleRejectCoHost = async (request: CoHostRequest) => {
    try {
      await updateCoHostRequestStatus(request.id, "rejected");
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (error) {
      console.error("Error rejecting co-host:", error);
    }
  };

  // Get co-host participants (not including the main host)
  // Include users who are accepted co-hosts OR are publishing audio/video
  const coHostParticipants = participants.filter(
    (p) =>
      p.userId !== hostId &&
      p.userId !== call?.state.localParticipant?.userId &&
      (acceptedCoHostIds.includes(p.userId ?? "") ||
        (p.roles ?? []).includes("host") ||
        (p.roles ?? []).includes("admin") ||
        (p.publishedTracks && p.publishedTracks.length > 0) ||
        p.audioStream ||
        p.videoStream)
  );

  const handleToggleLive = () => {
    if (isLive) setShowEndConfirm(true);
    else setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    if (countdown === 0) {
      call
        ?.goLive()
        .then(() => {
          onStartStream?.();
          setCountdown(null);
        })
        .catch(console.error);
    }
  }, [countdown]);

  // Fetch host's products
  useEffect(() => {
    if (!currentUserId) return;
    const fetchMyProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching host products:", error);
        return;
      }
      setMyProducts(data || []);
    };
    void fetchMyProducts();
  }, [currentUserId]);

  // Fetch shared products for this stream
  const fetchSharedProducts = useCallback(async () => {
    if (!livestreamId) return;
    const { data, error } = await supabase
      .from("stream_products")
      .select("*")
      .eq("live_stream_id", livestreamId)
      .order("display_order", { ascending: true });
    if (error) {
      console.error("Error fetching stream products:", error);
      return;
    }

    const rows = data || [];
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
  }, [livestreamId]);

  useEffect(() => {
    void fetchSharedProducts();
    if (!livestreamId) return;
    const channel = supabase
      .channel(`stream-products-${livestreamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "stream_products",
          filter: `live_stream_id=eq.${livestreamId}`,
        },
        async () => {
          await fetchSharedProducts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "stream_products",
          filter: `live_stream_id=eq.${livestreamId}`,
        },
        async () => {
          await fetchSharedProducts();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "stream_products",
          filter: `live_stream_id=eq.${livestreamId}`,
        },
        async () => {
          await fetchSharedProducts();
        }
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
  }, [livestreamId, fetchSharedProducts]);

  const toggleShareProduct = async (product: any) => {
    if (!livestreamId) return;
    const existing = sharedProducts.find(
      (s) =>
        String(s.product_id) === String(product.id) ||
        String(s.product?.id) === String(product.id)
    );
    if (existing) {
      await supabase
        .from("stream_products")
        .delete()
        .match({
          live_stream_id: livestreamId,
          product_id: existing.product_id || product.id,
        });
      setSharedProducts((prev) =>
        prev.filter((p) => String(p.product_id) !== String(product.id))
      );
    } else {
      await supabase
        .from("stream_products")
        .insert({ live_stream_id: livestreamId, product_id: product.id });
      setSharedProducts((prev) => [
        { product_id: product.id, product },
        ...prev,
      ]);
    }
  };

  const confirmEnd = async () => {
    setShowEndConfirm(false);
    try {
      await call?.stopLive();
      await onEndStream?.();
    } catch (error) {
      console.error("Stop Live Failed:", error);
    }
  };

  const collapsedHostPreview = myProducts.slice(0, 3);
  const displayedHostProducts = productPanelExpanded
    ? myProducts
    : collapsedHostPreview;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-black"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* End Stream Modal */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1">
          <Modal visible={showEndConfirm} transparent animationType="fade">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>End Livestream?</Text>
                <Text style={styles.modalSub}>
                  Are you sure you want to end the livestream?
                </Text>
                <View className="flex-row justify-end mt-4">
                  <TouchableOpacity
                    onPress={() => setShowEndConfirm(false)}
                    style={styles.btnCancel}
                  >
                    <Text>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmEnd} style={styles.btnEnd}>
                    <Text className="text-white font-bold">End Stream</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Product Details Modal for Host */}
          <Modal visible={!!selectedProduct} transparent animationType="slide">
            <View
              style={{
                flex: 1,
                backgroundColor: "rgba(0,0,0,0.6)",
                justifyContent: "center",
                padding: 20,
              }}
            >
              <View
                style={{
                  backgroundColor: "#111",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                {selectedProduct && (
                  <>
                    <Image
                      source={{
                        uri:
                          selectedProduct.image_url ||
                          selectedProduct.image ||
                          selectedProduct.thumbnail ||
                          selectedProduct.images?.[0] ||
                          "https://picsum.photos/320/220",
                      }}
                      style={{ width: "100%", height: 200, borderRadius: 8 }}
                    />
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 16,
                        fontWeight: "700",
                        marginTop: 10,
                      }}
                    >
                      {selectedProduct.name || selectedProduct.title}
                    </Text>
                    <Text style={{ color: "#fff", marginTop: 6 }}>
                      {selectedProduct.description || ""}
                    </Text>
                    <Text style={{ color: "#fff", marginTop: 8, fontSize: 15 }}>
                      {selectedProduct.price
                        ? `Nu ${selectedProduct.price}`
                        : ""}{" "}
                      {selectedProduct.is_discount_active
                        ? ` • ${selectedProduct.discount_percent}% off`
                        : ""}
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "flex-end",
                        marginTop: 14,
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => setSelectedProduct(null)}
                        style={{
                          marginRight: 12,
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          backgroundColor: "#374151",
                        }}
                      >
                        <Text style={{ color: "#fff" }}>Close</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={async () => {
                          try {
                            await toggleShareProduct(selectedProduct);
                          } catch (e) {
                            console.error(e);
                          }
                          // keep modal open briefly then close
                          setTimeout(() => setSelectedProduct(null), 250);
                        }}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          backgroundColor: "#DC2626",
                        }}
                      >
                        <Text style={{ color: "#fff", fontWeight: "700" }}>
                          {sharedProducts.some(
                            (s) =>
                              String(s.product_id) ===
                              String(selectedProduct?.id)
                          )
                            ? "Unshare"
                            : "Share"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>

          {/* TOP SECTION: 70% HEIGHT */}
          <View style={{ height: "70%", flexDirection: "row" }}>
            {/* VIDEO COLUMN */}
            <Animated.View
              style={[
                animatedVideoStyle,
                { backgroundColor: "#111", overflow: "hidden" },
              ]}
            >
              {/* Multi-participant grid layout - TikTok style */}
              {coHostParticipants.length > 0 ? (
                <View
                  style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}
                >
                  {/* Calculate grid based on number of participants (host + co-hosts) */}
                  {(() => {
                    const totalParticipants =
                      (call?.state.localParticipant ? 1 : 0) +
                      coHostParticipants.length;
                    let gridCols = 1;
                    let gridRows = 1;

                    if (totalParticipants === 1) {
                      gridCols = 1;
                      gridRows = 1;
                    } else if (totalParticipants === 2) {
                      gridCols = 2;
                      gridRows = 1;
                    } else if (totalParticipants <= 4) {
                      gridCols = 2;
                      gridRows = 2;
                    } else if (totalParticipants <= 6) {
                      gridCols = 3;
                      gridRows = 2;
                    } else if (totalParticipants <= 9) {
                      gridCols = 3;
                      gridRows = 3;
                    }

                    const cellWidth = 100 / gridCols;
                    const cellHeight = 100 / gridRows;

                    return (
                      <>
                        {/* Main host video */}
                        {call?.state.localParticipant && (
                          <View
                            style={{
                              width: `${cellWidth}%`,
                              height: `${cellHeight}%`,
                              borderWidth: 1,
                              borderColor: "#222",
                            }}
                          >
                            <ParticipantView
                              participant={call.state.localParticipant}
                              style={{ flex: 1 }}
                              objectFit="cover"
                              ParticipantLabel={null}
                              ParticipantNetworkQualityIndicator={null}
                            />
                            <View className="absolute bottom-1 left-1 bg-black/60 px-2 py-1 rounded-full">
                              <Text className="text-white text-xs font-semibold">
                                Host
                              </Text>
                            </View>
                          </View>
                        )}
                        {/* Co-host videos - up to 8 (limiting total to 9) */}
                        {coHostParticipants.slice(0, 8).map((coHost) => (
                          <View
                            key={coHost.sessionId}
                            style={{
                              width: `${cellWidth}%`,
                              height: `${cellHeight}%`,
                              borderWidth: 1,
                              borderColor: "#222",
                            }}
                          >
                            <ParticipantView
                              participant={coHost}
                              style={{ flex: 1 }}
                              objectFit="cover"
                              ParticipantLabel={null}
                              ParticipantNetworkQualityIndicator={null}
                            />
                            <View className="absolute bottom-1 left-1 bg-purple-500/80 px-1.5 py-0.5 rounded">
                              <Text className="text-white text-xs font-semibold">
                                Co-host
                              </Text>
                            </View>
                          </View>
                        ))}
                      </>
                    );
                  })()}
                </View>
              ) : (
                <>
                  {call?.state.localParticipant && (
                    <ParticipantView
                      participant={call.state.localParticipant}
                      style={{ flex: 1 }}
                      objectFit="cover"
                      ParticipantLabel={null}
                      ParticipantNetworkQualityIndicator={null}
                    />
                  )}
                </>
              )}

              {/* Toggle Button */}
              <TouchableOpacity
                onPress={toggleLayout}
                activeOpacity={0.7}
                style={styles.toggleBtn}
                className="bg-black/50 p-2 rounded-full border border-white/20"
              >
                <Ionicons
                  name={isFullWidth ? "contract" : "expand"}
                  size={20}
                  color="white"
                />
              </TouchableOpacity>

              {/* Co-host Requests Badge */}
              {pendingRequests.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShowRequestsModal(true)}
                  className="absolute top-3 right-3 bg-purple-500 px-3 py-2 rounded-full flex-row items-center"
                >
                  <Ionicons name="people" size={16} color="#fff" />
                  <Text className="text-white text-xs font-semibold ml-1">
                    {pendingRequests.length} request
                    {pendingRequests.length > 1 ? "s" : ""}
                  </Text>
                </TouchableOpacity>
              )}

              {countdown !== null && (
                <View className="absolute inset-0 items-center justify-center bg-black/40">
                  <Text className="text-white text-6xl font-bold italic">
                    {countdown > 0 ? countdown : "GO!"}
                  </Text>
                </View>
              )}
            </Animated.View>

            {/* CHAT COLUMN / OVERLAY */}
            <Animated.View
              style={animatedChatStyle}
              pointerEvents={isFullWidth ? "box-none" : "auto"}
            >
              <View
                className="flex-1"
                style={{
                  backgroundColor: isFullWidth ? "transparent" : "#1a1a1a",
                  width: isFullWidth ? "90%" : "auto",
                }}
              >
                <LiveChat
                  liveStreamId={livestreamId}
                  hostId={hostId}
                  isHostView={true}
                />
              </View>
            </Animated.View>
          </View>

          {/* Co-host Requests Modal */}
          <Modal visible={showRequestsModal} transparent animationType="slide">
            <View className="flex-1 justify-end bg-black/50">
              <View className="bg-white rounded-t-3xl p-6 max-h-[60%]">
                <View className="flex-row items-center justify-between mb-4">
                  <Text className="text-lg font-semibold text-gray-900">
                    Join Requests ({pendingRequests.length})
                  </Text>
                  <Pressable onPress={() => setShowRequestsModal(false)}>
                    <X color="#111" size={22} />
                  </Pressable>
                </View>
                <FlatList
                  data={pendingRequests}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <View className="flex-row items-center py-3 border-b border-gray-100">
                      {item.profile_image ? (
                        <Image
                          source={{ uri: item.profile_image }}
                          style={{ width: 44, height: 44, borderRadius: 22 }}
                        />
                      ) : (
                        <View className="w-11 h-11 rounded-full bg-gray-200 items-center justify-center">
                          <Text className="text-gray-600 font-semibold">
                            {item.username?.charAt(0)?.toUpperCase() || "?"}
                          </Text>
                        </View>
                      )}
                      <View className="flex-1 ml-3">
                        <Text className="font-semibold text-gray-900">
                          {item.username}
                        </Text>
                        <Text className="text-xs text-gray-500">
                          Wants to join as co-host
                        </Text>
                      </View>
                      <View className="flex-row">
                        <TouchableOpacity
                          onPress={() => handleRejectCoHost(item)}
                          className="bg-gray-200 px-4 py-2 rounded-full mr-2"
                        >
                          <Text className="text-gray-700 font-medium">
                            Decline
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleAcceptCoHost(item)}
                          className="bg-purple-500 px-4 py-2 rounded-full"
                        >
                          <Text className="text-white font-medium">Accept</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                  ListEmptyComponent={
                    <View className="py-8 items-center">
                      <Ionicons
                        name="people-outline"
                        size={48}
                        color="#9CA3AF"
                      />
                      <Text className="text-gray-500 mt-2">
                        No pending requests
                      </Text>
                    </View>
                  }
                />
              </View>
            </View>
          </Modal>

          {/* BOTTOM SECTION: 30% HEIGHT */}
          <View
            style={{ height: streamType === "business" ? "30%" : "auto" }}
            className="p-4 justify-between bg-black"
          >
            <View
              className={
                streamType === "business" ? "flex-1 justify-center" : ""
              }
            >
              {
                streamType === "business" &&
                currentUserId &&
                String(currentUserId) === String(hostId) ? (
                  // Host: show their products as stacked expandable cards (Business only)
                  <View>
                    {myProducts.length === 0 ? (
                      <Text className="text-white/50 text-center">
                        No products found
                      </Text>
                    ) : (
                      <View>
                        {/* Stacked Cards Header with expand/collapse */}
                        <TouchableOpacity
                          onPress={() =>
                            setProductPanelExpanded(!productPanelExpanded)
                          }
                          className="flex-row items-center justify-between mb-3 px-2"
                        >
                          <View className="flex-row items-center">
                            <Text className="text-white font-semibold text-sm">
                              Your Products ({myProducts.length})
                            </Text>
                            <View className="ml-2 bg-red-500 px-2 py-0.5 rounded-full">
                              <Text className="text-white text-xs font-bold">
                                {sharedProducts.length} shared
                              </Text>
                            </View>
                          </View>
                          {productPanelExpanded ? (
                            <ChevronDown color="#fff" size={20} />
                          ) : (
                            <ChevronUp color="#fff" size={20} />
                          )}
                        </TouchableOpacity>

                        {/* Stacked Card Preview (collapsed) */}
                        {!productPanelExpanded && myProducts.length > 0 && (
                          <View className="relative h-24 mx-2">
                            {myProducts.slice(0, 3).map((item, index) => {
                              const isShared = sharedProducts.some(
                                (s) =>
                                  String(s.product_id) === String(item.id) ||
                                  String(s.product?.id) === String(item.id)
                              );
                              return (
                                <TouchableOpacity
                                  key={item.id}
                                  onPress={() => setProductPanelExpanded(true)}
                                  activeOpacity={0.9}
                                  style={{
                                    position: "absolute",
                                    left: index * 20,
                                    top: index * 4,
                                    zIndex: 3 - index,
                                    transform: [
                                      { rotate: `${(index - 1) * 3}deg` },
                                    ],
                                  }}
                                >
                                  <View
                                    style={[
                                      hostStyles.stackedCard,
                                      isShared && hostStyles.stackedCardShared,
                                    ]}
                                  >
                                    <Image
                                      source={{
                                        uri:
                                          item.image_url ||
                                          item.image ||
                                          item.thumbnail ||
                                          item.images?.[0] ||
                                          "https://picsum.photos/160/120",
                                      }}
                                      style={hostStyles.stackedImage}
                                    />
                                    {isShared && (
                                      <View className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                                        <Eye color="#fff" size={10} />
                                      </View>
                                    )}
                                  </View>
                                </TouchableOpacity>
                              );
                            })}
                            {myProducts.length > 3 && (
                              <View
                                style={{
                                  position: "absolute",
                                  right: 10,
                                  top: "50%",
                                  transform: [{ translateY: -12 }],
                                }}
                              >
                                <Text className="text-white/70 text-sm">
                                  +{myProducts.length - 3} more
                                </Text>
                              </View>
                            )}
                          </View>
                        )}

                        {/* Expanded Product List */}
                        {productPanelExpanded && (
                          <FlatList
                            horizontal
                            data={myProducts}
                            keyExtractor={(item) => item.id}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ paddingHorizontal: 8 }}
                            renderItem={({ item, index }) => {
                              const isShared = sharedProducts.some(
                                (s) =>
                                  String(s.product_id) === String(item.id) ||
                                  String(s.product?.id) === String(item.id)
                              );
                              return (
                                <TouchableOpacity
                                  onPress={() => setSelectedProduct(item)}
                                  activeOpacity={0.9}
                                >
                                  <View
                                    style={[
                                      hostStyles.productCard,
                                      isShared && hostStyles.productCardShared,
                                    ]}
                                  >
                                    <View className="relative">
                                      <Image
                                        source={{
                                          uri:
                                            item.image_url ||
                                            item.image ||
                                            item.thumbnail ||
                                            item.images?.[0] ||
                                            "https://picsum.photos/160/120",
                                        }}
                                        style={hostStyles.productImage}
                                      />
                                      {isShared && (
                                        <View className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                                          <Check color="#fff" size={12} />
                                        </View>
                                      )}
                                    </View>
                                    <Text
                                      style={hostStyles.productName}
                                      numberOfLines={1}
                                    >
                                      {item.name || item.title}
                                    </Text>
                                    <Text style={hostStyles.productPrice}>
                                      {item.price ? `Nu ${item.price}` : ""}{" "}
                                      {item.discount
                                        ? ` • ${item.discount}% off`
                                        : ""}
                                    </Text>
                                    <TouchableOpacity
                                      onPress={() => toggleShareProduct(item)}
                                      style={[
                                        hostStyles.shareBtn,
                                        isShared && hostStyles.shareBtnActive,
                                      ]}
                                    >
                                      <Text style={hostStyles.shareBtnText}>
                                        {isShared ? "Unshare" : "Share"}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </TouchableOpacity>
                              );
                            }}
                          />
                        )}
                      </View>
                    )}
                  </View>
                ) : streamType === "entertainment" ? null : null // Entertainment mode - no products
              }
            </View>

            <View className="flex-row items-center justify-around bg-zinc-900 rounded-2xl px-4 py-4 mb-4">
              <TouchableOpacity
                onPress={async () => {
                  if (isCameraMuted) {
                    const cameraGranted = await ensureCameraPermission();
                    if (!cameraGranted) return;
                  }
                  camera.toggle();
                }}
                className={`p-3 rounded-full ${
                  isCameraMuted ? "bg-zinc-700" : "bg-zinc-600"
                }`}
              >
                <Ionicons
                  name={isCameraMuted ? "videocam-off" : "videocam"}
                  size={24}
                  color={isCameraMuted ? "#9CA3AF" : "#fff"}
                />
              </TouchableOpacity>

              <TouchableOpacity
                disabled={isCameraMuted}
                onPress={async () => {
                  if (isCameraMuted) return;
                  const cameraGranted = await ensureCameraPermission();
                  if (!cameraGranted) return;
                  try {
                    await camera.flip();
                  } catch (error) {
                    console.warn("Failed to switch camera:", error);
                  }
                }}
                className={`p-3 rounded-full ${
                  isCameraMuted ? "bg-zinc-700" : "bg-zinc-600"
                }`}
              >
                <Ionicons
                  name="camera-reverse"
                  size={24}
                  color={
                    isCameraMuted
                      ? "#9CA3AF"
                      : direction === "back"
                        ? "#ef4444"
                        : "#fff"
                  }
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleToggleLive}
                disabled={countdown !== null}
                className={`${
                  isLive ? "bg-zinc-700" : "bg-red-600"
                } p-4 rounded-full`}
              >
                <Ionicons
                  name={isLive ? "stop" : "radio"}
                  size={28}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => microphone.toggle()}
                className={`p-3 rounded-full ${
                  isMicMuted ? "bg-zinc-700" : "bg-zinc-600"
                }`}
              >
                <Ionicons
                  name={isMicMuted ? "mic-off" : "mic"}
                  size={24}
                  color={isMicMuted ? "#9CA3AF" : "#fff"}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  toggleBtn: {
    position: "absolute",
    bottom: 16,
    right: 16,
    zIndex: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111" },
  modalSub: { marginTop: 8, color: "#4b5563", lineHeight: 20 },
  btnCancel: {
    marginRight: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  btnEnd: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#ef4444",
    borderRadius: 8,
  },
});
const hostStyles = StyleSheet.create({
  stackedCard: {
    width: 100,
    height: 80,
    backgroundColor: "rgba(40,40,40,0.95)",
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
  },
  stackedCardShared: {
    borderColor: "rgba(34,197,94,0.6)",
  },
  stackedImage: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  productCard: {
    width: 140,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 10,
    marginRight: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  productCardShared: {
    borderColor: "rgba(34,197,94,0.6)",
    backgroundColor: "rgba(34,197,94,0.1)",
  },
  productImage: {
    width: 120,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#222",
  },
  productName: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  productPrice: {
    color: "#fff",
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
  shareBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  shareBtnActive: {
    backgroundColor: "rgba(239,68,68,0.9)",
  },
  shareBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  viewerSharedCard: {
    width: 160,
    marginRight: 10,
    alignItems: "center",
  },
  viewerSharedImage: {
    width: 140,
    height: 90,
    borderRadius: 8,
  },
  viewerSharedTitle: {
    color: "#fff",
    marginTop: 6,
  },
});
interface ViewerCallContainerProps {
  onLeaveStream: () => void | Promise<void>;
  onCallJoined?: () => void | Promise<void>;
  ending: boolean;
  livestreamId?: string | null;
  hostId?: string | null;
  onNavigateAway?: () => void;
  streamType?: LivestreamType | null;
  onBecomeCoHost?: () => void;
}

const ViewerCallContainer: React.FC<ViewerCallContainerProps> = ({
  onLeaveStream,
  onCallJoined,
  ending,
  livestreamId,
  hostId,
  onNavigateAway,
  streamType = "business",
  onBecomeCoHost,
}) => {
  const call = useCall();
  const router = useRouter();
  const { currentUser } = useUser();
  const { useParticipants, useCallCallingState } = useCallStateHooks();
  const participants = useParticipants();
  const callingState = useCallCallingState();

  const [isLive, setIsLive] = useState(false);
  const [hostEnded, setHostEnded] = useState(false);
  const [showHostEndedModal, setShowHostEndedModal] = useState(false);
  const hadLiveRef = useRef(false);
  const [hasRequestedJoin, setHasRequestedJoin] = useState(false);
  const [requestStatus, setRequestStatus] = useState<
    "pending" | "accepted" | "rejected" | null
  >(null);
  const [acceptedCoHostIds, setAcceptedCoHostIds] = useState<string[]>([]);
  const [requestCooldown, setRequestCooldown] = useState(0);
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);
  const REQUEST_COOLDOWN_SECONDS = 30; // Cooldown after rejection
  const REQUEST_RATE_LIMIT_MS = 5000; // Minimum 5 seconds between requests

  const joinPromiseRef = useRef<Promise<any> | null>(null);

  // Get current user ID
  const currentUserId = (currentUser as any)?.id;
  const currentUsername =
    (currentUser as any)?.username || (currentUser as any)?.name || "User";
  const currentProfileImage =
    (currentUser as any)?.profileImg || (currentUser as any)?.avatar_url;

  // Swipe gesture to navigate to host profile
  const navigateToHostProfile = () => {
    if (hostId) {
      router.push(`/(users)/profile/${hostId}` as any);
      // Close the stream overlay
      if (onNavigateAway) {
        onNavigateAway();
      }
    }
  };

  // Handle co-host join request with rate limiting
  const handleRequestToJoin = async () => {
    if (!livestreamId || !currentUserId) return;
    if (hasRequestedJoin && requestStatus === "pending") return;
    if (requestCooldown > 0) return;

    // Rate limiting - prevent spam
    const now = Date.now();
    if (now - lastRequestTime < REQUEST_RATE_LIMIT_MS) {
      console.log("Rate limited - please wait before requesting again");
      return;
    }

    try {
      await createCoHostRequest(
        livestreamId,
        currentUserId,
        currentUsername,
        currentProfileImage
      );
      setHasRequestedJoin(true);
      setRequestStatus("pending");
      setLastRequestTime(now);
    } catch (error) {
      console.error("Error requesting to join:", error);
    }
  };

  // Cancel pending request
  const handleCancelRequest = async () => {
    if (!livestreamId || !currentUserId) return;

    try {
      await cancelCoHostRequest(livestreamId, currentUserId);
      setHasRequestedJoin(false);
      setRequestStatus(null);
    } catch (error) {
      console.error("Error canceling request:", error);
      // Reset anyway to allow user to try again
      setHasRequestedJoin(false);
      setRequestStatus(null);
    }
  };

  // Cooldown timer effect for rejected requests
  useEffect(() => {
    if (requestStatus === "rejected" && requestCooldown === 0) {
      setRequestCooldown(REQUEST_COOLDOWN_SECONDS);
    }
  }, [requestStatus]);

  useEffect(() => {
    if (requestCooldown <= 0) return;

    const timer = setInterval(() => {
      setRequestCooldown((prev) => {
        if (prev <= 1) {
          // Reset states to allow requesting again
          setHasRequestedJoin(false);
          setRequestStatus(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [requestCooldown]);

  // Enable camera and microphone when becoming a co-host/speaker
  const enableSpeakerMode = async () => {
    if (!call) return;

    try {
      console.log("Enabling speaker mode for co-host...");

      // First, try to re-join the call with publishing capabilities
      // This may be needed because viewers join without publish rights
      const currentState = call.state.callingState;

      if (currentState === "joined") {
        // Try enabling camera and microphone
        try {
          const cameraGranted = await ensureCameraPermission();
          if (cameraGranted) {
            await call.camera.enable();
            console.log("Camera enabled successfully");
          }
        } catch (camError) {
          console.warn("Could not enable camera:", camError);
        }

        try {
          await call.microphone.enable();
          console.log("Microphone enabled successfully");
        } catch (micError) {
          console.warn("Could not enable microphone:", micError);
        }
      }

      console.log("Speaker mode enabled - camera and microphone activated");
    } catch (error) {
      console.error("Failed to enable speaker mode:", error);
    }
  };

  // Subscribe to request status changes
  useEffect(() => {
    if (!livestreamId || !currentUserId) return;

    const checkRequestStatus = async () => {
      const { data } = await supabase
        .from("cohost_requests")
        .select("*")
        .eq("livestream_id", livestreamId)
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const request = data[0];
        setHasRequestedJoin(true);
        setRequestStatus(request.status);

        if (request.status === "accepted") {
          // User has been accepted as co-host - enable speaker mode
          await enableSpeakerMode();
          onBecomeCoHost?.();
        }
      }
    };

    checkRequestStatus();

    const channel = supabase
      .channel(`cohost-status-${livestreamId}-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cohost_requests",
          filter: `livestream_id=eq.${livestreamId}`,
        },
        () => {
          checkRequestStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [livestreamId, currentUserId, onBecomeCoHost, call]);

  // Subscribe to accepted co-hosts for grid display
  useEffect(() => {
    if (!livestreamId) return;

    const fetchAcceptedCoHosts = async () => {
      const { data } = await supabase
        .from("cohost_requests")
        .select("user_id")
        .eq("livestream_id", livestreamId)
        .eq("status", "accepted");

      if (data) {
        setAcceptedCoHostIds(data.map((r) => r.user_id));
      }
    };

    fetchAcceptedCoHosts();

    const channel = supabase
      .channel(`viewer-accepted-cohosts-${livestreamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cohost_requests",
          filter: `livestream_id=eq.${livestreamId}`,
        },
        () => {
          fetchAcceptedCoHosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [livestreamId]);

  const swipeGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onEnd((event) => {
      // Swipe from right to left (negative velocityX or translationX)
      if (event.translationX < -100 && hostId) {
        runOnJS(navigateToHostProfile)();
      }
    });

  useEffect(() => {
    if (!call) return;
    const tryJoin = () => {
      if (!call) return;
      // If there's already an ongoing join attempt, skip.
      if (joinPromiseRef.current) return;

      const state = call.state.callingState;
      // Only initiate join when idle. If already joining, trust the existing attempt.
      if (state !== "idle") return;

      joinPromiseRef.current = call
        .join()
        .catch((err: any) => {
          // Common SDK error when join() was already triggered elsewhere.
          // Log for visibility but don't spam further attempts.
          console.warn("Viewer join attempt failed", err);
        })
        .finally(() => {
          // keep a small debounce before allowing another join attempt
          setTimeout(() => {
            joinPromiseRef.current = null;
          }, 500);
        });
    };

    // initial attempt (viewer may arrive before the host is live)
    tryJoin();

    const sub = call.state.backstage$?.subscribe((backstage) => {
      const live = !backstage;
      setIsLive(live);

      if (live) {
        // host started — ensure viewer tries to join (recover from stuck state)
        hadLiveRef.current = true;
        if (call.state.callingState !== "joined") {
          tryJoin();
        }
      } else if (hadLiveRef.current) {
        // Host went from live -> not live (ended)
        setHostEnded(true);
        setShowHostEndedModal(true);
      }
    });

    const callingStateSub = (call.state as any).callingState$?.subscribe?.(
      (s: string) => {
        if (s === "joined") {
          joinPromiseRef.current = null;
          onCallJoined?.();
        }
        // if it falls back to idle, allow retries
        if (s === "idle") {
          joinPromiseRef.current = null;
        }
      }
    );

    return () => {
      sub?.unsubscribe();
      callingStateSub?.unsubscribe?.();
    };
  }, [call?.id]);

  useEffect(() => {
    console.log("Calling State:", callingState);
    console.log("Participants Count:", participants.length);
    console.log("Is Live:", isLive);
  }, [participants, callingState, isLive]);

  const hostParticipant = participants.find(
    (p) =>
      p.userId === hostId ||
      (p.roles ?? []).includes("host") ||
      (p.roles ?? []).includes("admin") ||
      p.userId === call?.state.createdBy?.id
  );

  // Get all speakers (host + accepted co-hosts)
  // Filter participants who should be in the grid
  const speakerParticipants = participants.filter(
    (p) =>
      p.userId === hostId ||
      (p.roles ?? []).includes("host") ||
      (p.roles ?? []).includes("admin") ||
      p.userId === call?.state.createdBy?.id ||
      acceptedCoHostIds.includes(p.userId ?? "") ||
      (p.publishedTracks && p.publishedTracks.length > 0) ||
      p.audioStream ||
      p.videoStream
  );

  // Build final allSpeakers list ensuring:
  // 1. Host is always first (if found)
  // 2. Current user (if they're an accepted co-host) is included
  // 3. No duplicates
  const allSpeakers = (() => {
    const speakers: typeof participants = [];
    const addedIds = new Set<string>();

    // Always add host first if found
    if (hostParticipant && hostParticipant.userId) {
      speakers.push(hostParticipant);
      addedIds.add(hostParticipant.userId);
    }

    // Add current user if they're an accepted co-host
    if (requestStatus === "accepted" && call?.state.localParticipant) {
      const localP = call.state.localParticipant;
      if (localP.userId && !addedIds.has(localP.userId)) {
        speakers.push(localP);
        addedIds.add(localP.userId);
      }
    }

    // Add other speakers
    for (const p of speakerParticipants) {
      if (p.userId && !addedIds.has(p.userId)) {
        speakers.push(p);
        addedIds.add(p.userId);
      }
    }

    return speakers;
  })();

  // Check if current user is a speaker (accepted co-host)
  const isSpeaker =
    requestStatus === "accepted" ||
    allSpeakers.some((p) => p.userId === currentUserId);

  const handleLeaveAfterHostEnd = async () => {
    setShowHostEndedModal(false);
    try {
      await onLeaveStream();
    } catch {
      // fallback: try leaving the call directly
      try {
        await call?.leave();
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <GestureDetector gesture={swipeGesture}>
      <View className="flex-1 bg-black">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1">
            <Modal
              visible={showHostEndedModal}
              transparent
              animationType="fade"
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 20,
                }}
              >
                <View
                  style={{
                    width: "100%",
                    maxWidth: 420,
                    backgroundColor: "#111",
                    borderRadius: 12,
                    padding: 18,
                  }}
                >
                  <Text
                    style={{ fontSize: 18, fontWeight: "600", color: "#fff" }}
                  >
                    Livestream Ended
                  </Text>
                  <Text style={{ marginTop: 8, color: "#9CA3AF" }}>
                    The host has ended this livestream. Thank you for watching!
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "flex-end",
                      marginTop: 16,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setShowHostEndedModal(false)}
                      style={{
                        marginRight: 12,
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 8,
                        backgroundColor: "#374151",
                      }}
                    >
                      <Text style={{ color: "#fff" }}>Stay</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleLeaveAfterHostEnd}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        backgroundColor: "#DC2626",
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "600" }}>
                        Leave
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
            <View className="flex-1 bg-black">
              {/* LAYER 1: VIDEO (Absolute Fill) */}
              <View className="absolute inset-0">
                {!isLive ? (
                  <View className="flex-1 items-center justify-center">
                    {hostEnded ? (
                      <View className="items-center px-6">
                        <Text className="text-white/90 text-center mb-4">
                          The host has ended the livestream.
                        </Text>
                        <TouchableOpacity
                          onPress={handleLeaveAfterHostEnd}
                          className="rounded-full bg-red-600 px-6 py-3"
                        >
                          <Text className="text-white font-semibold">
                            Leave
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text className="text-white/80 text-center px-6">
                        Waiting for the host to start the livestream...
                      </Text>
                    )}
                  </View>
                ) : allSpeakers.length > 0 ? (
                  /* Multi-speaker grid layout - TikTok style for viewers */
                  <View
                    style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}
                  >
                    {(() => {
                      const totalParticipants = allSpeakers.length;
                      let gridCols = 1;
                      let gridRows = 1;

                      if (totalParticipants === 1) {
                        gridCols = 1;
                        gridRows = 1;
                      } else if (totalParticipants === 2) {
                        gridCols = 2;
                        gridRows = 1;
                      } else if (totalParticipants <= 4) {
                        gridCols = 2;
                        gridRows = 2;
                      } else if (totalParticipants <= 6) {
                        gridCols = 3;
                        gridRows = 2;
                      } else if (totalParticipants <= 9) {
                        gridCols = 3;
                        gridRows = 3;
                      }

                      const cellWidth = 100 / gridCols;
                      const cellHeight = 100 / gridRows;

                      return allSpeakers.slice(0, 9).map((speaker, index) => {
                        const isHost =
                          speaker.userId === hostId ||
                          (speaker.roles ?? []).includes("host") ||
                          (speaker.roles ?? []).includes("admin") ||
                          speaker.userId === call?.state.createdBy?.id;
                        const isMe = speaker.userId === currentUserId;

                        return (
                          <View
                            key={speaker.sessionId}
                            style={{
                              width: `${cellWidth}%`,
                              height: `${cellHeight}%`,
                              borderWidth: totalParticipants > 1 ? 1 : 0,
                              borderColor: "#222",
                            }}
                          >
                            <ParticipantView
                              participant={speaker}
                              style={{ flex: 1 }}
                              objectFit="cover"
                              ParticipantNetworkQualityIndicator={null}
                              ParticipantLabel={null}
                            />
                            <View
                              className={`absolute bottom-1 left-1 px-2 py-1 rounded-full ${
                                isHost
                                  ? "bg-black/60"
                                  : isMe
                                  ? "bg-green-500/80"
                                  : "bg-purple-500/80"
                              }`}
                            >
                              <Text className="text-white text-xs font-semibold">
                                {isHost ? "Host" : isMe ? "You" : "Co-host"}
                              </Text>
                            </View>
                          </View>
                        );
                      });
                    })()}
                  </View>
                ) : (
                  <View className="flex-1 items-center justify-center">
                    {callingState === "joining" ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <Text className="text-white mt-4">
                        Connecting to the stream…
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* LAYER 2: CHAT (Full width for viewers) */}
              <View
                className="absolute bottom-0 left-0 right-0"
                style={{ height: "55%" }}
                pointerEvents="box-none"
              >
                <LiveChat
                  liveStreamId={livestreamId ?? null}
                  hostId={hostParticipant?.userId}
                  isHostView={false}
                />
              </View>

              {/* LAYER 3: TOP UI */}
              <View className="absolute top-14 left-4 flex-row items-center">
                <View className="bg-red-600 px-2 py-0.5 rounded-sm">
                  <Text className="text-white text-[10px] font-bold">LIVE</Text>
                </View>
                {streamType === "business" && (
                  <View className="bg-blue-600/80 px-2 py-0.5 rounded-sm ml-2">
                    <Text className="text-white text-[10px] font-bold">
                      SHOP
                    </Text>
                  </View>
                )}
              </View>

              {/* LAYER 4: REQUEST TO JOIN BUTTON */}
              {(!hasRequestedJoin ||
                (requestStatus === "rejected" && requestCooldown === 0)) &&
                requestStatus !== "accepted" && (
                  <TouchableOpacity
                    onPress={handleRequestToJoin}
                    className="absolute bottom-32 right-4 bg-purple-600 px-4 py-3 rounded-full flex-row items-center"
                    style={{
                      shadowColor: "#9333EA",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.5,
                      shadowRadius: 8,
                      zIndex: 100,
                      elevation: 10,
                    }}
                  >
                    <Ionicons name="hand-left" size={18} color="white" />
                    <Text className="text-white font-semibold ml-2">
                      Request
                    </Text>
                  </TouchableOpacity>
                )}

              {hasRequestedJoin && requestStatus === "pending" && (
                <TouchableOpacity
                  onPress={handleCancelRequest}
                  className="absolute bottom-32 right-4 bg-yellow-600/90 px-4 py-3 rounded-full flex-row items-center"
                  style={{ zIndex: 100, elevation: 10 }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="time" size={18} color="white" />
                  <Text className="text-white font-medium ml-2">Requested</Text>
                  <View className="ml-2 bg-white/20 rounded-full px-2 py-0.5">
                    <Text className="text-white text-xs font-medium">
                      Cancel
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {requestStatus === "rejected" && requestCooldown > 0 && (
                <View
                  className="absolute bottom-32 right-4 bg-red-600/80 px-4 py-3 rounded-full flex-row items-center"
                  style={{ zIndex: 100, elevation: 10 }}
                >
                  <Ionicons name="close-circle" size={18} color="white" />
                  <Text className="text-white font-medium ml-2">
                    Declined · {requestCooldown}s
                  </Text>
                </View>
              )}

              {requestStatus === "accepted" && (
                <View
                  className="absolute bottom-32 right-4 bg-green-600 px-4 py-3 rounded-full flex-row items-center"
                  style={{ zIndex: 100, elevation: 10 }}
                >
                  <Ionicons name="mic" size={18} color="white" />
                  <Text className="text-white font-semibold ml-2">
                    You're a Speaker
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </GestureDetector>
  );
};

export default LiveScreen;
async function ensureCameraPermission(): Promise<boolean> {
  const { status } = await Camera.requestCameraPermissionsAsync();
  if (status !== "granted") {
    Alert.alert(
      "Camera Permission Needed",
      "Please enable camera access to use live video."
    );
    return false;
  }
  return true;
}

