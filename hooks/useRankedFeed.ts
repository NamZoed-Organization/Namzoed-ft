import { useCallback, useEffect, useRef, useState } from "react";
import { buildSessionOrder, RankableItem } from "@/lib/feedRanking";

export interface UseRankedFeedOptions<T extends RankableItem> {
  /** Fetches the full eligible candidate pool for one session. Called once
   * on mount and again on refresh — pagination afterward is a pure slice of
   * the cached session order, not a re-fetch. */
  fetchPool: () => Promise<T[]>;
  /** Batched impression RPC (e.g. increment_impressions_posts) — called once
   * per page of ids actually served, not per item. */
  trackImpressions: (ids: string[]) => Promise<void>;
  pageSize?: number;
  /** Boost slots only apply on the first page of a session — see algorithm doc. */
  boostSlotCount?: number;
  /** Session regenerates (new pool fetch + new random draw) when these change. */
  deps?: unknown[];
  /** Optional fast local-cache read, tried before fetchPool resolves so the
   * first frame isn't blank/spinning. A non-empty result is ranked and
   * painted immediately (no loading spinner), then silently replaced once
   * the real fetchPool() resolves in the background. */
  seedFromCache?: () => Promise<T[] | null | undefined>;
}

export interface UseRankedFeedResult<T> {
  items: T[];
  loading: boolean;
  /** True for the brief window between a scroll-triggered loadMore() and the
   * next page actually being revealed — see loadMore below. */
  loadingMore: boolean;
  refreshing: boolean;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => Promise<void>;
}

// Pagination here is just revealing more of an already-fetched pool (see
// fetchPool's own doc comment above) — genuinely instant, with nothing to
// wait on. Without an artificial beat, loadingMore would flip true and false
// within the same tick and the loading indicator would never actually be
// visible on screen. This delay exists purely so scrolling into the next
// page reads as "loading" instead of content just silently appearing.
const LOAD_MORE_DELAY_MS = 400;

/**
 * Generic per-screen wiring for lib/feedRanking.ts: fetch the candidate
 * pool once per session, compute the weighted/boosted order, cache it, and
 * expose it page by page — reused across posts/products/marketplace/
 * services so each content type only has to supply fetchPool + trackImpressions.
 */
export function useRankedFeed<T extends RankableItem>({
  fetchPool,
  trackImpressions,
  pageSize = 10,
  boostSlotCount = 2,
  deps = [],
  seedFromCache,
}: UseRankedFeedOptions<T>): UseRankedFeedResult<T> {
  const [orderedItems, setOrderedItems] = useState<T[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const loadingMoreRef = useRef(false);

  const fetchPoolRef = useRef(fetchPool);
  fetchPoolRef.current = fetchPool;
  const trackImpressionsRef = useRef(trackImpressions);
  trackImpressionsRef.current = trackImpressions;
  const seedFromCacheRef = useRef(seedFromCache);
  seedFromCacheRef.current = seedFromCache;

  const applyPool = useCallback(
    (pool: T[]) => {
      const ordered = buildSessionOrder(pool, { boostSlotCount });
      setOrderedItems(ordered);
      const firstPageSize = Math.min(pageSize, ordered.length);
      setVisibleCount(firstPageSize);
      const firstIds = ordered.slice(0, firstPageSize).map((item) => item.id);
      if (firstIds.length) trackImpressionsRef.current(firstIds).catch(() => {});
    },
    [pageSize, boostSlotCount],
  );

  const startSession = useCallback(
    async (isRefresh: boolean, skipLoadingFlag = false) => {
      if (isRefresh) setRefreshing(true);
      else if (!skipLoadingFlag) setLoading(true);
      try {
        const pool = await fetchPoolRef.current();
        applyPool(pool);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyPool],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let seeded = false;
      if (seedFromCacheRef.current) {
        const cached = await seedFromCacheRef.current().catch(() => null);
        if (!cancelled && cached && cached.length) {
          applyPool(cached);
          setLoading(false);
          seeded = true;
        }
      }
      if (!cancelled) startSession(false, seeded);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || visibleCount >= orderedItems.length) return;
    const next = Math.min(visibleCount + pageSize, orderedItems.length);
    const newIds = orderedItems.slice(visibleCount, next).map((item) => item.id);

    loadingMoreRef.current = true;
    setLoadingMore(true);
    setTimeout(() => {
      setVisibleCount(next);
      if (newIds.length) trackImpressionsRef.current(newIds).catch(() => {});
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }, LOAD_MORE_DELAY_MS);
  }, [orderedItems, pageSize, visibleCount]);

  const refresh = useCallback(() => startSession(true), [startSession]);

  return {
    items: orderedItems.slice(0, visibleCount),
    loading,
    loadingMore,
    refreshing,
    hasMore: visibleCount < orderedItems.length,
    loadMore,
    refresh,
  };
}
