/**
 * The Setlog camera.
 *
 * The preview is a rounded card filling four fifths of the screen, and every
 * control is a translucent circle on the picture itself — mode top-left,
 * self-timer top-right, camera flip bottom-left, flash bottom-right. Four
 * corners, one control each, nothing in the middle but the clock. A camera
 * screen with a tray of controls under it reads as a form with a photo
 * attached; this reads as a viewfinder.
 *
 * **The camera reads landscape by default**, and everything the app draws
 * on the picture turns with it: the clock, every orb's glyph, every pill's
 * label. This is a vlog camera, so the frame worth having is wide, and
 * furniture that reads upright in the hand would be on its side in every
 * clip. One shared value — `rotation` — is what they all read, so the
 * screen can never end up half-turned, and the turn is one movement of the
 * whole screen rather than eight things separately arriving at the angle.
 *
 * The frame is set from the capture menu and by nothing else — it never
 * swings round on its own because the phone tipped. Anyone who would rather
 * shoot upright switches it to portrait there, and that choice is
 * remembered: it is a way of holding the phone, not a thing to re-decide
 * every time. The menu itself is the one thing that does not turn with it.
 *
 * **Every mode stops itself.** 2s, 5s, Jumpcut (10s), Timelapse (30s),
 * Photo. There is no free-running record button, and two seconds is still
 * the default, because it is still the length that is too short to perform
 * in.
 *
 * **The title comes after the recording, never before.** A text field in
 * front of a camera is a form; the same field over a clip you already have
 * is a remark about it. Optional, and skipping it is one tap.
 *
 * Arriving with no `id` means the plus button: the clip lands in your own
 * log, created on the spot by `ensurePersonalLog`. Arriving with one means
 * you tapped an hour inside a log, and it lands there.
 */

import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import { BlurView } from "expo-blur";
import {
  CAPTURE_MODES,
  CAPTURE_MODE_ORDER,
  DEFAULT_CAPTURE_MODE,
  DEFAULT_VIDEO_QUALITY,
  VIDEO_QUALITIES,
  type CaptureMode,
  type VideoQuality,
  currentSlot,
  ensurePersonalLog,
  formatClock,
  prependClipToFeedCache,
  resolveUserId,
  uploadClip,
} from "@/lib/setlogService";
import { loadCameraDefaults, saveCameraDefaults } from "@/lib/setlogSettings";
import { useUser } from "@/contexts/UserContext";
import { useAppRouter } from "@/utils/navigation";
import { useIsFocused } from "@react-navigation/native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import { useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  Check,
  ChevronLeft,
  RefreshCw,
  Timer,
  Zap,
  ZapOff,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { keepRecordedClip } from "@/lib/setlogMediaCache";
import Reanimated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const { height: SCREEN_H } = Dimensions.get("window");
const CARD_INSET = 12;
/** Four fifths of the screen. The clamp where it is used only bites on a
 *  small phone, where 80% would leave no room for the shutter beneath. */
const CARD_TARGET_H = Math.round(SCREEN_H * 0.8);
const HEADER_H = 44;
const FOOT_MIN = 92;
/** Generous, because the card is the whole screen's worth of picture. */
const CARD_RADIUS = 18;

const ORB = 42;
/** The menu hangs off the control that opened it, so it is sized to the
 *  card rather than to its own content. */
const MENU_W = Math.min(
  Dimensions.get("window").width - CARD_INSET * 2 - 76,
  280,
);
const SHUTTER = 64;
const SHUTTER_BORDER = 3;
const TITLE_MAX = 60;

/** Which way the camera's own furniture reads. Landscape is the default,
 *  because this is a vlog camera and the frame worth having is wide. */
type FrameOrientation = "landscape" | "portrait";

/** Self-timer options, in seconds. Off is the absence of one, not a value. */
const TIMERS = [0, 3, 10] as const;
/**
 * The zoom stops.
 *
 * Two different mechanisms behind one row. **0.5× is a lens**, not a zoom
 * level: `zoom` cannot reach past the wide-angle camera, so the ultra-wide
 * stop switches `selectedLens` instead. Everything from 1× up **is** the
 * `zoom` prop, which is a fraction of that lens's own maximum rather than
 * an optical factor — so ×2/×4/×8 are positions along that range, and the
 * labels are the stops a person expects to see rather than a promise about
 * focal length.
 *
 * Lens selection is iOS-only, so 0.5× appears only where the device
 * actually reports an ultra-wide camera — see `lenses` below. A stop that
 * did nothing would be worse than one that is missing.
 */
