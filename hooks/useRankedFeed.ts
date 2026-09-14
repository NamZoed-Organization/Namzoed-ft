import { type FeedOrder, feedSeed } from "@/lib/feedSession";
import { CACHE_SEED_LIMIT, readCache, writeCache } from "@/lib/queryCache";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface FeedRow {
  id: string;
  created_at: string;
}

export interface UseRankedFeedOptions<T extends FeedRow> {
  /** One per screen + filter ("posts", "products:food:none") — keys the
   *  stored order and the stored first rows. */
  sessionKey: string;
  userId?: string | null;
  /** Hold off until the person is known, so a signed-in cold start doesn't
   *  draw a guest order first and then a second one. */
  enabled?: boolean;
  /** The day's order — `fetchFeedOrder` (lib/feedSession.ts) with this
   *  screen's function and filters. */
  fetchOrder: (seed: string) => Promise<FeedOrder>;
  /** Rows for a page of ids, in any order. */
  fetchByIds: (ids: string[]) => Promise<T[]>;
  /** Rows created after `asOf` — what pull-to-refresh adds on top. Without
   *  it a refresh only rolls the feed over to a new day. */
  fetchNewSince?: (asOf: string) => Promise<T[]>;
  /** Batched impression RPC (e.g. increment_impressions_posts) — once per
   *  page of ids actually revealed, not per item. */
  trackImpressions: (ids: string[]) => Promise<void>;
  pageSize?: number;
}

export interface UseRankedFeedResult<T> {
  items: T[];
  /** True only until the first page is on screen. */
  loading: boolean;
  loadingMore: boolean;
  refreshing: boolean;
  hasMore: boolean;
  loadMore: () => void;
  /** Adds what was posted since the order was drawn, keeping everything
   *  already loaded where it is. On a new day, draws the new day's order. */
  refresh: () => Promise<void>;
  /** A brand-new order on demand (a "Shuffle" button). Costs a new order and
   *  a new first page, so nothing calls it implicitly. */
  reshuffle: () => Promise<void>;
}

/** Ids per by-id request — keeps each URL comfortably under gateway limits. */
const HYDRATE_CHUNK = 60;
/** Stored first-page rows younger than this are shown without re-fetching
 *  them; older ones are painted, then quietly refreshed (counts change). */
const ROWS_FRESH_MS = 10 * 60 * 1000;

const orderCacheKey = (key: string) => `feed:v2:order:${key}`;
const rowsCacheKey = (key: string) => `feed:v2:rows:${key}`;

/**
 * A ranked grid that holds its order for the day and spends data only on
 * what is scrolled to.
 *
 * - The order (ids only) is drawn once per person per Bhutan day and stored,
 *   so reopening the app shows the same first screen — already in the image
 *   cache — instead of a fresh shuffle.
 * - Rows are fetched a page of ids at a time as the grid is scrolled.
 * - Pull-to-refresh adds posts newer than the order on top and moves nothing
 *   else. A new day draws a new order; a reshuffle is only ever explicit.
 */
