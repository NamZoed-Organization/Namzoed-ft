/**
 * Client-side feed randomization + boost ranking — implements the algorithm
 * from feed-randomization-and-boost-algorithm.md, run once per session
 * (screen mount / pull-to-refresh) rather than server-side: at this app's
 * scale, fetching the eligible pool and ranking it in JS is simpler than
 * standing up a server-side session cache, and produces the same "different
 * order every fresh visit, stable order within one scroll session" result.
 *
 * Shared across all four content types (posts, products, marketplace,
 * provider_services) via the generic RankableItem shape — see
 * hooks/useRankedFeed.ts for the per-screen wiring (fetch pool once, cache
 * the computed order, paginate by slicing, track impressions per page).
 */

export interface RankableItem {
  id: string;
  impressions_shown?: number | null;
  boost_started_at?: string | null;
  boost_expires_at?: string | null;
}

/** weight = 1 / (impressions_shown + 1) — never-shown items get the max
 * weight (1); the more a post has already been served, the less likely it
 * is to keep winning the draw, until it's finally had its turn. */
const fairnessWeight = (impressionsShown: number): number => 1 / (impressionsShown + 1);

/** Efraimidis-Spirakis weighted-random key: random() ** (1/weight). Sorting
 * by this descending gives a full weighted-random ordering without
 * replacement in one pass — every item still has a nonzero chance of
 * landing anywhere, just skewed toward higher weight, which is what makes
 * this "randomized but fair" rather than a plain sort by impression count. */
const rankingKey = (weight: number): number => Math.random() ** (1 / weight);

function weightedShuffle<T extends RankableItem>(items: T[]): T[] {
  return items
    .map((item) => ({ item, key: rankingKey(fairnessWeight(item.impressions_shown ?? 0)) }))
    .sort((a, b) => b.key - a.key)
    .map((entry) => entry.item);
}

const isBoostActive = (item: RankableItem, now: number): boolean =>
  !!item.boost_expires_at && new Date(item.boost_expires_at).getTime() > now;

export interface BuildSessionOrderOptions {
  /** Fixed boost-slot count for this session — 2-3 per the algorithm doc. */
  boostSlotCount?: number;
}

/**
 * Computes one full session ordering: boost slots first (drawn from the
 * currently-active boost pool), then a fairness-weighted shuffle of
 * everything else. Call this ONCE per session and cache the result —
 * recomputing per page request breaks pagination (the order would shift
 * under the user mid-scroll). See hooks/useRankedFeed.ts, which does this
 * caching for you.
 *
 * Boost-pool ordering scores on `impressions_shown` too, not lifetime
 * impressions elsewhere — by convention, impressions_shown is reset to 0
 * whenever a boost activates (see the future boost-purchase/activation
 * flow), so for a currently-boosted row it already reads as "impressions
 * since the boost started," which is what keeps a brand-new boost from
 * always losing to one that's been running for days.
 */
export function buildSessionOrder<T extends RankableItem>(
  allItems: T[],
  options: BuildSessionOrderOptions = {},
): T[] {
  const slotCount = options.boostSlotCount ?? 2;
  const now = Date.now();

  const boosted: T[] = [];
  const regular: T[] = [];
  for (const item of allItems) {
    (isBoostActive(item, now) ? boosted : regular).push(item);
  }

  const orderedBoosted = weightedShuffle(boosted);
  const chosenBoosted = orderedBoosted.slice(0, slotCount);
  // A boost means "in contention for a priority slot," not "guaranteed
  // visible every load" — anything that didn't make the cut this session
  // just falls back into the regular pool alongside everyone else.
  const overflowBoosted = orderedBoosted.slice(slotCount);

  const orderedRegular = weightedShuffle([...regular, ...overflowBoosted]);

  return [...chosenBoosted, ...orderedRegular];
}

/** Slices a cached session order into a page — indices 0-19, 20-39, etc. */
export function paginateOrder<T>(orderedItems: T[], page: number, pageSize: number): T[] {
  const start = page * pageSize;
  return orderedItems.slice(start, start + pageSize);
}
