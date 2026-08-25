import { categories as categoryData } from "@/data/categories";
import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface TrendingEntry {
  categoryKey: string;
  subcategoryName: string;
  count: number;
}

interface ProductSummary {
  category: string;
  tags: string[] | null;
}

const categoryKeys = Object.keys(categoryData);

/**
 * Top subcategory per top-level category, by real product count — shared
 * "Trending" data source between the Categories tab (rotating search-bar
 * placeholder) and the global Search screen (empty-state suggestion chips),
 * so both stay in sync off one fetch/aggregation instead of duplicating it.
 */
export function useTrendingSubcategories() {
  const [realProducts, setRealProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("category, tags");
      if (error) throw error;
      setRealProducts(data || []);
    } catch (error) {
      console.error("Error fetching trending subcategories:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  useFocusEffect(
    useCallback(() => {
      fetchCounts();
    }, [fetchCounts]),
  );

  const trending = useMemo<TrendingEntry[]>(() => {
    return categoryKeys
      .map((categoryKey): TrendingEntry | null => {
        const productsInCategory = realProducts.filter(
          (p) => p.category === categoryKey,
        );
        const subcategories = categoryData[categoryKey].map((sub) => ({
          name: sub.name,
          count: productsInCategory.filter((p) => p.tags?.includes(sub.name))
            .length,
        }));
        const top = subcategories.reduce(
          (max, current) => (current.count > max.count ? current : max),
          { name: "", count: 0 },
        );
        return top.count > 0
          ? { categoryKey, subcategoryName: top.name, count: top.count }
          : null;
      })
      .filter((entry): entry is TrendingEntry => entry !== null)
      .sort((a, b) => b.count - a.count);
  }, [realProducts]);

  return { trending, loading };
}
