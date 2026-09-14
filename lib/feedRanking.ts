/**
 * Feed fairness + boost ranking — the algorithm from
 * feed-randomization-and-boost-algorithm.md.
 *
 * The ranking normally runs on the server
 * (supabase/migrations/20260914120000_seeded_feed_order.sql, `feed_order_*`),
 * which returns one day's order as a list of ids. This copy is the fallback
 * when those functions are not deployed (lib/feedSession.ts): the same rules,
 * seeded the same way in spirit — one seed, one order — though the hash
 * differs, so the two never have to agree item for item.
 *
 * Shared across all four content types (posts, products, marketplace,
 * provider_services) via the generic RankableItem shape.
 */

export interface RankableItem {
  id: string;
  impressions_shown?: number | null;
  boost_started_at?: string | null;
  boost_expires_at?: string | null;
}

/**
 * A number in (0, 1] that depends only on the seed and the id.
 *
 * Per item rather than a seeded stream, so an item draws the same number for
 * the same seed whatever else is in the pool and in whatever order the pool
 * arrived. FNV-1a, then murmur3's finaliser, because FNV alone barely mixes
 * the ids' shared prefixes.
 */
export function seededUnit(seed: string, id: string): number {
  const s = `${seed}:${id}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) + 1) / 4294967297;
}

/** Efraimidis-Spirakis key u ** (1/weight), with weight = 1 / (impressions_shown + 1):
 * never-shown items get the max weight; the more an item has already been
 * served, the less likely it is to keep winning the draw. Every item still
 * has a nonzero chance of landing anywhere — "randomized but fair" rather
 * than a plain sort by impression count. */
const rankingKey = (seed: string, item: RankableItem): number =>
  seededUnit(seed, item.id) ** ((item.impressions_shown ?? 0) + 1);

function weightedShuffle<T extends RankableItem>(items: T[], seed: string): T[] {
  return items
    .map((item) => ({ item, key: rankingKey(seed, item) }))
    .sort((a, b) => b.key - a.key || (a.item.id < b.item.id ? -1 : 1))
    .map((entry) => entry.item);
}

const isBoostActive = (item: RankableItem, now: number): boolean =>
  !!item.boost_expires_at && new Date(item.boost_expires_at).getTime() > now;

/**
 * One full ordering: boost slots first (drawn from the currently-active boost
 * pool), then a fairness-weighted shuffle of everything else. The same seed
 * gives the same order, which is what lets a feed keep its order all day.
 *
 * Boost-pool ordering scores on `impressions_shown` too — by convention it is
 * reset to 0 whenever a boost activates, so for a boosted row it reads as
 * "impressions since the boost started", which keeps a brand-new boost from
 * always losing to one that has been running for days.
 */
export function buildSessionOrder<T extends RankableItem>(
  allItems: T[],
  seed: string,
  boostSlotCount = 2,
): T[] {
  const now = Date.now();

  const boosted: T[] = [];
  const regular: T[] = [];
  for (const item of allItems) {
    (isBoostActive(item, now) ? boosted : regular).push(item);
  }

  const orderedBoosted = weightedShuffle(boosted, seed);
  const chosenBoosted = orderedBoosted.slice(0, boostSlotCount);
  // A boost means "in contention for a priority slot," not "guaranteed
  // visible every load" — anything that didn't make the cut just falls back
  // into the regular pool alongside everyone else.
  const overflowBoosted = orderedBoosted.slice(boostSlotCount);

  const orderedRegular = weightedShuffle([...regular, ...overflowBoosted], seed);

  return [...chosenBoosted, ...orderedRegular];
}
