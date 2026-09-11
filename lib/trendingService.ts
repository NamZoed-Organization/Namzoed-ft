/**
 * Trending Service
 *
 * Records the three things that make a topic trend — a search, a hashtag
 * tap, a hashtag published in a post — and reads back the ranked list.
 *
 * Scoring lives in Postgres (`trending_terms`, see
 * supabase/migrations/20260905120000_create_trending_signals.sql): weighted
 * signals with a three-day half-life, deduplicated to one per user per term
 * per source per day. The client never sees the raw signal log.
 *
 * Deliberately separate from analyticsService: that one is gated off in dev
 * builds (`if (__DEV__) return`) so testing doesn't pollute production
 * numbers, which is right for analytics and wrong for a product feature that
 * has to be usable while you're building it.
 */

import { supabase } from "@/lib/supabase";
import { normalizeTerm } from "@/utils/hashtags";

export type TrendingSource = "search" | "hashtag_tap" | "hashtag_post";

export interface TrendingTopic {
  term: string;
  score: number;
  signalCount: number;
  userCount: number;
}

/**
 * Fire-and-forget: a failure here must never surface to the user or block
 * whatever they were actually doing.
 */
export async function recordTrendingSignal(
  rawTerm: string | null | undefined,
  source: TrendingSource,
  userId?: string | null,
): Promise<void> {
  const term = normalizeTerm(rawTerm);
  if (!term) return;
  await recordTrendingSignals([term], source, userId);
}

/** One insert for a whole post's worth of hashtags. */
export async function recordTrendingSignals(
  rawTerms: Array<string | null | undefined>,
  source: TrendingSource,
  userId?: string | null,
): Promise<void> {
  const terms = Array.from(
    new Set(
      rawTerms
        .map(normalizeTerm)
        .filter((term): term is string => term !== null),
    ),
  );
  if (!terms.length) return;

  try {
    await supabase.from("search_signals").insert(
      terms.map((term) => ({
        term,
        source,
        user_id: userId ?? null,
      })),
    );
  } catch (error) {
    console.error("Failed to record trending signal:", error);
  }
}

export async function fetchTrendingTopics(
  { days = 7, limit = 12 }: { days?: number; limit?: number } = {},
): Promise<TrendingTopic[]> {
  try {
    const { data, error } = await supabase.rpc("trending_terms", {
      days,
      max_results: limit,
    });
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      term: String(row.term),
      score: Number(row.score) || 0,
      signalCount: Number(row.signal_count) || 0,
      userCount: Number(row.user_count) || 0,
    }));
  } catch (error) {
    console.error("Failed to fetch trending topics:", error);
    return [];
  }
}
