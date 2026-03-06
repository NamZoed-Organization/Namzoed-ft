/**
 * LiveScrollScreen
 *
 * TikTok-style vertical pager for live streams.
 *
 * • Scrolling auto-joins each stream as a WebRTC viewer via Stream SDK
 * • Video + audio play inline — no separate page to join
 * • Tap once → show LiveChat overlay (comments, reactions, join messages)
 * • Tap again → hide the chat overlay
 * • "Create Live" button opens LiveWrapper in host mode
 */
import { useLiveSession } from "@/contexts/LiveSessionProvider";
import { useUser } from "@/contexts/UserContext";
import { useLivestreams } from "@/hooks/useLivestreams";
import { supabase } from "@/lib/supabase";
import getStreamService, {
  type StreamIdentity,
} from "@/services/getStreamService";
import {
  cancelCoHostRequest,
  createCoHostRequest,
  incrementLivestreamViewerCountAtomic,
  subscribeToViewerCount,
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
import { useRouter } from "expo-router";
import {
  Briefcase,
  ChevronLeft,
  Eye,
  Hand,
  Radio,
  Tv2
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
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LiveChat } from "./livechat";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } =
  Dimensions.get("window");

// ─── CallJoiner ──────────────────────────────────────────────────────────────
// Zero-UI: auto-joins the call on mount, tracks viewer count.
function CallJoiner({ streamId }: { streamId: string }) {
  const call = useCall();
  const joiningRef = useRef(false);

  useEffect(() => {
    if (!call) return;

    const tryJoin = () => {
      if (joiningRef.current) return;
      if (call.state.callingState !== "idle") return;
      joiningRef.current = true;
      call
        .join()
        .catch(() => {})
        .finally(() => {
          joiningRef.current = false;
        });
    };

    tryJoin();

    // If host goes live while we're connected, retry join
    const sub = call.state.backstage$?.subscribe((backstage: boolean) => {
      if (!backstage && call.state.callingState !== "joined") {
        tryJoin();
      }
    });

    return () => {
      sub?.unsubscribe();
    };
  }, [call?.id]);

  // Viewer count ±1
  useEffect(() => {
    if (!streamId) return;
    incrementLivestreamViewerCountAtomic(streamId, 1).catch(() => {});
    return () => {
      incrementLivestreamViewerCountAtomic(streamId, -1).catch(() => {});
    };
  }, [streamId]);

  return null;
}

// ─── ActiveVideoContent ──────────────────────────────────────────────────────
// Rendered inside <StreamCall> for the active page. Shows the host's camera via
// ParticipantView, or a waiting / connecting state.
function ActiveVideoContent({ stream }: { stream: Livestream }) {
  const call = useCall();
  const { useParticipants, useCallCallingState } = useCallStateHooks();
  const participants = useParticipants();
  const callingState = useCallCallingState();
  const [isLive, setIsLive] = useState(false);
  const [hostEnded, setHostEnded] = useState(false);
  const hadLiveRef = useRef(false);

  useEffect(() => {
    if (!call) return;
    const sub = call.state.backstage$?.subscribe((backstage: boolean) => {
      const live = !backstage;
      setIsLive(live);
      if (live) hadLiveRef.current = true;
      else if (hadLiveRef.current) setHostEnded(true);
    });
    return () => sub?.unsubscribe();
  }, [call?.id]);

  const allSpeakers = useMemo(() => {
    return participants.filter(
      (p) =>
        p.userId === stream.user_id ||
        (p.roles ?? []).includes("host") ||
        (p.roles ?? []).includes("admin") ||
        (p.publishedTracks && p.publishedTracks.length > 0) ||
        p.audioStream ||
        p.videoStream,
    );
  }, [participants, stream.user_id]);

  // Waiting for host
  if (!isLive && callingState === "joined") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000",
        }}
      >
        {hostEnded ? (
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>
            The host has ended the livestream
          </Text>
        ) : (
          <>
            <ActivityIndicator color="white" size="small" />
            <Text
              style={{
                color: "rgba(255,255,255,0.7)",
                marginTop: 12,
                fontSize: 13,
              }}
            >
              Waiting for host to go live…
            </Text>
          </>
        )}
      </View>
    );
  }

  // Speaker grid
  if (allSpeakers.length > 0) {
    const total = allSpeakers.length;

    // Single speaker → fill the entire screen
    if (total === 1) {
      return (
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <ParticipantView
            participant={allSpeakers[0]}
            style={{
              flex: 1,
              width: SCREEN_WIDTH,
              height: SCREEN_HEIGHT,
            }}
            objectFit="cover"
            ParticipantNetworkQualityIndicator={null}
            ParticipantLabel={null}
          />
        </View>
      );
    }

    let cols = 2;
    let rows = 1;
    if (total <= 4) {
      cols = 2;
      rows = 2;
    } else if (total <= 6) {
      cols = 3;
      rows = 2;
    } else if (total <= 9) {
      cols = 3;
      rows = 3;
    }
    const cellW = 100 / cols;
    const cellH = 100 / rows;

    return (
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap" }}>
        {allSpeakers.slice(0, 9).map((speaker) => (
          <View
            key={speaker.sessionId}
            style={{
              width: `${cellW}%` as any,
              height: `${cellH}%` as any,
              borderWidth: 1,
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
          </View>
        ))}
      </View>
    );
  }

  // Connecting
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000",
      }}
    >
      <ActivityIndicator color="white" size="small" />
      <Text
        style={{
          color: "rgba(255,255,255,0.6)",
          marginTop: 10,
          fontSize: 13,
        }}
      >
        Connecting…
      </Text>
    </View>
  );
}

