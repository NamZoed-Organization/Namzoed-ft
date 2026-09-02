import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import { supabase } from "@/lib/supabase";
import { sendChatPushNotification } from "@/services/chatPushService";
import { triggerSendHaptic } from "@/utils/chatSounds";
import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { BlurView } from "expo-blur";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

type WeChatVoiceRecorderProps = {
  currentUserUUID: string;
  chatPartnerId: string;
  onOptimisticAudio: (msg: any) => void;
  onUploadSuccess: (msg: any, optimisticId: string) => void;
  onUploadError: (optimisticId: string) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
};

type DragZone = "none" | "cancel" | "lock";

const PRIMARY = "#094569";
// Translucent fills for the frosted-glass pills (layered over a BlurView,
// masked to the pill's own curved stroke shape — see the pill JSX below).
const PILL_TINT_IDLE = "rgba(107,114,128,0.42)"; // greyish matte
const PILL_TINT_CANCEL = "#ef4444"; // solid red, no translucency
const PILL_TINT_LOCK = PRIMARY; // solid PRIMARY blue, no translucency
// Forgiveness on each pill's measured hit zone, so landing just short of
// its edge still registers.
const PILL_HIT_TOLERANCE = 16;
const BAR_COUNT = 14;
// How tall the dome rises above the composer, and how far past it extends
// downward so its curved top clears the true screen edge regardless of
// safe-area/padding — the excess simply renders off-screen, harmlessly.
const DOME_HEIGHT = 130;
const DOME_EXTRA = 140;
const DOME_TOTAL = DOME_HEIGHT + DOME_EXTRA;
// A single quadratic bezier, not a circular corner radius, so the curve
// keeps rising all the way to a true peak at the horizontal center instead
// of either flattening into a plateau or reading as a round circular bulge.
// DOME_CURVE_DEPTH is how far below the apex the arc's endpoints sit at the
// box's own (off-screen) left/right edges — lower makes the curve read as
// shallower across the visible width without changing the peak height;
// raising it toward DOME_HEIGHT makes it a deeper, more pronounced arc. The
// control point mirrors that depth above the apex, which is what pins the
// peak at exactly y=0 regardless of the depth chosen — see
// https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Quadratic_B%C3%A9zier_curves.
// x runs 0–100 (percent-of-width units, stretched to fill by
// preserveAspectRatio="none") since the actual pixel width isn't known here.
const DOME_CURVE_DEPTH = DOME_HEIGHT * 0.5;
const DOME_PATH = `M0,${DOME_TOTAL} L0,${DOME_CURVE_DEPTH} Q50,${-DOME_CURVE_DEPTH} 100,${DOME_CURVE_DEPTH} L100,${DOME_TOTAL} Z`;
// Cancel/lock pills — float above the dome and echo its arc: each is the
// SAME half-arc shape as the dome's own edge (identical rise, just shifted
// up by PILL_GAP), drawn as an open path and given a strokeWidth with
// strokeLinecap="round". A stroke traces parallel offsets of the path on
// both sides, which is what gives the pill BOTH a curved top edge and a
// curved bottom edge (mimicking the dome's arc on each side) plus true
// semicircle end caps — all from one path, rather than assembling flat or
// rotated pieces. Authored in real pixels (not the dome's percent-stretch
// trick) because a non-uniform horizontal stretch would squash the round
// caps into ellipses.
const PILL_GAP = 55; // clearance between the dome's peak and the pill's own highest point
const PILL_STROKE_WIDTH = 70;
// Headroom on every side so the stroke's round caps — which bulge past
// their path endpoint by strokeWidth/2 in every direction — aren't clipped
// by the SVG canvas edge, which is exactly the "corners not fully rounded"
// bug: a cap flattens wherever it runs into the canvas boundary.
const PILL_PAD = PILL_STROKE_WIDTH / 2 + 2;
// How far short of the screen's true horizontal center each pill's inner
// end stops — bigger than the round cap's own bulge radius (strokeWidth/2)
// so the two caps clear each other with a visible gap instead of merely
// touching or overlapping.
const PILL_CENTER_GAP = PILL_STROKE_WIDTH / 2 + 10;
// How much of the dome's own visible-side angle each pill's arc uses:
// 1.0 = exactly as steep as the dome, 0.5 = half as steep, higher = more
// pronounced curve. This is the one number to change to make the pills
// more or less arced.
const PILL_ARC_FACTOR = 1.7;
// The composer that hosts this component has its own horizontal padding
// (rounded input bar + row insets), so — same reason the dome uses
// left/right:-100 — positioning the pill at left/right:0 stops short of
// the true screen edge. This overhang pushes past that padding so the
// pill's outer end actually reaches (and slightly bleeds past) the edge.
const PILL_EDGE_OVERHANG = 250;
// Total container width: the screen-edge-to-center reach, plus the edge
// overhang, plus padding at BOTH ends for their own round caps.
const PILL_CONTAINER_WIDTH_EXTRA = PILL_EDGE_OVERHANG + PILL_PAD * 2;
// The waveform now lives in its own compact card above the dome and pills,
// rather than inside the dome's content layer, so it needs its own anchor.
const WAVEFORM_PANEL_HEIGHT = 88;
// Bars are a fixed-height view scaled via transform (scaleY), not an
// animated height — RN transforms scale around the view's own center by
// default, which is what makes each bar grow up AND down symmetrically
// instead of only upward from a bottom edge.
const WAVEFORM_BAR_MAX_H = 48;
const WAVEFORM_BAR_MIN_SCALE = 0.12;
// How many bars at each end of the row taper toward the floor instead of
// showing full amplitude, producing the fade-in/fade-out edges.
const WAVEFORM_FADE_COUNT = 3;
// How often we read the recorder's mic level and animate the bars to it.
// Faster than the metering hook's old 80ms poll, and short enough that
// consecutive scaleY animations overlap smoothly rather than visibly
// stepping between samples.
const WAVEFORM_SAMPLE_INTERVAL = 50;
// A static, generous clearance rather than one computed from the pills'
// actual (now dynamic, screen-size-dependent) height — the pills' rise is
// capped well below DOME_HEIGHT+PILL_GAP by construction (see
// domeEdgeAngleRad below), so this stays a safe upper bound regardless of
// device width.
const WAVEFORM_PANEL_BOTTOM = DOME_HEIGHT + PILL_GAP + 90;

