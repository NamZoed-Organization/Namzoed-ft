/**
 * The reel editor.
 *
 * The day's clips played through full screen, with the split in the
 * recorder's hands: **1, 2 or 3 at a time**. That split is the format's own
 * idea — the day read side by side rather than one thing after another —
 * and it is the one thing about a reel worth deciding. Sound is the other.
 *
 * **Every frame keeps its clock and title, exactly as recorded.** They are
 * what the clip *was*; nothing here writes them, edits them, or leaves them
 * off.
 *
 * ## What this does not do
 *
 * It does not produce a video file. There is no encoder on the device —
 * `expo-video` plays, `expo-camera` records, neither concatenates, and no
 * ffmpeg is bundled — so a stitched MP4 is a server-side render and is not
 * built. This is the reel as something to *watch*, with the controls that
 * would shape the render when there is one. The screen says so rather than
 * offering a button that would have to lie.
 */

import ClipStamp, { clipClock } from "@/components/setlog/ClipStamp";
import { MODAL_RADIUS } from "@/constants/theme";
import { getDayExport } from "@/lib/setlogExport";
import { prefetchClips, type LocalClip } from "@/lib/setlogMediaCache";
import { canStitch, stitchReel } from "@/modules/setlog-stitcher";
import { Asset } from "expo-asset";
import {
  saveToLibrary,
  shareFile,
  shareToApp,
  type ShareTarget,
} from "@/lib/setlogShare";
import { waitForIosModalDismiss } from "@/utils/modal";
import * as Haptics from "expo-haptics";
import { CAPTURE_MODES, formatDay, localDay } from "@/lib/setlogService";
import { useAppRouter } from "@/utils/navigation";
import { useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import EditMenu from "@/components/setlog/EditMenu";
import PostToNamzoed from "@/components/setlog/PostToNamzoed";
import type { ComposerSeedMedia } from "@/components/modals/CreatePost";
import PopupMessage from "@/components/ui/PopupMessage";
import {
  EditorFootBar,
  EditorTopBar,
} from "@/components/setlog/EditorChrome";
import {
  Download,
  ImagePlus,
  Instagram,
  Layers,
  // lucide has no TikTok mark; a music note is the nearest honest stand-in
  // and TikTok's own guidelines forbid redrawing theirs anyway.
  Music2,
  Paintbrush,
  Share2,
  SlidersHorizontal,
  Sticker,
  Twitter,
  Type,
  Volume2,
  X,
} from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * One at a time, for now.
 *
 * The preview has always been able to play two and three up, and the export
 * never could — the render worker that was supposed to build it had never
 * once succeeded. Now that the export is real, offering a layout the file
 * would not come back in would be the preview lying about the result.
 *
 * The multi-pane composition is written on the iOS side already; Android's
 * equivalent (Media3's multi-sequence compositor) is not, and a reel that
 * arrives three-up on one phone and one-up on the other is worse than one
 * that is the same everywhere. It goes back to [1, 2, 3] when both encoders
 * do it and both have been run on a real device.
 */
const SPLITS = [1] as const;

/** The ground behind the panes — the letterbox, in other words. Named
 *  rather than a swatch: a colour with a name is a choice somebody can
 *  repeat. */
const BACKGROUNDS = [
  { value: "#000000", label: "Black" },
  { value: "#111827", label: "Ink" },
  { value: "#FFFFFF", label: "White" },
  { value: "#F5F5F5", label: "Paper" },
];
type Split = (typeof SPLITS)[number];

const SCREEN_W = Dimensions.get("window").width;
const STAGE_INSET = 12;
const GAP = 6;

/**
 * One pane of the split.
 *
 * A player per pane, mounted only while its pane is on screen — three
 * decoders is the point of the format, thirty would be the end of it.
 */
function Frame({
  clip,
  muted,
  playing,
  height,
  width,
  showStamp,
}: {
  clip: LocalClip;
  muted: boolean;
  playing: boolean;
  height: number;
  width: number;
  showStamp: boolean;
}) {
  const isPhoto = clip.mediaType === "photo";
  const player = useVideoPlayer(
    clip.url && !isPhoto ? { uri: clip.url } : null,
    (p) => {
      p.loop = true;
      p.playbackRate = CAPTURE_MODES[clip.captureMode]?.rate ?? 1;
    },
  );

  useEffect(() => {
    if (isPhoto || !clip.url) return;
    player.muted = muted;
    if (playing) player.play();
    else player.pause();
  }, [player, muted, playing, isPhoto, clip.url]);

  return (
    <View
      style={{
        width,
        height,
        borderRadius: MODAL_RADIUS,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: "#111827",
      }}
    >
      {clip.url ? (
        isPhoto ? (
          <Image
            source={{ uri: clip.url }}
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
      ) : null}

      {/* The stamp, as recorded — the same component the feed card and the
          collage cells use, scaled to the pane. */}
      {showStamp && (
        <ClipStamp createdAt={clip.createdAt} title={clip.title} size={height} />
      )}
    </View>
  );
}

export default function SetlogReelScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  const day = dayParam ? String(dayParam) : localDay();

  const [clips, setClips] = useState<LocalClip[]>([]);
  /**
   * The logo as a real file the encoder can open.
   *
   * A `require`d image is a bundle reference, not a path — in a release
   * build it lives inside the app package and neither AVFoundation nor
   * Media3 can read it. `expo-asset` unpacks it to the filesystem once and
   * hands back a `file://` URI, which is the only thing either encoder will
   * take. Resolved up here rather than at export time so a watermarked share
   * never waits on it.
   */
  const [logoUri, setLogoUri] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Asset.fromModule(require("@/assets/images/logo.png"))
      .downloadAsync()
      .then((asset) => {
        if (alive) setLogoUri(asset.localUri ?? asset.uri);
      })
      // A reel without its mark beats no reel.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(0);
  const [split, setSplit] = useState<Split>(1);
  // Sound on: this is a vlog, and a silent one is half of it. The feed
  // mutes because it scrolls past; here you came to watch.
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [page, setPage] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderNote, setRenderNote] = useState<string | null>(null);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "warning" | "error" | "white";
    title: string;
    message: string;
  }>({ visible: false, type: "white", title: "", message: "" });
  const [showStamp, setShowStamp] = useState(true);
  const [watermark, setWatermark] = useState(true);
  const [background, setBackground] = useState("#000000");
  // The rendered mp4, while the in-app composer is open over this screen.
  const [composerMedia, setComposerMedia] = useState<ComposerSeedMedia | null>(
    null,
  );

  const pages = Math.max(1, Math.ceil(clips.length / split));
  const current = useMemo(
    () => clips.slice(page * split, page * split + split),
    [clips, page, split],
  );

  /**
   * Rows, then files, then the screen.
   *
   * Nothing renders until every clip is on disk, because a reel that opens
   * on three black rectangles filling in one by one is the worst possible
   * first frame of a thing whose whole job is to be looked at. The chooser
   * usually did this already, in which case the files exist and this
   * returns at once.
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getDayExport(day);
        if (!alive) return;
        const local = await prefetchClips(data.videos, (done) => {
          if (alive) setReady(done);
        });
        if (alive) setClips(local);
      } catch (e) {
        console.error("Error loading reel:", e);
        if (alive) setClips([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [day]);

  /**
   * Stitched here, on this phone.
   *
   * This used to put a row in `setlog_renders` and wait for a worker with
   * ffmpeg to pick it up, which meant a server, a service-role key, a queue,
   * and — for as long as nobody had deployed one — no reel at all. It is
   * now the platform's own encoder (`modules/setlog-stitcher`): AVFoundation
   * on iOS, Media3 Transformer on Android, both hardware accelerated. No
   * network, so it works on a plane, and there is nothing to download
   * afterwards because the file was written here.
   */
  const withFile = async (
    what: (fileUri: string) => Promise<void>,
    verb: string,
  ) => {
    if (clips.length === 0 || rendering) return;
    setRendering(true);
    setRenderNote("Stitching the reel…");
    try {
      const file = await stitchReel(
        {
          clips: clips.map((clip) => ({
            // Every clip is already on this phone; the cache put it there
            // when it was recorded.
            uri: clip.url ?? "",
            mediaType: clip.mediaType === "photo" ? "photo" : "video",
            durationMs: clip.durationMs,
            // Formatted here, in the phone's own 12/24-hour convention —
            // the native side must not re-derive it and disagree.
            clock: clipClock(clip.createdAt),
            title: clip.title,
          })),
          sound: !muted,
          stamp: showStamp,
          watermark,
          background,
          watermarkUri: watermark ? logoUri : null,
        },
        (fraction) =>
          setRenderNote(`Stitching · ${Math.round(fraction * 100)}%`),
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await waitForIosModalDismiss(250);
      await what(file);
    } catch (e: any) {
      setPopup({
        visible: true,
        type: "warning",
        title: `Couldn't ${verb} the reel`,
        message: e?.message || "Something went wrong building it.",
      });
    } finally {
      setRendering(false);
      setRenderNote(null);
    }
  };

  const caption = `${formatDay(day)} on Setlog`;

  // Said up front rather than on tap: the stitcher is native, so a JS reload
  // cannot add it to a binary built before it existed, and finding that out
  // by pressing Share reads as the export failing rather than as this build
  // being behind.
  const buildNote = canStitch
    ? null
    : "This build doesn't include the stitcher yet — it's native, so it needs a new development build.";

  const onSave = () =>
    withFile(async (file) => {
      await saveToLibrary(file);
      setPopup({
        visible: true,
        type: "success",
        title: "Saved",
        message: "The reel is in your photos.",
      });
    }, "save");

  const onShare = () => withFile((file) => shareFile(file, caption), "share");

  const onShareTo = (target: ShareTarget) =>
    withFile((file) => shareToApp(target, file, caption), "share");

  /**
   * Namzoed itself. Same render as every other destination — so if the day
   * has already been stitched with these settings, this opens on the file
   * that exists rather than queueing a second identical job.
   *
   * The result is a video post, which is what a Reel *is* here: nothing else
   * needs to happen for it to appear in the reels viewer.
   */
  const onPostToNamzoed = () =>
    withFile(async (file) => {
      setComposerMedia({ uri: file, type: "video" });
    }, "post");

  // Changing the split re-cuts the day, so the page it was on no longer
  // means anything — back to the start rather than somewhere arbitrary.
  useEffect(() => {
    setPage(0);
  }, [split]);

  /**
   * The pane group advances together, on the longest clip in it.
   *
   * A timer rather than `playToEnd`: with two or three playing at once
   * there is no single "the clip ended", and advancing on the first would
   * cut the others off mid-sentence.
   */
  useEffect(() => {
    if (!playing || current.length === 0) return;
    const longest = current.reduce(
      (max, c) => Math.max(max, c.durationMs || 2000),
      0,
    );
    const rate = CAPTURE_MODES[current[0]?.captureMode]?.rate ?? 1;
    const t = setTimeout(() => {
      // Loops the day rather than stopping on the last frame: a reel that
      // ends on a frozen pane looks like it broke.
      setPage((p) => (p + 1) % pages);
    }, Math.max(1200, longest / rate));
    return () => clearTimeout(t);
  }, [playing, current, pages]);

  // ── Stage geometry ──────────────────────────────────────────────────
  const stageW = SCREEN_W - STAGE_INSET * 2 - GAP * 2;
  const availableH =
    Dimensions.get("window").height - insets.top - insets.bottom - 210;
  const frameH = Math.floor((availableH - GAP * (split - 1)) / split);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <StatusBar barStyle="dark-content" />

      {/* Close on the left; nothing on the right, because nothing here
          produces a file and a share button that pretended to would be the
          one dishonest thing on the screen. */}
      <EditorTopBar
        onClose={() => router.back()}
        closeIcon={<X size={22} color="#111827" strokeWidth={2.2} />}
        actions={
          clips.length > 0 && !loading
            ? [
                {
                  key: "save",
                  onPress: onSave,
                  busy: rendering,
                  icon: <Download size={20} color="#111827" strokeWidth={2} />,
                },
                {
                  key: "share",
                  primary: true,
                  busy: rendering,
                  onPress: onShare,
                  icon: rendering ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Share2 size={20} color="#fff" strokeWidth={2} />
                  ),
                },
              ]
            : []
        }
      />

      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
        onHide={() => setPopup((p) => ({ ...p, visible: false }))}
      />

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#0369A1" />
          <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 12 }}>
            {ready > 0 ? `Loading the day · ${ready}` : "Loading the day"}
          </Text>
        </View>
      ) : clips.length === 0 ? (
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
              fontSize: 16,
              lineHeight: 22,
              color: "#9CA3AF",
              textAlign: "center",
            }}
          >
            No clips on {formatDay(day).toLowerCase()}.
          </Text>
        </View>
      ) : (
        <>
          {/* The stage. Tapping it holds or resumes. */}
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setPlaying((p) => !p)}
            style={{
              flex: 1,
              marginHorizontal: STAGE_INSET,
              padding: GAP,
              gap: GAP,
              justifyContent: "center",
              backgroundColor: background,
              borderRadius: 18,
              borderCurve: "continuous",
              overflow: "hidden",
            }}
          >
            {current.map((clip) => (
              <Frame
                key={clip.id}
                clip={clip}
                muted={muted}
                playing={playing}
                width={stageW}
                height={frameH}
                showStamp={showStamp}
              />
            ))}
          </TouchableOpacity>


          {/* What the renderer is doing, over the stage rather than in a
              spinner that says only "working" — a reel takes long enough
              that a percentage is the difference between waiting and
              wondering. */}
          {!renderNote && buildNote && (
            <View
              style={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: 12,
                borderRadius: MODAL_RADIUS,
                borderCurve: "continuous",
                backgroundColor: "rgba(17,24,39,0.82)",
                paddingHorizontal: 14,
                paddingVertical: 10,
                zIndex: 20,
              }}
              pointerEvents="none"
            >
              <Text style={{ fontSize: 13, lineHeight: 18, color: "#fff" }}>
                {buildNote}
              </Text>
            </View>
          )}

          {renderNote && (
            <View
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.86)",
                zIndex: 20,
              }}
              pointerEvents="none"
            >
              <ActivityIndicator color="#0369A1" />
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: "600",
                  color: "#111827",
                  marginTop: 12,
                }}
              >
                {renderNote}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: "#9CA3AF",
                  marginTop: 4,
                  paddingHorizontal: 40,
                  textAlign: "center",
                }}
              >
                Stitching the day into one video.
              </Text>
            </View>
          )}

          <EditorFootBar
            targets={[
              {
                // First, and the only one that keeps the day in the app the
                // day was recorded in — the others are all exits.
                key: "namzoed",
                icon: <ImagePlus size={22} color="#111827" strokeWidth={1.9} />,
                onPress: onPostToNamzoed,
              },
              {
                key: "instagram",
                icon: <Instagram size={22} color="#111827" strokeWidth={1.9} />,
                onPress: () => onShareTo("instagram"),
              },
              {
                key: "tiktok",
                icon: <Music2 size={22} color="#111827" strokeWidth={1.9} />,
                onPress: () => onShareTo("tiktok"),
              },
              {
                key: "x",
                icon: <Twitter size={22} color="#111827" strokeWidth={1.9} />,
                onPress: () => onShareTo("x"),
              },
            ]}
            onOptions={() => setShowOptions(true)}
            optionsIcon={
              <SlidersHorizontal size={20} color="#111827" strokeWidth={2} />
            }
          />
        </>
      )}

      <PostToNamzoed
        media={composerMedia}
        caption={caption}
        onClose={() => setComposerMedia(null)}
      />

      {showOptions && (
        <EditMenu
          onClose={() => setShowOptions(false)}
          items={[
            {
              kind: "toggle",
              key: "watermark",
              label: "Logo watermark",
              icon: <Sticker size={17} color="#fff" strokeWidth={1.9} />,
              value: watermark,
              onToggle: setWatermark,
            },
            {
              kind: "toggle",
              key: "stamp",
              label: "Text overlay",
              icon: <Type size={17} color="#fff" strokeWidth={1.9} />,
              value: showStamp,
              onToggle: setShowStamp,
            },
            {
              kind: "toggle",
              key: "sound",
              label: "Include sound",
              icon: <Volume2 size={17} color="#fff" strokeWidth={1.9} />,
              value: !muted,
              onToggle: (on) => setMuted(!on),
            },
            {
              kind: "submenu",
              key: "frames",
              label: "Frames",
              icon: <Layers size={17} color="#fff" strokeWidth={1.9} />,
              value: `${split} up`,
              selected: String(split),
              options: SPLITS.map((n) => ({
                value: String(n),
                label: `${n} at a time`,
              })),
              onSelect: (v) => setSplit(Number(v) as Split),
            },
            {
              kind: "submenu",
              key: "background",
              label: "Background",
              icon: <Paintbrush size={17} color="#fff" strokeWidth={1.9} />,
              value:
                BACKGROUNDS.find((b) => b.value === background)?.label ?? "Black",
              selected: background,
              options: BACKGROUNDS,
              onSelect: setBackground,
            },
          ]}
        />
      )}
    </View>
  );
}
