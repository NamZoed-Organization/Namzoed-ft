/**
 * The collage editor.
 *
 * Full screen, on the day's photos, with the shape in the recorder's hands:
 * portrait or landscape, and how many of the day to include. There is no
 * columns/rows stepper any more — the arrangement is derived from the
 * photos' own proportions (`lib/collageLayout.ts`), so there is no grid to
 * set. A collage somebody is about to post has a shape they want more than
 * it has every photo they took, so the count can cap it, and the screen says
 * plainly how many are being left out rather than dropping them quietly.
 *
 * **Every photo is measured before it is drawn.** The layout is built out of
 * real aspect ratios, so the screen asks `Image.getSize` for each file the
 * moment it is on disk and lays out only once it has them. Guessing square
 * and correcting later would reflow the collage under the recorder's hands.
 *
 * **The clock and the title are on every cell, exactly as recorded.** They
 * are what the photo *was*, not decoration added at export time, so they
 * are not editable here and they are never dropped.
 *
 * The collage is laid out at export size and scaled down for the preview,
 * never laid out small and scaled up: `captureRef` flattens what is on
 * screen, so anything else ships a blurry file.
 */

import DayCollage, {
  COLLAGE_FORMATS,
  type CollageFormat,
} from "@/components/setlog/DayCollage";
import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import EdgeSwipeBack from "@/components/ui/EdgeSwipeBack";
import PopupMessage from "@/components/ui/PopupMessage";
import { MODAL_RADIUS } from "@/constants/theme";
import { getDayExport, uploadCollage } from "@/lib/setlogExport";
import { prefetchClips, type LocalClip } from "@/lib/setlogMediaCache";
import {
  canSaveToLibrary,
  saveToLibrary,
  shareFile,
  shareToApp,
  type ShareTarget,
} from "@/lib/setlogShare";
import EditMenu from "@/components/setlog/EditMenu";
import PostToNamzoed from "@/components/setlog/PostToNamzoed";
import type { ComposerSeedMedia } from "@/components/modals/CreatePost";
import { formatDay, localDay } from "@/lib/setlogService";
import { waitForIosModalDismiss } from "@/utils/modal";
import { useAppRouter } from "@/utils/navigation";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import {
  EditorFootBar,
  EditorTopBar,
} from "@/components/setlog/EditorChrome";
import {
  Download,
  Grid3x3,
  ImagePlus,
  Instagram,
  // lucide has no TikTok mark; a music note is the nearest honest stand-in
  // and TikTok's own guidelines forbid redrawing theirs anyway.
  Music2,
  Paintbrush,
  RectangleVertical,
  Share2,
  SlidersHorizontal,
  Sticker,
  Twitter,
  Type,
  X,
} from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StatusBar,
  Text,
  View,
} from "react-native";
import ViewShot, { captureRef } from "react-native-view-shot";

const INSET = 16;
const SCREEN_W = Dimensions.get("window").width;
const PREVIEW_W = SCREEN_W - INSET * 2;

/** The ground the grid sits on. Named rather than a swatch: a colour with
 *  a name is a choice somebody can repeat. */
const BACKGROUNDS = [
  { value: "#111827", label: "Ink" },
  { value: "#000000", label: "Black" },
  { value: "#FFFFFF", label: "White" },
  { value: "#F5F5F5", label: "Paper" },
];

