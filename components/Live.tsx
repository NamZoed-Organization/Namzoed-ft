import { LinearGradient } from "expo-linear-gradient";
import { Radio, X } from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { useUser } from "@/contexts/UserContext";
import getStreamService, {
  type StreamIdentity,
} from "@/services/getStreamService";
import {
  adjustLivestreamViewerCount,
  createLivestreamRecord,
  endLivestreamRecord,
  fetchActiveLivestreams,
  incrementLivestreamViewerCountAtomic,
  subscribeToLivestreams,
  type Livestream,
} from "@/services/livestreamService";
import {
  ParticipantView,
  StreamCall,
  StreamVideo,
  useCall,
  useCallStateHooks,
  type Call,
  type StreamVideoClient,
} from "@stream-io/video-react-native-sdk";

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

type ActiveCallRole = "host" | "viewer" | null;

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
        email: (currentUser as Record<string, unknown>)?.email ?? null,
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
            ? (currentUser.profileImg as string)
            : null,
        title: liveTitle,
        description: null,
        stream_provider_id: callIdentifier,
        recording_enabled: recordingEnabled,
        call_id: callIdentifier,
        call_cid: call.cid,
        call_type: "livestream",
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

    incrementLivestreamViewerCountAtomic(selectedStream.id, 1).catch(() => {});
    return () => {
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
                />
              ) : (
                <ViewerCallContainer
                  onLeaveStream={handleViewerLeave}
                  onCallJoined={handleViewerCallStart}
                  ending={endingStream}
                />
              )}

              <ActiveCallHeader
                role={callRole}
                username={selectedStream.username ?? "Live"}
                viewerCount={activeViewerCount}
                onClose={handleLeaveCurrentCall}
                busy={endingStream || initializingCall}
                profileImage={
                  (selectedStream as any)?.profile_image ??
                  (selectedStream as any)?.thumbnail ??
                  null
                }
                recording={Boolean((selectedStream as any)?.recording)}
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

        {loadingStreams ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#DC2626" />
            <Text className="mt-2 text-sm text-gray-500">
              Fetching active livestreams...
            </Text>
          </View>
        ) : livestreams.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-base font-semibold text-gray-700">
              No one is live yet
            </Text>
            <Text className="mt-2 text-center text-sm text-gray-500">
              Be the first to go live with Stream Live Streams.
            </Text>
          </View>
        ) : (
          <FlatList
            data={livestreams}
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
            <Text className="text-sm text-gray-600">
              Name your Stream Live Stream and decide if you want Stream to
              record it automatically.
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
              className="mt-6 items-center rounded-full bg-red-500 py-3"
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-base font-semibold text-white">
                  Create Stream session
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
  onClose: () => void | Promise<void>;
  busy?: boolean;
  profileImage?: string | null;
  recording?: boolean;
}

