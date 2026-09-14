/**
 * Storage.
 *
 * What was here was a placeholder — an icon and the sentence "Data and
 * storage management options will be available here" — while the app kept an
 * uncapped image cache. This is the screen that sentence promised.
 *
 * Modelled on RedNote's 存储空间 and Telegram's Storage Usage, which are the
 * two apps that do this properly. RedNote's whole control is one Clear
 * button; Telegram's is clear-by-type plus hard size caps. This takes the
 * type breakdown and the caps and leaves out Telegram's age-based auto-delete
 * on purpose — see the note in lib/storageManager.ts on why "oldest first" is
 * the wrong axis for an app with Setlog in it.
 *
 * **The bar exists so the number means something.** "1.4 GB" alone tells you
 * nothing you can act on; the same figure split four ways tells you which
 * button to press. It is one bar rather than a chart because there is one
 * quantity here and four parts of it.
 *
 * **Nothing on this screen can lose anything.** Posts, drafts, messages and
 * saved items live on the server, so every row clears without ceremony — the
 * one exception being Setlog clips, which are local originals and ask first.
 * A confirmation on a harmless action teaches people to dismiss
 * confirmations.
 *
 * Split into a view and a container (§ Judging a screen before the data
 * exists): the numbers come from four different libraries and a phone with
 * nothing cached shows an empty screen, so the preview in Dev Components
 * drives the same view from fixtures.
 *
 * **Data saver sits first**, above the storage it has nothing to do with,
 * because it is the one control on this screen that decides what people pay
 * for (lib/dataSaver.ts). Its description says what it is doing *now* — on
 * because this is mobile data, off because this is Wi-Fi — since a mode
 * called "On mobile data" otherwise leaves you guessing which one you're on.
 */

import {
  SettingsGroup,
  SettingsRow,
  SettingsScreen,
} from "@/components/settings/SettingsChrome";
import ChoiceSheet from "@/components/ui/ChoiceSheet";
import CircularLoader from "@/components/ui/CircularLoader";
import DialogCard from "@/components/ui/DialogCard";
import {
  DATA_SAVER_OPTIONS,
  setDataSaverMode,
  useDataSaver,
  type DataSaverMode,
  type DataSaverState,
} from "@/lib/dataSaver";
import {
  CACHE_LIMIT_OPTIONS,
  clearAllCaches,
  clearCategory,
  DEFAULT_PHOTO_LIMIT,
  DEFAULT_VIDEO_LIMIT,
  formatBytes,
  getStorageLimits,
  measureStorage,
  setPhotoCacheLimit,
  setVideoCacheLimit,
  type StorageCategory,
  type StorageKey,
  type StorageReport,
} from "@/lib/storageManager";
import { Film, Image as ImageIcon, Camera, Database } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

/**
 * One colour per category, and the only place in the app that colour-codes
 * anything (§ Icons rules it out for icons). A stacked bar is the exception
 * that proves it: four segments of the same grey is not a breakdown.
 */
const SEGMENT_COLOR: Record<StorageKey, string> = {
  photos: "#094569",
  videos: "#0369A1",
  setlog: "#38BDF8",
  appData: "#CBD5E1",
};

const ROW_ICON: Record<StorageKey, React.ComponentType<any>> = {
  photos: ImageIcon,
  videos: Film,
  setlog: Camera,
  appData: Database,
};

interface DataStorageProps {
  onClose?: () => void;
}