const ULTRA_WIDE_LENS = "builtInUltraWideCamera";
const WIDE_LENS = "builtInWideAngleCamera";

const ZOOMS: { label: string; value: number; lens: string }[] = [
  { label: "0.5", value: 0, lens: ULTRA_WIDE_LENS },
  { label: "1x", value: 0, lens: WIDE_LENS },
  { label: "2", value: 0.14, lens: WIDE_LENS },
  { label: "4", value: 0.34, lens: WIDE_LENS },
  { label: "8", value: 0.6, lens: WIDE_LENS },
];

/** Legible over a bright sky and a dark room alike, without dropping a
 *  scrim over the whole frame. */
const OVER_MEDIA = {
  color: "#fff",
  textShadowColor: "rgba(0,0,0,0.4)",
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 12,
} as const;

type Phase = "ready" | "counting" | "recording" | "review" | "uploading" | "failed";

/**
 * One of the four corner controls: a translucent circle on the picture.
 * Dark rather than light because a control over a viewfinder has to stay
 * readable against a white wall as well as a night sky.
 */
function Orb({
  onPress,
  onLongPress,
  disabled,
  children,
  style,
  rotateStyle,
}: {
  onPress: () => void;
  /** Every control that has more than two values opens its full list on a
   *  hold — see `OptionSheet`. */
  onLongPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  style?: object;
  /** Turns the glyph, never the button: a circle is a circle either way,
   *  and it is the mark inside it that has to stand up. Animated, so the
   *  whole screen turns together — see `rotationStyle`. */
  rotateStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={280}
      disabled={disabled}
      style={{
        position: "absolute",
        width: ORB,
        height: ORB,
        borderRadius: ORB / 2,
        borderCurve: "continuous",
        backgroundColor: "rgba(17,24,39,0.45)",
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.4 : 1,
        ...style,
      }}
    >
      <Reanimated.View style={rotateStyle}>{children}</Reanimated.View>
    </TouchableOpacity>
  );
}

/**
 * The flash glyph. Auto is a bolt with an `A` beside it, because a bolt on
 * its own is what "on" looks like — the two states were telling the same
 * story with the same picture, and only the label underneath disagreed.
 */
function FlashGlyph({ mode, size = 19 }: { mode: "off" | "on" | "auto"; size?: number }) {
  if (mode === "off") return <ZapOff size={size} color="#fff" strokeWidth={1.8} />;
  if (mode === "on") return <Zap size={size} color="#fff" strokeWidth={1.8} />;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Zap size={size} color="#fff" strokeWidth={1.8} />
      <Text
        style={{
          fontSize: size * 0.55,
          fontWeight: "800",
          color: "#fff",
          marginLeft: 1,
        }}
      >
        A
      </Text>
    </View>
  );
}

/**
 * The full list behind a control — an iOS context menu, near enough.
 *
 * Not the app's `BottomSheetModal` (§ Sheets): a sheet from the bottom edge
 * slides the viewfinder away, and every choice here is about what the
 * camera is doing *right now*, so it has to be made while the frame is
 * still visible. It keeps the sheet's substance — a labelled group, one row
 * per option, a check on the live one — and only where it appears differs.
 *
 * It is the one thing on this camera that does **not** turn with the frame.
 * A system menu is aligned to the screen, never to the picture, and a menu
 * that rotated would be the only sideways text anyone had to read to make a
 * decision.
 *
 * The blur is what makes it read as a menu rather than a panel: the whole
 * frame goes soft behind it, so the choice is plainly in front of the
 * camera rather than part of it.
 *
 * **It grows out of the control that opened it.** The menu is pinned to
 * that control's own corner and scales from exactly that point —
 * `transformOrigin`, not a centred scale, which would have it swell out of
 * the middle of the frame and then settle somewhere else. A menu that
 * appears where you pressed needs no explaining; one that appears anywhere
 * else has to be found again every time.
 */
const MENU_ANCHORS = {
  "top-left": { position: { top: 10, left: 10 }, origin: "top left" },
  "top-right": { position: { top: 10, right: 10 }, origin: "top right" },
  "bottom-right": { position: { bottom: 10, right: 10 }, origin: "bottom right" },
} as const;

type MenuAnchor = keyof typeof MENU_ANCHORS;