export default function SetlogCollageScreen() {
  const router = useAppRouter();
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  const day = dayParam ? String(dayParam) : localDay();

  const [photos, setPhotos] = useState<LocalClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(0);
  const [saving, setSaving] = useState(false);
  const [format, setFormat] = useState<CollageFormat>("portrait");
  /** How many of the day to include, newest-last. Null is all of them. */
  const [limit, setLimit] = useState<number | null>(null);
  const [aspects, setAspects] = useState<Record<string, number>>({});
  const [showOptions, setShowOptions] = useState(false);
  const [watermark, setWatermark] = useState(true);
  const [showStamp, setShowStamp] = useState(true);
  const [background, setBackground] = useState("#111827");
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "warning" | "error" | "white";
    title: string;
    message: string;
  }>({ visible: false, type: "white", title: "", message: "" });

  // The captured file, while the in-app composer is open over this screen.
  // Null closes it, and the composer is keyed on the uri so a second export
  // after changing the grid seeds a fresh one.
  const [composerMedia, setComposerMedia] = useState<ComposerSeedMedia | null>(
    null,
  );

  const collageRef = useRef<ViewShot>(null);

  /**
   * Rows, then files, then the screen.
   *
   * `captureRef` flattens what is *on screen* — an image still loading
   * flattens as a grey square, so a collage exported before its photos
   * arrived would ship the holes. Downloading first is what makes the
   * export deterministic, not merely the preview nicer.
   */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await getDayExport(day);
        if (!alive) return;
        const local = await prefetchClips(result.photos, (done) => {
          if (alive) setReady(done);
        });
        if (!alive) return;
        setPhotos(local);
        // Real proportions, before anything is laid out. Image.getSize on a
        // file:// URI is a header read, so this is fast — and it is the
        // difference between a collage of the photos and a collage of
        // squares with the photos cropped into them.
        const measured = await Promise.all(
          local.map(
            (clip) =>
              new Promise<[string, number]>((resolve) => {
                if (!clip.url) return resolve([clip.id, 1]);
                Image.getSize(
                  clip.url,
                  (w, h) => resolve([clip.id, h > 0 ? w / h : 1]),
                  // A photo that will not report its size still has to
                  // appear; square is the least wrong assumption.
                  () => resolve([clip.id, 1]),
                );
              }),
          ),
        );
        if (!alive) return;
        setAspects(Object.fromEntries(measured));
      } catch (e) {
        console.error("Error loading collage:", e);
        if (alive) setPhotos([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [day]);

  const shownPhotos = limit == null ? photos : photos.slice(0, limit);
  const leftOut = photos.length - shownPhotos.length;
  const gridNote =
    leftOut > 0
      ? `${shownPhotos.length} of ${photos.length} included — the last ${leftOut} ${leftOut === 1 ? "photo is" : "photos are"} left out.`
      : null;

  const frame = COLLAGE_FORMATS[format];
  const previewScale = PREVIEW_W / frame.width;

  /**
   * Flatten the preview into a file.
   *
   * One path, whatever is being done with it afterwards: the capture is the
   * expensive half and the destination is a detail. The upload is what
   * gives Android a link to share, since it cannot attach a local file to
   * an arbitrary app.
   */
  const buildFile = async (
    /** Whether a shareable link is wanted. False for the in-app composer,
     *  which uploads its own copy into the posts bucket — filing a second
     *  one under the log as well is a write nothing ever reads. */
    needsLink = true,
  ): Promise<{ uri: string; url: string | null }> => {
    const uri = await captureRef(collageRef, {
      format: "jpg",
      quality: 0.95,
      result: "tmpfile",
    });
    if (__DEV__) {
      // The capture silently took the preview box's width once already (see
      // the ViewShot below), and a cut-off collage looks enough like a
      // deliberate crop that it shipped. A file whose shape is not the
      // frame's shape is always a bug, and this is the only moment anything
      // can tell.
      Image.getSize(
        uri,
        (w, h) => {
          const want = frame.width / frame.height;
          if (Math.abs(w / h - want) > 0.02) {
            console.warn(
              `[collage] exported ${w}×${h} (${(w / h).toFixed(3)}) but the ${format} frame is ${frame.width}×${frame.height} (${want.toFixed(3)}). Something in the capture tree is constraining the ViewShot.`,
            );
          }
        },
        () => {},
      );
    }
    let url: string | null = null;
    if (!needsLink) return { uri, url };
    try {
      // Filed under the log its photos came from — the only path the
      // bucket's policies cover.
      url = await uploadCollage(photos[0].setlogId, day, uri);
    } catch {
      // A link is a convenience; the file in hand is the export.
    }
    return { uri, url };
  };

  const run = async (
    what: (file: { uri: string; url: string | null }) => Promise<void>,
    failure: string,
    needsLink = true,
  ) => {
    if (photos.length === 0 || !collageRef.current || saving) return;
    setSaving(true);
    try {
      const file = await buildFile(needsLink);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // The OS share sheet is a native view controller and cannot be
      // presented while anything else is coming down (utils/modal.ts).
      await waitForIosModalDismiss(250);
      await what(file);
    } catch (e: any) {
      setPopup({
        visible: true,
        type: "error",
        title: "Couldn't export",
        message: e?.message || failure,
      });
    } finally {
      setSaving(false);
    }
  };

  const caption = `${formatDay(day)} on Setlog`;

  const onSave = () =>
    run(async ({ uri }) => {
      await saveToLibrary(uri);
      setPopup({
        visible: true,
        type: "success",
        title: "Saved",
        message: "The collage is in your photos.",
      });
    }, "That collage didn't save.");

  const onShare = () =>
    run(({ uri, url }) => shareFile(uri, caption, url), "That collage didn't send.");

  const onShareTo = (target: ShareTarget) =>
    run(({ uri, url }) => shareToApp(target, uri, caption, url), "That didn't open.");

  /**
   * Namzoed itself — the destination the row was missing.
   *
   * Goes through the same capture as every other target, so what reaches the
   * composer is the export rather than a second rendering of it. It skips the
   * link, though: the composer uploads its own copy into the posts bucket, and
   * a link is only for handing a file to an app that cannot take one.
   *
   * The dimensions are the chosen frame's, so the composer shows the collage
   * at its real shape instead of assuming a portrait picture and
   * letterboxing a wide one.
   */
  const onPostToNamzoed = () =>
    run(
      async ({ uri }) => {
        setComposerMedia({
          uri,
          type: "image",
          width: frame.width,
          height: frame.height,
        });
      },
      "That collage didn't open in the composer.",
      false,
    );

  return (
    <EdgeSwipeBack onSwipeBack={() => router.back()}>
      <View style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND }}>
        <StatusBar barStyle="dark-content" />

        <PopupMessage
          visible={popup.visible}
          type={popup.type}
          title={popup.title}
          message={popup.message}
          onHide={() => setPopup((p) => ({ ...p, visible: false }))}
        />

        <EditorTopBar
          onClose={() => router.back()}
          closeIcon={<X size={22} color="#111827" strokeWidth={2.2} />}
          actions={
            photos.length > 0 && !loading
              ? [
                  {
                    key: "save",
                    busy: saving,
                    onPress: onSave,
                    icon: (
                      <Download
                        size={20}
                        color={canSaveToLibrary() ? "#111827" : "#C7C7CC"}
                        strokeWidth={2}
                      />
                    ),
                  },
                  {
                    key: "share",
                    primary: true,
                    busy: saving,
                    onPress: onShare,
                    icon: saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Share2 size={20} color="#fff" strokeWidth={2} />
                    ),
                  },
                ]
              : []
          }
        />

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#0369A1" />
            <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 12 }}>
              {ready > 0 ? `Loading the day · ${ready}` : "Loading the day"}
            </Text>
          </View>
        ) : photos.length === 0 ? (
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
              No photos on {formatDay(day).toLowerCase()}. Switch the camera to
              Photo and the collage fills itself in.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* The preview *is* the export, shrunk. Height is reserved by
                hand because a scaled child still lays out at full size. */}
            <View
              style={{
                marginHorizontal: INSET,
                width: PREVIEW_W,
                height: frame.height * previewScale,
                borderRadius: MODAL_RADIUS,
                borderCurve: "continuous",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  // Full size, then scaled. The width has to be stated here
                  // too: this is the flex parent of the ViewShot below, and
                  // without it the chain inherits the preview box's width.
                  width: frame.width,
                  height: frame.height,
                  transform: [{ scale: previewScale }],
                  transformOrigin: "top left",
                }}
              >
                {/*
                  **The ViewShot must be exactly the collage's size.**
                  `captureRef` captures this view's own laid-out frame, and
                  with no size of its own it was stretched to the preview
                  box's width (PREVIEW_W, ~361pt) while DayCollage inside it
                  drew at its real 540 — so the capture came out 361×675pt
                  and everything past 67% of the width was simply cut off.
                  On a square 3-column grid that lost the right-hand column
                  and read as "the grid"; with two photos in a row it cut one
                  of them in half, which is how it was finally spotted.
                */}
                <ViewShot
                  ref={collageRef}
                  style={{ width: frame.width, height: frame.height }}
                >
                  <DayCollage
                    day={day}
                    photos={shownPhotos}
                    aspects={aspects}
                    format={format}
                    background={background}
                    showStamp={showStamp}
                    watermark={watermark}
                  />
                </ViewShot>
              </View>
            </View>

            {/* Said, never done silently: a grid smaller than the day is a
                choice, and the recorder should know they made it. */}
            {gridNote && (
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 18,
                  color: "#DC2626",
                  paddingHorizontal: INSET + 2,
                  paddingTop: 12,
                }}
              >
                {gridNote}
              </Text>
            )}
          </ScrollView>
        )}

        {photos.length > 0 && !loading && (
          <EditorFootBar
            disabled={saving}
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
                kind: "submenu",
                key: "format",
                label: "Shape",
                icon: <RectangleVertical size={17} color="#fff" strokeWidth={1.9} />,
                value: COLLAGE_FORMATS[format].label,
                selected: format,
                options: (
                  Object.keys(COLLAGE_FORMATS) as CollageFormat[]
                ).map((key) => ({
                  value: key,
                  label: `${COLLAGE_FORMATS[key].label} · ${COLLAGE_FORMATS[key].note}`,
                })),
                onSelect: (v) => setFormat(v as CollageFormat),
              },
              {
                // A count, not a grid: the arrangement follows from the
                // photos, so the only thing left to decide is how much of
                // the day goes in.
                kind: "submenu",
                key: "limit",
                label: "Include",
                icon: <Grid3x3 size={17} color="#fff" strokeWidth={1.9} />,
                value:
                  limit == null ? `All ${photos.length}` : `First ${limit}`,
                selected: limit == null ? "all" : String(limit),
                options: [
                  { value: "all", label: `All ${photos.length}` },
                  ...[3, 4, 6, 8, 12]
                    .filter((n) => n < photos.length)
                    .map((n) => ({ value: String(n), label: `First ${n}` })),
                ],
                onSelect: (v) => setLimit(v === "all" ? null : Number(v)),
              },
              {
                kind: "submenu",
                key: "background",
                label: "Background",
                icon: <Paintbrush size={17} color="#fff" strokeWidth={1.9} />,
                value:
                  BACKGROUNDS.find((b) => b.value === background)?.label ?? "Ink",
                selected: background,
                options: BACKGROUNDS,
                onSelect: setBackground,
              },
            ]}
          />
        )}
      </View>
    </EdgeSwipeBack>
  );
}