// ─── LivePage ────────────────────────────────────────────────────────────────
function LivePage({
  stream,
  isActive,
  onTap,
  streamReady,
  showChat,
  currentUserId,
  currentUsername,
  currentProfileImage,
  onCohostAccepted,
  onNavigateToProfile,
}: {
  stream: Livestream;
  isActive: boolean;
  onTap: () => void;
  streamReady: boolean;
  showChat: boolean;
  currentUserId: string | null;
  currentUsername: string;
  currentProfileImage: string | null;
  onCohostAccepted: (streamId: string) => void;
  onNavigateToProfile: (userId: string) => void;
}) {
  const name = stream.username ?? "Unknown";

  // ── Real-time viewer count ──────────────────────────────────────────────
  const [viewerCount, setViewerCount] = useState(stream.viewer_count ?? 0);

  useEffect(() => {
    setViewerCount(stream.viewer_count ?? 0);
  }, [stream.viewer_count]);

  useEffect(() => {
    if (!stream.id) return;
    const unsub = subscribeToViewerCount(stream.id, (count) => {
      setViewerCount(count);
    });
    return () => unsub();
  }, [stream.id]);

  // ── Cohost request state ────────────────────────────────────────────────
  const [hasRequested, setHasRequested] = useState(false);
  const [reqStatus, setReqStatus] = useState<"pending" | "accepted" | "rejected" | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const lastReqTime = useRef(0);

  const handleRequestCoHost = useCallback(async () => {
    if (!stream.id || !currentUserId) return;
    if (hasRequested && reqStatus === "pending") return;
    if (cooldown > 0) return;
    const now = Date.now();
    if (now - lastReqTime.current < 5000) return;
    try {
      await createCoHostRequest(stream.id, currentUserId, currentUsername, currentProfileImage);
      setHasRequested(true);
      setReqStatus("pending");
      lastReqTime.current = now;
    } catch {}
  }, [stream.id, currentUserId, currentUsername, currentProfileImage, hasRequested, reqStatus, cooldown]);

  const handleCancelCoHost = useCallback(async () => {
    if (!stream.id || !currentUserId) return;
    try {
      await cancelCoHostRequest(stream.id, currentUserId);
    } catch {}
    setHasRequested(false);
    setReqStatus(null);
  }, [stream.id, currentUserId]);

  // Cooldown after rejection
  useEffect(() => {
    if (reqStatus === "rejected" && cooldown === 0) setCooldown(30);
  }, [reqStatus]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown((p) => {
        if (p <= 1) { setHasRequested(false); setReqStatus(null); return 0; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // ── Subscribe to cohost request status changes from Supabase ──────────
  useEffect(() => {
    if (!stream.id || !currentUserId) return;

    const checkStatus = async () => {
      const { data } = await supabase
        .from("cohost_requests")
        .select("*")
        .eq("livestream_id", stream.id)
        .eq("user_id", currentUserId)
        .in("status", ["pending", "accepted", "rejected"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const req = data[0];
        setHasRequested(true);
        setReqStatus(req.status);

        if (req.status === "accepted") {
          onCohostAccepted(stream.id);
        }
      }
    };

    // Only subscribe if we have a pending request
    if (!hasRequested) return;

    const channel = supabase
      .channel(`cohost-scroll-${stream.id}-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cohost_requests",
          filter: `livestream_id=eq.${stream.id}`,
        },
        () => {
          checkStatus();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [stream.id, currentUserId, hasRequested, onCohostAccepted]);

  return (
    <TouchableWithoutFeedback onPress={onTap}>
      <View
        style={{
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          backgroundColor: "#000",
        }}
      >
        {/* ── Video layer ─────────────────────────────────────────────── */}
        {isActive && streamReady ? (
          <ActiveVideoContent stream={stream} />
        ) : isActive ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#000",
            }}
          >
            <ActivityIndicator color="white" size="small" />
            <Text
              style={{
                color: "rgba(255,255,255,0.6)",
                marginTop: 10,
                fontSize: 13,
              }}
            >
              Joining stream…
            </Text>
          </View>
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#111",
            }}
          >
            {stream.profile_image ? (
              <Image
                source={{ uri: stream.profile_image }}
                style={{ width: 120, height: 120, borderRadius: 60 }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: "#094569",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontSize: 48,
                    fontWeight: "700",
                  }}
                >
                  {name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Overlays ────────────────────────────────────────────────── */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 200,
          }}
        />

        {/* Type badge */}
        {stream.stream_type && (
          <View
            style={{
              position: "absolute",
              top: 60,
              right: 16,
              backgroundColor: "rgba(0,0,0,0.55)",
              borderRadius: 20,
              paddingHorizontal: 10,
              paddingVertical: 4,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
            }}
          >
            {stream.stream_type === "business" ? (
              <Briefcase size={11} color="white" />
            ) : (
              <Tv2 size={11} color="white" />
            )}
            <Text
              style={{
                color: "white",
                fontSize: 11,
                fontWeight: "600",
                textTransform: "capitalize",
              }}
            >
              {stream.stream_type}
            </Text>
          </View>
        )}

        {/* Viewer count */}
        <View
          style={{
            position: "absolute",
            top: 90,
            right: 16,
            backgroundColor: "rgba(0,0,0,0.55)",
            borderRadius: 20,
            paddingHorizontal: 10,
            paddingVertical: 4,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Eye size={13} color="white" />
          <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>
            {viewerCount}
          </Text>
        </View>

        {/* Bottom info — hidden in chat mode */}
        {!showChat && <View
          style={{
            position: "absolute",
            bottom: 90,
            left: 16,
            right: 80,
          }}
        >
          <TouchableOpacity
            onPress={() => stream.user_id && onNavigateToProfile(stream.user_id)}
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            {stream.profile_image ? (
              <Image
                source={{ uri: stream.profile_image }}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: "white",
                }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: "#094569",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: "white",
                }}
              >
                <Text
                  style={{
                    color: "white",
                    fontWeight: "700",
                    fontSize: 16,
                  }}
                >
                  {name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text
              style={{ color: "white", fontWeight: "700", fontSize: 16 }}
              numberOfLines={1}
            >
              {name}
            </Text>
          </TouchableOpacity>
          {stream.title ? (
            <Text
              style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}
              numberOfLines={2}
            >
              {stream.title}
            </Text>
          ) : null}
        </View>}

        {/* Tap hint — hidden in chat mode */}
        {!showChat && (
          <View
            style={{
              position: "absolute",
              bottom: 56,
              left: 0,
              right: 0,
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.45)",
                borderRadius: 20,
                paddingHorizontal: 18,
                paddingVertical: 7,
              }}
            >
              <Text
                style={{ color: "white", fontSize: 12, fontWeight: "500" }}
              >
                Tap to interact · Scroll to continue
              </Text>
            </View>
          </View>
        )}

        {/* ── Cohost request button — only in interactive mode ───────── */}
        {showChat && currentUserId && currentUserId !== stream.user_id && (
          <View
            style={{
              position: "absolute",
              right: 14,
              bottom: "42%",
              zIndex: 100,
            }}
          >
            {(!hasRequested || (reqStatus === "rejected" && cooldown === 0)) && reqStatus !== "accepted" && (
              <TouchableOpacity
                onPress={handleRequestCoHost}
                activeOpacity={0.8}
                style={{
                  backgroundColor: "#7C3AED",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 28,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  shadowColor: "#9333EA",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.5,
                  shadowRadius: 8,
                  elevation: 10,
                }}
              >
                <Hand size={16} color="white" />
                <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>Request</Text>
              </TouchableOpacity>
            )}

            {hasRequested && reqStatus === "pending" && (
              <TouchableOpacity
                onPress={handleCancelCoHost}
                activeOpacity={0.7}
                style={{
                  backgroundColor: "rgba(202,138,4,0.9)",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 28,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  elevation: 10,
                }}
              >
                <Text style={{ color: "white", fontWeight: "500", fontSize: 13 }}>Requested</Text>
                <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "500" }}>Cancel</Text>
                </View>
              </TouchableOpacity>
            )}

            {reqStatus === "rejected" && cooldown > 0 && (
              <View
                style={{
                  backgroundColor: "rgba(220,38,38,0.8)",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 28,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  elevation: 10,
                }}
              >
                <Text style={{ color: "white", fontWeight: "500", fontSize: 13 }}>Declined · {cooldown}s</Text>
              </View>
            )}

            {reqStatus === "accepted" && (
              <View
                style={{
                  backgroundColor: "#16A34A",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderRadius: 28,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  elevation: 10,
                }}
              >
                <Text style={{ color: "white", fontWeight: "600", fontSize: 13 }}>You're a Speaker</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

// ─── LiveScrollScreen ────────────────────────────────────────────────────────
interface LiveScrollScreenProps {
  initialStreamId?: string;
  onClose: () => void;
}

export default function LiveScrollScreen({
  initialStreamId,
  onClose,
}: LiveScrollScreenProps) {
  const { currentUser } = useUser();
  const { setSession, minimize } = useLiveSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { livestreams, loading } = useLivestreams();

  const [activeIndex, setActiveIndex] = useState(0);
  const [showChat, setShowChat] = useState(false);

  // Stream SDK state
  const [streamClient, setStreamClient] = useState<StreamVideoClient | null>(
    null,
  );
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const activeCallRef = useRef<Call | null>(null);

  // Host / Create flow
  const [hostMode, setHostMode] = useState(false);
  const [cohostStreamId, setCohostStreamId] = useState<string | null>(null);
  const [LiveWrapper, setLiveWrapper] = useState<React.ComponentType<{
    onClose: () => void;
    onMinimize?: () => void;
    initialStreamId?: string;
    showCreateModalOnMount?: boolean;
  }> | null>(null);
  const [wrapperLoading, setWrapperLoading] = useState(false);

  const hasAutoScrolled = useRef(false);
  const flatListRef = useRef<FlatList>(null);

  // ── Derive identity from logged-in user ──────────────────────────────────
  const identity = useMemo((): StreamIdentity | null => {
    if (!currentUser) return null;
    const id = (currentUser as any)?.id;
    if (typeof id !== "string" || !id) return null;
    const name =
      (currentUser as any)?.username ??
      (currentUser as any)?.name ??
      id;
    const image =
      (currentUser as any)?.profileImg ??
      (currentUser as any)?.avatar_url ??
      null;
    return { id, name: String(name), image };
  }, [currentUser]);

  // ── Initialise Stream SDK client once ────────────────────────────────────
  useEffect(() => {
    if (!identity) return;
    let cancelled = false;
    getStreamService
      .ensureClient(identity)
      .then((client) => {
        if (!cancelled) setStreamClient(client);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [identity]);

  // ── Switch call when activeIndex or client changes ───────────────────────
  useEffect(() => {
    if (!streamClient) return;

    const stream = livestreams[activeIndex];
    const callId = stream?.stream_provider_id;

    // No valid call ID → clear
    if (!callId) {
      if (activeCallRef.current) {
        activeCallRef.current.leave().catch(() => {});
        activeCallRef.current = null;
      }
      setActiveCall(null);
      return;
    }

    // Already on this call
    if (activeCallRef.current?.id === callId) return;

    // Leave old call
    if (activeCallRef.current) {
      activeCallRef.current.leave().catch(() => {});
    }

    // Create new call object (synchronous)
    const call = streamClient.call("livestream", callId);
    activeCallRef.current = call;
    setShowChat(false);

    // Fetch call metadata then expose
    call
      .get()
      .then(() => {
        if (activeCallRef.current === call) {
          setActiveCall(call);
        }
      })
      .catch(() => {
        // Still show the call — join will retry inside CallJoiner
        if (activeCallRef.current === call) {
          setActiveCall(call);
        }
      });
  }, [activeIndex, streamClient, livestreams]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (activeCallRef.current) {
        activeCallRef.current.leave().catch(() => {});
        activeCallRef.current = null;
      }
    };
  }, []);

  // ── Auto-scroll to initialStreamId ──────────────────────────────────────
  useEffect(() => {
    if (
      !initialStreamId ||
      hasAutoScrolled.current ||
      livestreams.length === 0
    )
      return;
    const idx = livestreams.findIndex(
      (s) =>
        s.id === initialStreamId ||
        s.stream_provider_id === initialStreamId,
    );
    if (idx >= 0) {
      hasAutoScrolled.current = true;
      setActiveIndex(idx);
      flatListRef.current?.scrollToIndex({ index: idx, animated: false });
    }
  }, [initialStreamId, livestreams]);

  // ── Lazy-load LiveWrapper (for Create Live) ─────────────────────────────
  type LiveWrapperType = React.ComponentType<{
    onClose: () => void;
    onMinimize?: () => void;
    initialStreamId?: string;
    showCreateModalOnMount?: boolean;
  }>;
  const ensureLiveWrapper = useCallback((): Promise<LiveWrapperType | null> => {
    if (LiveWrapper) return Promise.resolve(LiveWrapper);
    return new Promise((resolve) => {
      setWrapperLoading(true);
      import("@/components/livestream/LiveWrapper")
        .then((m) => {
          const W = m.default as LiveWrapperType;
          setLiveWrapper(() => W);
          setWrapperLoading(false);
          resolve(W);
        })
        .catch(() => {
          setWrapperLoading(false);
          resolve(null);
        });
    });
  }, [LiveWrapper]);

  // ── iOS edge-swipe to exit interactive mode ─────────────────────────────
  const showChatRef = useRef(showChat);
  useEffect(() => {
    showChatRef.current = showChat;
  }, [showChat]);

  const edgeSwipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture horizontal right-swipes starting near the left edge
        return (
          showChatRef.current &&
          gestureState.moveX < 40 &&
          gestureState.dx > 10 &&
          Math.abs(gestureState.dy) < 30
        );
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx > 60) {
          setShowChat(false);
        }
      },
    }),
  ).current;

  // ── Handlers ─────────────────────────────────────────────────────────────
  // Only enter interactive mode on tap — exit only via back gesture / button
  const handleTap = useCallback(() => {
    if (!showChat) {
      setShowChat(true);
    }
  }, [showChat]);

  const handleExitInteractive = useCallback(() => {
    setShowChat(false);
  }, []);

  const handleCreateLive = useCallback(async () => {
    await ensureLiveWrapper();
    setHostMode(true);
  }, [ensureLiveWrapper]);

  const handleHostClose = useCallback(() => {
    setHostMode(false);
  }, []);

  const handleCohostAccepted = useCallback(async (streamId: string) => {
    await ensureLiveWrapper();
    setCohostStreamId(streamId);
  }, [ensureLiveWrapper]);

  const handleCohostClose = useCallback(() => {
    setCohostStreamId(null);
  }, []);

  // ── Navigate to profile with PIP ────────────────────────────────────────
  const handleNavigateToProfile = useCallback((userId: string) => {
    if (!userId) return;
    // Hand off call to PIP overlay
    if (activeCallRef.current && streamClient) {
      const currentLivestream = livestreams[activeIndex] ?? null;
      setSession({
        call: activeCallRef.current,
        client: streamClient,
        streamMeta: currentLivestream,
        role: "viewer",
      });
      minimize();
      // Clear local refs so we don't double-leave
      activeCallRef.current = null;
      setActiveCall(null);
    }
    router.push(`/(users)/profile/${userId}` as any);
    onClose();
  }, [streamClient, livestreams, activeIndex, setSession, minimize, router, onClose]);

  // ── Continuous scroll tracking ───────────────────────────────────────────
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(
        e.nativeEvent.contentOffset.y / SCREEN_HEIGHT,
      );
      if (
        index !== activeIndex &&
        index >= 0 &&
        index < livestreams.length
      ) {
        setActiveIndex(index);
      }
    },
    [activeIndex, livestreams.length],
  );

  // ── Android back button ──────────────────────────────────────────────────
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showChat) {
        setShowChat(false);
        return true;
      }
      if (cohostStreamId) {
        handleCohostClose();
        return true;
      }
      if (hostMode) {
        setHostMode(false);
        return true;
      }
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [showChat, hostMode, cohostStreamId, onClose]);

  const currentStream = livestreams[activeIndex] ?? null;
  const streamReady = !!(streamClient && activeCall);

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="white" />
        <Text
          style={{
            color: "rgba(255,255,255,0.6)",
            marginTop: 14,
            fontSize: 14,
          }}
        >
          Loading streams…
        </Text>
      </View>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  if (livestreams.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        <StatusBar barStyle="light-content" />
        <TouchableOpacity
          onPress={onClose}
          style={{
            position: "absolute",
            top: insets.top + 10,
            left: 16,
            backgroundColor: "rgba(255,255,255,0.15)",
            borderRadius: 20,
            padding: 8,
          }}
        >
          <ChevronLeft size={22} color="white" />
        </TouchableOpacity>
        <Radio size={56} color="#374151" />
        <Text
          style={{
            color: "white",
            fontSize: 20,
            fontWeight: "700",
            marginTop: 20,
            textAlign: "center",
          }}
        >
          No live streams right now
        </Text>
        <Text
          style={{
            color: "#9CA3AF",
            fontSize: 14,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          Be the first one to go live!
        </Text>
        <TouchableOpacity
          onPress={handleCreateLive}
          activeOpacity={0.85}
          style={{
            marginTop: 28,
            backgroundColor: "#EF4444",
            borderRadius: 14,
            paddingHorizontal: 28,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          {wrapperLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Radio size={18} color="white" />
              <Text
                style={{
                  color: "white",
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                Start a Livestream
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Modal
          visible={hostMode && !!LiveWrapper}
          animationType="slide"
          presentationStyle="fullScreen"
          statusBarTranslucent
          onRequestClose={handleHostClose}
        >
          {LiveWrapper && (
            <LiveWrapper
              onClose={handleHostClose}
              showCreateModalOnMount
            />
          )}
        </Modal>
      </View>
    );
  }

  // ── Main content ─────────────────────────────────────────────────────────
  const mainContent = (
    <View style={{ flex: 1, backgroundColor: "#000" }} {...edgeSwipePan.panHandlers}>
      <StatusBar barStyle="light-content" />

      {/* ── Back button + host info — visible only in interactive mode ── */}
      {showChat && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 10,
            left: 12,
            zIndex: 15,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <TouchableOpacity
            onPress={handleExitInteractive}
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              borderRadius: 20,
              padding: 6,
            }}
          >
            <ChevronLeft size={24} color="white" />
          </TouchableOpacity>
          {currentStream && (
            <TouchableOpacity
              onPress={() => currentStream.user_id && handleNavigateToProfile(currentStream.user_id)}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                backgroundColor: "rgba(0,0,0,0.45)",
                borderRadius: 20,
                paddingRight: 12,
                paddingLeft: 3,
                paddingVertical: 3,
              }}
            >
              {currentStream.profile_image ? (
                <Image
                  source={{ uri: currentStream.profile_image }}
                  style={{ width: 28, height: 28, borderRadius: 14 }}
                />
              ) : (
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: "#094569",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>
                    {(currentStream.username ?? "U").charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text
                style={{ color: "white", fontWeight: "600", fontSize: 13 }}
                numberOfLines={1}
              >
                {currentStream.username ?? "Unknown"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── Top overlay — hidden in interactive mode ────────────────── */}
      {!showChat && (
        <View
          style={{
            position: "absolute",
            top: insets.top + 10,
            left: 0,
            right: 0,
            zIndex: 10,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
          }}
          pointerEvents="box-none"
        >
           <TouchableOpacity
            onPress={onClose}
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              borderRadius: 20,
              padding: 6,
              width: 36,
              alignItems: "center",
            }}
          >
            <ChevronLeft size={22} color="white" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <TouchableOpacity
              onPress={handleCreateLive}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(239,68,68,0.92)",
                borderRadius: 20,
                paddingHorizontal: 16,
                paddingVertical: 9,
              }}
            >
              <Radio size={15} color="white" />
              <Text
                style={{ color: "white", fontSize: 13, fontWeight: "700" }}
              >
                Create Live
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ width: 36 }} />

         
        </View>
      )}

      {/* ── Vertical FlatList pager ──────────────────────────────────── */}
      <FlatList
        ref={flatListRef}
        data={livestreams}
        keyExtractor={(item) => item.id}
        pagingEnabled
        scrollEnabled={!showChat}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <LivePage
            stream={item}
            isActive={index === activeIndex}
            onTap={handleTap}
            streamReady={streamReady}
            showChat={showChat}
            currentUserId={identity?.id ?? null}
            currentUsername={identity?.name ?? "User"}
            currentProfileImage={identity?.image ?? null}
            onCohostAccepted={handleCohostAccepted}
            onNavigateToProfile={handleNavigateToProfile}
          />
        )}
      />

      {/* ── LiveChat overlay (tap to show/hide) ──────────────────────── */}
      {showChat && currentStream && streamReady && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "40%",
            zIndex: 20,
          }}
          pointerEvents="box-none"
        >
          <LiveChat
            liveStreamId={currentStream.id}
            hostId={currentStream.user_id}
            isHostView={false}
            onNavigate={() => {
              // Hand off call to PIP so live stream continues while viewing profile
              if (activeCallRef.current && streamClient) {
                const current = livestreams[activeIndex] ?? null;
                setSession({
                  call: activeCallRef.current,
                  client: streamClient,
                  streamMeta: current,
                  role: "viewer",
                });
                minimize();
                activeCallRef.current = null;
                setActiveCall(null);
              }
              onClose();
            }}
          />
        </KeyboardAvoidingView>
      )}

      {/* ── Loading overlay while LiveWrapper imports ─────────────────── */}
      {wrapperLoading && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.65)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 30,
          }}
        >
          <ActivityIndicator size="large" color="white" />
          <Text style={{ color: "white", marginTop: 12, fontSize: 14 }}>
            Opening…
          </Text>
        </View>
      )}

      {/* ── Host modal (Create Live) ─────────────────────────────────── */}
      <Modal
        visible={hostMode && !!LiveWrapper}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={handleHostClose}
      >
        {LiveWrapper && (
          <LiveWrapper
            onClose={handleHostClose}
            showCreateModalOnMount
          />
        )}
      </Modal>

      {/* ── Cohost modal (accepted request → full viewer+speaker) ──── */}
      <Modal
        visible={!!cohostStreamId && !!LiveWrapper}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={handleCohostClose}
      >
        {LiveWrapper && cohostStreamId && (
          <LiveWrapper
            onClose={handleCohostClose}
            initialStreamId={cohostStreamId}
          />
        )}
      </Modal>
    </View>
  );

  // ── Wrap with Stream SDK providers when ready ─────────────────────────────
  if (streamClient && activeCall && currentStream) {
    return (
      <StreamVideo client={streamClient}>
        <StreamCall call={activeCall}>
          <CallJoiner streamId={currentStream.id} />
          {mainContent}
        </StreamCall>
      </StreamVideo>
    );
  }

  return mainContent;
}