export default function DataStorage({ onClose }: DataStorageProps) {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [limits, setLimits] = useState({
    photos: DEFAULT_PHOTO_LIMIT,
    videos: DEFAULT_VIDEO_LIMIT,
  });
  const [busy, setBusy] = useState<StorageKey | "all" | null>(null);
  const dataSaver = useDataSaver();

  const refresh = useCallback(async () => {
    const [next, storedLimits] = await Promise.all([
      measureStorage(),
      getStorageLimits(),
    ]);
    setReport(next);
    setLimits(storedLimits);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleClear = useCallback(
    async (key: StorageKey | "all") => {
      setBusy(key);
      try {
        if (key === "all") await clearAllCaches();
        else await clearCategory(key);
      } finally {
        // Re-measured rather than zeroed: a cache the native side declined to
        // drop should show what it still holds, not what we hoped.
        await refresh();
        setBusy(null);
      }
    },
    [refresh],
  );

  const handleLimit = useCallback(
    async (key: "photos" | "videos", bytes: number) => {
      if (key === "photos") await setPhotoCacheLimit(bytes);
      else await setVideoCacheLimit(bytes);
      await refresh();
    },
    [refresh],
  );

  return (
    <DataStorageView
      report={report}
      limits={limits}
      busy={busy}
      dataSaver={dataSaver}
      onSetDataSaverMode={setDataSaverMode}
      onClear={handleClear}
      onSetLimit={handleLimit}
      onClose={onClose}
    />
  );
}

/** What data saver is doing on this connection, in one sentence. */
const dataSaverDescription = ({ mode, active }: DataSaverState): string => {
  if (active) {
    return mode === "on"
      ? "On. Pictures load smaller, videos wait for a tap, and less is loaded ahead of you."
      : "On now — you're on mobile data. Pictures load smaller, videos wait for a tap, and less is loaded ahead of you.";
  }
  return mode === "off"
    ? "Off. Pictures and videos load normally on every connection."
    : "Off now — you're on Wi-Fi. Turns on by itself on mobile data.";
};

export function DataStorageView({
  report,
  limits,
  busy,
  dataSaver,
  onSetDataSaverMode,
  onClear,
  onSetLimit,
  onClose,
}: {
  report: StorageReport | null;
  limits: { photos: number; videos: number };
  busy: StorageKey | "all" | null;
  dataSaver: DataSaverState;
  onSetDataSaverMode: (mode: DataSaverMode) => void;
  onClear: (key: StorageKey | "all") => void;
  onSetLimit: (key: "photos" | "videos", bytes: number) => void;
  onClose?: () => void;
}) {
  const [limitSheet, setLimitSheet] = useState<"photos" | "videos" | null>(null);
  const [dataSaverSheet, setDataSaverSheet] = useState(false);
  const [confirm, setConfirm] = useState<StorageKey | "all" | null>(null);

  const limitLabel = (bytes: number) =>
    CACHE_LIMIT_OPTIONS.find((o) => o.value === String(bytes))?.label ??
    formatBytes(bytes);

  // Shown whether or not the storage figures have been measured yet — it
  // doesn't depend on them, and it is the row most people come here for.
  const dataSaverControls = (
    <>
      <SettingsGroup label="Mobile data">
        <SettingsRow
          first
          label="Data saver"
          description={dataSaverDescription(dataSaver)}
          value={DATA_SAVER_OPTIONS.find((o) => o.value === dataSaver.mode)?.label}
          onPress={() => setDataSaverSheet(true)}
        />
      </SettingsGroup>
      <ChoiceSheet
        visible={dataSaverSheet}
        title="Data saver"
        options={DATA_SAVER_OPTIONS.map((o) => ({ ...o }))}
        selected={dataSaver.mode}
        onSelect={(value) => {
          onSetDataSaverMode(value as DataSaverMode);
          setDataSaverSheet(false);
        }}
        onClose={() => setDataSaverSheet(false)}
      />
    </>
  );

  if (!report) {
    return (
      <SettingsScreen title="Data and storage" onClose={onClose}>
        {dataSaverControls}
        <View style={{ paddingVertical: 48, alignItems: "center" }}>
          <CircularLoader size="small" color="#094569" />
        </View>
      </SettingsScreen>
    );
  }

  const { categories, total } = report;
  const confirmCategory = categories.find((c) => c.key === confirm);

  return (
    <SettingsScreen title="Data and storage" onClose={onClose}>
      {dataSaverControls}

      {/* The total, and what it is made of. */}
      <View
        style={{
          backgroundColor: "#fff",
          borderRadius: 18,
          borderCurve: "continuous",
          padding: 16,
          marginBottom: 14,
        }}
      >
        <Text style={{ fontSize: 30, fontWeight: "700", color: "#111" }}>
          {formatBytes(total)}
        </Text>
        <Text style={{ fontSize: 13.5, color: "#9CA3AF", marginTop: 2 }}>
          kept on this phone to make Namzoed quick
        </Text>

        <StackedBar categories={categories} total={total} />

        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            columnGap: 14,
            rowGap: 6,
            marginTop: 12,
          }}
        >
          {categories.map((c) => (
            <View
              key={c.key}
              style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  borderCurve: "continuous",
                  backgroundColor: SEGMENT_COLOR[c.key],
                }}
              />
              <Text style={{ fontSize: 12.5, color: "#6B7280" }}>{c.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <SettingsGroup label="What's stored">
        {categories.map((category, index) => (
          <SettingsRow
            key={category.key}
            first={index === 0}
            icon={ROW_ICON[category.key]}
            label={category.label}
            description={category.detail}
            right={
              <ClearButton
                bytes={category.bytes}
                busy={busy === category.key}
                onPress={() =>
                  // The local originals ask first; the caches don't, because a
                  // confirmation on something harmless is how people learn to
                  // tap through the ones that matter.
                  category.reDownloads
                    ? setConfirm(category.key)
                    : onClear(category.key)
                }
              />
            }
          />
        ))}
      </SettingsGroup>

      <SettingsGroup label="Limits">
        <SettingsRow
          first
          label="Photo cache"
          description="Older pictures are dropped first once this is reached."
          value={limitLabel(limits.photos)}
          onPress={() => setLimitSheet("photos")}
        />
        <SettingsRow
          label="Video cache"
          description="Same, for reels and clips."
          value={limitLabel(limits.videos)}
          onPress={() => setLimitSheet("videos")}
        />
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow
          first
          label={busy === "all" ? "Clearing…" : "Clear all caches"}
          description="Photos, videos and feed data. Your Setlog clips are left alone."
          destructive
          onPress={() => (busy ? undefined : onClear("all"))}
          right={<View />}
        />
      </SettingsGroup>

      <Text
        style={{
          fontSize: 12.5,
          lineHeight: 18,
          color: "#9CA3AF",
          paddingHorizontal: 14,
          paddingBottom: 8,
        }}
      >
        Nothing here can be lost. Your posts, messages, drafts and saved items
        live on your account — this is only what the app keeps close by so it
        doesn&apos;t have to ask for the same picture twice.
      </Text>

      <ChoiceSheet
        visible={limitSheet != null}
        title={limitSheet === "videos" ? "Video cache" : "Photo cache"}
        options={CACHE_LIMIT_OPTIONS.map((o) => ({ ...o }))}
        selected={String(limitSheet === "videos" ? limits.videos : limits.photos)}
        onSelect={(value) => {
          if (limitSheet) onSetLimit(limitSheet, Number(value));
          setLimitSheet(null);
        }}
        onClose={() => setLimitSheet(null)}
      />

      <DialogCard
        visible={confirm != null}
        title="Clear Setlog clips?"
        message={
          confirmCategory
            ? `${formatBytes(confirmCategory.bytes)} of your own recordings are kept here. They're safe on your account — but this phone will download them again the next time you look back at a day.`
            : undefined
        }
        onDismiss={() => setConfirm(null)}
        actions={[
          { label: "Keep them", style: "cancel", onPress: () => setConfirm(null) },
          {
            label: "Clear",
            style: "destructive",
            onPress: () => {
              const key = confirm;
              setConfirm(null);
              if (key) onClear(key);
            },
          },
        ]}
      />
    </SettingsScreen>
  );
}

/**
 * The breakdown, as one bar.
 *
 * Segments below a couple of percent are given a floor rather than being
 * dropped: the feed cache is 3MB against a gigabyte of pictures, and a
 * legend entry pointing at a segment nobody can see reads as a bug. An
 * empty store gets a flat grey track instead of an invisible bar.
 */
function StackedBar({
  categories,
  total,
}: {
  categories: StorageCategory[];
  total: number;
}) {
  const shown = categories.filter((c) => c.bytes > 0);
  return (
    <View
      style={{
        flexDirection: "row",
        height: 10,
        borderRadius: 5,
        borderCurve: "continuous",
        overflow: "hidden",
        backgroundColor: "#F0F1F3",
        marginTop: 14,
      }}
    >
      {total > 0 &&
        shown.map((c) => (
          <View
            key={c.key}
            style={{
              flexGrow: Math.max(c.bytes / total, 0.02),
              flexBasis: 0,
              backgroundColor: SEGMENT_COLOR[c.key],
            }}
          />
        ))}
    </View>
  );
}

/** The size is the label: a row that reads "842 MB" and clears when tapped
 *  says both things at once, where "842 MB" plus a separate "Clear" is two
 *  controls' worth of width for one action. */
function ClearButton({
  bytes,
  busy,
  onPress,
}: {
  bytes: number;
  busy: boolean;
  onPress: () => void;
}) {
  const empty = bytes <= 0;
  return (
    <TouchableOpacity
      onPress={empty || busy ? undefined : onPress}
      disabled={empty || busy}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{
        minWidth: 78,
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderCurve: "continuous",
        backgroundColor: empty ? "transparent" : "#F5F5F5",
        marginLeft: 8,
      }}
    >
      {busy ? (
        <CircularLoader size="small" color="#6B7280" />
      ) : (
        <Text
          style={{
            fontSize: 13.5,
            fontWeight: "600",
            color: empty ? "#C7C7CC" : "#0369A1",
          }}
        >
          {formatBytes(bytes)}
        </Text>
      )}
    </TouchableOpacity>
  );
}
