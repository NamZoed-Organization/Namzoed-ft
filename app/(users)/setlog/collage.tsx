/**
 * The collage editor.
 *
 * Full screen, on the day's photos, with the grid in the recorder's hands:
 * columns and rows, both steppers. A collage somebody is about to post has
 * a shape they want more than it has every photo they took — so rows can
 * cap it, and the screen says plainly how many are being left out rather
 * than dropping them quietly.
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
  COLLAGE_SIZE,
  collageColumns,
  collageHeight,
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
  ScrollView,
  StatusBar,
  Text,
  View,
} from "react-native";
import ViewShot, { captureRef } from "react-native-view-shot";

const INSET = 16;
const SCREEN_W = Dimensions.get("window").width;
const PREVIEW_W = SCREEN_W - INSET * 2;
const PREVIEW_SCALE = PREVIEW_W / COLLAGE_SIZE;

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
  const [columns, setColumns] = useState(3);
  const [rows, setRows] = useState(3);
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
        // Opens on the shape the day suggests, then it is the recorder's.
        const suggested = collageColumns(local.length);
        setColumns(suggested);
        setRows(Math.max(1, Math.ceil(local.length / suggested)));
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

  const capacity = columns * rows;
  const leftOut = Math.max(0, photos.length - capacity);
  const gridNote =
    leftOut > 0
      ? `${capacity} of ${photos.length} fit — the last ${leftOut} ${leftOut === 1 ? "photo is" : "photos are"} left out.`
      : null;

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
   * The dimensions come from the grid that was just laid out, so the composer
   * frames the collage at its real shape instead of assuming a portrait
   * picture and letterboxing a wide one.
   */
  const onPostToNamzoed = () =>
    run(
      async ({ uri }) => {
        setComposerMedia({
          uri,
          type: "image",
          width: COLLAGE_SIZE,
          height: collageHeight(photos.length, columns, rows),
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
                height: collageHeight(photos.length, columns, rows) * PREVIEW_SCALE,
                borderRadius: MODAL_RADIUS,
                borderCurve: "continuous",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  transform: [{ scale: PREVIEW_SCALE }],
                  transformOrigin: "top left",
                }}
              >
                <ViewShot ref={collageRef}>
                  <DayCollage
                    day={day}
                    photos={photos}
                    columns={columns}
                    rows={rows}
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
                key: "columns",
                label: "Columns",
                icon: <Grid3x3 size={17} color="#fff" strokeWidth={1.9} />,
                value: String(columns),
                selected: String(columns),
                options: [1, 2, 3, 4].map((n) => ({
                  value: String(n),
                  label: `${n} across`,
                })),
                onSelect: (v) => setColumns(Number(v)),
              },
              {
                kind: "submenu",
                key: "rows",
                label: "Rows",
                icon: <Grid3x3 size={17} color="#fff" strokeWidth={1.9} />,
                value: String(rows),
                selected: String(rows),
                options: [1, 2, 3, 4, 5, 6].map((n) => ({
                  value: String(n),
                  label: `${n} down`,
                })),
                onSelect: (v) => setRows(Number(v)),
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
