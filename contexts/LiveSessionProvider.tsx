import {
  ParticipantView,
  StreamCall,
  StreamVideo,
  type Call,
  type StreamVideoClient,
} from "@stream-io/video-react-native-sdk";
import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

interface LiveSessionInfo {
  call: Call | null;
  client: StreamVideoClient | null;
  streamMeta?: any;
  role?: "host" | "viewer" | null;
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
  const [collapsed, setCollapsed] = useState(false);
  const [restoreHandler, setRestoreHandler] = useState<(() => void) | null>(
    null
  );
  const [pendingRestore, setPendingRestore] = useState(false);

  const { width, height } = useWindowDimensions();
  const defaultPos = useRef({
    x: width - 200,
    y: Math.max(40, height - 220),
  });
  const [position, setPosition] = useState(() => defaultPos.current);

  const clampX = (x: number, boxWidth: number) =>
    Math.max(8, Math.min(x, width - boxWidth - 8));
  const clampY = (y: number, boxHeight: number) =>
    Math.max(16, Math.min(y, height - boxHeight - 16));

  const snapToCorner = (x: number, y: number, boxW: number, boxH: number) => {
    const corners = [
      { x: 8, y: 16 },
      { x: width - boxW - 8, y: 16 },
      { x: 8, y: height - boxH - 16 },
      { x: width - boxW - 8, y: height - boxH - 16 },
    ];
    let best = corners[0];
    let bestDist = Infinity;
    for (const c of corners) {
      const dx = c.x - x;
      const dy = c.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  };

  const panResponder = useMemo(() => {
    const moveThreshold = 6;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        const dist = Math.abs(gesture.dx) + Math.abs(gesture.dy);
        return dist > moveThreshold;
      },
      onPanResponderMove: (_evt, gesture) => {
        setPosition((prev) => {
          const boxW = collapsed ? 64 : 180;
          const boxH = collapsed ? 64 : 120;
          const nextX = clampX(prev.x + gesture.dx, boxW);
          const nextY = clampY(prev.y + gesture.dy, boxH);
          return { x: nextX, y: nextY };
        });
      },
      onPanResponderRelease: (_evt, gesture) => {
        setPosition((prev) => {
          const boxW = collapsed ? 64 : 180;
          const boxH = collapsed ? 64 : 120;
          const nextX = clampX(prev.x + gesture.dx, boxW);
          const nextY = clampY(prev.y + gesture.dy, boxH);
          return snapToCorner(nextX, nextY, boxW, boxH);
        });
      },
    });
  }, [width, height, collapsed]);

  // Keep position in bounds on orientation change or collapse toggle
  React.useEffect(() => {
    const boxW = collapsed ? 64 : 180;
    const boxH = collapsed ? 64 : 120;
    setPosition((prev) => ({
      x: clampX(prev.x, boxW),
      y: clampY(prev.y, boxH),
    }));
  }, [width, height, collapsed]);

  const setSession = (info: LiveSessionInfo) => {
    setSessionState(info);
    setMinimized(false);
    setCollapsed(false);
  };

  const clearSession = async () => {
    try {
      await session.call?.leave();
    } catch {
      /* ignore */
    }
    setSessionState({ call: null, client: null, streamMeta: null, role: null });
    setMinimized(false);
    setCollapsed(false);
  };

  const restore = () => {
    setMinimized(false);
    setCollapsed(false);
    if (restoreHandler) {
      try {
        restoreHandler();
        setPendingRestore(false);
      } catch {
        setPendingRestore(true);
      }
    } else {
      setPendingRestore(true);
    }
  };

  const value = useMemo<LiveSessionContextValue>(
    () => ({
      session,
      minimized,
      setSession,
      clearSession,
      minimize: () => setMinimized(true),
      restore,
      setRestoreHandler,
      pendingRestore,
      consumePendingRestore: () => setPendingRestore(false),
    }),
    [session, minimized, restoreHandler, pendingRestore]
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
  const mainParticipant =
    session.call?.state.localParticipant ?? session.call?.state.participants[0];
  const overlayWidth = collapsed ? 64 : 180;
  const overlayHeight = collapsed ? 64 : 120;

  return (
    <LiveSessionContext.Provider value={value}>
      {children}
      {showOverlay ? (
        <StreamVideo client={session.client!}>
          <StreamCall call={session.call!}>
            <View
              style={[
                styles.overlayContainer,
                {
                  width: overlayWidth,
                  height: overlayHeight,
                  left: position.x,
                  top: position.y,
                },
              ]}
              pointerEvents="box-none"
              {...panResponder.panHandlers}
            >
              {collapsed ? (
                <TouchableOpacity
                  style={styles.overlayCollapsed}
                  onPress={() => setCollapsed(false)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.overlayLabel}>Live</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.overlayCard}>
                  <TouchableOpacity
                    style={styles.overlayVideo}
                    onPress={restore}
                    activeOpacity={0.9}
                  >
                    {mainParticipant ? (
                      <ParticipantView
                        participant={mainParticipant}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : null}
                    <View style={styles.overlayLabelWrap}>
                      <Text style={styles.overlayLabel}>
                        {session.streamMeta?.title || "Live"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.overlayActions}>
                    <TouchableOpacity onPress={restore}>
                      <Text style={styles.overlayActionText}>Open</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCollapsed(true)}>
                      <Text style={styles.overlayActionText}>Hide</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={clearSession}>
                      <Text
                        style={[styles.overlayActionText, { color: "#F87171" }]}
                      >
                        Close
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </StreamCall>
        </StreamVideo>
      ) : null}
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
    right: 12,
    bottom: 90,
    width: 180,
    height: 120,
    zIndex: 1000,
  },
  overlayCard: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  overlayVideo: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 8,
    backgroundColor: "#000",
  },
  overlayLabelWrap: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  overlayLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  overlayCollapsed: {
    flex: 1,
    backgroundColor: "#000",
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  overlayActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.75)",
  },
  overlayActionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
});