function OptionSheet<T extends string>({
  groups,
  onClose,
  anchor,
}: {
  groups: {
    label: string;
    options: { value: T; label: string }[];
    selected: T;
    onSelect: (value: T) => void;
  }[];
  onClose: () => void;
  /** Which control it belongs to — where it grows from, and where it sits. */
  anchor: MenuAnchor;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  /** Runs the growth backwards before unmounting, so the menu returns to
   *  the control rather than blinking out of existence. */
  const dismiss = () => {
    progress.value = withTiming(
      0,
      { duration: 150, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onClose)();
      },
    );
  };

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const menuStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    // Starts near enough to a point to read as coming *out* of the orb,
    // far enough from zero that the type never renders at an unreadable
    // size on the first frame.
    transform: [{ scale: 0.4 + 0.6 * progress.value }],
  }));

  const { position, origin } = MENU_ANCHORS[anchor];

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* The scrim is the way out — there is no close button, because this
          is a glance at a list, not a screen. */}
      <Reanimated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={dismiss}
          style={StyleSheet.absoluteFill}
        >
          <BlurView
            intensity={24}
            tint="dark"
            style={StyleSheet.absoluteFill}
            experimentalBlurMethod="dimezisBlurView"
          />
        </TouchableOpacity>
      </Reanimated.View>

      <Reanimated.View
        style={[
          {
            position: "absolute",
            ...position,
            width: MENU_W,
            transformOrigin: origin,
          },
          menuStyle,
        ]}
      >
      <BlurView
        intensity={70}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={{
          width: "100%",
          borderRadius: 16,
          borderCurve: "continuous",
          overflow: "hidden",
          paddingVertical: 6,
        }}
      >
        {groups.map((group, gi) => (
          <View key={group.label}>
            {gi > 0 && (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  marginVertical: 6,
                  marginHorizontal: 16,
                }}
              />
            )}
            <Text
              style={{
                fontSize: 15,
                fontWeight: "500",
                color: "rgba(255,255,255,0.55)",
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: 4,
              }}
            >
              {group.label}
            </Text>
            {group.options.map((option) => {
              const selected = option.value === group.selected;
              return (
                <TouchableOpacity
                  key={option.value}
                  activeOpacity={0.6}
                  onPress={() => {
                    Haptics.selectionAsync();
                    group.onSelect(option.value);
                    dismiss();
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                  }}
                >
                  {/* The check leads the row and holds its column whether or
                      not it is drawn, so the labels stay in one line. */}
                  <View style={{ width: 26 }}>
                    {selected && <Check size={18} color="#fff" strokeWidth={2.4} />}
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: "400", color: "#fff" }}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </BlurView>
      </Reanimated.View>
    </View>
  );
}

/**
 * The zoom scale, in the shape iOS's camera uses: the stops in a row, the
 * live one picked out in amber.
 *
 * The labels are honest about what they can be. `CameraView`'s `zoom` is a
 * fraction of whatever the device's own maximum happens to be, not an
 * optical factor, so these are positions along that range — which is why
 * there is no ".5": the ultra-wide lens is not reachable through that prop
 * at all, and a stop that did nothing would be worse than one that is
 * missing.
 */
function ZoomScale({
  stops,
  index,
  onSelect,
  rotateStyle,
}: {
  /** Indices into `ZOOMS`, so a hidden stop cannot shift the selection. */
  stops: number[];
  index: number;
  onSelect: (index: number) => void;
  rotateStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 66,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 26,
      }}
    >
      {stops.map((i) => {
        const z = ZOOMS[i];
        const active = i === index;
        return (
          <TouchableOpacity
            key={z.label}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(i);
            }}
          >
            {/* The row keeps its place along the card's edge; it is the
                digits that stand up, like every other glyph here. */}
            <Reanimated.View style={rotateStyle}>
              <Text
                style={{
                  fontSize: active ? 15 : 14,
                  fontWeight: active ? "700" : "500",
                  // Amber is the camera's own convention for the live stop,
                  // the same licence the record ring takes for red.
                  color: active ? "#FBBF24" : "rgba(255,255,255,0.75)",
                  textShadowColor: "rgba(0,0,0,0.4)",
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 8,
                }}
              >
                {z.label}
              </Text>
            </Reanimated.View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function SetlogCaptureScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { id, hour } = useLocalSearchParams<{ id?: string; hour?: string }>();
  const { currentUser } = useUser();

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  // Back camera by default: what you are pointing at is the usual subject,
  // and the flip is one tap away in the corner.
  const [facing, setFacing] = useState<"front" | "back">("back");
  const [mode, setMode] = useState<CaptureMode>(DEFAULT_CAPTURE_MODE);
  const [quality, setQuality] = useState<VideoQuality>(DEFAULT_VIDEO_QUALITY);
  const [timerIndex, setTimerIndex] = useState(0);
  // 1× rather than 0.5×: the wide lens is the one every phone has, and the
  // ultra-wide stop is dropped entirely on a phone that lacks it.
  const [zoomIndex, setZoomIndex] = useState(1);
  const [lenses, setLenses] = useState<string[]>([]);
  /** The stored defaults have landed, so the rotation may start animating. */
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);
  const [flash, setFlash] = useState<"off" | "on" | "auto">("off");

  const [phase, setPhase] = useState<Phase>("ready");
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [frame, setFrame] = useState<FrameOrientation>("landscape");
  /** Which control has its full list open, if any. */
  const [sheet, setSheet] = useState<null | "capture" | "timer" | "flash">(null);

  /**
   * What the camera opens on, from Setlog's settings screen.
   *
   * Read once, on mount. Everything here can still be changed from the
   * camera's own controls for one take — those deliberately do *not* write
   * back, so a one-off 30s clip does not quietly become the new default.
   * The frame is the exception, because it is a way of holding the phone
   * rather than a property of a take.
   */
  useEffect(() => {
    loadCameraDefaults().then((d) => {
      setFrame(d.frame);
      setMode(d.mode);
      setQuality(d.quality);
      setFlash(d.flash);
      setFacing(d.facing);
      setTimerIndex(Math.max(0, TIMERS.indexOf(d.timerSeconds as (typeof TIMERS)[number])));
      setZoomIndex(d.zoomIndex);
      setDefaultsLoaded(true);
    });
  }, []);

  const setFrameAndRemember = (next: FrameOrientation) => {
    setFrame(next);
    loadCameraDefaults().then((d) =>
      saveCameraDefaults({ ...d, frame: next }),
    );
  };

  /**
   * How far the camera's own furniture is turned.
   *
   * One shared value, read by the clock, every orb's glyph and every pill's
   * label, so the screen can never end up half-turned — and so the turn is
   * a single movement of the whole screen rather than eight things
   * independently arriving at the same angle.
   *
   * It follows the button and nothing else. Letting the camera's own
   * orientation reporting drive it was worse in practice: the type would
   * swing round on its own whenever the phone tipped past an angle nobody
   * was thinking about, and the same tip meant nothing on Android, where
   * that callback never fires. A control you press is the same on both
   * platforms and only moves when you ask it to.
   *
   * It lives on the UI thread: a rotation driven from JS stutters against
   * a running camera preview, which is the one thing on this screen that
   * must never drop frames.
   */
  const rotation = useSharedValue(frame === "landscape" ? 90 : 0);
  const hydrated = useRef(false);
  useEffect(() => {
    const next = frame === "landscape" ? 90 : 0;
    // The stored default arriving is not a change the user made, so it
    // snaps. Only a press animates.
    if (!hydrated.current || !defaultsLoaded) {
      hydrated.current = true;
      rotation.value = next;
      return;
    }
    rotation.value = withTiming(next, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [frame, rotation, defaultsLoaded]);

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const cameraRef = useRef<CameraView | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /** The stops worth showing on this camera, as indices into `ZOOMS`. */
  const zoomStops = ZOOMS.map((_, i) => i).filter(
    (i) => ZOOMS[i].lens !== ULTRA_WIDE_LENS || lenses.includes(ULTRA_WIDE_LENS),
  );

  // Flipping to the front camera takes the ultra-wide lens with it. Without
  // this the stop would vanish from the row while `selectedLens` still
  // asked for a camera that is no longer there.
  useEffect(() => {
    if (!zoomStops.includes(zoomIndex)) setZoomIndex(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lenses, facing]);

  const isPhoto = mode === "photo";
  const durationMs = CAPTURE_MODES[mode].ms;
  const timerSeconds = TIMERS[timerIndex];

  const cardH = Math.min(
    CARD_TARGET_H,
    SCREEN_H - insets.top - insets.bottom - HEADER_H - FOOT_MIN,
  );

  // The slot being recorded into. Read once: an hour that turns over
  // mid-record must not move the clip out from under the recorder.
  const slotRef = useRef(currentSlot());
  const targetHour = hour != null ? Number(hour) : slotRef.current.hour;

  // The clock reads live until the shutter, then freezes at the moment it
  // was pressed — from there on it belongs to the clip, not the screen.
  const [clock, setClock] = useState(() => formatClock());
  const frozen = useRef(false);
  useEffect(() => {
    const tick = setInterval(() => {
      if (!frozen.current) setClock(formatClock());
    }, 5_000);
    return () => clearInterval(tick);
  }, []);

  // Asked for on arrival, both at once — the recorder should meet one OS
  // prompt pair, not one now and another when they press the shutter.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
    if (micPermission && !micPermission.granted && micPermission.canAskAgain) {
      requestMicPermission();
    }
  }, [permission, micPermission, requestPermission, requestMicPermission]);

  useEffect(
    () => () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (countTimer.current) clearInterval(countTimer.current);
    },
    [],
  );

  // ── The record line ──────────────────────────────────────────────────
  // A rule across the foot of the card that fills over exactly the mode's
  // length. It is the timeline, so it has to be the length of the take, not
  // a spinner that means "working".
  const progress = useSharedValue(0);
  const lineStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // Plays the take back under the title field, so what you are naming is in
  // front of you while you name it.
  const player = useVideoPlayer(
    mediaUri && !isPhoto ? { uri: mediaUri } : null,
    (p) => {
      p.loop = true;
      p.muted = true;
      // A timelapse is thirty real seconds shown fast — the speed-up lives
      // in playback because nothing re-encodes on the device.
      p.playbackRate = CAPTURE_MODES[mode].rate;
    },
  );
  useEffect(() => {
    if (mediaUri && !isPhoto) player.play();
  }, [mediaUri, isPhoto, player]);

  const capture = useCallback(async () => {
    if (!cameraRef.current) return;
    setError(null);
    frozen.current = true;
    setClock(formatClock());

    if (isPhoto) {
      setPhase("recording");
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.9,
          // The rotation is otherwise only an EXIF tag, which some
          // surfaces honour and others ignore — which is why a portrait
          // photo came back on its side while video, whose orientation is
          // written into the container, did not.
          exif: false,
        });
        if (!photo?.uri) throw new Error("The camera didn't return a photo.");

        // Re-encoded with no operations, purely to bake the sensor's
        // rotation into the pixels. After this the file is upright
        // everywhere: the review, the feed card, the collage, and anything
        // it is ever shared into.
        const upright = await ImageManipulator.manipulateAsync(
          photo.uri,
          [],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
        );

        setMediaUri(upright.uri);
        setPhase("review");
      } catch (e: any) {
        frozen.current = false;
        setError(e?.message || "That didn't capture.");
        setPhase("failed");
      }
      return;
    }

    setPhase("recording");
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: durationMs,
      easing: Easing.linear,
    });

    // Belt and braces: `maxDuration` is the camera's own cap, and the timer
    // is the one that fires if a platform ignores it. A take that stops
    // itself is the feature, so it does not get to depend on one mechanism.
    stopTimer.current = setTimeout(() => {
      cameraRef.current?.stopRecording();
    }, durationMs + 150);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: durationMs / 1000,
      });
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (!video?.uri) throw new Error("The camera didn't return a clip.");
      setMediaUri(video.uri);
      setPhase("review");
    } catch (e: any) {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      progress.value = 0;
      frozen.current = false;
      setError(e?.message || "That didn't record.");
      setPhase("failed");
    }
  }, [isPhoto, durationMs, progress]);

  /** The shutter. Runs the self-timer first when one is set. */
  const onShutter = () => {
    if (phase !== "ready" && phase !== "failed") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (timerSeconds === 0) {
      capture();
      return;
    }
    setPhase("counting");
    setCountdown(timerSeconds);
    countTimer.current = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          if (countTimer.current) clearInterval(countTimer.current);
          countTimer.current = null;
          capture();
          return 0;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return n - 1;
      });
    }, 1000);
  };

  const post = async () => {
    if (!mediaUri) return;
    setPhase("uploading");
    setError(null);
    try {
      // Resolved here rather than on arrival: backing out of the camera
      // should not leave an empty log behind.
      const setlogId = id ? String(id) : await ensurePersonalLog();
      const clip = await uploadClip({
        setlogId,
        uri: mediaUri,
        durationMs,
        captureMode: mode,
        videoQuality: isPhoto ? null : quality,
        slot: { day: slotRef.current.day, hour: targetHour },
        // Decided here rather than when the screen opened: tapping the
        // shutter at 2:59 and landing at 3:00 is exactly the case the
        // marker exists for. The clip still files under the hour it was
        // recorded in — only the label moves.
        isLate: currentSlot().hour !== targetHour,
        title,
      });

      // Keep the file the camera just made, filed under the clip's id. The
      // phone used to upload its own recording and then download it back
      // the next time anybody looked — see lib/setlogMediaCache.ts. This
      // one copy is why your own log opens instantly, forever.
      await keepRecordedClip(clip, mediaUri);

      // Straight into the day's cached feed rather than left for a refetch
      // to discover: the row and the author are both in hand right here, so
      // asking the server what you just did is a round trip that can only
      // return what you already know.
      const uid = await resolveUserId(currentUser?.id);
      if (uid) {
        await prependClipToFeedCache(uid, clip, {
          name: currentUser?.name || "You",
          avatarUrl: currentUser?.avatar_url ?? null,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e: any) {
      setError(e?.message || "That clip didn't send.");
      setPhase("failed");
    }
  };

  const discard = () => {
    setMediaUri(null);
    setTitle("");
    setError(null);
    frozen.current = false;
    progress.value = 0;
    setPhase("ready");
  };

  const denied =
    (permission && !permission.granted && !permission.canAskAgain) ||
    (micPermission && !micPermission.granted && !micPermission.canAskAgain);

  /** A take is on screen and waiting on the recorder — a failed upload
   *  included, or the only control left would be a shutter that discards
   *  the very thing that failed to send. */
  const editing = mediaUri != null && phase !== "uploading";
  const busy =
    phase === "recording" || phase === "counting" || phase === "uploading";

  const hint = () => {
    if (phase === "uploading") return "Sending…";
    if (phase === "failed") return error;
    if (editing) return "Say what this was, or just post it.";
    if (phase === "counting") return "Get ready…";
    if (phase === "recording") return isPhoto ? " " : "It stops itself.";
    if (isPhoto) return "One frame of the hour.";
    // Resolution has no indicator of its own now that it lives inside the
    // capture panel, so the line under the card carries it. A setting you
    // cannot see the value of is a setting nobody trusts.
    return `${CAPTURE_MODES[mode].label} · ${quality} · stops itself.`;
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}
    >
      <StatusBar barStyle="dark-content" />

      {/* § Header — chevron, no title (the clock on the card is the title),
          and the one text action only once there is something to post. */}
      <View
        style={{
          height: HEADER_H,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => (editing ? discard() : router.back())}
          disabled={phase === "uploading"}
          style={{ padding: 4, opacity: phase === "uploading" ? 0.4 : 1 }}
        >
          <ChevronLeft size={28} color="#374151" />
        </TouchableOpacity>
        {editing ? (
          <TouchableOpacity onPress={post} style={{ padding: 4 }}>
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#0369A1" }}>
              {phase === "failed" ? "Retry" : "Post"}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {denied ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 32,
          }}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: "#111827",
              textAlign: "center",
            }}
          >
            Camera access is off
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 16,
              lineHeight: 22,
              color: "#9CA3AF",
              textAlign: "center",
            }}
          >
            Setlog needs the camera and the microphone to record. You can turn
            them back on in Settings.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={{ marginTop: 20 }}
          >
            <Text style={{ fontSize: 17, fontWeight: "500", color: "#0369A1" }}>
              Open Settings
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* ── The card: four fifths of the screen ────────────────── */}
          <View
            style={{
              height: cardH,
              marginHorizontal: CARD_INSET,
              borderRadius: CARD_RADIUS,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: "#111827",
            }}
          >
            {mediaUri ? (
              isPhoto ? (
                <Image
                  source={{ uri: mediaUri }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <VideoView
                  player={player}
                  style={StyleSheet.absoluteFill}
                  nativeControls={false}
                  contentFit="cover"
                />
              )
            ) : (
              permission?.granted &&
              isFocused && (
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing={facing}
                  mode={isPhoto ? "picture" : "video"}
                  zoom={ZOOMS[zoomIndex].value}
                  // 0.5× is a different camera, not a zoom level, so the
                  // stop picks the lens too (iOS; Android reports no lenses
                  // and never offers that stop).
                  selectedLens={ZOOMS[zoomIndex].lens}
                  onAvailableLensesChanged={(e) => setLenses(e.lenses ?? [])}
                  flash={flash}
                  enableTorch={!isPhoto && flash === "on"}
                  // Honoured on Android; iOS picks its own preset and
                  // ignores it, which is why the chosen value is stored as
                  // what was asked for rather than a fact about the file.
                  videoQuality={quality}
                />
              )
            )}

            {/* Shown while the frame is landscape and the camera is idle.
                Nothing here watches the phone, so it cannot know you have
                already turned it — it goes when you start, or when you
                switch the frame to portrait. */}
            {!editing && frame === "landscape" && phase === "ready" && (
              <Text
                style={{
                  position: "absolute",
                  top: 14,
                  left: ORB + 24,
                  right: ORB + 24,
                  fontSize: 14,
                  lineHeight: 19,
                  textAlign: "center",
                  ...OVER_MEDIA,
                }}
                pointerEvents="none"
              >
                Turn your phone sideways for a better vlog
              </Text>
            )}

            {/* The clock, centred, at title size — the subject of the frame
                rather than a badge in a corner. Drawn on its side while the
                phone is upright, so it stands up the moment the phone is
                turned, which is the way this camera is meant to be held. */}
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              style={{
                ...StyleSheet.absoluteFillObject,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 24,
              }}
              pointerEvents={editing ? "box-none" : "none"}
            >
              {phase === "counting" ? (
                <Text style={{ fontSize: 64, fontWeight: "700", ...OVER_MEDIA }}>
                  {countdown}
                </Text>
              ) : (
                <Reanimated.View
                  style={[{ alignItems: "center" }, rotationStyle]}
                >
                  <Text
                    style={{
                      fontSize: 52,
                      fontWeight: "700",
                      letterSpacing: -1,
                      ...OVER_MEDIA,
                    }}
                  >
                    {clock}
                  </Text>

                  {editing ? (
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="Add a title"
                      placeholderTextColor="rgba(255,255,255,0.55)"
                      maxLength={TITLE_MAX}
                      multiline
                      returnKeyType="done"
                      blurOnSubmit
                      style={{
                        marginTop: 6,
                        minWidth: 200,
                        fontSize: 20,
                        fontWeight: "600",
                        textAlign: "center",
                        ...OVER_MEDIA,
                      }}
                    />
                  ) : null}
                </Reanimated.View>
              )}
            </KeyboardAvoidingView>

            {/* ── Four corners, one control each ─────────────────── */}
            {!editing && (
              <>
                {/* What the shutter will do — length and resolution both,
                    because they are one decision about the take. The only
                    control whose plain press opens its list rather than
                    cycling: five lengths crossed with three resolutions is
                    not something anyone should tap through. */}
                <Orb
                  onPress={() => setSheet("capture")}
                  disabled={busy}
                  style={{ top: 12, left: 12 }}
                  rotateStyle={rotationStyle}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>
                    {CAPTURE_MODES[mode].short}
                  </Text>
                </Orb>

                <Orb
                  onPress={() => setTimerIndex((i) => (i + 1) % TIMERS.length)}
                  onLongPress={() => setSheet("timer")}
                  disabled={busy}
                  style={{ top: 12, right: 12 }}
                  rotateStyle={rotationStyle}
                >
                  {timerSeconds === 0 ? (
                    <Timer size={19} color="#fff" strokeWidth={1.8} />
                  ) : (
                    <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>
                      {timerSeconds}s
                    </Text>
                  )}
                </Orb>

                <Orb
                  onPress={() =>
                    setFacing((f) => (f === "front" ? "back" : "front"))
                  }
                  disabled={busy}
                  style={{ bottom: 12, left: 12 }}
                  rotateStyle={rotationStyle}
                >
                  <RefreshCw size={19} color="#fff" strokeWidth={1.8} />
                </Orb>

                <Orb
                  onPress={() =>
                    setFlash((f) =>
                      f === "off" ? "on" : f === "on" ? "auto" : "off",
                    )
                  }
                  onLongPress={() => setSheet("flash")}
                  disabled={busy}
                  style={{ bottom: 12, right: 12 }}
                  rotateStyle={rotationStyle}
                >
                  <FlashGlyph mode={flash} />
                </Orb>

                {/* The zoom stops, in the shape iOS's camera uses. */}
                <ZoomScale
                  stops={zoomStops}
                  index={zoomIndex}
                  onSelect={setZoomIndex}
                  rotateStyle={rotationStyle}
                />
              </>
            )}

            {/* The full list behind whichever control asked for it. Inside
                the card, so the frame stays visible behind the choice. */}
            {sheet === "capture" && (
              <OptionSheet
                anchor="top-left"
                onClose={() => setSheet(null)}
                groups={[
                  {
                    label: "Length",
                    selected: mode,
                    onSelect: (v) => setMode(v as CaptureMode),
                    options: CAPTURE_MODE_ORDER.map((m) => ({
                      value: m,
                      label: CAPTURE_MODES[m].label,
                    })),
                  },
                  // Meaningless for a photo, so it is absent rather than
                  // present and inert.
                  ...(isPhoto
                    ? []
                    : [
                        {
                          label: "Video Quality",
                          selected: quality,
                          onSelect: (v: string) => setQuality(v as VideoQuality),
                          options: VIDEO_QUALITIES.map((q) => ({
                            value: q,
                            label: q,
                          })),
                        },
                      ]),
                  // Which way the app's own furniture reads. A row in the
                  // menu rather than a pill of its own: it is set once and
                  // then left alone, and the zoom scale wanted the space.
                  {
                    label: "Frame",
                    selected: frame,
                    onSelect: (v: string) => setFrameAndRemember(v as FrameOrientation),
                    options: [
                      { value: "landscape", label: "Landscape" },
                      { value: "portrait", label: "Portrait" },
                    ],
                  },
                ]}
              />
            )}

            {sheet === "timer" && (
              <OptionSheet
                anchor="top-right"
                onClose={() => setSheet(null)}
                groups={[
                  {
                    label: "Self-timer",
                    selected: String(timerSeconds),
                    onSelect: (v) =>
                      setTimerIndex(TIMERS.indexOf(Number(v) as (typeof TIMERS)[number])),
                    options: TIMERS.map((t) => ({
                      value: String(t),
                      label: t === 0 ? "Off" : `${t} seconds`,
                    })),
                  },
                ]}
              />
            )}

            {sheet === "flash" && (
              <OptionSheet
                anchor="bottom-right"
                onClose={() => setSheet(null)}
                groups={[
                  {
                    label: "Flash",
                    selected: flash,
                    onSelect: (v) => setFlash(v as "off" | "on" | "auto"),
                    options: [
                      { value: "off", label: "Off" },
                      { value: "on", label: "On" },
                      { value: "auto", label: "Auto" },
                    ],
                  },
                ]}
              />
            )}

            {/* The record line: a rule across the foot of the card filling
                over exactly the take's length. */}
            {phase === "recording" && !isPhoto && (
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 3,
                  backgroundColor: "rgba(255,255,255,0.28)",
                }}
                pointerEvents="none"
              >
                <Reanimated.View
                  style={[{ height: 3, backgroundColor: "#fff" }, lineStyle]}
                />
              </View>
            )}
          </View>

          {/* ── The foot ───────────────────────────────────────────── */}
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingBottom: insets.bottom,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: "#9CA3AF",
                textAlign: "center",
                paddingHorizontal: 32,
                marginBottom: 8,
              }}
            >
              {hint()}
            </Text>

            {phase === "uploading" ? (
              <View style={{ height: SHUTTER, justifyContent: "center" }}>
                <ActivityIndicator color="#0369A1" />
              </View>
            ) : editing ? (
              <TouchableOpacity onPress={post} style={{ padding: 10 }}>
                <Text style={{ fontSize: 17, fontWeight: "500", color: "#0369A1" }}>
                  {phase === "failed"
                    ? "Try again"
                    : title.trim()
                      ? "Post"
                      : "Post without a title"}
                </Text>
              </TouchableOpacity>
            ) : (
              /* The shutter: this app's mark inside the camera's ring. A
                 white disc is every camera ever made; this one says whose
                 camera it is. */
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onShutter}
                disabled={busy}
                style={{
                  width: SHUTTER,
                  height: SHUTTER,
                  borderRadius: SHUTTER / 2,
                  borderCurve: "continuous",
                  borderWidth: SHUTTER_BORDER,
                  borderColor: phase === "recording" ? "#DC2626" : "#111827",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#fff",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Image
                  source={require("@/assets/images/logo.png")}
                  style={{
                    width: SHUTTER - SHUTTER_BORDER * 6,
                    height: SHUTTER - SHUTTER_BORDER * 6,
                  }}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}
