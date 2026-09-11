/**
 * What Namzoed is keeping on this phone, and how to get it back.
 *
 * Every fast-feed technique this app uses buys its speed with disk: images
 * cached at several resolutions, video chunks kept so a swipe back doesn't
 * re-download, a week of feed JSON so the grid paints before the network
 * answers, and the Setlog clips this device recorded itself. None of that is
 * waste — it is the reason the app is quick — but it accumulates, and an app
 * that accumulates silently and offers no way to look is the "Documents &
 * Data" black hole people reinstall to escape.
 *
 * So this module is the one place that knows the whole inventory. Four
 * stores, each measured from the thing that actually holds it rather than
 * estimated, and each clearable on its own:
 *
 *  - **Photos** — expo-image's disk cache (SDWebImage on iOS, Glide on
 *    Android). It had *no size limit at all*, which is the default and is
 *    wrong for an app that is mostly pictures: it grows until iOS decides
 *    the phone is full, and iOS only trims caches under real pressure.
 *    `applyStorageLimits` is what fixes that.
 *  - **Videos** — expo-video's cache, already capped, exact size available.
 *  - **Setlog clips** — the one store that is *not* a cache. Your own
 *    recordings are copied here as they are made so they are never
 *    downloaded back (lib/setlogMediaCache.ts), so clearing it costs real
 *    re-downloads. It is listed apart for that reason.
 *  - **Feed & search data** — the stale-while-revalidate query cache, ~3MB
 *    by design (lib/queryCache.ts).
 *
 * ## Why size caps and not "delete after a week"
 *
 * Telegram's storage manager is the reference, and it offers both. This app
 * takes only the caps, deliberately. Age is the wrong axis here: Setlog
 * exists to look *back*, so "oldest first" is precisely the wrong thing to
 * throw away, and the feed cache already expires at a week on its own. A
 * budget with least-recently-used eviction keeps what you actually return to
 * and drops what you don't, which is the honest version of the same promise.
 *
 * ## The measurement is honest about what it can't separate
 *
 * Both libraries put their caches inside the OS cache directory (verified:
 * expo-video uses `cachesDirectory/ExpoVideoCache` on iOS and
 * `context.cacheDir/ExpoVideoCache` on Android). So the photo figure is the
 * whole cache directory minus the video cache's own exact size, which also
 * sweeps up small temporary files — a few hundred KB that belong in "clear
 * this" anyway. Vendor directory names are deliberately not hardcoded; they
 * change between library versions and a number that silently reads zero is
 * worse than one that is approximately right.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import {
  clearVideoCacheAsync,
  getCurrentVideoCacheSize,
  setVideoCacheSizeAsync,
} from "expo-video";
import { clearQueryCache, queryCacheStats } from "./queryCache";
import { clearMediaCache, mediaCacheStats } from "./setlogMediaCache";

export type StorageKey = "photos" | "videos" | "setlog" | "appData";

export interface StorageCategory {
  key: StorageKey;
  label: string;
  /** What it is and what clearing it costs — the second half matters more. */
  detail: string;
  bytes: number;
  /** Setlog is not a cache; clearing it re-downloads your own recordings. */
  reDownloads: boolean;
}

export interface StorageReport {
  categories: StorageCategory[];
  total: number;
}

// ─── Limits ─────────────────────────────────────────────────────────────

const PHOTO_LIMIT_KEY = "storage:photoCacheBytes";
const VIDEO_LIMIT_KEY = "storage:videoCacheBytes";

const MB = 1024 * 1024;
const GB = 1024 * MB;

/**
 * The offered caps.
 *
 * 256MB is the floor rather than something smaller because below it the
 * cache stops doing its job — a grid of thumbnails alone is tens of
 * megabytes, and a cache that evicts what you scrolled past a minute ago
 * makes the app slower than having none. "No limit" is offered last and is
 * the old behaviour, named so somebody choosing it knows what they chose.
 */
export const CACHE_LIMIT_OPTIONS = [
  { value: String(256 * MB), label: "256 MB" },
  { value: String(512 * MB), label: "512 MB" },
  { value: String(1 * GB), label: "1 GB" },
  { value: String(2 * GB), label: "2 GB" },
  { value: "0", label: "No limit" },
] as const;

export const DEFAULT_PHOTO_LIMIT = 512 * MB;
export const DEFAULT_VIDEO_LIMIT = 512 * MB;

const readLimit = async (key: string, fallback: number): Promise<number> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  } catch {
    return fallback;
  }
};

export const getStorageLimits = async (): Promise<{
  photos: number;
  videos: number;
}> => ({
  photos: await readLimit(PHOTO_LIMIT_KEY, DEFAULT_PHOTO_LIMIT),
  videos: await readLimit(VIDEO_LIMIT_KEY, DEFAULT_VIDEO_LIMIT),
});

