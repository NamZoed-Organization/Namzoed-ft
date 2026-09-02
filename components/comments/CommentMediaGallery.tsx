import CircularLoader from "@/components/ui/CircularLoader";
import { CommentMediaItem } from "@/lib/commentsService";
import { EdgeGestureCarouselHandle, registerEdgeGestureCarousel } from "@/utils/edgeGestureRegistry";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { Video as VideoIcon, X } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const PRIMARY = "#094569";
const SIZE = 200;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Renders a video paused on its first frame — same "mini post" grid-card
 * treatment as PostGridCard's VideoFrameThumbnail (never calls .play()). */
function VideoFrameThumbnail({ uri, style }: { uri: string; style: { width: number | string; height: number | string } }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.muted = true;
    p.loop = false;
  });
  return <VideoView player={player} style={style as any} nativeControls={false} contentFit="cover" />;
}

function VideoBadge() {
  return (
    <View
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        borderCurve: "continuous",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "rgba(255,255,255,0.35)",
        backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(0,0,0,0.45)",
      }}
    >
      {Platform.OS === "ios" && <BlurView tint="dark" intensity={50} style={StyleSheet.absoluteFill} />}
      <VideoIcon size={12} color="#fff" />
    </View>
  );
}

function CounterPill({ index, total }: { index: number; total: number }) {
  return (
    <View
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        backgroundColor: "rgba(0,0,0,0.55)",
        borderRadius: 999,
        borderCurve: "continuous",
        paddingHorizontal: 7,
        paddingVertical: 3,
      }}
    >
      <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>
        {index + 1}/{total}
      </Text>
    </View>
  );
}

function DotsRow({ index, total }: { index: number; total: number }) {
  const dotSize = total > 6 ? 4 : 6;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            borderCurve: "continuous",
            backgroundColor: i === index ? PRIMARY : "#D1D5DB",
          }}
        />
      ))}
    </View>
  );
}

