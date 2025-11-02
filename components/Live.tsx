import { ResizeMode, Video } from "expo-av";
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
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import {
  adjustLivestreamViewerCount,
  createLivestreamRecord,
  endLivestreamRecord,
  fetchActiveLivestreams,
  subscribeToLivestreams,
  type Livestream,
} from "@/services/livestreamService";

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

const LiveScreen: React.FC<LiveScreenProps> = ({ onClose }) => {
  const { currentUser } = useUser();
  const [livestreams, setLivestreams] = useState<Livestream[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<Livestream | null>(null);
  const [hostingRecord, setHostingRecord] = useState<Livestream | null>(null);
  const [ingestDetails, setIngestDetails] = useState<IngestDetails | null>(
    null
  );
  const [viewerSession, setViewerSession] = useState<{
    streamId: string;
  } | null>(null);
  const [isHosting, setIsHosting] = useState(false);
  const [creatingStream, setCreatingStream] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinLoadingId, setJoinLoadingId] = useState<string | null>(null);
  const [endingStream, setEndingStream] = useState(false);
  const [liveTitle, setLiveTitle] = useState("Going live on Namzoed");
  const [recordingEnabled, setRecordingEnabled] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const videoRef = useRef<Video | null>(null);
  const hostingRecordRef = useRef<Livestream | null>(null);
  const viewerSessionRef = useRef<{ streamId: string } | null>(null);
  const supabaseUserIdRef = useRef<string | null>(null);

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

  const handleLeaveLivestream = useCallback(async () => {
    if (!selectedStream) {
      return;
    }

    setEndingStream(true);
    try {
      if (isHosting && hostingRecord?.id && supabaseUserId) {
        await endLivestreamRecord(hostingRecord.id, supabaseUserId);
        setHostingRecord(null);
        setIngestDetails(null);
        setIsHosting(false);
      } else if (viewerSession?.streamId) {
        await adjustLivestreamViewerCount(viewerSession.streamId, -1);
        setViewerSession(null);
      }
    } catch (error) {
      console.error("Failed to leave livestream", error);
      setErrorMessage("Unable to update livestream status. Please try again.");
    } finally {
      setSelectedStream(null);
      setEndingStream(false);
    }
  }, [hostingRecord, isHosting, selectedStream, supabaseUserId, viewerSession]);

  const handleClose = useCallback(async () => {
    if (selectedStream) {
      await handleLeaveLivestream();
    }
    onClose();
  }, [handleLeaveLivestream, onClose, selectedStream]);

  const handleStartLivestream = useCallback(async () => {
    if (!currentUser || !supabaseUserId) {
      setErrorMessage("Please sign in before going live.");
      return;
    }

    const hostIdentifier = sanitizeIdentifier(userId ?? supabaseUserId);
    if (!hostIdentifier) {
      setErrorMessage("Unable to derive a host ID for Stream.");
      return;
    }

    try {
      setCreatingStream(true);
      setErrorMessage(null);

      const response = await supabase.functions.invoke<{
        liveStream?: StreamLiveStream;
      }>("create-live-stream", {
        body: {
          host_id: hostIdentifier,
          title: liveTitle.trim().length > 0 ? liveTitle.trim() : null,
          record: recordingEnabled,
        },
      });

      if (response.error) {
        const { message, status } = response.error;
        throw new Error(
          `Supabase create-live-stream failed${
            status ? ` (status ${status})` : ""
          }${message ? `: ${message}` : "."}`
        );
      }

      const liveStream = response.data?.liveStream;
      if (!liveStream) {
        throw new Error(
          "Supabase create-live-stream did not return liveStream data."
        );
      }

      const playbackId = liveStream.playback_ids?.[0]?.id ?? null;
      const playbackPolicy = liveStream.playback_ids?.[0]?.policy ?? null;
      const hlsUrl =
        liveStream.hls_url ??
        liveStream.playback_url ??
        buildPlaybackUrl(playbackId);
      const dashUrl = liveStream.dash_url ?? null;
      const rtmpAddress = liveStream.rtmp_address ?? null;
      const streamKey = liveStream.stream_key ?? null;
      const providerId = liveStream.id ?? null;
      const metadata = liveStream as Record<string, unknown>;
      const recordingFlag = Boolean(liveStream.recording ?? liveStream.record);

      const record = await createLivestreamRecord({
        user_id: supabaseUserId,
        username: displayName,
        profile_image:
          typeof currentUser.profileImg === "string"
            ? currentUser.profileImg
            : null,
        title: liveStream.name ?? liveTitle,
        description: liveStream.description ?? null,
        stream_key: streamKey,
        stream_provider_id: providerId,
        playback_id: playbackId,
        playback_policy: playbackPolicy ?? liveStream.playback_policy ?? null,
        hls_url: hlsUrl,
        dash_url: dashUrl,
        rtmp_address: rtmpAddress,
        recording_enabled: recordingFlag,
        external_metadata: metadata,
        thumbnail: null,
      });

      setLivestreams((prev) => [record, ...prev]);
      setSelectedStream(record);
      setHostingRecord(record);
      setIngestDetails({
        streamKey: streamKey ?? null,
        rtmpAddress,
        hlsUrl: hlsUrl ?? null,
        dashUrl,
        playbackId,
      });
      setIsHosting(true);
      setShowCreateModal(false);
    } catch (error) {
      console.error("Failed to start livestream", error);
      const message =
        error instanceof Error ? error.message : "Unable to start livestream.";
      setErrorMessage(message);
    } finally {
      setCreatingStream(false);
    }
  }, [
    currentUser,
    displayName,
    liveTitle,
    recordingEnabled,
    supabaseUserId,
    userId,
  ]);

  const handleJoinStream = useCallback(async (stream: Livestream) => {
    const playbackUrl =
      stream.hls_url ?? buildPlaybackUrl(stream.playback_id ?? null);

    if (!playbackUrl) {
      setErrorMessage(
        "This livestream is not ready for playback yet. Please try again shortly."
      );
      return;
    }

    setJoinLoadingId(stream.id);
    setPlaybackError(null);
    try {
      await adjustLivestreamViewerCount(stream.id, 1);
      setSelectedStream({ ...stream, hls_url: playbackUrl });
      setViewerSession({ streamId: stream.id });
      setIsHosting(false);
      setHostingRecord(null);
      setIngestDetails(null);
    } catch (error) {
      console.error("Failed to join livestream", error);
      const message =
        error instanceof Error ? error.message : "Unable to join livestream.";
      setErrorMessage(message);
    } finally {
      setJoinLoadingId(null);
    }
  }, []);

  useEffect(() => {
    loadLivestreams(true);
    const unsubscribe = subscribeToLivestreams(() => loadLivestreams(false));
    return () => {
      unsubscribe();
    };
  }, [loadLivestreams]);

  useEffect(() => {
    if (!selectedStream) {
      setPlaybackError(null);
    }
  }, [selectedStream]);

  const renderViewerScreen = () => {
    if (!selectedStream) {
      return null;
    }

    const playbackUrl =
      selectedStream.hls_url ?? buildPlaybackUrl(selectedStream.playback_id);
    const viewerCount = selectedStream.viewer_count ?? 0;

    return (
      <View className="flex-1 bg-black">
        {playbackUrl ? (
          <Video
            ref={videoRef}
            source={{ uri: playbackUrl }}
            style={{ flex: 1 }}
            useNativeControls
            shouldPlay
            resizeMode={ResizeMode.CONTAIN}
            onError={(event) => {
              console.error("Playback error", event);
              setPlaybackError(
                "We had trouble loading this stream. Please try again."
              );
            }}
          />
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-base font-semibold text-white">
              Stream is preparing
            </Text>
            <Text className="mt-2 text-center text-sm text-white/70">
              We will start playing automatically once the broadcaster connects
              their encoder.
            </Text>
          </View>
        )}

        <View className="absolute inset-x-0 top-0 flex-row items-center justify-between px-4 pt-12">
          <View className="flex-row items-center rounded-full bg-black/40 px-3 py-1">
            <View className="mr-2 h-2 w-2 rounded-full bg-red-500" />
            <Text className="text-sm font-semibold text-white">
              {selectedStream.username ?? "Live"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleLeaveLivestream}
            className="flex-row items-center rounded-full bg-white/20 px-3 py-1"
            disabled={endingStream}
          >
            <Text className="mr-2 text-xs font-semibold text-white">Leave</Text>
            <X color="#fff" size={18} />
          </TouchableOpacity>
        </View>

        <View className="absolute right-4 top-20 rounded-full bg-black/50 px-3 py-1">
          <Text className="text-xs font-semibold text-white">
            {viewerCount} watching
          </Text>
        </View>

        {playbackError && (
          <View className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-black/80 px-6 py-4">
            <Text className="text-sm font-semibold text-white">
              Playback issue
            </Text>
            <Text className="mt-1 text-xs text-white/70">{playbackError}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderHostingScreen = () => {
    if (!selectedStream) {
      return null;
    }

    const details = ingestDetails ?? {
      streamKey: selectedStream.stream_key ?? null,
      rtmpAddress: selectedStream.rtmp_address ?? null,
      hlsUrl:
        selectedStream.hls_url ?? buildPlaybackUrl(selectedStream.playback_id),
      dashUrl: selectedStream.dash_url ?? null,
      playbackId: selectedStream.playback_id ?? null,
    };

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-xl font-semibold text-gray-900">
            You are live
          </Text>
          <TouchableOpacity
            onPress={handleLeaveLivestream}
            className="flex-row items-center rounded-full bg-red-500 px-4 py-2"
            disabled={endingStream}
            activeOpacity={endingStream ? 1 : 0.8}
          >
            <Text className="mr-2 font-semibold text-white">End</Text>
            <X color="#fff" size={18} />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4">
          <Text className="text-lg font-semibold text-gray-900">
            {selectedStream.title ?? liveTitle}
          </Text>
          <Text className="mt-2 text-sm text-gray-600">
            Use an encoder like OBS, Streamlabs, or Restream to broadcast. Paste
            the RTMP details below into your encoder and start streaming.
          </Text>

          <IngestField label="RTMP address" value={details.rtmpAddress} />
          <IngestField label="Stream key" value={details.streamKey} />

          <Text className="mt-6 text-sm font-semibold text-gray-800">
            Share with viewers
          </Text>
          <Text className="mt-1 text-xs text-gray-500">
            Once your encoder is live, send this playback link to your audience
            or embed it where you need it.
          </Text>

          <IngestField label="HLS URL" value={details.hlsUrl} />
          {details.dashUrl ? (
            <IngestField label="DASH URL" value={details.dashUrl} />
          ) : null}

          <View className="mt-6 rounded-2xl bg-red-50 p-4">
            <Text className="text-sm font-semibold text-red-600">
              Need help?
            </Text>
            <Text className="mt-1 text-xs text-red-600/80">
              Stream creates the livestream in a ready state. Start your encoder
              within 15 minutes to keep the session active. You can manage the
              broadcast from the Stream dashboard if needed.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  const renderPlaybackScreen = () => {
    if (!selectedStream) {
      return null;
    }
    return isHosting ? renderHostingScreen() : renderViewerScreen();
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
        <View className="flex-row items-center justify-between px-4 py-3">
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

  return selectedStream ? renderPlaybackScreen() : renderListScreen();
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
  const viewerCount = stream.viewer_count ?? 0;
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
}) => (
  <Modal visible={visible} animationType="slide" transparent>
    <View className="flex-1 justify-end bg-black/60">
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
          Name your Stream Live Stream and decide if you want Stream to record
          it automatically.
        </Text>
        <TextInput
          value={title}
          onChangeText={onTitleChange}
          placeholder="Describe what you will stream..."
          className="mt-4 rounded-2xl border border-gray-200 px-4 py-3 text-base text-gray-900"
          placeholderTextColor="#9CA3AF"
          maxLength={80}
        />

        <View className="mt-4 flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-semibold text-gray-800">
              Record stream
            </Text>
            <Text className="text-xs text-gray-500">
              Store a VOD in the Stream dashboard after you go live.
            </Text>
          </View>
          <Switch
            value={recordingEnabled}
            onValueChange={onToggleRecording}
            thumbColor={recordingEnabled ? "#DC2626" : "#f4f3f4"}
            trackColor={{ false: "#D1D5DB", true: "#FECACA" }}
          />
        </View>

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
  </Modal>
);

interface IngestFieldProps {
  label: string;
  value: string | null | undefined;
}

const IngestField: React.FC<IngestFieldProps> = ({ label, value }) => (
  <View className="mt-4">
    <Text className="text-xs font-semibold uppercase text-gray-500">
      {label}
    </Text>
    <View className="mt-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2">
      <Text className="font-mono text-sm text-gray-900" selectable>
        {value ?? "Not available yet"}
      </Text>
    </View>
  </View>
);

export default LiveScreen;
