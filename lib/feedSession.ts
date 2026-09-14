import { buildSessionOrder, type RankableItem } from "./feedRanking";
import { supabase } from "./supabase";

/**
 * One day's feed order, per person.
 *
 * Every ranked grid used to download its whole table and shuffle it with
 * Math.random() on each open and each pull-to-refresh. A new order every time
 * meant the top of the grid was always photos the phone did not have yet, and
 * on paid mobile data that is the most expensive thing an app can do.
 *
 * Now the order is drawn once a day from a seed of the person and the date,
 * as a list of ids. The same person reopening the app the same day gets the
 * same order, so what they see first is already in the image cache; rows are
 * fetched a page at a time as they scroll (hooks/useRankedFeed.ts); and a
 * refresh adds what was posted since instead of starting over.
 */

export interface FeedOrder {
  /** What the order was drawn with — a different seed means a stale order. */
  seed: string;
  ids: string[];
  /** Server time the order was drawn; refresh fetches what was created after it. */
  asOf: string;
}

/** Bhutan Time is UTC+6 all year — no daylight saving to account for. */
const BHUTAN_UTC_OFFSET_MS = 6 * 60 * 60 * 1000;

/** Today's date in Bhutan, so the feed turns over at local midnight. */
export const feedDay = (now = Date.now()): string =>
  new Date(now + BHUTAN_UTC_OFFSET_MS).toISOString().slice(0, 10);

/**
 * Per person as well as per day: if everyone drew the same order, everyone's
 * first screen would be the same few items, and the fairness weighting exists
 * precisely to spread attention around. `salt` is for an explicit reshuffle.
 */
export const feedSeed = (userId: string | null | undefined, salt?: string): string =>
  [userId || "guest", feedDay(), salt].filter(Boolean).join(":");

/**
 * The most ids one order holds — about 40 bytes each on the wire, so the whole
 * order costs less than one grid photo. Scrolling past it ends that feed for
 * the day.
 */
export const FEED_ORDER_LIMIT = 600;

interface FetchFeedOrderOptions {
  /** `feed_order_*` in supabase/migrations/20260914120000_seeded_feed_order.sql. */
  rpc: string;
  /** Filter arguments beyond seed/limit/boost slots. */
  args?: Record<string, unknown>;
  seed: string;
  /** Id-only candidates, ranked on the device if the function isn't deployed. */
  fallbackPool: () => Promise<RankableItem[]>;
  boostSlotCount?: number;
}

let warnedFallback = false;

export async function fetchFeedOrder({
  rpc,
  args = {},
  seed,
  fallbackPool,
  boostSlotCount = 2,
}: FetchFeedOrderOptions): Promise<FeedOrder> {
  const { data, error } = await supabase.rpc(rpc, {
    ...args,
    p_seed: seed,
    p_limit: FEED_ORDER_LIMIT,
    p_boost_slots: boostSlotCount,
  });

  if (!error && data && Array.isArray(data.ids)) {
    return { seed, ids: data.ids.map(String), asOf: String(data.as_of) };
  }

  // Not deployed yet (or failing): rank on the device instead. Still one
  // seed, one order — just from an id-only pool rather than a list of ids.
  if (__DEV__ && !warnedFallback) {
    warnedFallback = true;
    console.warn(`[feedSession] ${rpc} unavailable, ranking on device:`, error?.message);
  }
  const pool = await fallbackPool();
  return {
    seed,
    ids: buildSessionOrder(pool, seed, boostSlotCount)
      .slice(0, FEED_ORDER_LIMIT)
      .map((item) => item.id),
    asOf: new Date().toISOString(),
  };
}
