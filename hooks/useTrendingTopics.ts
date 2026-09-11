import { fetchTrendingTopics, TrendingTopic } from "@/lib/trendingService";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";

/**
 * Shared "Trending" data source — the Search screen's chips and the search
 * bar's rotating placeholder both read it, so both stay in sync off one
 * fetch.
 *
 * This replaced useTrendingSubcategories, which pulled every row of the
 * products table to the device on each focus and ranked hardcoded
 * subcategory names by all-time listing count. The ranking now happens in
 * Postgres over a rolling window and comes back as a dozen rows.
 */
export function useTrendingTopics(limit = 12) {
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const topics = await fetchTrendingTopics({ limit });
    setTrending(topics);
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refreshed on focus, but the list is a dozen pre-aggregated rows rather
  // than the whole products table, so this is cheap.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { trending, loading, refresh: load };
}
