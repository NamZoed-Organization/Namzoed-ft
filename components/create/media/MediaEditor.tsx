/**
 * The picture editor — one photograph, five tabs, nothing destroyed.
 *
 * Everything here edits a *description* (`lib/mediaEdit.ts`) sitting beside
 * an untouched original, and pixels are only written on Done. That is what
 * lets you come back an hour later to a picture already in the composer and
 * find the crop handles where you left them and the filter still at 60%,
 * instead of a flattened JPEG you can only edit further by damaging it
 * again.
 *
 * **The canvas is the crop window, always.** Every tab looks through the
 * same frame: the aspect you chose, with the picture panned and pinched
 * behind it. The Crop tab only adds the grid and hands the gestures to the
 * picture; the other tabs hand the same gestures to whatever is drawn on
 * it. One renderer means the filter you pick is judged on the composition
 * you actually kept, which is the whole reason crop comes first.
 *
 * The five tabs are the ones a photograph actually needs, in the order they
 * are used: what is in the frame, the look, the fine tuning, what you write
 * on it, and what you point at. Anything past that — beauty filters,
 * blemish removal, thirty presets — is a different product.
 */

import FilteredImage, { paramsFor } from "@/components/create/media/FilteredImage";
import {
  flattenOverlays,
  measure,
  needsFlatten,
  renderPixels,
} from "@/components/create/media/exportEdit";
import OverlayLayer from "@/components/create/media/OverlayLayer";
import CircularLoader from "@/components/ui/CircularLoader";
import type { MascotMood } from "@/components/ui/Mascot";
import Mascot from "@/components/ui/Mascot";
import {
  ASPECT_ORDER,
  ASPECT_RATIOS,
  EMPTY_EDIT,
  FILTERS,
  NEUTRAL,
  newId,
  type AspectKey,
  type ColorAdjust,
  type ImageEdit,
  type PinTag,
} from "@/lib/mediaEdit";
import { searchTaggableItems, type TaggableItem } from "@/lib/taggableItems";
import Slider from "@react-native-community/slider";
import {
  Crop as CropIcon,
  FlipHorizontal2,
  Pencil,
  RotateCw,
  Sliders,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  Type as TypeIcon,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN = Dimensions.get("window");
const INK_COLORS = ["#FFFFFF", "#111827", "#DC2626", "#EDC06D", "#0369A1", "#16A34A"];
const STICKERS: MascotMood[] = [
  "normal",
  "excited",
  "superexcited",
  "confused",
  "surprised",
  "sleepy",
  "sad",
  "angry",
];

type TabKey = "crop" | "filter" | "adjust" | "draw" | "tag";
type DrawTool = "text" | "sticker" | "ink";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "crop", label: "Crop", icon: CropIcon },
  { key: "filter", label: "Filters", icon: Sparkles },
  { key: "adjust", label: "Adjust", icon: Sliders },
  { key: "draw", label: "Draw", icon: TypeIcon },
  { key: "tag", label: "Tag", icon: TagIcon },
];

const ADJUSTMENTS: { key: keyof ColorAdjust; label: string; min: number }[] = [
  { key: "brightness", label: "Brightness", min: -1 },
  { key: "contrast", label: "Contrast", min: -1 },
  { key: "saturation", label: "Saturation", min: -1 },
  { key: "warmth", label: "Warmth", min: -1 },
  { key: "sharpen", label: "Sharpen", min: 0 },
  { key: "vignette", label: "Vignette", min: 0 },
];

export interface EditorResult {
  /** The description, kept so the picture can be re-opened and un-edited. */
  edit: ImageEdit;
  /** The rendered file, or the original when nothing was changed. */
  uri: string;
}