function Slide({ item, size, onPress }: { item: CommentMediaItem; size: number; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={item.isOptimistic}
      style={{ width: size, height: size, backgroundColor: "#E5E7EB" }}
    >
      {item.type === "video" ? (
        <VideoFrameThumbnail uri={item.url} style={{ width: size, height: size }} />
      ) : (
        <Image source={{ uri: item.url }} style={{ width: size, height: size }} contentFit="cover" cachePolicy="memory-disk" />
      )}
      {item.type === "video" && <VideoBadge />}
      {item.isOptimistic && (
        <View style={[StyleSheet.absoluteFillObject, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)" }]}>
          <CircularLoader size="small" color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

function FullscreenVideo({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (p) => {
    p.loop = false;
  });
  return <VideoView player={player} style={{ width, height }} nativeControls contentFit="contain" />;
}

/** Fullscreen paged viewer — grows from the carousel's own on-screen rect
 * (measured via measureInWindow) rather than just popping/fading in, same
 * lightweight Animated-API hero transition as the single-image viewer had,
 * extended to swipe between every attached item once fully open. */
function GalleryViewer({
  items,
  visible,
  startIndex,
  containerRef,
  onClose,
}: {
  items: CommentMediaItem[];
  visible: boolean;
  startIndex: number;
  containerRef: React.RefObject<View | null>;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const progress = useRef(new Animated.Value(0)).current;

  const screen = Dimensions.get("window");
  const finalHeight = screen.height * 0.7;
  const finalRect: Rect = { x: 0, y: (screen.height - finalHeight) / 2, width: screen.width, height: finalHeight };

  useEffect(() => {
    if (!visible) return;
    setActiveIndex(startIndex);
    setPhase("opening");
    containerRef.current?.measureInWindow((x, y, width, height) => {
      setRect({ x, y, width, height });
      progress.setValue(0);
      Animated.spring(progress, {
        toValue: 1,
        useNativeDriver: false,
        damping: 20,
        stiffness: 200,
        mass: 0.9,
      }).start(({ finished }) => {
        if (finished) setPhase("open");
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, startIndex]);

  const requestClose = () => {
    setPhase("closing");
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / finalRect.width);
    setActiveIndex(Math.min(items.length - 1, Math.max(0, idx)));
  };

  if (!visible || !rect) return null;

  const activeItem = items[activeIndex];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={requestClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: "#000", opacity: progress }]} />

        {phase === "open" ? (
          <View style={{ position: "absolute", left: finalRect.x, top: finalRect.y, width: finalRect.width, height: finalRect.height }}>
            <FlatList
              data={items}
              keyExtractor={(it) => it.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={startIndex}
              getItemLayout={(_, index) => ({ length: finalRect.width, offset: finalRect.width * index, index })}
              onMomentumScrollEnd={handleMomentumEnd}
              renderItem={({ item }) => (
                <View style={{ width: finalRect.width, height: finalRect.height, alignItems: "center", justifyContent: "center" }}>
                  {item.type === "video" ? (
                    <FullscreenVideo uri={item.url} width={finalRect.width} height={finalRect.height} />
                  ) : (
                    <Image source={{ uri: item.url }} style={{ width: finalRect.width, height: finalRect.height }} contentFit="contain" cachePolicy="memory-disk" />
                  )}
                </View>
              )}
            />
          </View>
        ) : (
          <TouchableOpacity activeOpacity={1} onPress={requestClose} style={StyleSheet.absoluteFillObject}>
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: progress.interpolate({ inputRange: [0, 1], outputRange: [rect.x, finalRect.x] }),
                top: progress.interpolate({ inputRange: [0, 1], outputRange: [rect.y, finalRect.y] }),
                width: progress.interpolate({ inputRange: [0, 1], outputRange: [rect.width, finalRect.width] }),
                height: progress.interpolate({ inputRange: [0, 1], outputRange: [rect.height, finalRect.height] }),
                borderRadius: progress.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
                borderCurve: "continuous",
                overflow: "hidden",
                backgroundColor: "#000",
              }}
            >
              {activeItem.type === "video" ? (
                <VideoFrameThumbnail uri={activeItem.url} style={{ width: "100%", height: "100%" }} />
              ) : (
                <Animated.Image source={{ uri: activeItem.url }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
              )}
            </Animated.View>
          </TouchableOpacity>
        )}

        {items.length > 1 && phase === "open" && (
          <View pointerEvents="none" style={{ position: "absolute", top: 56, left: 0, right: 0, alignItems: "center" }}>
            <View style={{ backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "700" }}>
                {activeIndex + 1}/{items.length}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          onPress={requestClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ position: "absolute", top: 56, right: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}
        >
          <X size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

interface CommentMediaGalleryProps {
  items: CommentMediaItem[];
}

/** Renders a comment/reply's image/video attachments — the same "mini post"
 * carousel treatment as the main feed: paged horizontal scroll, a "N/total"
 * counter pill top-right, dots below, a video badge top-left on video
 * slides, and a fullscreen paged viewer on tap. */
export default function CommentMediaGallery({ items }: CommentMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);
  const containerRef = useRef<View>(null);
  const multipleItems = items.length > 1;

  // Lets ContextDrop's edge-swipe-back gesture (see PostDetailOverlay) tell
  // this gallery's "swipe right to see the previous image" apart from an
  // actual back gesture — see utils/edgeGestureRegistry.ts.
  const edgeGestureHandleRef = useRef<EdgeGestureCarouselHandle | null>(null);

  const remeasure = () => {
    containerRef.current?.measureInWindow((_x, y, _w, h) => {
      edgeGestureHandleRef.current?.setBounds(y, y + h);
    });
  };

  useEffect(() => {
    if (!multipleItems) return;
    const handle = registerEdgeGestureCarousel();
    edgeGestureHandleRef.current = handle;
    return () => {
      handle.unregister();
      edgeGestureHandleRef.current = null;
    };
  }, [multipleItems]);

  useEffect(() => {
    edgeGestureHandleRef.current?.setHasPrevious(activeIndex > 0);
    remeasure();
  }, [activeIndex]);

  if (items.length === 0) return null;

  const openViewer = (index: number) => {
    setViewerStartIndex(index);
    setViewerOpen(true);
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.min(items.length - 1, Math.max(0, Math.round(x / SIZE)));
    setActiveIndex((prev) => (prev === idx ? prev : idx));
  };

  return (
    <View style={{ alignSelf: "flex-start" }}>
      <View
        ref={containerRef}
        collapsable={false}
        onLayout={remeasure}
        style={{ width: SIZE, height: SIZE, borderRadius: 12, overflow: "hidden", backgroundColor: "#E5E7EB" }}
      >
        {items.length > 1 ? (
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={({ item, index }) => <Slide item={item} size={SIZE} onPress={() => openViewer(index)} />}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />
        ) : (
          <Slide item={items[0]} size={SIZE} onPress={() => openViewer(0)} />
        )}
        {items.length > 1 && <CounterPill index={activeIndex} total={items.length} />}
      </View>

      {items.length > 1 && <DotsRow index={activeIndex} total={items.length} />}

      <GalleryViewer
        items={items}
        visible={viewerOpen}
        startIndex={viewerStartIndex}
        containerRef={containerRef}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}
