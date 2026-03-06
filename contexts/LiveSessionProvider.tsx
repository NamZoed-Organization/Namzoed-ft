import { X as XIcon } from "lucide-react-native";
import React, {
    createContext,
    useContext,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ActivityIndicator,
    Animated,
    BackHandler,
    Modal,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";

// PiP card size — portrait 9:16
const PIP_W = 108;
const PIP_H = 192;

// Define types without importing WebRTC modules at the top level
interface Call {
  leave: () => Promise<void>;
  state: {
    localParticipant?: any;
    participants: any[];
  };
}

interface StreamVideoClient {}

interface LiveSessionInfo {
  call: Call | null;
  client: StreamVideoClient | null;
  streamMeta?: any;
  role?: "host" | "viewer" | "cohost" | null;
}

interface LiveSessionContextValue {
  session: LiveSessionInfo;
  minimized: boolean;
  setSession: (info: LiveSessionInfo) => void;
  clearSession: () => Promise<void>;
  minimize: () => void;
  restore: () => void;
  setRestoreHandler: (fn: (() => void) | null) => void;
  pendingRestore: boolean;
  consumePendingRestore: () => void;
}

// Check if WebRTC is available (will be false in Expo Go)
let webRTCAvailable = false;
let StreamVideo: any = null;
let StreamCall: any = null;
let ParticipantView: any = null;

try {
  const webRTCModule = require("@stream-io/video-react-native-sdk");
  StreamVideo = webRTCModule.StreamVideo;
  StreamCall = webRTCModule.StreamCall;
  ParticipantView = webRTCModule.ParticipantView;
  webRTCAvailable = true;
} catch (error) {
  console.warn("WebRTC not available (Expo Go). Live features will be disabled.");
  webRTCAvailable = false;
}

// LiveWrapper is required lazily at render time (not at module level) to avoid a
// circular import: LiveWrapper → Live.tsx → useLiveSession → LiveSessionProvider.
// By the time any component renders, all modules are fully loaded, so require() is safe.
function getLiveWrapperComponent(): React.ComponentType<{ onClose: () => void; onMinimize?: () => void }> | null {
  try {
    return require("@/components/livestream/LiveWrapper").default;
  } catch {
    return null;
  }
}

const LiveSessionContext = createContext<LiveSessionContextValue | undefined>(
  undefined
);

export const LiveSessionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [session, setSessionState] = useState<LiveSessionInfo>({
    call: null,
    client: null,
    streamMeta: null,
    role: null,
  });
  const [minimized, setMinimized] = useState(false);
  const [showRestoredModal, setShowRestoredModal] = useState(false);
  const [restoreHandler, setRestoreHandler] = useState<(() => void) | null>(
    null
  );
  const [pendingRestore, setPendingRestore] = useState(false);

  const { width, height } = useWindowDimensions();

  const clampX = (x: number) => Math.max(8, Math.min(x, width - PIP_W - 8));
  const clampY = (y: number) => Math.max(16, Math.min(y, height - PIP_H - 16));

  // Always-current position reference — avoids stale closure issues inside panResponder
  const positionRef = useRef({ x: width - PIP_W - 12, y: height - PIP_H - 100 });
  // Animated value drives the actual rendered position (enables spring animation on release)
  const animPos = useRef(new Animated.ValueXY(positionRef.current)).current;
  // Captures overlay position at the start of each drag gesture
  const dragStartRef = useRef({ x: 0, y: 0 });

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      // Only claim the gesture after a deliberate 12 px movement
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dx) + Math.abs(gesture.dy) > 12,
      onPanResponderGrant: () => {
        // Snapshot current position so we can apply gesture.dx/dy as absolute offsets
        dragStartRef.current = { ...positionRef.current };
      },
      onPanResponderMove: (_evt, gesture) => {
        const nx = clampX(dragStartRef.current.x + gesture.dx);
        const ny = clampY(dragStartRef.current.y + gesture.dy);
        positionRef.current = { x: nx, y: ny };
        animPos.setValue({ x: nx, y: ny });
      },
      onPanResponderRelease: (_evt, gesture) => {
        const nx = clampX(dragStartRef.current.x + gesture.dx);
        const ny = clampY(dragStartRef.current.y + gesture.dy);

        // Edge-snap X: use velocity to bias the edge choice when near centre.
        // vx > 0 means thrown right, vx < 0 means thrown left.
        const projectedX = nx + gesture.vx * 180;
        const targetX = projectedX > width / 2 ? width - PIP_W - 8 : 8;

        // Fling Y: project forward with velocity so a hard throw travels further.
        const targetY = clampY(ny + gesture.vy * 180);

        positionRef.current = { x: targetX, y: targetY };
        Animated.spring(animPos, {
          toValue: { x: targetX, y: targetY },
          useNativeDriver: false,
          velocity: { x: gesture.vx, y: gesture.vy },
          tension: 70,
          friction: 9,
        }).start();
      },
    });
  }, [width, height]);

  // Re-clamp position when screen dimensions change (e.g. device rotation)
  React.useEffect(() => {
    const newPos = {
      x: clampX(positionRef.current.x),
      y: clampY(positionRef.current.y),
    };
    positionRef.current = newPos;
    animPos.setValue(newPos);
  }, [width, height]);

  const setSession = (info: LiveSessionInfo) => {
    setSessionState(info);
    setMinimized(false);
  };

  const clearSession = async () => {
    try {
      await session.call?.leave();
    } catch {
      /* ignore */
    }
    setSessionState({ call: null, client: null, streamMeta: null, role: null });
    setMinimized(false);
    setShowRestoredModal(false);
  };

  // restore() now opens a root-level Modal directly — no restoreHandler/navigation needed.
  // This is rendered by LiveSessionProvider which wraps the entire app, so the Modal
  // always appears above all navigation screens.
  const restore = () => {
    setMinimized(false);
    setShowRestoredModal(true);
  };

  const value = useMemo<LiveSessionContextValue>(
    () => ({
      session,
      minimized,
      setSession,
      clearSession,
      minimize: () => {
        setMinimized(true);
        setShowRestoredModal(false);
      },
      restore,
      setRestoreHandler,
      pendingRestore,
      consumePendingRestore: () => setPendingRestore(false),
    }),
    [session, minimized, restoreHandler, pendingRestore, showRestoredModal]
  );

  // If a restore was requested before a handler was available, trigger it once the handler mounts
  React.useEffect(() => {
    if (pendingRestore && restoreHandler) {
      try {
        restoreHandler();
        setPendingRestore(false);
      } catch {
        // keep pending flag so another screen can handle it
      }
    }
  }, [pendingRestore, restoreHandler]);

  const showOverlay = minimized && session.call && session.client;

  // Hardware back button restores the full-screen stream when the overlay is visible
  React.useEffect(() => {
    if (!showOverlay) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      restore();
      return true; // prevent default back navigation
    });
    return () => sub.remove();
  }, [showOverlay]);

  const mainParticipant = (() => {
    const all = session.call?.state.participants ?? [];
    const local = session.call?.state.localParticipant;

    if (session.role === "viewer") {
      // Viewers don't publish video — show the first remote participant (the host)
      const remote = all.find((p: any) => p.userId !== local?.userId);
      return remote ?? local ?? all[0] ?? null;
    }

    return local ?? all[0] ?? null;
  })();

  const renderOverlay = () => {
    if (!showOverlay) return null;

    const overlayContent = (
      <Animated.View
        style={[
          styles.overlayContainer,
          { width: PIP_W, height: PIP_H },
          animPos.getLayout(),
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.overlayCard}>
          {/* Video feed fills the card */}
          {webRTCAvailable && mainParticipant ? (
            <ParticipantView
              participant={mainParticipant}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.overlayNoVideo]}>
              <Text style={styles.overlayNoVideoText}>LIVE</Text>
            </View>
          )}

          {/* Transparent full-card tap area → restore fullscreen */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={restore}
            activeOpacity={0.15}
          />

          {/* Overlaid controls — rendered last so they sit above the tap area */}
          <View style={[StyleSheet.absoluteFill]} pointerEvents="box-none">
            {/* Top bar: LIVE badge + close */}
            <View style={styles.overlayTopBar}>
              <View style={styles.overlayLiveBadge}>
                <View style={styles.overlayLiveDot} />
                <Text style={styles.overlayLiveText}>LIVE</Text>
              </View>
              <TouchableOpacity
                style={styles.overlayCloseBtn}
                onPress={clearSession}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <XIcon size={13} color="#fff" strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {/* Spacer */}
            <View style={{ flex: 1 }} pointerEvents="none" />

            {/* Bottom: stream title */}
            <View style={styles.overlayBottomBar} pointerEvents="none">
              <Text style={styles.overlayTitle} numberOfLines={1}>
                {session.streamMeta?.title || "Live"}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    );

    if (webRTCAvailable && StreamVideo && StreamCall) {
      return (
        <StreamVideo client={session.client!}>
          <StreamCall call={session.call!}>
            {overlayContent}
          </StreamCall>
        </StreamVideo>
      );
    }
    return overlayContent;
  };

  return (
    <LiveSessionContext.Provider value={value}>
      {children}
      {renderOverlay()}
      {/* Restore modal — rendered at root level so it always appears above all navigation screens */}
      <Modal
        visible={showRestoredModal}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={true}
        onRequestClose={() => { /* let Live.tsx handle its own close button */ }}
      >
        {(() => {
          const LiveWrapperComp = getLiveWrapperComponent();
          return LiveWrapperComp ? (
            <LiveWrapperComp
              onClose={clearSession}
              onMinimize={() => {
                setMinimized(true);
                setShowRestoredModal(false);
              }}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#fff" size="large" />
            </View>
          );
        })()}
      </Modal>
    </LiveSessionContext.Provider>
  );
};

export const useLiveSession = () => {
  const ctx = useContext(LiveSessionContext);
  if (!ctx)
    throw new Error("useLiveSession must be used within LiveSessionProvider");
  return ctx;
};

const styles = StyleSheet.create({
  overlayContainer: {
    position: "absolute",
    zIndex: 9999,
    elevation: 10,
  },
  overlayCard: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 10,
  },
  overlayNoVideo: {
    backgroundColor: "#1c1c1e",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayNoVideoText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  overlayTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingTop: 7,
    paddingBottom: 4,
  },
  overlayLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
    gap: 4,
  },
  overlayLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#ef4444",
  },
  overlayLiveText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
  },
  overlayCloseBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  overlayBottomBar: {
    paddingHorizontal: 8,
    paddingBottom: 8,
    paddingTop: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overlayTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 10,
    fontWeight: "600",
  },
});