const ActiveCallHeader: React.FC<ActiveCallHeaderProps> = ({
  role,
  username,
  viewerCount,
  onClose,
  busy = false,
  profileImage,
  recording = false,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="absolute inset-x-0 top-0 flex-row items-center justify-between px-4"
      style={{ paddingTop: Math.max(12, insets.top) }}
    >
      <View className="flex-row items-center rounded-full bg-black/30 px-3 py-1">
        {profileImage ? (
          <Image
            source={{ uri: profileImage }}
            style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10 }}
          />
        ) : (
          <View className="mr-2 h-2 w-2 rounded-full bg-red-500" />
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
      </View>

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
}

const HostCallContainer: React.FC<HostCallContainerProps> = ({
  onStartStream,
  onEndStream,
  ending,
}) => {
  const call = useCall();
  const { useCameraState, useMicrophoneState } = useCallStateHooks();

  const { camera, isMute: isCameraMuted } = useCameraState();
  const { microphone, isMute: isMicMuted } = useMicrophoneState();
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  // Manually track live status since the hook is missing
  const [isLive, setIsLive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!call) return;

    const joinCall = async () => {
      try {
        const currentState = call.state.callingState;

        if (currentState === "idle") {
          await call.join({ create: true });
          console.log("Successfully joined the call");
        }
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.includes("shall be called only once")
        ) {
          console.warn("Caught redundant join attempt safely");
        } else {
          console.error("Host join failed", err);
        }
      }
    };

    joinCall();

    const subscription = call.state.backstage$.subscribe((backstage) => {
      setIsLive(!backstage);
    });

    return () => {
      subscription.unsubscribe();
      // Only leave if the component is actually unmounting permanently
      // call.leave();
    };
  }, [call?.id]);

  const handleToggleLive = async () => {
    if (!call) return;

    if (isLive) {
      setShowEndConfirm(true);
    } else {
      setCountdown(3);
    }
  };

  const confirmEnd = async () => {
    setShowEndConfirm(false);
    if (!call) return;
    try {
      await call.stopLive();
      await onEndStream?.();
    } catch (error) {
      console.error("Stop Live Failed:", error);
    }
  };

  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (countdown === 0) {
      const startStream = async () => {
        try {
          await call?.goLive();
          onStartStream?.();
        } catch (error) {
          console.error("Go Live Failed:", error);
        } finally {
          setCountdown(null);
        }
      };
      startStream();
    }
  }, [countdown, call, onStartStream]);

  return (
    <View className="flex-1 bg-black">
      <Modal visible={showEndConfirm} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 420,
              backgroundColor: "#fff",
              borderRadius: 12,
              padding: 18,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600", color: "#111" }}>
              End Livestream?
            </Text>
            <Text style={{ marginTop: 8, color: "#4b5563" }}>
              Are you sure you want to end the livestream? Viewers will be
              disconnected.
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                marginTop: 16,
              }}
            >
              <TouchableOpacity
                onPress={() => setShowEndConfirm(false)}
                style={{
                  marginRight: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderRadius: 8,
                  backgroundColor: "#e5e7eb",
                }}
              >
                <Text style={{ color: "#111" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmEnd}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  backgroundColor: "#dc2626",
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>
                  End Stream
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={{ height: "70%", flexDirection: "row" }}>
        <View style={{ width: "50%", backgroundColor: "#111" }}>
          {call && call.state.localParticipant && (
            <ParticipantView
              participant={call.state.localParticipant}
              style={{ flex: 1 }}
              objectFit="cover"
              ParticipantLabel={null}
              ParticipantNetworkQualityIndicator={null}
            />
          )}

          {countdown !== null && (
            <View className="absolute inset-0 items-center justify-center bg-black/40">
              <Text className="text-white text-6xl font-bold italic">
                {countdown > 0 ? countdown : "GO!"}
              </Text>
            </View>
          )}
        </View>

        <View style={{ width: "50%", backgroundColor: "#1a1a1a" }}>
          <View className="p-4">
            <Text className="text-gray-500 italic">
              Comments will appear here...
            </Text>
          </View>
        </View>
      </View>

      <View
        style={{ height: "30%", width: "100%", backgroundColor: "#000" }}
        className="p-4 justify-between"
      >
        <View className="flex-1 justify-center">
          <Text className="text-white/50 text-center border border-dashed border-white/20 py-4 rounded-lg">
            Drop Cards Here
          </Text>
        </View>

        {/* Control Buttons */}
        <View className="flex-row items-center justify-around bg-zinc-900 rounded-2xl px-4 py-4 mb-4">
          <TouchableOpacity onPress={() => camera.toggle()}>
            <Text className="text-white font-medium">
              {isCameraMuted ? "Cam Off" : "Cam On"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleToggleLive}
            disabled={countdown !== null}
            className={`${
              isLive ? "bg-zinc-700" : "bg-red-600"
            } px-8 py-2 rounded-lg`}
          >
            <Text className="text-white font-bold">
              {isLive ? "End Stream" : "Go Live"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => microphone.toggle()}>
            <Text className="text-white font-medium">
              {isMicMuted ? "Mic Off" : "Mic On"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};
interface ViewerCallContainerProps {
  onLeaveStream: () => void | Promise<void>;
  onCallJoined?: () => void | Promise<void>;
  ending: boolean;
}

const ViewerCallContainer: React.FC<ViewerCallContainerProps> = () => {
  const call = useCall();
  const { useParticipants, useCallCallingState } = useCallStateHooks();
  const participants = useParticipants();
  const callingState = useCallCallingState();

  // 1. Viewer MUST join to see the participant list
  useEffect(() => {
    if (!call) return;
    if (call.state.callingState === "idle") {
      call.join();
    }
  }, [call]);

  // 2. Log the state to see what's happening
  useEffect(() => {
    console.log("Calling State:", callingState);
    console.log("Participants Count:", participants.length);
  }, [participants, callingState]);

  // Find host
  const hostParticipant = participants.find(
    (p) =>
      (p.roles ?? []).includes("host") ||
      (p.roles ?? []).includes("admin") ||
      p.userId === call?.state.createdBy?.id
  );

  return (
    <View className="flex-1 bg-black">
      {hostParticipant ? (
        <ParticipantView
          participant={hostParticipant}
          style={{ flex: 1 }}
          ParticipantNetworkQualityIndicator={null}
          ParticipantLabel={null}
          trackType="videoTrack"
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          {callingState === "joining" ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white mt-4">
              Waiting for host to go live...
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

export default LiveScreen;
