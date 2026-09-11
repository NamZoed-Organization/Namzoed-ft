import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Lightweight stale-while-revalidate cache for API/query responses.
 *
 * - In-memory map for instant synchronous reads within a session.
 * - AsyncStorage for persistence across app restarts.
 * - The `useCachedQuery` hook renders cached data immediately, then refreshes
 *   in the background and writes the fresh result back to the cache.
 *
 * Keep cached payloads JSON-serialisable (no `Date`, `Map`, etc.). Revive such
 * fields in the caller after reading.
 *
 * ## It is bounded, on purpose
 *
 * AsyncStorage on Android is one SQLite table with a default ceiling of
 * about 6MB, and raising it needs a native rebuild. A cache that only ever
 * grows therefore does not fail loudly when it runs out — it starts losing
 * writes, quietly, because every caller here treats storage as best-effort.
 *
 * So the budget is enforced here instead: every entry carries its own size,
 * an index tracks the total, and the least recently *written* entries are
 * dropped when it is exceeded. Staying under the ceiling is more robust
 * than moving it, and it needs no rebuild.
 *
 * Nothing here is the source of truth. Anything evicted is re-fetched.
 */

const PREFIX = "qcache:";
// Bump when the cached shape changes so old entries are ignored.
const VERSION = "v1";
const INDEX_KEY = `${PREFIX}${VERSION}:__index`;

/** Comfortably under Android's ~6MB AsyncStorage ceiling, with room for the
 *  small non-cache keys (session, drafts, prefs) that share it. */
const MAX_BYTES = 3 * 1024 * 1024;
/** Nothing cached is worth serving after a week; a stale week-old feed is
 *  worse than a spinner. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The most one entry may occupy on disk.
 *
 * A payload larger than this would evict most of the cache to make room for
 * itself, which is a cache serving one screen at every other screen's
 * expense. A pool that big should be capped where it is written instead —
 * see `CACHE_SEED_LIMIT`.
 */
const MAX_ENTRY_BYTES = 900 * 1024;

/**
 * How many items of a list are worth persisting.
 *
 * A cached pool exists to paint the first screenful instantly, not to
 * reproduce a whole ranking offline: the fetch that replaces it is already
 * in flight by the time anyone has scrolled. Four pages is generous.
 */
export const CACHE_SEED_LIMIT = 60;

interface CacheEntry<T> {
  data: T;
  ts: number;
}

/** What the index holds per key: when it was written and how big it was. */
interface IndexEntry {
  ts: number;
  size: number;
}

const memory = new Map<string, CacheEntry<any>>();
/** Loaded once per session, then kept in step with every write. */
let index: Record<string, IndexEntry> | null = null;

const storageKey = (key: string) => `${PREFIX}${VERSION}:${key}`;

const loadIndex = async (): Promise<Record<string, IndexEntry>> => {
  if (index) return index;
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    index = raw ? (JSON.parse(raw) as Record<string, IndexEntry>) : {};
  } catch {
    index = {};
  }
  return index;
};

const persistIndex = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index ?? {}));
  } catch {
    // Best-effort: a lost index costs accuracy, not correctness — the next
    // prune simply has less to go on.
  }
};

/**
 * Drop the oldest entries until the budget is met.
 *
 * Oldest *written*, not oldest read: a read costs nothing to serve, and
 * tracking reads would mean a storage write on every cache hit, which is
 * the opposite of what a cache is for.
 */
const evictTo = async (budget: number): Promise<void> => {
  const idx = await loadIndex();
  let total = Object.values(idx).reduce((sum, e) => sum + e.size, 0);
  if (total <= budget) return;

  const byAge = Object.entries(idx).sort((a, b) => a[1].ts - b[1].ts);
  const doomed: string[] = [];
  for (const [key, entry] of byAge) {
    if (total <= budget) break;
    doomed.push(key);
    total -= entry.size;
  }
  if (doomed.length === 0) return;

  for (const key of doomed) {
    delete idx[key];
    memory.delete(key);
  }
  try {
    await AsyncStorage.multiRemove(doomed.map(storageKey));
  } catch {
    // ignore
  }
  await persistIndex();
};

/**
 * Housekeeping, run once at startup (see `app/_layout.tsx`).
 *
 * Age first, then size — an entry too old to serve should go whether or not
 * the cache is near its budget.
 */
export async function pruneQueryCache(): Promise<void> {
  const idx = await loadIndex();
  const cutoff = Date.now() - MAX_AGE_MS;
  const stale = Object.keys(idx).filter((k) => idx[k].ts < cutoff);

  if (stale.length > 0) {
    for (const key of stale) {
      delete idx[key];
      memory.delete(key);
    }
    try {
      await AsyncStorage.multiRemove(stale.map(storageKey));
    } catch {
      // ignore
    }
    await persistIndex();
  }

  await evictTo(MAX_BYTES);
}

/** What the cache is currently holding — for the dev screen, and for
 *  anyone wondering whether it is the reason storage is full. */
export async function queryCacheStats(): Promise<{
  entries: number;
  bytes: number;
}> {
  const idx = await loadIndex();
  const values = Object.values(idx);
  return {
    entries: values.length,
    bytes: values.reduce((sum, e) => sum + e.size, 0),
  };
}