export function useRankedFeed<T extends FeedRow>({
  sessionKey,
  userId,
  enabled = true,
  fetchOrder,
  fetchByIds,
  fetchNewSince,
  trackImpressions,
  pageSize = 20,
}: UseRankedFeedOptions<T>): UseRankedFeedResult<T> {
  const [order, setOrder] = useState<FeedOrder | null>(null);
  const [rows, setRows] = useState<ReadonlyMap<string, T>>(() => new Map());
  const [visibleCount, setVisibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const orderRef = useRef<FeedOrder | null>(null);
  const rowsRef = useRef<Map<string, T>>(new Map());
  const visibleRef = useRef(0);
  const loadingMoreRef = useRef(false);
  // Bumped whenever a new order starts; async work from an older one checks
  // it and drops its result instead of writing into the new feed.
  const generationRef = useRef(0);
  const saltRef = useRef<string | undefined>(undefined);

  const callbacksRef = useRef({ fetchOrder, fetchByIds, fetchNewSince, trackImpressions });
  callbacksRef.current = { fetchOrder, fetchByIds, fetchNewSince, trackImpressions };

  const mergeRows = useCallback((fetched: T[]) => {
    if (fetched.length === 0) return;
    const next = new Map(rowsRef.current);
    for (const row of fetched) next.set(row.id, row);
    rowsRef.current = next;
    setRows(next);
  }, []);

  const commitVisible = useCallback((count: number) => {
    visibleRef.current = count;
    setVisibleCount(count);
  }, []);

  const commitOrder = useCallback(
    (next: FeedOrder) => {
      orderRef.current = next;
      setOrder(next);
      writeCache(orderCacheKey(sessionKey), next);
    },
    [sessionKey],
  );

  /** Fetch the rows for these ids that aren't held yet — or all of them. */
  const hydrate = useCallback(
    async (ids: string[], force = false) => {
      const wanted = force ? ids : ids.filter((id) => !rowsRef.current.has(id));
      if (wanted.length === 0) return;
      const chunks: string[][] = [];
      for (let i = 0; i < wanted.length; i += HYDRATE_CHUNK) {
        chunks.push(wanted.slice(i, i + HYDRATE_CHUNK));
      }
      const fetched = await Promise.all(chunks.map((c) => callbacksRef.current.fetchByIds(c)));
      mergeRows(fetched.flat());
    },
    [mergeRows],
  );

  /** The head of the feed, so the next open paints before the network answers. */
  const persistHead = useCallback(() => {
    const current = orderRef.current;
    if (!current) return;
    const head: T[] = [];
    for (const id of current.ids.slice(0, CACHE_SEED_LIMIT)) {
      const row = rowsRef.current.get(id);
      if (row) head.push(row);
    }
    writeCache(rowsCacheKey(sessionKey), head);
  }, [sessionKey]);

  const track = useCallback((ids: string[]) => {
    if (ids.length) callbacksRef.current.trackImpressions(ids).catch(() => {});
  }, []);

  /** Draw (or, on mount, restore) the order and put its first page up. */
  const startSession = useCallback(
    async (restore: boolean) => {
      const generation = ++generationRef.current;
      const seed = feedSeed(userId, saltRef.current);
      try {
        if (restore) {
          const [storedOrder, storedRows] = await Promise.all([
            readCache<FeedOrder>(orderCacheKey(sessionKey)),
            readCache<T[]>(rowsCacheKey(sessionKey)),
          ]);
          if (generation !== generationRef.current) return;
          if (storedRows?.data?.length) mergeRows(storedRows.data);

          if (storedOrder?.data?.seed === seed) {
            const restored = storedOrder.data;
            const first = restored.ids.slice(0, pageSize);
            orderRef.current = restored;
            setOrder(restored);
            commitVisible(first.length);
            const covered = first.every((id) => rowsRef.current.has(id));
            if (covered) setLoading(false);
            if (!covered || Date.now() - (storedRows?.ts ?? 0) > ROWS_FRESH_MS) {
              await hydrate(first, true);
              if (generation !== generationRef.current) return;
              persistHead();
            }
            track(first);
            return;
          }
        }

        const next = await callbacksRef.current.fetchOrder(seed);
        if (generation !== generationRef.current) return;
        const first = next.ids.slice(0, pageSize);
        await hydrate(first, true);
        if (generation !== generationRef.current) return;
        commitOrder(next);
        commitVisible(first.length);
        persistHead();
        track(first);
      } catch (e) {
        // Whatever was painted from storage stays up; a refresh retries.
        console.error(`[useRankedFeed] ${sessionKey} failed:`, e);
      } finally {
        if (generation === generationRef.current) setLoading(false);
      }
    },
    [userId, sessionKey, pageSize, mergeRows, commitVisible, commitOrder, hydrate, persistHead, track],
  );

  useEffect(() => {
    if (!enabled) return;
    // A different screen, filter or person: start clean rather than flash
    // the previous list under the new one.
    saltRef.current = undefined;
    orderRef.current = null;
    setOrder(null);
    commitVisible(0);
    setLoading(true);
    startSession(true);
  }, [enabled, startSession, commitVisible]);

  const loadMore = useCallback(() => {
    const current = orderRef.current;
    if (!current || loadingMoreRef.current || visibleRef.current >= current.ids.length) return;
    const generation = generationRef.current;
    const from = visibleRef.current;
    const to = Math.min(from + pageSize, current.ids.length);
    const ids = current.ids.slice(from, to);

    loadingMoreRef.current = true;
    setLoadingMore(true);
    hydrate(ids)
      .then(() => {
        if (generation !== generationRef.current) return;
        commitVisible(to);
        track(ids);
        if (from < CACHE_SEED_LIMIT) persistHead();
      })
      .catch((e) => console.error(`[useRankedFeed] ${sessionKey} loadMore failed:`, e))
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [pageSize, sessionKey, hydrate, commitVisible, track, persistHead]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const current = orderRef.current;
      if (!current || current.seed !== feedSeed(userId, saltRef.current)) {
        await startSession(false);
        return;
      }
      const fetchNew = callbacksRef.current.fetchNewSince;
      if (!fetchNew) return;

      const generation = generationRef.current;
      const fresh = await fetchNew(current.asOf);
      if (generation !== generationRef.current) return;

      const known = new Set(current.ids);
      const added = fresh
        .filter((row) => !known.has(row.id))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (added.length === 0) return;

      mergeRows(added);
      // The newest row's own timestamp string, not a re-serialised Date, so
      // the next "since" keeps the server's full precision.
      const asOf = added.reduce(
        (latest, row) =>
          new Date(row.created_at).getTime() > new Date(latest).getTime() ? row.created_at : latest,
        current.asOf,
      );
      commitOrder({ ...current, ids: [...added.map((row) => row.id), ...current.ids], asOf });
      commitVisible(visibleRef.current + added.length);
      persistHead();
      track(added.map((row) => row.id));
    } catch (e) {
      console.error(`[useRankedFeed] ${sessionKey} refresh failed:`, e);
    } finally {
      setRefreshing(false);
    }
  }, [userId, sessionKey, startSession, mergeRows, commitOrder, commitVisible, persistHead, track]);

  const reshuffle = useCallback(async () => {
    saltRef.current = `shuffle-${Date.now()}`;
    setRefreshing(true);
    try {
      await startSession(false);
    } finally {
      setRefreshing(false);
    }
  }, [startSession]);

  const items = useMemo(() => {
    if (!order) return [];
    const out: T[] = [];
    for (const id of order.ids.slice(0, visibleCount)) {
      const row = rows.get(id);
      if (row) out.push(row);
    }
    return out;
  }, [order, rows, visibleCount]);

  return {
    items,
    loading,
    loadingMore,
    refreshing,
    hasMore: !!order && visibleCount < order.ids.length,
    loadMore,
    refresh,
    reshuffle,
  };
}