/**
 * Push the stored caps into the two libraries that enforce them.
 *
 * Called at startup and again whenever one is changed. `configureCache` is
 * not persistent across launches — it configures the native cache for this
 * process — which is exactly why the value lives in AsyncStorage and is
 * re-applied every time rather than being set once and forgotten.
 * `setVideoCacheSizeAsync` *is* persistent, but is re-applied for the same
 * reason: one code path, no drift between what the screen says and what the
 * native side is doing.
 */
export const applyStorageLimits = async (): Promise<void> => {
  const { photos, videos } = await getStorageLimits();
  try {
    Image.configureCache({ maxDiskSize: photos });
  } catch {
    // A cap that could not be applied is not worth failing a launch over.
  }
  try {
    await setVideoCacheSizeAsync(videos);
  } catch {
    // As above.
  }
};

export const setPhotoCacheLimit = async (bytes: number): Promise<void> => {
  await AsyncStorage.setItem(PHOTO_LIMIT_KEY, String(bytes));
  await applyStorageLimits();
};

export const setVideoCacheLimit = async (bytes: number): Promise<void> => {
  await AsyncStorage.setItem(VIDEO_LIMIT_KEY, String(bytes));
  await applyStorageLimits();
};

// ─── Measuring ──────────────────────────────────────────────────────────

/** Recursive, because both image libraries shard their caches into
 *  subdirectories — a flat listing reads as an almost-empty cache. */
const directoryBytes = (dir: Directory): number => {
  let bytes = 0;
  try {
    if (!dir.exists) return 0;
    for (const entry of dir.list()) {
      if (entry instanceof File) bytes += entry.size ?? 0;
      else if (entry instanceof Directory) bytes += directoryBytes(entry);
    }
  } catch {
    // An unreadable subtree contributes nothing rather than failing the
    // whole report — a storage screen that shows an error is useless.
  }
  return bytes;
};

const videoBytes = (): number => {
  try {
    return getCurrentVideoCacheSize() ?? 0;
  } catch {
    return 0;
  }
};

/** Everything, measured now. Cheap enough to run on open and after a
 *  clear, expensive enough not to run on every render. */
export const measureStorage = async (): Promise<StorageReport> => {
  const video = videoBytes();
  const cacheDir = directoryBytes(new Directory(Paths.cache));
  const setlog = mediaCacheStats();
  let appData = 0;
  try {
    appData = (await queryCacheStats()).bytes;
  } catch {
    appData = 0;
  }

  const categories: StorageCategory[] = [
    {
      key: "photos",
      label: "Photos",
      detail: "Pictures from the feed, grids and profiles. They come back as you scroll.",
      // Floored at zero: the two numbers come from different sources and a
      // negative figure on screen would be worse than a slightly low one.
      bytes: Math.max(0, cacheDir - video),
      reDownloads: false,
    },
    {
      key: "videos",
      label: "Videos",
      detail: "Reels and clips kept so scrolling back doesn't download them twice.",
      bytes: video,
      reDownloads: false,
    },
    {
      key: "setlog",
      label: "Setlog clips",
      detail:
        "Your own recordings, kept here so this phone never downloads back what it filmed. Clearing this re-downloads them.",
      bytes: setlog.bytes,
      reDownloads: true,
    },
    {
      key: "appData",
      label: "Feed & search data",
      detail: "The last feed, so the grid paints before the network answers.",
      bytes: appData,
      reDownloads: false,
    },
  ];

  return {
    categories,
    total: categories.reduce((sum, c) => sum + c.bytes, 0),
  };
};

// ─── Clearing ───────────────────────────────────────────────────────────

/**
 * Nothing here can lose anything that isn't on the server.
 *
 * Which is the whole reason this screen can exist without a frightening
 * confirmation on every row: posts, drafts, messages, saved items and the
 * session all live elsewhere. Setlog clips are the one case worth asking
 * about, and they are re-downloadable too — just not for free.
 */
export const clearCategory = async (key: StorageKey): Promise<void> => {
  switch (key) {
    case "photos":
      await Image.clearDiskCache();
      await Image.clearMemoryCache();
      return;
    case "videos":
      await clearVideoCacheAsync();
      return;
    case "setlog":
      clearMediaCache();
      return;
    case "appData":
      await clearQueryCache();
      return;
  }
};

/** Every cache, but not the Setlog clips — "clear everything" should not
 *  quietly throw away the one store that is a local original. */
export const clearAllCaches = async (): Promise<void> => {
  await clearCategory("photos");
  await clearCategory("videos");
  await clearCategory("appData");
};

// ─── Formatting ─────────────────────────────────────────────────────────

/**
 * One decimal past a megabyte, none below it.
 *
 * "0.4 MB" is noise where "412 KB" is a number; "1.4 GB" is a number where
 * "1433 MB" is noise. Zero says "None" rather than "0 B", because a row
 * reading 0 B looks like a measurement that failed.
 */
export const formatBytes = (bytes: number): string => {
  if (bytes <= 0) return "None";
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
};