/** Synchronous peek at the in-memory cache (null if not loaded this session). */
export function peekCache<T>(key: string): CacheEntry<T> | null {
  return memory.get(key) ?? null;
}

/** Read from memory, falling back to AsyncStorage (and warming memory). */
export async function readCache<T>(key: string): Promise<CacheEntry<T> | null> {
  const mem = memory.get(key);
  if (mem) return mem as CacheEntry<T>;
  try {
    const raw = await AsyncStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

/** Persist a value to memory + AsyncStorage, keeping the cache in budget. */
export async function writeCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { data, ts: Date.now() };
  memory.set(key, entry);

  const payload = JSON.stringify(entry);
  const size = payload.length;
  const idx = await loadIndex();

  // Oversized entries are kept in memory for the session but not persisted:
  // the caller still gets its cache hit, just not one that survives a
  // restart. Cap the list at the call site (`CACHE_SEED_LIMIT`) rather than
  // letting it land here.
  if (size > MAX_ENTRY_BYTES) {
    if (__DEV__) {
      console.warn(
        `[queryCache] "${key}" is ${Math.round(size / 1024)}KB — too big to persist. Cap it with CACHE_SEED_LIMIT.`,
      );
    }
    if (idx[key]) {
      delete idx[key];
      await AsyncStorage.removeItem(storageKey(key)).catch(() => {});
      await persistIndex();
    }
    return;
  }

  idx[key] = { ts: entry.ts, size };
  try {
    await AsyncStorage.setItem(storageKey(key), payload);
    await persistIndex();
  } catch {
    // Almost always the storage ceiling. Make room and try once more; if it
    // fails again the memory copy still serves this session.
    delete idx[key];
    await evictTo(MAX_BYTES / 2);
    try {
      await AsyncStorage.setItem(storageKey(key), payload);
      (await loadIndex())[key] = { ts: entry.ts, size };
      await persistIndex();
    } catch {
      // Best-effort cache; give up rather than interrupt anyone.
    }
    return;
  }

  await evictTo(MAX_BYTES);
}

/** Drop a single cached key (e.g. after a mutation invalidates it). */
export async function invalidateCache(key: string): Promise<void> {
  memory.delete(key);
  const idx = await loadIndex();
  if (idx[key]) {
    delete idx[key];
    await persistIndex();
  }
  try {
    await AsyncStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}

/** Drop every cached key under a prefix — one screen's worth, rather than
 *  the whole cache. `invalidateCachePrefix("setlog:feed:")` after a delete,
 *  for instance. */
export async function invalidateCachePrefix(prefix: string): Promise<void> {
  const idx = await loadIndex();
  const hit = Object.keys(idx).filter((k) => k.startsWith(prefix));
  for (const key of [...hit, ...memory.keys()].filter((k) =>
    k.startsWith(prefix),
  )) {
    memory.delete(key);
    delete idx[key];
  }
  if (hit.length > 0) {
    try {
      await AsyncStorage.multiRemove(hit.map(storageKey));
    } catch {
      // ignore
    }
    await persistIndex();
  }
}

/** Clear every query-cache entry (e.g. on logout). */
export async function clearQueryCache(): Promise<void> {
  memory.clear();
  index = {};
  try {
    const keys = await AsyncStorage.getAllKeys();
    // The index carries the same prefix, so it goes with everything else.
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // ignore
  }
}

export interface UseCachedQueryOptions {
  /** If cached data is younger than this (ms), skip the background refetch. */
  staleTime?: number;
  /** Set false to pause the query (e.g. while a param is missing). */
  enabled?: boolean;
}

export interface CachedQueryResult<T> {
  data: T | null;
  /** True only on the very first load with no cache available. */
  loading: boolean;
  /** True while revalidating in the background over existing data. */
  refreshing: boolean;
  error: unknown;
  refetch: () => Promise<void>;
  /** Optimistically replace cached data (also persists it). */
  mutate: (data: T) => void;
}

/**
 * Stale-while-revalidate query hook. Renders cached data instantly (if any),
 * then refreshes from `fetcher` and updates the cache.
 */
export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: UseCachedQueryOptions = {},
): CachedQueryResult<T> {
  const { staleTime = 0, enabled = true } = options;

  const [data, setData] = useState<T | null>(
    () => (key ? peekCache<T>(key)?.data ?? null : null),
  );
  const [loading, setLoading] = useState<boolean>(() => !(key && peekCache<T>(key)));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(
    async (force: boolean) => {
      if (!key || !enabled) return;

      const cached = await readCache<T>(key);
      if (cached) {
        setData(cached.data);
        setLoading(false);
        const isFresh = Date.now() - cached.ts < staleTime;
        if (isFresh && !force) return;
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const result = await fetcherRef.current();
        setData(result);
        setError(null);
        await writeCache(key, result);
      } catch (e) {
        setError(e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [key, enabled, staleTime],
  );

  useEffect(() => {
    run(false);
  }, [run]);

  const refetch = useCallback(() => run(true), [run]);

  const mutate = useCallback(
    (next: T) => {
      setData(next);
      if (key) writeCache(key, next);
    },
    [key],
  );

  return { data, loading, refreshing, error, refetch, mutate };
}
