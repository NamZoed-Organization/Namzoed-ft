/**
 * Which way out of a day.
 *
 * Two buttons, and nothing else: the reel and the collage. Each goes
 * straight into its own editor — there is no preview here to look at and no
 * export to fire, because a day is not worth exporting until somebody has
 * decided what it should look like.
 *
 * What this replaced was two cards that exported on the spot, with the only
 * choice being which. That is the wrong order: the shape of the thing is
 * the interesting decision, and it was the one the screen did not offer.
 *
 * **It downloads before it navigates.** The editors show several clips at
 * once, and streaming those at the moment a screen opens gives you a grid
 * of black rectangles filling in one by one. So the button counts the day
 * down and the editor opens on something finished. The wait happens where
 * somebody has just chosen to wait, which is the only place a wait is
 * welcome.
 */

import { SETTINGS_BACKGROUND } from "@/components/settings/SettingsChrome";
import EdgeSwipeBack from "@/components/ui/EdgeSwipeBack";
import { MODAL_RADIUS } from "@/constants/theme";
import { getDayExport, type DayExport } from "@/lib/setlogExport";
import { prefetchClips } from "@/lib/setlogMediaCache";
import { formatDay, localDay } from "@/lib/setlogService";
import { useAppRouter } from "@/utils/navigation";
import { useLocalSearchParams } from "expo-router";
import { ChevronLeft, Film, LayoutGrid } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const INSET = 16;
const GAP = 12;
const TILE = Math.floor((Dimensions.get("window").width - INSET * 2 - GAP) / 2);

function Choice({
  icon,
  label,
  count,
  noun,
  onPress,
  progress,
  busy,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  noun: string;
  onPress: () => void;
  /** How many of `count` are on the device so far. */
  progress: number;
  busy: boolean;
  disabled: boolean;
}) {
  const empty = count === 0;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={empty || disabled}
      style={{
        width: TILE,
        height: TILE,
        borderRadius: MODAL_RADIUS,
        borderCurve: "continuous",
        backgroundColor: "#fff",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 12,
        opacity: empty || (disabled && !busy) ? 0.45 : 1,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          borderCurve: "continuous",
          backgroundColor: empty ? "#F5F5F5" : "#094569",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {busy ? <ActivityIndicator color="#fff" /> : icon}
      </View>
      <Text
        style={{
          fontSize: 15.5,
          fontWeight: "600",
          color: "#111",
          marginTop: 12,
        }}
      >
        {label}
      </Text>
      <Text
        style={{ fontSize: 14, color: "#9CA3AF", marginTop: 2, textAlign: "center" }}
      >
        {busy
          ? `Loading ${progress} of ${count}`
          : empty
            ? `No ${noun}s`
            : `${count} ${count === 1 ? noun : `${noun}s`}`}
      </Text>
    </TouchableOpacity>
  );
}

export default function SetlogExportScreen() {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { day: dayParam } = useLocalSearchParams<{ day?: string }>();
  const day = dayParam ? String(dayParam) : localDay();

  const [data, setData] = useState<DayExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "reel" | "collage">(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    getDayExport(day)
      .then(setData)
      .catch((e) => {
        console.error("Error loading day export:", e);
        setData({ day, videos: [], photos: [] });
      })
      .finally(() => setLoading(false));
  }, [day]);

  const videos = data?.videos ?? [];
  const photos = data?.photos ?? [];

  /**
   * Download the half being opened, then navigate.
   *
   * Only that half: opening the collage should not wait on the day's video,
   * and the editor re-checks anyway — the files are keyed by clip id, so a
   * second visit finds them already there and opens at once.
   */
  const open = async (kind: "reel" | "collage") => {
    if (busy) return;
    setBusy(kind);
    setProgress(0);
    try {
      await prefetchClips(kind === "reel" ? videos : photos, (done) =>
        setProgress(done),
      );
    } catch (e) {
      // A download that failed still leaves a signed URL to stream from, so
      // the editor is worth opening either way.
      console.error("Error preparing export media:", e);
    } finally {
      setBusy(null);
      router.push(`/(users)/setlog/${kind}?day=${day}`);
    }
  };

  return (
    <EdgeSwipeBack onSwipeBack={() => router.back()}>
      <View
        style={{ flex: 1, backgroundColor: SETTINGS_BACKGROUND, paddingTop: insets.top }}
      >
        <StatusBar barStyle="dark-content" />

        {/* § Header — chevron, centred title, a spacer opposite. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 12,
            paddingTop: 2,
            paddingBottom: 12,
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
            <ChevronLeft size={28} color="#374151" />
          </TouchableOpacity>
          <View
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
            pointerEvents="none"
          >
            <Text style={{ fontSize: 17, fontWeight: "600", color: "#111827" }}>
              {formatDay(day)}
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color="#0369A1" />
          </View>
        ) : (
          <>
            <View
              style={{
                flexDirection: "row",
                gap: GAP,
                paddingHorizontal: INSET,
              }}
            >
              <Choice
                icon={<Film size={26} color="#fff" strokeWidth={1.8} />}
                label="Reel"
                count={videos.length}
                noun="clip"
                progress={progress}
                busy={busy === "reel"}
                disabled={busy !== null}
                onPress={() => open("reel")}
              />
              <Choice
                icon={<LayoutGrid size={26} color="#fff" strokeWidth={1.8} />}
                label="Collage"
                count={photos.length}
                noun="photo"
                progress={progress}
                busy={busy === "collage"}
                disabled={busy !== null}
                onPress={() => open("collage")}
              />
            </View>

            <Text
              style={{
                fontSize: 14,
                lineHeight: 20,
                color: "#9CA3AF",
                textAlign: "center",
                paddingHorizontal: 32,
                paddingTop: 20,
              }}
            >
              Both open in an editor first, once the day is on your phone —
              so nothing is still arriving while you are deciding how it
              should look. The clock and the title stay on every frame
              exactly as they were recorded.
            </Text>
          </>
        )}
      </View>
    </EdgeSwipeBack>
  );
}
