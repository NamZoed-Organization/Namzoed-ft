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
 */

const PREFIX = "qcache:";
// Bump when the cached shape changes so old entries are ignored.
const VERSION = "v1";

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const memory = new Map<string, CacheEntry<any>>();

const storageKey = (key: string) => `${PREFIX}${VERSION}:${key}`;

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

/** Persist a value to memory + AsyncStorage. */
export async function writeCache<T>(key: string, data: T): Promise<void> {
  const entry: CacheEntry<T> = { data, ts: Date.now() };
  memory.set(key, entry);
  try {
    await AsyncStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // Best-effort cache; ignore storage failures.
  }
}

/** Drop a single cached key (e.g. after a mutation invalidates it). */
export async function invalidateCache(key: string): Promise<void> {
  memory.delete(key);
  try {
    await AsyncStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}

/** Clear every query-cache entry (e.g. on logout). */
export async function clearQueryCache(): Promise<void> {
  memory.clear();
  try {
    const keys = await AsyncStorage.getAllKeys();
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