export default function MediaEditor({
  visible,
  uri,
  edit: initialEdit,
  onCancel,
  onDone,
}: {
  visible: boolean;
  /** The **original** file, never a previously rendered one. */
  uri: string;
  edit?: ImageEdit;
  onCancel: () => void;
  onDone: (result: EditorResult) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>("crop");
  const [edit, setEdit] = useState<ImageEdit>(initialEdit ?? EMPTY_EDIT);
  const [source, setSource] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);

  // Crop is held as a window over the picture — zoom and offset — because
  // that is the gesture people already know (pinch the photo behind a fixed
  // frame). The stored `crop` rect is derived from it, so the export never
  // has to know about gestures.
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const [drawTool, setDrawTool] = useState<DrawTool>("text");
  const [inkColor, setInkColor] = useState(INK_COLORS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typing, setTyping] = useState<{ id: string | null; text: string } | null>(
    null,
  );
  const [pinning, setPinning] = useState<{ x: number; y: number } | null>(null);
  const [pinQuery, setPinQuery] = useState("");
  const [pinResults, setPinResults] = useState<TaggableItem[]>([]);

  const flattenHost = useRef<View>(null);
  const [flattenUri, setFlattenUri] = useState<string | null>(null);
  const flattenResolve = useRef<((uri: string) => void) | null>(null);

  useEffect(() => {
    if (!visible) return;
    setEdit(initialEdit ?? EMPTY_EDIT);
    setTab("crop");
    setSelectedId(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    measure(uri).then(setSource);
  }, [initialEdit, uri, visible]);

  // ── The canvas box ────────────────────────────────────────────────────

  const canvasWidth = SCREEN.width;
  const canvasMaxHeight = SCREEN.height * 0.56;
  const aspect = ASPECT_RATIOS[edit.aspect];
  const sourceAspect = source.width > 0 ? source.width / source.height : 1;
  const frameAspect = aspect ?? sourceAspect;
  const frame = useMemo(() => {
    let width = canvasWidth;
    let height = width / frameAspect;
    if (height > canvasMaxHeight) {
      height = canvasMaxHeight;
      width = height * frameAspect;
    }
    return { width, height };
  }, [canvasMaxHeight, canvasWidth, frameAspect]);

  /** How big the picture is drawn behind the frame at zoom 1 — cover, so
   *  there is never a gap at an edge. */
  const baseScale = useMemo(() => {
    if (source.width === 0) return 1;
    return Math.max(frame.width / source.width, frame.height / source.height);
  }, [frame.height, frame.width, source.height, source.width]);

  /** The window, back in the picture's own coordinates and normalised —
   *  which is exactly what the export crops with. */
  const commitCrop = useCallback(
    (nextZoom: number, nextOffset: { x: number; y: number }) => {
      if (source.width === 0) return;
      const scale = baseScale * nextZoom;
      const windowW = frame.width / scale;
      const windowH = frame.height / scale;
      const centreX = source.width / 2 - nextOffset.x / scale;
      const centreY = source.height / 2 - nextOffset.y / scale;
      const x = Math.min(
        Math.max(0, centreX - windowW / 2),
        Math.max(0, source.width - windowW),
      );
      const y = Math.min(
        Math.max(0, centreY - windowH / 2),
        Math.max(0, source.height - windowH),
      );
      const identity =
        nextZoom === 1 &&
        nextOffset.x === 0 &&
        nextOffset.y === 0 &&
        edit.aspect === "free";
      setEdit((prev) => ({
        ...prev,
        crop: identity
          ? null
          : {
              x: x / source.width,
              y: y / source.height,
              width: Math.min(1, windowW / source.width),
              height: Math.min(1, windowH / source.height),
            },
      }));
    },
    [baseScale, edit.aspect, frame.height, frame.width, source.height, source.width],
  );

  useEffect(() => {
    commitCrop(zoom, offset);
    // Re-derived whenever the window or the frame changes — including an
    // aspect switch, which changes the window without touching the gesture.
  }, [commitCrop, offset, zoom]);

  // ── Gestures on the picture (Crop tab) ────────────────────────────────

  /** Tabs that hand their gestures to the overlays still need *a* gesture
   *  for the detector; this one deliberately does nothing. */
  const inert = Gesture.Manual();

  // Panning and pinching are committed through React rather than a shared
  // value: the crop rect they produce is state the rest of the editor reads
  // (the export, the aspect row), and a value living only on the UI thread
  // would have to be copied back anyway. The gesture is coarse — a photo
  // being positioned, not a slider — so a re-render per frame is fine.
  /**
   * Positioning the picture runs entirely on the UI thread.
   *
   * It used to `setOffset` on every frame of the drag, which re-rendered the
   * whole editor — the GL canvas, the overlays, five panels — sixty times a
   * second, and the picture lagged behind the finger by however long that
   * took. Now the drag moves a transform through shared values and React
   * hears about it exactly once, on release, when the crop rectangle
   * actually has to be derived from it.
   */
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const scale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startScale = useSharedValue(1);

  /** The picture at zoom 1, which is what the transform scales from. */
  const baseWidth = source.width * baseScale;
  const baseHeight = source.height * baseScale;

  // An aspect change resets the window: the old offset was measured against
  // a frame that no longer exists.
  useEffect(() => {
    panX.value = 0;
    panY.value = 0;
    scale.value = 1;
  }, [edit.aspect, panX, panY, scale]);

  /** Clamped so the frame can never show past the picture's own edges — a
   *  gap in the frame is a crop that exports a black band. */
  const clamp = useCallback(
    (x: number, y: number, z: number) => {
      "worklet";
      const limitX = Math.max(0, (baseWidth * z - frame.width) / 2);
      const limitY = Math.max(0, (baseHeight * z - frame.height) / 2);
      return {
        x: Math.min(limitX, Math.max(-limitX, x)),
        y: Math.min(limitY, Math.max(-limitY, y)),
      };
    },
    [baseHeight, baseWidth, frame.height, frame.width],
  );

  /** Release is the only moment React needs the numbers. */
  const settleWindow = useCallback(
    (x: number, y: number, z: number) => {
      setOffset({ x, y });
      setZoom(z);
    },
    [],
  );

  const panPicture = Gesture.Pan()
    .enabled(tab === "crop")
    .onStart(() => {
      "worklet";
      startX.value = panX.value;
      startY.value = panY.value;
    })
    .onUpdate((e) => {
      "worklet";
      const next = clamp(
        startX.value + e.translationX,
        startY.value + e.translationY,
        scale.value,
      );
      panX.value = next.x;
      panY.value = next.y;
    })
    .onEnd(() => {
      "worklet";
      runOnJS(settleWindow)(panX.value, panY.value, scale.value);
    });

  const pinchPicture = Gesture.Pinch()
    .enabled(tab === "crop")
    .onStart(() => {
      "worklet";
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      "worklet";
      scale.value = Math.min(5, Math.max(1, startScale.value * e.scale));
      // Zooming out can leave the picture off-centre past its own edge.
      const next = clamp(panX.value, panY.value, scale.value);
      panX.value = next.x;
      panY.value = next.y;
    })
    .onEnd(() => {
      "worklet";
      runOnJS(settleWindow)(panX.value, panY.value, scale.value);
    });

  const pictureStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value },
      { translateY: panY.value },
      { scale: scale.value },
      { rotate: `${edit.rotate + edit.straighten}deg` },
      { scaleX: edit.flipH ? -1 : 1 },
    ],
  }));

  // ── Ink ───────────────────────────────────────────────────────────────

  const strokeRef = useRef<string | null>(null);
  const inkPan = Gesture.Pan()
    .enabled(tab === "draw" && drawTool === "ink")
    .onStart((e) => {
      const id = newId();
      strokeRef.current = id;
      setEdit((prev) => ({
        ...prev,
        overlays: [
          ...prev.overlays,
          {
            kind: "stroke",
            id,
            color: inkColor,
            width: 0.012,
            points: [{ x: e.x / frame.width, y: e.y / frame.height }],
          },
        ],
      }));
    })
    .onUpdate((e) => {
      const id = strokeRef.current;
      if (!id) return;
      setEdit((prev) => ({
        ...prev,
        overlays: prev.overlays.map((o) =>
          o.kind === "stroke" && o.id === id
            ? {
                ...o,
                points: [
                  ...o.points,
                  { x: e.x / frame.width, y: e.y / frame.height },
                ],
              }
            : o,
        ),
      }));
    })
    .onEnd(() => {
      strokeRef.current = null;
    })
    .runOnJS(true);

  // ── Pins ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!pinning) return;
    let alive = true;
    const t = setTimeout(() => {
      searchTaggableItems(pinQuery)
        .then((items) => alive && setPinResults(items))
        .catch(() => alive && setPinResults([]));
    }, 220);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [pinQuery, pinning]);

  const tapToPin = Gesture.Tap()
    .enabled(tab === "tag")
    .onEnd((e) => {
      setPinning({ x: e.x / frame.width, y: e.y / frame.height });
      setPinQuery("");
      setPinResults([]);
    })
    .runOnJS(true);

  const addPin = (item: TaggableItem) => {
    if (!pinning) return;
    const pin: PinTag = {
      id: newId(),
      kind: "product",
      refId: String(item.id),
      label: item.name,
      x: pinning.x,
      y: pinning.y,
      // Opens away from the nearer edge, so a label never runs off.
      side: pinning.x > 0.6 ? "left" : "right",
    };
    setEdit((prev) => ({ ...prev, pins: [...prev.pins, pin] }));
    setPinning(null);
  };

  // ── Overlays ──────────────────────────────────────────────────────────

  const updateOverlay = useCallback(
    (id: string, next: Partial<{ x: number; y: number; scale: number; rotation: number }>) => {
      setEdit((prev) => ({
        ...prev,
        overlays: prev.overlays.map((o) =>
          o.kind !== "stroke" && o.id === id ? { ...o, ...next } : o,
        ),
      }));
    },
    [],
  );

  const addText = (text: string, id: string | null) => {
    const value = text.trim();
    setEdit((prev) => {
      if (id) {
        return {
          ...prev,
          overlays: prev.overlays.map((o) =>
            o.kind === "text" && o.id === id ? { ...o, text: value } : o,
          ),
        };
      }
      if (!value) return prev;
      return {
        ...prev,
        overlays: [
          ...prev.overlays,
          {
            kind: "text",
            id: newId(),
            text: value,
            color: inkColor,
            plate: false,
            x: 0.5,
            y: 0.5,
            scale: 1,
            rotation: 0,
          },
        ],
      };
    });
    setTyping(null);
  };

  const addSticker = (mood: MascotMood) => {
    setEdit((prev) => ({
      ...prev,
      overlays: [
        ...prev.overlays,
        {
          kind: "sticker",
          id: newId(),
          mood,
          x: 0.5,
          y: 0.5,
          scale: 1,
          rotation: 0,
        },
      ],
    }));
  };

  const removeSelected = () => {
    if (!selectedId) return;
    setEdit((prev) => ({
      ...prev,
      overlays: prev.overlays.filter((o) => o.id !== selectedId),
    }));
    setSelectedId(null);
  };

  const undoStroke = () => {
    setEdit((prev) => {
      const lastStroke = [...prev.overlays]
        .reverse()
        .find((o) => o.kind === "stroke");
      if (!lastStroke) return prev;
      return {
        ...prev,
        overlays: prev.overlays.filter((o) => o !== lastStroke),
      };
    });
  };

  // ── Done ──────────────────────────────────────────────────────────────

  /**
   * Stages one and two run headlessly; stage three needs the off-screen
   * host to have actually painted, so it is mounted, awaited by a frame,
   * and only then photographed — a capture taken early flattens a grey
   * rectangle.
   */
  const handleDone = async () => {
    setBusy(true);
    try {
      const rendered = await renderPixels(uri, edit);
      if (!needsFlatten(edit)) {
        onDone({ edit, uri: rendered });
        return;
      }
      const flattened = await new Promise<string>((resolve) => {
        flattenResolve.current = resolve;
        setFlattenUri(rendered);
      });
      onDone({ edit, uri: flattened });
    } catch (e) {
      console.error("[MediaEditor] export failed", e);
      // A failed render must not lose the picture: the original goes back,
      // with the description intact so the edits can be retried.
      onDone({ edit, uri });
    } finally {
      setBusy(false);
      setFlattenUri(null);
    }
  };

  const onFlattenHostReady = useCallback(async () => {
    if (!flattenResolve.current || !flattenHost.current) return;
    // One frame for the image to paint before it is photographed.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      const out = await flattenOverlays(flattenHost.current);
      flattenResolve.current(out);
    } catch {
      flattenResolve.current(flattenUri ?? uri);
    }
    flattenResolve.current = null;
  }, [flattenUri, uri]);

  // ── Render ────────────────────────────────────────────────────────────

  const colorParams = useMemo(() => paramsFor(edit), [edit]);
  const canvasGesture = useMemo(() => {
    if (tab === "crop") return Gesture.Simultaneous(panPicture, pinchPicture);
    if (tab === "draw" && drawTool === "ink") return inkPan;
    if (tab === "tag") return tapToPin;
    return inert;
  }, [drawTool, inert, inkPan, panPicture, pinchPicture, tab, tapToPin]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar barStyle="light-content" />

        {/* Header — Cancel, and the one commitment. */}
        <View
          style={{
            paddingTop: insets.top + 6,
            paddingHorizontal: 16,
            paddingBottom: 10,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TouchableOpacity onPress={onCancel} disabled={busy} hitSlop={8}>
            <Text style={{ fontSize: 16, fontWeight: "500", color: "rgba(255,255,255,0.75)" }}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
            Edit picture
          </Text>
          <TouchableOpacity onPress={handleDone} disabled={busy} hitSlop={8}>
            {busy ? (
              <CircularLoader size="small" color="#fff" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#EDC06D" }}>
                Done
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* The canvas: the crop window, whatever tab is open. */}
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <GestureDetector gesture={canvasGesture}>
            <View
              style={{
                width: frame.width,
                height: frame.height,
                overflow: "hidden",
                backgroundColor: "#111",
              }}
            >
              {source.width > 0 && (
                <Animated.View
                  style={[
                    {
                      position: "absolute",
                      left: (frame.width - baseWidth) / 2,
                      top: (frame.height - baseHeight) / 2,
                      width: baseWidth,
                      height: baseHeight,
                    },
                    pictureStyle,
                  ]}
                >
                  <FilteredImage
                    uri={uri}
                    params={colorParams}
                    style={{ width: "100%", height: "100%" }}
                  />
                </Animated.View>
              )}

              {/* Rule of thirds, only while the frame is the thing being
                  decided — a grid over a filter choice is noise. */}
              {tab === "crop" && <ThirdsGrid />}

              <OverlayLayer
                overlays={edit.overlays}
                pins={edit.pins}
                size={frame}
                interactive={tab === "draw" || tab === "tag"}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={updateOverlay}
                onRemovePin={(id) =>
                  setEdit((prev) => ({
                    ...prev,
                    pins: prev.pins.filter((p) => p.id !== id),
                  }))
                }
              />
            </View>
          </GestureDetector>
        </View>

        {/* Tab body */}
        <View style={{ paddingBottom: 6 }}>
          {tab === "crop" && (
            <CropPanel
              edit={edit}
              onAspect={(key) => {
                setEdit((prev) => ({ ...prev, aspect: key }));
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              onRotate={() =>
                setEdit((prev) => ({
                  ...prev,
                  rotate: (((prev.rotate + 90) % 360) as ImageEdit["rotate"]),
                }))
              }
              onFlip={() => setEdit((prev) => ({ ...prev, flipH: !prev.flipH }))}
              onStraighten={(deg) => setEdit((prev) => ({ ...prev, straighten: deg }))}
            />
          )}

          {tab === "filter" && (
            <FilterStrip
              uri={uri}
              current={edit.filter}
              intensity={edit.intensity}
              onPick={(id) => setEdit((prev) => ({ ...prev, filter: id }))}
              onIntensity={(v) => setEdit((prev) => ({ ...prev, intensity: v }))}
            />
          )}

          {tab === "adjust" && (
            <AdjustPanel
              adjust={edit.adjust}
              onChange={(key, value) =>
                setEdit((prev) => ({
                  ...prev,
                  adjust: { ...prev.adjust, [key]: value },
                }))
              }
              onReset={() => setEdit((prev) => ({ ...prev, adjust: NEUTRAL }))}
            />
          )}

          {tab === "draw" && (
            <DrawPanel
              tool={drawTool}
              onTool={setDrawTool}
              color={inkColor}
              onColor={setInkColor}
              onAddText={() => setTyping({ id: null, text: "" })}
              onAddSticker={addSticker}
              onUndo={undoStroke}
              hasSelection={!!selectedId}
              onDeleteSelected={removeSelected}
            />
          )}

          {tab === "tag" && <TagHint count={edit.pins.length} />}
        </View>

        {/* Tabs */}
        <View
          style={{
            flexDirection: "row",
            paddingBottom: Math.max(insets.bottom, 10),
            paddingTop: 8,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: "rgba(255,255,255,0.12)",
          }}
        >
          {TABS.map((t) => {
            const on = tab === t.key;
            const Icon = t.icon;
            return (
              <TouchableOpacity
                key={t.key}
                onPress={() => {
                  setTab(t.key);
                  setSelectedId(null);
                }}
                style={{ flex: 1, alignItems: "center", paddingVertical: 4 }}
              >
                <Icon
                  size={20}
                  color={on ? "#EDC06D" : "rgba(255,255,255,0.6)"}
                  strokeWidth={on ? 2.2 : 1.8}
                />
                <Text
                  style={{
                    fontSize: 11,
                    marginTop: 3,
                    fontWeight: on ? "700" : "500",
                    color: on ? "#EDC06D" : "rgba(255,255,255,0.6)",
                  }}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Typing happens in a sheet, not on the picture: a keyboard over
            the canvas hides the half you are writing on. */}
        {typing && (
          <TextSheet
            initial={typing.text}
            onCancel={() => setTyping(null)}
            onDone={(text) => addText(text, typing.id)}
          />
        )}

        {pinning && (
          <PinSheet
            query={pinQuery}
            results={pinResults}
            onQuery={setPinQuery}
            onPick={addPin}
            onCancel={() => setPinning(null)}
          />
        )}

        {/* The flattening host: off screen, at export width, mounted only
            while stage three runs. */}
        {flattenUri && (
          <View
            collapsable={false}
            style={{ position: "absolute", left: -10000, top: 0 }}
          >
            <View
              ref={flattenHost}
              collapsable={false}
              style={{
                width: 1080,
                height: Math.round(1080 / frameAspect),
                backgroundColor: "#000",
              }}
            >
              <Image
                source={{ uri: flattenUri }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
                onLoadEnd={onFlattenHostReady}
              />
              <OverlayLayer
                overlays={edit.overlays}
                pins={[]}
                size={{ width: 1080, height: Math.round(1080 / frameAspect) }}
              />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Panels ──────────────────────────────────────────────────────────────

function ThirdsGrid() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {[1, 2].map((i) => (
        <View
          key={`h${i}`}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${(i * 100) / 3}%`,
            height: StyleSheet.hairlineWidth,
            backgroundColor: "rgba(255,255,255,0.4)",
          }}
        />
      ))}
      {[1, 2].map((i) => (
        <View
          key={`v${i}`}
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `${(i * 100) / 3}%`,
            width: StyleSheet.hairlineWidth,
            backgroundColor: "rgba(255,255,255,0.4)",
          }}
        />
      ))}
    </View>
  );
}

function PanelRow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 8 }}>{children}</View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        borderCurve: "continuous",
        marginRight: 8,
        backgroundColor: active ? "#EDC06D" : "rgba(255,255,255,0.12)",
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: active ? "#0A0A0A" : "rgba(255,255,255,0.85)",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function CropPanel({
  edit,
  onAspect,
  onRotate,
  onFlip,
  onStraighten,
}: {
  edit: ImageEdit;
  onAspect: (key: AspectKey) => void;
  onRotate: () => void;
  onFlip: () => void;
  onStraighten: (deg: number) => void;
}) {
  return (
    <>
      <PanelRow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {ASPECT_ORDER.map((key) => (
            <Chip
              key={key}
              label={key === "free" ? "Free" : key}
              active={edit.aspect === key}
              onPress={() => onAspect(key)}
            />
          ))}
          <View style={{ width: 8 }} />
          <TouchableOpacity onPress={onRotate} style={toolButton}>
            <RotateCw size={18} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onFlip} style={toolButton}>
            <FlipHorizontal2 size={18} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        </ScrollView>
      </PanelRow>
      <PanelRow>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text style={labelStyle}>Straighten</Text>
          <Slider
            style={{ flex: 1 }}
            minimumValue={-15}
            maximumValue={15}
            step={0.5}
            value={edit.straighten}
            onValueChange={onStraighten}
            minimumTrackTintColor="#EDC06D"
            maximumTrackTintColor="rgba(255,255,255,0.25)"
            thumbTintColor="#fff"
          />
          <Text style={[labelStyle, { width: 42, textAlign: "right" }]}>
            {edit.straighten.toFixed(1)}°
          </Text>
        </View>
      </PanelRow>
    </>
  );
}

/**
 * The filmstrip.
 *
 * The thumbnails are the picture with a cheap approximation of each look
 * laid over it, not eight live GL contexts — eight shaders running under a
 * scrolling row costs more than it tells you, and the true render is
 * already on the canvas the moment you tap one. What a thumbnail has to do
 * is say *warmer*, *cooler*, *flatter*, *grey*; the canvas says the rest.
 */
function FilterStrip({
  uri,
  current,
  intensity,
  onPick,
  onIntensity,
}: {
  uri: string;
  current: string;
  intensity: number;
  onPick: (id: string) => void;
  onIntensity: (v: number) => void;
}) {
  return (
    <>
      <PanelRow>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map((f) => {
            const on = current === f.id;
            const tint = f.tint;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => onPick(f.id)}
                activeOpacity={0.85}
                style={{ marginRight: 10, alignItems: "center" }}
              >
                <View
                  style={{
                    width: 62,
                    height: 62,
                    borderRadius: 12,
                    borderCurve: "continuous",
                    overflow: "hidden",
                    borderWidth: on ? 2 : 0,
                    borderColor: "#EDC06D",
                  }}
                >
                  <Image
                    source={{ uri }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                  {tint && (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        {
                          backgroundColor: `rgba(${Math.round(tint[0] * 255)},${Math.round(
                            tint[1] * 255,
                          )},${Math.round(tint[2] * 255)},${(f.tintAmount ?? 0) * 2.2})`,
                        },
                      ]}
                    />
                  )}
                  {f.adjust.saturation <= -0.9 && (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: "rgba(120,120,120,0.55)" },
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    marginTop: 5,
                    fontWeight: on ? "700" : "500",
                    color: on ? "#EDC06D" : "rgba(255,255,255,0.75)",
                  }}
                >
                  {f.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </PanelRow>
      {current !== "none" && (
        <PanelRow>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={labelStyle}>Strength</Text>
            <Slider
              style={{ flex: 1 }}
              minimumValue={0}
              maximumValue={1}
              value={intensity}
              onValueChange={onIntensity}
              minimumTrackTintColor="#EDC06D"
              maximumTrackTintColor="rgba(255,255,255,0.25)"
              thumbTintColor="#fff"
            />
            <Text style={[labelStyle, { width: 42, textAlign: "right" }]}>
              {Math.round(intensity * 100)}%
            </Text>
          </View>
        </PanelRow>
      )}
    </>
  );
}

function AdjustPanel({
  adjust,
  onChange,
  onReset,
}: {
  adjust: ColorAdjust;
  onChange: (key: keyof ColorAdjust, value: number) => void;
  onReset: () => void;
}) {
  return (
    <ScrollView style={{ maxHeight: 168 }} showsVerticalScrollIndicator={false}>
      {ADJUSTMENTS.map((a) => (
        <PanelRow key={a.key}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={[labelStyle, { width: 78 }]}>{a.label}</Text>
            <Slider
              style={{ flex: 1 }}
              minimumValue={a.min}
              maximumValue={1}
              value={adjust[a.key]}
              onValueChange={(v) => onChange(a.key, v)}
              minimumTrackTintColor="#EDC06D"
              maximumTrackTintColor="rgba(255,255,255,0.25)"
              thumbTintColor="#fff"
            />
            <Text style={[labelStyle, { width: 34, textAlign: "right" }]}>
              {Math.round(adjust[a.key] * 100)}
            </Text>
          </View>
        </PanelRow>
      ))}
      <PanelRow>
        <TouchableOpacity onPress={onReset} style={{ alignSelf: "flex-start" }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.6)" }}>
            Reset all
          </Text>
        </TouchableOpacity>
      </PanelRow>
    </ScrollView>
  );
}

function DrawPanel({
  tool,
  onTool,
  color,
  onColor,
  onAddText,
  onAddSticker,
  onUndo,
  hasSelection,
  onDeleteSelected,
}: {
  tool: DrawTool;
  onTool: (t: DrawTool) => void;
  color: string;
  onColor: (c: string) => void;
  onAddText: () => void;
  onAddSticker: (m: MascotMood) => void;
  onUndo: () => void;
  hasSelection: boolean;
  onDeleteSelected: () => void;
}) {
  return (
    <>
      <PanelRow>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Chip label="Text" active={tool === "text"} onPress={() => onTool("text")} />
          <Chip
            label="Stickers"
            active={tool === "sticker"}
            onPress={() => onTool("sticker")}
          />
          <Chip label="Ink" active={tool === "ink"} onPress={() => onTool("ink")} />
          <View style={{ flex: 1 }} />
          {hasSelection && (
            <TouchableOpacity onPress={onDeleteSelected} style={toolButton}>
              <Trash2 size={18} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </PanelRow>

      {tool === "text" && (
        <PanelRow>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              onPress={onAddText}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(255,255,255,0.12)",
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                borderCurve: "continuous",
              }}
            >
              <Pencil size={16} color="#fff" strokeWidth={2} />
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
                Write something
              </Text>
            </TouchableOpacity>
            <ColorRow color={color} onColor={onColor} />
          </View>
        </PanelRow>
      )}

      {tool === "sticker" && (
        <PanelRow>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {STICKERS.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => onAddSticker(m)}
                style={{
                  width: 56,
                  height: 56,
                  marginRight: 8,
                  borderRadius: 12,
                  borderCurve: "continuous",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Mascot mood={m} size={40} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </PanelRow>
      )}

      {tool === "ink" && (
        <PanelRow>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <ColorRow color={color} onColor={onColor} />
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onUndo}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,0.7)" }}>
                Undo stroke
              </Text>
            </TouchableOpacity>
          </View>
        </PanelRow>
      )}
    </>
  );
}

function ColorRow({
  color,
  onColor,
}: {
  color: string;
  onColor: (c: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {INK_COLORS.map((c) => (
        <TouchableOpacity
          key={c}
          onPress={() => onColor(c)}
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            borderCurve: "continuous",
            backgroundColor: c,
            borderWidth: color === c ? 2.5 : 1,
            borderColor: color === c ? "#EDC06D" : "rgba(255,255,255,0.4)",
          }}
        />
      ))}
    </View>
  );
}

function TagHint({ count }: { count: number }) {
  return (
    <PanelRow>
      <Text style={{ fontSize: 13, lineHeight: 19, color: "rgba(255,255,255,0.7)" }}>
        {count === 0
          ? "Tap the picture where the thing is, then choose what it is. The label stays on that spot in the feed."
          : `${count} tagged. Tap the picture again to add another, or the × on a label to take it off.`}
      </Text>
    </PanelRow>
  );
}

// ── Sheets ──────────────────────────────────────────────────────────────

/**
 * Writing on the picture.
 *
 * **The way out is pinned to the top, above the keyboard.** It sat at the
 * top of a sheet anchored to the *bottom* of the screen, which the keyboard
 * then covered completely — leaving no Done, no Cancel, and a multiline
 * field whose return key inserts a newline rather than finishing. There was
 * genuinely no way off this screen but killing the app.
 *
 * Three ways out now, and all of them work with the keyboard up: **Done**
 * and **Cancel** in a bar at the top of the screen, and a tap anywhere on
 * the darkened area outside the field, which commits like Done. Multiline
 * stays — a caption on a photograph legitimately wraps — so return still
 * makes a new line, and that is only acceptable because it is no longer the
 * only key that could end this.
 */
function TextSheet({
  initial,
  onCancel,
  onDone,
}: {
  initial: string;
  onCancel: () => void;
  onDone: (text: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const insets = useSafeAreaInsets();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.8)" }]}>
      {/* The bar, above everything, where the keyboard cannot reach it. */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <TouchableOpacity onPress={onCancel} hitSlop={10} style={{ padding: 4 }}>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onDone(value)}
          hitSlop={10}
          style={{ padding: 4 }}
        >
          <Text style={{ color: "#EDC06D", fontSize: 16, fontWeight: "700" }}>
            Done
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tapping the dark commits what has been typed — the gesture people
          try first on every editor that works this way. */}
      <Pressable style={{ flex: 1 }} onPress={() => onDone(value)}>
        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24 }}>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            multiline
            placeholder="Type on the picture"
            placeholderTextColor="rgba(255,255,255,0.45)"
            // Written as it will appear, centred, so what is being typed is
            // what lands on the photograph rather than a form field's
            // version of it.
            style={{
              color: "#fff",
              fontSize: 26,
              fontWeight: "700",
              textAlign: "center",
              maxHeight: 220,
            }}
          />
        </View>
      </Pressable>

      <Text
        style={{
          color: "rgba(255,255,255,0.45)",
          fontSize: 12.5,
          textAlign: "center",
          paddingBottom: Math.max(insets.bottom, 10) + 6,
        }}
      >
        Tap anywhere to finish
      </Text>
    </View>
  );
}

function PinSheet({
  query,
  results,
  onQuery,
  onPick,
  onCancel,
}: {
  query: string;
  results: TaggableItem[];
  onQuery: (q: string) => void;
  onPick: (item: TaggableItem) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.72)" }]}
    >
      {/* Above the keyboard, not under it. A bottom-anchored sheet with an
          autofocused field is a sheet the keyboard covers whole — its
          Cancel included, which is the trap the text sheet next door was in
          until somebody got stuck in it. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, justifyContent: "flex-end" }}
      >
      <View
        style={{
          backgroundColor: "#1A1A1A",
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: Math.max(insets.bottom, 12) + 8,
          maxHeight: SCREEN.height * 0.6,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 12,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
            What is it?
          </Text>
          <TouchableOpacity onPress={onCancel}>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 15 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          value={query}
          onChangeText={onQuery}
          autoFocus
          placeholder="Search products and services"
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={{
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 999,
            borderCurve: "continuous",
            paddingHorizontal: 14,
            paddingVertical: Platform.OS === "ios" ? 10 : 6,
            color: "#fff",
            fontSize: 15,
          }}
        />
        <ScrollView style={{ marginTop: 10 }} keyboardShouldPersistTaps="handled">
          {results.map((item) => (
            <TouchableOpacity
              key={String(item.id)}
              onPress={() => onPick(item)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 10,
              }}
            >
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={{ width: 38, height: 38, borderRadius: 8 }}
                />
              ) : (
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    borderCurve: "continuous",
                    backgroundColor: "rgba(255,255,255,0.1)",
                  }}
                />
              )}
              <Text numberOfLines={1} style={{ flex: 1, color: "#fff", fontSize: 15 }}>
                {item.name}
              </Text>
            </TouchableOpacity>
          ))}
          {results.length === 0 && (
            <Text
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 14,
                paddingVertical: 14,
              }}
            >
              {query.trim()
                ? "Nothing by that name."
                : "Search for the product or service in the picture."}
            </Text>
          )}
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const labelStyle = {
  fontSize: 13,
  fontWeight: "600" as const,
  color: "rgba(255,255,255,0.75)",
};

const toolButton = {
  width: 34,
  height: 34,
  borderRadius: 17,
  borderCurve: "continuous" as const,
  backgroundColor: "rgba(255,255,255,0.12)",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  marginRight: 8,
};
