/**
 * Everything drawn *on* a picture: words, stickers, ink — and the pinned
 * tags, which are drawn but never burned in.
 *
 * The same component does the editing and the export. Interactive, each
 * item carries its own drag/pinch/rotate; static, it is the exact same
 * layout at the export's size, which is what gets flattened. Two components
 * would mean two layouts, and the first thing that drifts between them is
 * the one nobody notices until a caption lands two millimetres off in the
 * published picture.
 *
 * **Positions are fractions of the picture, never points.** An item placed
 * on a 340pt preview has to land in the same place in a 1080px export, so
 * every overlay stores `x`/`y` in 0…1 and every size is a fraction of the
 * canvas width. The centring trick throughout is a full-size wrapper that
 * centres its child and then translates by `(x - 0.5) * W` — it puts an
 * item's *middle* on the point without ever measuring the item.
 *
 * Pins are the exception to flattening: a tag is data the feed draws, so it
 * can be tapped, priced live and removed later. Burning it in would make a
 * shopping post a picture of a shopping post.
 */

import Mascot from "@/components/ui/Mascot";
import type { Overlay, PinTag, StrokeOverlay, TextOverlay } from "@/lib/mediaEdit";
import { X } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import Svg, { Polyline } from "react-native-svg";

/** Text is sized as a fraction of the picture's width, so it exports at the
 *  proportion it was written at rather than at 17pt on a 4000px photo. */
const TEXT_BASE = 0.075;
const STICKER_BASE = 0.22;

export interface CanvasSize {
  width: number;
  height: number;
}

// ── One draggable thing ─────────────────────────────────────────────────

function Placed({
  item,
  size,
  interactive,
  selected,
  onSelect,
  onChange,
  children,
}: {
  item: Exclude<Overlay, StrokeOverlay>;
  size: CanvasSize;
  interactive: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onChange: (id: string, next: Partial<{ x: number; y: number; scale: number; rotation: number }>) => void;
  children: React.ReactNode;
}) {
  // Seeded from the item and driven on the UI thread while the finger is
  // down; the committed value goes back to React on release, so a drag
  // never re-renders the whole editor 60 times a second.
  const x = useSharedValue(item.x);
  const y = useSharedValue(item.y);
  const scale = useSharedValue(item.scale);
  const rotation = useSharedValue(item.rotation);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startRotation = useSharedValue(0);

  React.useEffect(() => {
    x.value = item.x;
    y.value = item.y;
    scale.value = item.scale;
    rotation.value = item.rotation;
  }, [item.x, item.y, item.scale, item.rotation, rotation, scale, x, y]);

  const commit = React.useCallback(
    (next: { x: number; y: number; scale: number; rotation: number }) => {
      onChange(item.id, next);
    },
    [item.id, onChange],
  );

  const pan = Gesture.Pan()
    .enabled(interactive)
    .onStart(() => {
      "worklet";
      startX.value = x.value;
      startY.value = y.value;
      runOnJS(onSelect)(item.id);
    })
    .onUpdate((e) => {
      "worklet";
      // Clamped a little inside the frame: an overlay dragged off the edge
      // is one you can never grab again.
      x.value = Math.min(1.02, Math.max(-0.02, startX.value + e.translationX / size.width));
      y.value = Math.min(1.02, Math.max(-0.02, startY.value + e.translationY / size.height));
    })
    .onEnd(() => {
      "worklet";
      runOnJS(commit)({
        x: x.value,
        y: y.value,
        scale: scale.value,
        rotation: rotation.value,
      });
    });

  const pinch = Gesture.Pinch()
    .enabled(interactive)
    .onStart(() => {
      "worklet";
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      "worklet";
      scale.value = Math.min(4, Math.max(0.3, startScale.value * e.scale));
    })
    .onEnd(() => {
      "worklet";
      runOnJS(commit)({
        x: x.value,
        y: y.value,
        scale: scale.value,
        rotation: rotation.value,
      });
    });

  const rotate = Gesture.Rotation()
    .enabled(interactive)
    .onStart(() => {
      "worklet";
      startRotation.value = rotation.value;
    })
    .onUpdate((e) => {
      "worklet";
      rotation.value = startRotation.value + (e.rotation * 180) / Math.PI;
    })
    .onEnd(() => {
      "worklet";
      runOnJS(commit)({
        x: x.value,
        y: y.value,
        scale: scale.value,
        rotation: rotation.value,
      });
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (x.value - 0.5) * size.width },
      { translateY: (y.value - 0.5) * size.height },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  const body = (
    <Animated.View
      style={[
        style,
        selected && interactive
          ? {
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.9)",
              borderRadius: 6,
              borderCurve: "continuous",
              borderStyle: "dashed",
            }
          : null,
      ]}
    >
      {children}
    </Animated.View>
  );

  return (
    <View
      pointerEvents={interactive ? "box-none" : "none"}
      style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
    >
      {interactive ? (
        <GestureDetector gesture={Gesture.Simultaneous(pan, pinch, rotate)}>
          {body}
        </GestureDetector>
      ) : (
        body
      )}
    </View>
  );
}

