import { fetchMarketplaceItems, MarketplaceItem } from "@/lib/postMarketPlace";
import { fetchProducts, Product } from "@/lib/productsService";
import {
  fetchAllProviderServices,
  ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { isClosingSaleActive } from "@/utils/timeHelpers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, unstable_batchedUpdates } from "react-native";

export type SortOrder =
  | "latest"
  | "oldest"
  | "high_discount"
  | "low_discount"
  | "high_price"
  | "low_price";

export const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export function useForYouData() {
  const isMountedRef = useRef(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([]);
  const [services, setServices] = useState<ProviderServiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosingSaleTime, setIsClosingSaleTime] = useState(isClosingSaleActive());
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      if (isMountedRef.current) setLoading(true);
      const [productsData, marketplaceData, servicesData] = await Promise.all([
        fetchProducts(0, 15),
        fetchMarketplaceItems(0, 15),
        fetchAllProviderServices(0, 15),
      ]);
      if (!isMountedRef.current) return;
      unstable_batchedUpdates(() => {
      setProducts(shuffleArray(productsData.products || []).slice(0, 6));
      setMarketplaceItems(shuffleArray(marketplaceData.items || []).slice(0, 6));
      setServices(
        shuffleArray(servicesData || [])
          .slice(0, 6)
          .map(
            (s) =>
              ({
                id: s.id,
                name: s.name,
                images: s.images?.slice(0, 1) ?? [],
                description: "",
                service_categories: s.service_categories
                  ? { name: s.service_categories.name }
                  : undefined,
                service_providers: s.service_providers
                  ? {
                      name: s.service_providers.name,
                      profile_url: s.service_providers.profile_url,
                      profiles: s.service_providers.profiles
                        ? {
                            name: s.service_providers.profiles.name,
                            avatar_url: s.service_providers.profiles.avatar_url,
                          }
                        : undefined,
                    }
                  : undefined,
              }) as ProviderServiceWithDetails,
          ),
      );
      if (isMountedRef.current) setLoading(false);
      }); // end batchedUpdates
    } catch (error) {
      console.error("Error loading ForYou data:", error);
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer data loading until after the screen navigation animation completes
    // so the JS thread isn't competing with the transition
    const task = InteractionManager.runAfterInteractions(() => {
      loadAllData();
    });
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      setIsClosingSaleTime(isClosingSaleActive());
    }, 60000);
    return () => {
      task.cancel();
      clearInterval(interval);
    };
  }, [loadAllData]);

  const sortedClosingSaleProducts = useMemo(() => {
    const items = products.filter(
      (p) => p.category === "food" && p.is_discount_active,
    );
    const sorted = [...items];
    switch (sortOrder) {
      case "latest":
        return sorted.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      case "oldest":
        return sorted.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      case "high_discount":
        return sorted.sort(
          (a, b) => (b.discount_percent || 0) - (a.discount_percent || 0),
        );
      case "low_discount":
        return sorted.sort(
          (a, b) => (a.discount_percent || 0) - (b.discount_percent || 0),
        );
      case "high_price":
        return sorted.sort(
          (a, b) =>
            (b.current_price || b.price) - (a.current_price || a.price),
        );
      case "low_price":
        return sorted.sort(
          (a, b) =>
            (a.current_price || a.price) - (b.current_price || b.price),
        );
      default:
        return sorted;
    }
  }, [products, sortOrder]);

  const closingSaleFoodItems = useMemo(
    () => shuffleArray(sortedClosingSaleProducts),
    [sortedClosingSaleProducts],
  );

  const discountedProducts = useMemo(
    () =>
      products.filter((p) => p.is_currently_active && p.category !== "food"),
    [products],
  );

  const toggleSortMenu = useCallback(() => setShowSortMenu((v) => !v), []);

  const selectSort = useCallback((order: SortOrder) => {
    setSortOrder(order);
    setShowSortMenu(false);
  }, []);

  const getSortLabel = useCallback((sort: SortOrder): string => {
    switch (sort) {
      case "latest":        return "Latest";
      case "oldest":        return "Oldest";
      case "high_discount": return "High Discount";
      case "low_discount":  return "Low Discount";
      case "high_price":    return "Higher Price";
      case "low_price":     return "Lower Price";
      default:              return "Latest";
    }
  }, []);

  return {
    products,
    marketplaceItems,
    services,
    loading,
    isClosingSaleTime,
    sortOrder,
    showSortMenu,
    toggleSortMenu,
    selectSort,
    getSortLabel,
    closingSaleFoodItems,
    discountedProducts,
    reload: loadAllData,
  };
}