const formatSecs = (secs: number) =>
  `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;

export default function WeChatVoiceRecorder({
  currentUserUUID,
  chatPartnerId,
  onOptimisticAudio,
  onUploadSuccess,
  onUploadError,
  onRecordingStateChange,
}: WeChatVoiceRecorderProps) {
  // isMeteringEnabled is required for recorderState.metering to ever report
  // real values — without it every sample reads as undefined and the
  // waveform has no live signal to animate from.
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  // Measured (not assumed from window width) so the two pills' inner ends
  // land relative to THIS component's own actual center — since the
  // composer's horizontal padding is symmetric, that measured center
  // coincides with the screen's true center exactly, with no need to guess
  // the padding amount the way the outer-edge overhang below still does.
  const [contentWidth, setContentWidth] = useState(0);
  // Real pixel width, not the dome's percent-stretch trick — needed here so
  // the pill's stroke (round caps, band thickness) renders undistorted
  // instead of squashed by a non-uniform horizontal scale.
  const pillReach = Math.max(0, contentWidth / 2 - PILL_CENTER_GAP);
  // The dome's own visible-side angle: the slope of the chord from where
  // the dome is actually visible (the composer's edge — DOME_PATH's box is
  // wider than that, per its own left/right:-100 overhang) up to its peak
  // at screen center. y(t) = DOME_CURVE_DEPTH*(1-2t)^2 is DOME_PATH's own
  // curve (a quadratic bezier symmetric about t=0.5 simplifies to exactly
  // this); t here is where the composer's edge falls within the dome's
  // 0–100 range, given its box width is contentWidth+200.
  const domeEdgeAngleRad = useMemo(() => {
    if (contentWidth <= 0) return 0;
    const boxWidth = contentWidth + 200;
    const t = 100 / boxWidth;
    const edgeDrop = DOME_CURVE_DEPTH * (1 - 2 * t) ** 2;
    const run = contentWidth / 2;
    return Math.atan2(edgeDrop, run);
  }, [contentWidth]);
  // The pill's curve is a genuine CROP (De Casteljau subdivision) of a
  // symmetric dome-shaped curve whose true peak sits PILL_CENTER_GAP
  // further along than where we actually stop drawing — not a curve
  // deliberately re-flattened to end horizontally at the cutoff. That
  // earlier "force the control point to match the endpoint's height"
  // approach guaranteed a flat tangent exactly at the visible tip, which
  // is what read as an unnaturally sharp bend right where the two pills
  // meet, and made the dome-to-pill gap look inconsistent along the curve.
  // Cropping a real curve instead keeps it still gently rising at the
  // cutoff, same as the dome itself still rising slightly short of ITS own
  // center.
  //
  // virtualHalfRun is the edge-to-true-peak distance of that uncropped
  // curve; frac is how far along it (0–1) our visible cutoff (pillReach)
  // actually sits. S is the edge's drop-from-peak, sized so the edge's
  // tangent angle is PILL_ARC_FACTOR of the dome's own (same formula the
  // dome itself uses: slope = 2S/halfRun). Subdividing a symmetric
  // low→peak→low bezier P0=(0,S) C=(H,-S) P2=(2H,S) at t=frac/2 (so
  // x(t)=2Ht lands at pillReach) gives new control/end drops of
  // S(1-frac) and S(1-frac)^2 respectively — see the bezier subdivision
  // formula (De Casteljau).
  const virtualHalfRun = pillReach + PILL_CENTER_GAP;
  const targetAngle = domeEdgeAngleRad * PILL_ARC_FACTOR;
  const edgeDrop = (virtualHalfRun * Math.tan(targetAngle)) / 2;
  const frac = virtualHalfRun > 0 ? pillReach / virtualHalfRun : 0;
  const controlDrop = edgeDrop * (1 - frac);
  const endDrop = edgeDrop * (1 - frac) ** 2;
  // How much further the straight extension drops over PILL_EDGE_OVERHANG,
  // continuing the bezier's own tangent at its low end (unaffected by
  // where it's cropped — B'(0) only depends on P0 and C) so the overhang
  // joins without a visible kink.
  const overhangDrop =
    virtualHalfRun > 0 ? (2 * edgeDrop * PILL_EDGE_OVERHANG) / virtualHalfRun : 0;
  const pillContainerHeight = edgeDrop + overhangDrop + PILL_PAD * 2;
  // Container bottom is derived FROM pillContainerHeight (peak height =
  // bottom + height - PILL_PAD) so the peak reference always lands at
  // exactly DOME_HEIGHT + PILL_GAP above the baseline — independent of
  // overhangDrop. Folding overhangDrop only into the height above but not
  // here silently pushed the peak upward by that same amount, which is
  // what kept reopening the gap regardless of PILL_GAP.
  const pillContainerBottom = DOME_HEIGHT + PILL_GAP - pillContainerHeight + PILL_PAD;
  const pillContainerWidth = pillReach + PILL_CONTAINER_WIDTH_EXTRA;
  // The lock container's left edge, expressed explicitly rather than via
  // `right: -(PILL_EDGE_OVERHANG + PILL_PAD)` — algebraically identical
  // (parentWidth - (-(PILL_EDGE_OVERHANG+PILL_PAD)) - pillContainerWidth
  // reduces to exactly this), but measureInWindow's reported x for a
  // right-positioned view was consistently landing somewhere that never
  // satisfied `x >= lockZone.left` — matching the cancel pill's own
  // reliably-working left-based positioning instead removes that
  // asymmetry outright, with no visual difference (same resolved position).
  const lockContainerLeft = contentWidth - pillReach - PILL_PAD;
  // Cancel: M is the far outer tip (straight extension, out in the
  // overhang), L brings it in to the visible screen-edge point, then Q is
  // the cropped dome-matched curve from there in to the inner/high end,
  // which stays PILL_CENTER_GAP short of the screen's center so the two
  // pills don't touch.
  const cancelPillPath = useMemo(() => {
    const edgeX = PILL_EDGE_OVERHANG + PILL_PAD;
    const controlX = edgeX + pillReach / 2;
    const endX = edgeX + pillReach;
    const edgeY = PILL_PAD + edgeDrop;
    const farY = edgeY + overhangDrop;
    return `M${PILL_PAD},${farY} L${edgeX},${edgeY} Q${controlX},${PILL_PAD + controlDrop} ${endX},${PILL_PAD + endDrop}`;
  }, [pillReach, edgeDrop, controlDrop, endDrop, overhangDrop]);
  // Lock: mirror image of the above within the same container width.
  const lockPillPath = useMemo(() => {
    const edgeX = pillContainerWidth - (PILL_EDGE_OVERHANG + PILL_PAD);
    const controlX = edgeX - pillReach / 2;
    const endX = edgeX - pillReach;
    const edgeY = PILL_PAD + edgeDrop;
    const farY = edgeY + overhangDrop;
    return `M${pillContainerWidth - PILL_PAD},${farY} L${edgeX},${edgeY} Q${controlX},${PILL_PAD + controlDrop} ${endX},${PILL_PAD + endDrop}`;
  }, [pillContainerWidth, pillReach, edgeDrop, controlDrop, endDrop, overhangDrop]);
  // Icon/label centered on the visible curve itself — its midpoint
  // (t=0.5 on the Q segment) and tangent angle there — rather than a
  // fixed corner offset, and tilted to match the curve's own slope at
  // that point so the label visually follows the pill's arc. For a
  // quadratic bezier, the t=0.5 point is 0.25*P0+0.5*C+0.25*P2, and its
  // tangent simplifies to just P2-P0 (the two (1-t)/t terms cancel out at
  // t=0.5), which is why the angle below is a plain atan2 of the
  // edge→end delta rather than needing the control point at all.
  const cancelLabel = useMemo(() => {
    const edgeX = PILL_EDGE_OVERHANG + PILL_PAD;
    const controlX = edgeX + pillReach / 2;
    const endX = edgeX + pillReach;
    const edgeY = PILL_PAD + edgeDrop;
    const controlY = PILL_PAD + controlDrop;
    const endY = PILL_PAD + endDrop;
    return {
      x: 0.25 * edgeX + 0.5 * controlX + 0.25 * endX,
      y: 0.25 * edgeY + 0.5 * controlY + 0.25 * endY,
      angleDeg: (Math.atan2(endY - edgeY, endX - edgeX) * 180) / Math.PI,
    };
  }, [pillReach, edgeDrop, controlDrop, endDrop]);
  const lockLabel = useMemo(() => {
    const edgeX = pillContainerWidth - (PILL_EDGE_OVERHANG + PILL_PAD);
    const controlX = edgeX - pillReach / 2;
    const endX = edgeX - pillReach;
    const edgeY = PILL_PAD + edgeDrop;
    const controlY = PILL_PAD + controlDrop;
    const endY = PILL_PAD + endDrop;
    return {
      x: 0.25 * edgeX + 0.5 * controlX + 0.25 * endX,
      y: 0.25 * edgeY + 0.5 * controlY + 0.25 * endY,
      // Lock's edge sits to the right of its end (curve runs right→left
      // toward center), so the raw endX-edgeX delta is negative and points
      // the tangent vector backwards — landing near ±180° instead of a
      // small tilt, which is what was flipping the text upside down.
      // Reversing the delta gives the same line, correctly oriented.
      angleDeg: (Math.atan2(edgeY - endY, edgeX - endX) * 180) / Math.PI,
    };
  }, [pillContainerWidth, pillReach, edgeDrop, controlDrop, endDrop]);
  // Rough half-size of the icon+label row, for centering it on the point
  // above — RN has no reliable percentage-based transform to center by
  // measured size without an extra render pass, so this is an estimate.
  const LABEL_HALF_W = 40;
  const LABEL_HALF_H = 11;
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  // True from the instant the finger touches down (onPanResponderGrant)
  // until the session actually concludes (send/cancel/error) — deliberately
  // NOT the same thing as isRecording, which only flips true once
  // startRecording()'s async chain (mic permission → setAudioModeAsync →
  // prepareToRecordAsync → recorder.record()) has fully resolved, often
  // 100s of ms later. The dome/pills/hit-zones used to mount only once
  // isRecording went true, which meant a normal quick "press, drag,
  // release" gesture could run its entire course — including reaching the
  // cancel/lock zone — before the pills had even mounted, let alone
  // measured their hit zones, so the drag was evaluated against zone refs
  // that were still null and nothing ever registered. Driving the UI off
  // this instead shrinks that race from "however long real audio setup
  // takes" down to a single render/effect flush, which is what actually
  // fixes detection rather than the coordinate-math theories tried first.
  const [isHolding, setIsHolding] = useState(false);
  const holdingRef = useRef(false);
  // Mirrors isHolding but lags behind it on the way to false — the dome
  // and pills are a conditional mount (see the render below), so unmounting
  // the instant isHolding flips false would cut off the fade-out
  // animation mid-flight. This stays true through that animation and only
  // flips once it's actually finished.
  const [showRecordingUI, setShowRecordingUI] = useState(false);
  const [dragZone, setDragZone] = useState<DragZone>("none");
  const [displaySecs, setDisplaySecs] = useState(0);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "warning" | "error";
    title: string;
    message: string;
  }>({ visible: false, type: "warning", title: "", message: "" });

  const mountedRef = useRef(true);
  const recordingRef = useRef(false);
  const startingRef = useRef(false);
  const pendingEndRef = useRef<"send" | "cancel" | null>(null);
  const dragZoneRef = useRef<DragZone>("none");
  const lockedRef = useRef(false);
  // Measured absolute (window) bounds of each pill's actually visible
  // curve, refreshed whenever the pill lays out. The gesture below checks
  // the touch's real screen position against these instead of a fixed
  // drag-distance threshold, which has no relationship to where the pills
  // actually render and is what made the old dx-based check register
  // inconsistently once the pills' size/position changed. Requiring the
  // touch to also be within the pill's actual vertical span (not just past
  // some x) is what makes a press on "Hold to talk" not immediately read
  // as touching a pill — the pill sits well above it, so genuinely
  // dragging up into that space is required, with no separate minimum-
  // drag-distance constant needed to fake that guarantee.
  const cancelZoneRef = useRef<{ right: number; top: number; bottom: number } | null>(null);
  const lockZoneRef = useRef<{ left: number; top: number; bottom: number } | null>(null);
  // Last touch position seen by the responder, so a pill's zone — measured
  // asynchronously via measureInWindow, which can resolve after a fast
  // flick has already landed and gone still — can be re-checked the moment
  // it becomes available instead of waiting on a move event that may never
  // come again.
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const cancelPillRef = useRef<View>(null);
  const lockPillRef = useRef<View>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendingRef = useRef(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  // Drives the "Hold to talk" → dome morph: 0 = idle pill, 1 = fully grown
  // dome+pills. Interpolated separately (and over different sub-ranges) by
  // the dome, the pills, and the idle text below, rather than each of them
  // mounting/fading independently — that shared single value is what makes
  // the text crossfade and the dome grow feel like one continuous
  // transition instead of three unrelated animations firing at once.
  const domeProgress = useRef(new Animated.Value(0)).current;
  const barAnims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(WAVEFORM_BAR_MIN_SCALE)),
  ).current;
  // Rolling buffer of real mic levels (as scaleY factors), oldest first —
  // each new metering sample shifts in from the right, so the bars scroll
  // like an actual level-meter of what was just captured instead of a
  // canned animation.
  const levelHistoryRef = useRef<number[]>(Array(BAR_COUNT).fill(WAVEFORM_BAR_MIN_SCALE));
  // Per-position taper so the oldest (leftmost) bars fade down toward the
  // floor as they age out, and the newest (rightmost) bars fade up as they
  // arrive, instead of every bar snapping abruptly to full amplitude right
  // at the row's edge.
  const waveformEnvelope = useMemo(() => {
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const edgeDistance = Math.min(i, BAR_COUNT - 1 - i);
      if (edgeDistance >= WAVEFORM_FADE_COUNT) return 1;
      const t = (edgeDistance + 1) / (WAVEFORM_FADE_COUNT + 1);
      return t * (2 - t); // ease-out, smoother than a linear ramp
    });
  }, []);

  const setRecording = (next: boolean) => {
    recordingRef.current = next;
    setIsRecording(next);
    onRecordingStateChange?.(next);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const applyDragZone = (zone: DragZone) => {
    if (dragZoneRef.current === zone) return;
    dragZoneRef.current = zone;
    setDragZone(zone);
    // Light impact, not selectionAsync — a selection tick reads as
    // "scrolled past a picker row," barely felt on plenty of Android
    // devices, and too faint to register as "you just crossed into a drop
    // zone" on either platform. A light impact is the more common choice
    // apps actually use for that kind of boundary-crossing feedback, and
    // fires for every zone transition here (entering AND leaving a zone,
    // since "none" is itself a zone value applyDragZone treats the same way).
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Real hit-testing against each pill's measured box — both axes. The pill
  // sits well above where "Hold to talk" is pressed, so requiring the touch
  // to be within its vertical span too is what naturally means the finger
  // has to actually drag up into that space. Horizontally there's no bound
  // on the outer/off-screen side — once above the pill's row, continuing
  // left (cancel) or right (lock) past the pill itself still counts. The
  // inner (center-facing) edge, though, gets NO added tolerance: the two
  // pills' inner edges sit only ~16px apart, so forgiveness on both sides
  // would make them overlap — a diagonal drag from the (centered) start
  // point up toward one pill would then transiently satisfy the OTHER
  // pill's zone too, permanently locking when the user meant to cancel.
  // Sharing this exact test between onPanResponderMove and the post-layout
  // catch-up below (see lastTouchRef) is what a plain if/else-if inline in
  // the responder can't do on its own.
  const evaluateDragZone = (x: number, y: number) => {
    if (lockedRef.current) return;
    const cancelZone = cancelZoneRef.current;
    const lockZone = lockZoneRef.current;
    const inCancelZone =
      !!cancelZone &&
      x <= cancelZone.right &&
      y >= cancelZone.top - PILL_HIT_TOLERANCE &&
      y <= cancelZone.bottom + PILL_HIT_TOLERANCE;
    const inLockZone =
      !!lockZone &&
      x >= lockZone.left &&
      y >= lockZone.top - PILL_HIT_TOLERANCE &&
      y <= lockZone.bottom + PILL_HIT_TOLERANCE;
    // Lock is a hover-then-release zone, symmetric with cancel — entering it
    // mid-drag only shows the preview (blue tint, "Release to lock" hint,
    // the selectionAsync tick from applyDragZone below), not an instant
    // commit. Actually locking happens in onPanResponderRelease, same place
    // cancel/send are decided, so drifting back out before releasing reverts
    // to "release to send" exactly like drifting out of the cancel zone
    // reverts there — instead of the old behavior where merely touching the
    // zone while still dragging locked it immediately and irreversibly.
    if (inCancelZone) {
      applyDragZone("cancel");
    } else if (inLockZone) {
      applyDragZone("lock");
    } else {
      applyDragZone("none");
    }
  };

  // Re-measures each pill's hit-test zone (same logic as their own onLayout
  // below) — also called from the keyboard-settle effect further down.
  // Needed because the composer bar this component lives in tracks the
  // keyboard via a Reanimated UI-thread animation that keeps sliding for
  // ~250-300ms after the mic button dismisses the keyboard — well past
  // when the pills' own one-shot onLayout measurement already resolved and
  // froze cancelZoneRef/lockZoneRef at whatever mid-slide position the bar
  // happened to be in at that instant. Without a re-measure once the
  // keyboard has actually finished moving, the hit zones stay anchored a
  // bit too high (wherever the bar was mid-close), which is exactly what
  // reads as "have to drag past the visible pill before it registers."
  const remeasureCancelZone = () => {
    cancelPillRef.current?.measureInWindow((x, y, width, height) => {
      cancelZoneRef.current = { right: x + width, top: y, bottom: y + height };
      if (lastTouchRef.current) {
        evaluateDragZone(lastTouchRef.current.x, lastTouchRef.current.y);
      }
    });
  };
  const remeasureLockZone = () => {
    lockPillRef.current?.measureInWindow((x, y, width, height) => {
      lockZoneRef.current = { left: x, top: y, bottom: y + height };
      if (lastTouchRef.current) {
        evaluateDragZone(lastTouchRef.current.x, lastTouchRef.current.y);
      }
    });
  };

  const resetInteraction = () => {
    startingRef.current = false;
    pendingEndRef.current = null;
    lockedRef.current = false;
    sendingRef.current = false;
    holdingRef.current = false;
    lastTouchRef.current = null;
    clearTimer();
    applyDragZone("none");
    if (mountedRef.current) {
      setRecording(false);
      setIsLocked(false);
      setIsHolding(false);
      setDisplaySecs(0);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      try {
        void recorder.stop().catch(() => {});
      } catch {}
    };
  }, []);

  useEffect(() => {
    Animated.timing(panelOpacity, {
      toValue: isHolding && !isLocked ? 1 : 0,
      duration: 140,
      useNativeDriver: true,
    }).start();

    if (isHolding) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.04,
            duration: 520,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 520,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      pulse.stopAnimation();
      Animated.timing(pulse, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start();
    }
  }, [isHolding, isLocked]);

  // The "Hold to talk" → dome morph. Kept separate from the effect above
  // (which also reacts to isLocked) since mount/unmount timing should only
  // ever be driven by isHolding itself — locking happens while the dome is
  // already mounted and shouldn't re-trigger this.
  useEffect(() => {
    if (isHolding) {
      setShowRecordingUI(true);
      Animated.timing(domeProgress, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(domeProgress, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShowRecordingUI(false);
      });
    }
  }, [isHolding]);

  useEffect(() => {
    if (!isRecording) {
      levelHistoryRef.current = Array(BAR_COUNT).fill(WAVEFORM_BAR_MIN_SCALE);
      barAnims.forEach((bar) =>
        Animated.timing(bar, {
          toValue: WAVEFORM_BAR_MIN_SCALE,
          duration: 120,
          useNativeDriver: true,
        }).start(),
      );
      return;
    }

    // Polls recorder.getStatus() directly on our own interval, rather than
    // useAudioRecorderState(recorder, WAVEFORM_SAMPLE_INTERVAL) — that hook
    // calls setState internally on every sample, which was re-rendering
    // this ENTIRE component (recomputing every pill-path memo, etc.)
    // ~20x/second for the whole duration of the hold gesture. That JS-thread
    // churn was starving the PanResponder's own onPanResponderMove of time
    // to run promptly, which is what made the drag-to-lock/cancel zone
    // detection below feel laggy despite being cheap arithmetic on its own.
    // getStatus() is a synchronous, non-reactive read — same data, zero
    // re-renders. The bar animations themselves were already native-driven
    // (scaleY transform, not height) and stay exactly as they were.
    const interval = setInterval(() => {
      const db = recorder.getStatus().metering ?? -60;
      const amp = Math.min(1, Math.max(0, (db + 60) / 60));
      const scale = WAVEFORM_BAR_MIN_SCALE + Math.max(0.08, amp) * (1 - WAVEFORM_BAR_MIN_SCALE);
      const history = levelHistoryRef.current;
      history.shift();
      history.push(scale);
      history.forEach((s, i) => {
        const target =
          WAVEFORM_BAR_MIN_SCALE + (s - WAVEFORM_BAR_MIN_SCALE) * waveformEnvelope[i];
        Animated.timing(barAnims[i], {
          toValue: target,
          duration: WAVEFORM_SAMPLE_INTERVAL,
          useNativeDriver: true,
        }).start();
      });
    }, WAVEFORM_SAMPLE_INTERVAL);

    return () => clearInterval(interval);
  }, [barAnims, isRecording, recorder, waveformEnvelope]);

  // Re-measure both pills once the keyboard finishes moving — see
  // remeasureCancelZone/remeasureLockZone's own comment for why: pressing
  // the mic button (which mounts this UI) also dismisses the keyboard, and
  // the composer bar's own keyboard-tracking animation keeps sliding well
  // past the pills' first onLayout firing. Listening for both show and hide
  // covers holding to talk while the keyboard happens to be opening too,
  // not just the far more common dismiss-on-mic-tap case.
  useEffect(() => {
    if (!showRecordingUI) return;
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      remeasureCancelZone();
      remeasureLockZone();
    });
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      remeasureCancelZone();
      remeasureLockZone();
    });
    return () => {
      hideSub.remove();
      showSub.remove();
    };
  }, [showRecordingUI]);

  const startRecording = async () => {
    if (recordingRef.current || startingRef.current || isUploading) return;
    startingRef.current = true;
    pendingEndRef.current = null;
    const permission = await requestRecordingPermissionsAsync();
    if (permission.status !== "granted") {
      resetInteraction();
      setPopup({
        visible: true,
        type: "warning",
        title: "Microphone Needed",
        message: "Please allow microphone access to send voice messages.",
      });
      return;
    }

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startingRef.current = false;
      if (mountedRef.current) {
        setDisplaySecs(0);
        applyDragZone("none");
        setRecording(true);
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      timerRef.current = setInterval(() => {
        const secs = Math.floor(recorder.currentTime);
        setDisplaySecs(secs);
        if (secs >= 300) void stopAndSend();
      }, 500);

      const pendingEnd = pendingEndRef.current;
      if (pendingEnd) {
        pendingEndRef.current = null;
        setTimeout(() => {
          if (pendingEnd === "cancel") {
            void cancelRecording();
          } else {
            void stopAndSend();
          }
        }, 120);
      }
    } catch {
      resetInteraction();
      setPopup({
        visible: true,
        type: "error",
        title: "Recording Failed",
        message: "Could not start recording. Please try again.",
      });
    }
  };

  const uploadAudio = async (uri: string, duration: number) => {
    setIsUploading(true);
    const optimisticId = `temp-${Date.now()}-${Math.random()}`;
    try {
      onOptimisticAudio({
        id: optimisticId,
        sender_id: currentUserUUID,
        receiver_id: chatPartnerId,
        message_type: "audio",
        audio_url: uri,
        audio_duration: duration,
        content: null,
        created_at: new Date().toISOString(),
        is_read: false,
        isOptimistic: true,
        localStatus: "sending",
      });

      const conversationKey = [currentUserUUID, chatPartnerId].sort().join("_");
      const filePath = `${conversationKey}/${optimisticId}_${Date.now()}.m4a`;
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const { error: uploadError } = await supabase.storage
        .from("chat-audio")
        .upload(filePath, bytes.buffer, {
          contentType: "audio/m4a",
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("chat-audio").getPublicUrl(filePath);

      const { data: msg, error: msgError } = await supabase
        .from("messages")
        .insert([
          {
            sender_id: currentUserUUID,
            receiver_id: chatPartnerId,
            message_type: "audio",
            audio_url: publicUrl,
            audio_duration: duration,
            content: null,
            is_read: false,
          },
        ])
        .select()
        .single();
      if (msgError) throw msgError;

      onUploadSuccess(msg, optimisticId);
      void sendChatPushNotification({
        senderId: currentUserUUID,
        receiverId: chatPartnerId,
        messageType: "audio",
        messagePreview: "Voice message",
      });
    } catch {
      onUploadError(optimisticId);
    } finally {
      if (mountedRef.current) setIsUploading(false);
    }
  };

  const stopAndSend = async () => {
    if (startingRef.current) {
      pendingEndRef.current = "send";
      return;
    }
    if (sendingRef.current || !recordingRef.current) return;
    sendingRef.current = true;
    clearTimer();
    const duration = Math.max(1, Math.round(recorder.currentTime));
    try {
      await recorder.stop();
      const uri = recorder.uri;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (mountedRef.current) {
        setRecording(false);
        setIsLocked(false);
        setIsHolding(false);
        applyDragZone("none");
        setDisplaySecs(0);
      }
      lockedRef.current = false;
      holdingRef.current = false;
      if (uri) {
        void triggerSendHaptic();
        await uploadAudio(uri, duration);
      }
    } catch {
      resetInteraction();
    } finally {
      sendingRef.current = false;
    }
  };

  const cancelRecording = async () => {
    if (startingRef.current) {
      pendingEndRef.current = "cancel";
      applyDragZone("cancel");
      return;
    }
    clearTimer();
    sendingRef.current = false;
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch {}
    resetInteraction();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        // Fires the UI immediately — see isHolding's own declaration for
        // why this can't wait on startRecording()'s async chain.
        holdingRef.current = true;
        setIsHolding(true);
        void startRecording();
      },
      onPanResponderMove: (_, gesture) => {
        if (lockedRef.current) return;
        lastTouchRef.current = { x: gesture.moveX, y: gesture.moveY };
        evaluateDragZone(gesture.moveX, gesture.moveY);
      },
      onPanResponderRelease: () => {
        if (lockedRef.current) return;
        if (dragZoneRef.current === "cancel") {
          void cancelRecording();
        } else if (dragZoneRef.current === "lock") {
          // Committing the lock here (not the moment the drag first entered
          // the zone) is what makes it a real hover-then-release gesture —
          // see evaluateDragZone's own comment.
          lockedRef.current = true;
          applyDragZone("none");
          if (mountedRef.current) setIsLocked(true);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          void stopAndSend();
        }
      },
      onPanResponderTerminate: () => {
        if (lockedRef.current) return;
        void cancelRecording();
      },
    }),
  ).current;

  const hintText =
    dragZone === "cancel"
      ? "Release to cancel"
      : dragZone === "lock"
        ? "Release to lock"
        : "Release to send";

  // "Hold to talk" crossfades out exactly as the dome grows in — one
  // shared value driving both is what reads as a morph rather than two
  // separate, coincidentally-timed animations.
  const holdToTalkOpacity = domeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const domeOpacity = domeProgress;
  const domeScale = domeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });
  // Pills wait until the dome is most of the way in before they start
  // appearing, then pop in over the remaining stretch — a light stagger
  // that reads as "the dome arrives, then the pills follow" instead of
  // everything growing in at once.
  const pillsOpacity = domeProgress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, 0, 1],
  });
  const pillsScale = domeProgress.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0.7, 0.7, 1],
  });

  return (
    <>
      <View
        style={{ flex: 1, position: "relative" }}
        onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
      >
        {/* Stable gesture anchor — always the same mounted view across
            idle/recording/locked so an in-progress drag never loses its
            native responder. The dome below is purely presentational. */}
        <Animated.View
          {...panResponder.panHandlers}
          style={{
            minHeight: 38,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: pulse }],
            opacity: holdToTalkOpacity,
          }}
        >
          {isUploading ? (
            <CircularLoader size="small" color={PRIMARY} />
          ) : (
            <Text style={{ color: "#111827", fontSize: 15, fontWeight: "700" }}>
              Hold to talk
            </Text>
          )}
        </Animated.View>

        {showRecordingUI && (
          <>
            {/* Live waveform card — a separate, compact bordered panel
                floating above the dome and pills, instead of being
                squeezed into the dome's content layer. Animated in/out
                with the dome (see domeOpacity/domeScale) rather than a
                fresh wrapping View, which would've put it in a new
                positioning context and broken its absolute offsets. */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 24,
                right: 24,
                bottom: WAVEFORM_PANEL_BOTTOM,
                height: WAVEFORM_PANEL_HEIGHT,
                borderRadius: 24,
                // iOS's own continuous ("squircle") corner curve, not the
                // constant-radius circular arc RN draws by default — same
                // smoother, more gradual curvature apple's own UI (app
                // icons, sheets, alerts) uses. No effect on Android; RN
                // silently falls back to the standard circular corner there
                // since Android's View has no native continuous-curve
                // primitive to draw it with.
                borderCurve: "continuous",
                borderWidth: 1.5,
                borderColor: "rgba(255,255,255,0.15)",
                backgroundColor: PRIMARY,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                opacity: domeOpacity,
                transform: [{ scale: domeScale }],
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  height: WAVEFORM_BAR_MAX_H,
                }}
              >
                {barAnims.map((bar, i) => (
                  <Animated.View
                    key={i}
                    style={{
                      width: 4,
                      height: WAVEFORM_BAR_MAX_H,
                      marginHorizontal: 1.6,
                      borderRadius: 4,
                      borderCurve: "continuous",
                      // Same red as the cancel pill's own tint (PILL_TINT_CANCEL),
                      // not a light/pastel red — matches it exactly instead
                      // of introducing a second, weaker "cancel" red.
                      backgroundColor: dragZone === "cancel" ? PILL_TINT_CANCEL : "#ffffff",
                      transform: [{ scaleY: bar }],
                    }}
                  />
                ))}
              </View>
            </Animated.View>

            {/* Dome shape — deliberately wider than its narrow parent so it
                safely spans the full screen width regardless of the
                composer's own horizontal padding. */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: -100,
                right: -100,
                bottom: -DOME_EXTRA,
                height: DOME_TOTAL,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 18,
                opacity: domeOpacity,
                transform: [{ scale: domeScale }],
              }}
            >
              <Svg
                width="100%"
                height={DOME_TOTAL}
                viewBox={`0 0 100 ${DOME_TOTAL}`}
                preserveAspectRatio="none"
              >
                <Path d={DOME_PATH} fill="#ffffff" />
              </Svg>
            </Animated.View>
            {/* zIndex pins the content layer above the dome background on
                every platform — elevation (used for Android shadows) also
                reorders siblings by itself, so it's deliberately left off
                the dome shape above to avoid it painting over this. */}

            {/* Content layer, aligned to the parent's own (narrower, more
                accurately centered) width rather than the stretched dome. */}
            <Animated.View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                zIndex: 1,
                left: 0,
                right: 0,
                bottom: -DOME_EXTRA,
                height: DOME_HEIGHT + DOME_EXTRA,
                opacity: domeOpacity,
                transform: [{ scale: domeScale }],
              }}
            >
              {/* Recording timer, near the dome's own peak */}
              <View
                pointerEvents="none"
                style={{ position: "absolute", top: 22, left: 0, right: 0, alignItems: "center" }}
              >
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: "700",
                    color: "#374151",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {formatSecs(displaySecs)}
                </Text>
              </View>

              {/* Hint text, right below the timer — kept high in the dome
                  so a holding thumb (which covers the lower/base area)
                  doesn't block it. */}
              {!isLocked && (
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 46,
                    left: 0,
                    right: 0,
                    alignItems: "center",
                    opacity: panelOpacity,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: dragZone === "cancel" ? "#dc2626" : "#111827",
                    }}
                  >
                    {hintText}
                  </Text>
                </Animated.View>
              )}

            </Animated.View>

            {/* Cancel pill — a curved capsule floating above the dome,
                echoing its arc (see PILL constants above). */}
            <Animated.View
              ref={cancelPillRef}
              pointerEvents="box-none"
              // Only the visible curve counts as the zone — skip the
              // invisible far-tip overhang before PILL_EDGE_OVERHANG, same
              // region the tap target below excludes. No left bound:
              // anywhere at or past the inner edge, toward and beyond the
              // screen's left side, still reads as cancel. measureInWindow
              // is async — if a fast flick already landed and went still
              // before this resolved, there's no further move event to
              // re-check it against, so remeasureCancelZone catches up
              // immediately using the last known touch (also re-run on
              // keyboard settle — see that effect for why).
              onLayout={remeasureCancelZone}
              style={{
                position: "absolute",
                left: -(PILL_EDGE_OVERHANG + PILL_PAD),
                bottom: pillContainerBottom,
                width: pillContainerWidth,
                height: pillContainerHeight,
                // Opacity doesn't affect layout, so the measureInWindow
                // calls above still return accurate bounds regardless of
                // where this animation currently is.
                opacity: pillsOpacity,
                transform: [{ scale: pillsScale }],
              }}
            >
              <MaskedView
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: pillContainerWidth,
                  height: pillContainerHeight,
                }}
                maskElement={
                  <Svg width={pillContainerWidth} height={pillContainerHeight}>
                    <Path
                      d={cancelPillPath}
                      stroke="#000000"
                      strokeWidth={PILL_STROKE_WIDTH}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                }
              >
                <BlurView intensity={20} tint="dark" style={{ width: "100%", height: "100%" }} />
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor:
                      !isLocked && dragZone === "cancel" ? PILL_TINT_CANCEL : PILL_TINT_IDLE,
                  }}
                />
              </MaskedView>
              {/* The whole visible pill is the tap target once locked —
                  not just the icon/label — so it excludes only the
                  (invisible, off-screen) far-tip overhang before
                  PILL_EDGE_OVERHANG. */}
              {isLocked && (
                <TouchableOpacity
                  onPress={() => void cancelRecording()}
                  style={{
                    position: "absolute",
                    left: PILL_EDGE_OVERHANG,
                    top: 0,
                    right: 0,
                    bottom: 0,
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                />
              )}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: cancelLabel.x - LABEL_HALF_W,
                  top: cancelLabel.y - LABEL_HALF_H,
                  width: LABEL_HALF_W * 2,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ rotate: `${cancelLabel.angleDeg}deg` }],
                }}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color="#ffffff"
                />
                <Text
                  style={{
                    marginLeft: 6,
                    fontSize: 12,
                    fontWeight: "700",
                    color: "#ffffff",
                  }}
                >
                  Cancel
                </Text>
              </View>
            </Animated.View>

            {/* Lock pill — mirrored. Becomes a Send button once locked. */}
            <Animated.View
              ref={lockPillRef}
              pointerEvents="box-none"
              // Mirror of the cancel zone: no right bound (anywhere at or
              // past the inner edge, toward and beyond the screen's right
              // side, still reads as lock). See the matching comment on the
              // cancel pill's onLayout.
              onLayout={remeasureLockZone}
              style={{
                position: "absolute",
                left: lockContainerLeft,
                bottom: pillContainerBottom,
                width: pillContainerWidth,
                height: pillContainerHeight,
                opacity: pillsOpacity,
                transform: [{ scale: pillsScale }],
              }}
            >
              <MaskedView
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: pillContainerWidth,
                  height: pillContainerHeight,
                }}
                maskElement={
                  <Svg width={pillContainerWidth} height={pillContainerHeight}>
                    <Path
                      d={lockPillPath}
                      stroke="#000000"
                      strokeWidth={PILL_STROKE_WIDTH}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </Svg>
                }
              >
                <BlurView intensity={20} tint="dark" style={{ width: "100%", height: "100%" }} />
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor:
                      isLocked || dragZone === "lock" ? PILL_TINT_LOCK : PILL_TINT_IDLE,
                  }}
                />
              </MaskedView>
              {/* The whole visible pill is the tap target once locked —
                  not just the icon/label — so it excludes only the
                  (invisible, off-screen) far-tip overhang before
                  PILL_EDGE_OVERHANG. */}
              {isLocked && (
                <TouchableOpacity
                  onPress={() => void stopAndSend()}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    right: PILL_EDGE_OVERHANG,
                    bottom: 0,
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                />
              )}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: lockLabel.x - LABEL_HALF_W,
                  top: lockLabel.y - LABEL_HALF_H,
                  width: LABEL_HALF_W * 2,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ rotate: `${lockLabel.angleDeg}deg` }],
                }}
              >
                {isLocked ? (
                  <>
                    <Ionicons name="send" size={15} color="#ffffff" />
                    <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: "700", color: "#ffffff" }}>
                      Send
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons
                      name="lock-closed-outline"
                      size={16}
                      color="#ffffff"
                    />
                    <Text
                      style={{
                        marginLeft: 6,
                        fontSize: 12,
                        fontWeight: "700",
                        color: "#ffffff",
                      }}
                    >
                      Lock
                    </Text>
                  </>
                )}
              </View>
            </Animated.View>
          </>
        )}
      </View>

      <Modal visible={popup.visible} transparent animationType="none">
        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup((p) => ({ ...p, visible: false }))}
        />
      </Modal>
    </>
  );
}