// ── The layer ───────────────────────────────────────────────────────────

export default function OverlayLayer({
  overlays,
  pins,
  size,
  interactive = false,
  selectedId,
  onSelect,
  onChange,
  onRemovePin,
}: {
  overlays: Overlay[];
  pins: PinTag[];
  size: CanvasSize;
  interactive?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onChange?: (id: string, next: Partial<{ x: number; y: number; scale: number; rotation: number }>) => void;
  /** Absent on the export pass, where nothing is removable. */
  onRemovePin?: (id: string) => void;
}) {
  const strokes = overlays.filter((o): o is StrokeOverlay => o.kind === "stroke");
  const placed = overlays.filter(
    (o): o is Exclude<Overlay, StrokeOverlay> => o.kind !== "stroke",
  );

  return (
    <View pointerEvents={interactive ? "box-none" : "none"} style={StyleSheet.absoluteFill}>
      {/* Ink under everything else: you draw on the photograph, not on the
          caption. */}
      {strokes.length > 0 && (
        <Svg
          width={size.width}
          height={size.height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          {strokes.map((s) => (
            <Polyline
              key={s.id}
              points={s.points
                .map((p) => `${p.x * size.width},${p.y * size.height}`)
                .join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={Math.max(1, s.width * size.width)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      )}

      {placed.map((item) => (
        <Placed
          key={item.id}
          item={item}
          size={size}
          interactive={interactive}
          selected={selectedId === item.id}
          onSelect={onSelect ?? (() => {})}
          onChange={onChange ?? (() => {})}
        >
          {item.kind === "text" ? (
            <TextBody item={item} width={size.width} />
          ) : (
            <Mascot mood={item.mood} size={size.width * STICKER_BASE} />
          )}
        </Placed>
      ))}

      {/* Pins last, and never flattened — they are data the feed draws. */}
      {pins.map((pin) => (
        <View
          key={pin.id}
          pointerEvents={interactive ? "box-none" : "none"}
          style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}
        >
          <View
            style={{
              transform: [
                { translateX: (pin.x - 0.5) * size.width },
                { translateY: (pin.y - 0.5) * size.height },
              ],
              flexDirection: pin.side === "left" ? "row-reverse" : "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            {/* The dot is the anchor; the label opens away from the nearest
                edge so a pin near the right does not run off the picture. */}
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                borderCurve: "continuous",
                backgroundColor: "#fff",
                borderWidth: 2,
                borderColor: "rgba(17,24,39,0.6)",
              }}
            />
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(17,24,39,0.72)",
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: 999,
                borderCurve: "continuous",
                maxWidth: size.width * 0.6,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: "#fff", fontSize: 12.5, fontWeight: "600" }}
              >
                {pin.label}
              </Text>
              {interactive && onRemovePin && (
                <TouchableOpacity onPress={() => onRemovePin(pin.id)} hitSlop={8}>
                  <X size={13} color="rgba(255,255,255,0.8)" strokeWidth={2.4} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function TextBody({ item, width }: { item: TextOverlay; width: number }) {
  const fontSize = width * TEXT_BASE;
  return (
    <View
      style={
        item.plate
          ? {
              backgroundColor: "rgba(17,24,39,0.55)",
              paddingHorizontal: fontSize * 0.4,
              paddingVertical: fontSize * 0.18,
              borderRadius: fontSize * 0.3,
              borderCurve: "continuous",
            }
          : undefined
      }
    >
      <Text
        style={{
          color: item.color,
          fontSize,
          fontWeight: "700",
          // A shadow rather than an outline: RN has no text stroke, and
          // white words on a bright sky are unreadable without one of them.
          textShadowColor: item.plate ? "transparent" : "rgba(0,0,0,0.35)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: fontSize * 0.12,
        }}
      >
        {item.text}
      </Text>
    </View>
  );
}
