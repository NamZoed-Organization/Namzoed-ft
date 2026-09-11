import { useUser } from "@/contexts/UserContext";
import { fetchUserMarketplaceItems, MarketplaceItem } from "@/lib/postMarketPlace";
import { peekCache, readCache, writeCache } from "@/lib/queryCache";
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

const marketplaceCacheKey = (userId: string) => `profile:marketplace:${userId}`;

/**
 * The signed-in user's own marketplace listings — what their profile's
 * Marketplace tab shows.
 *
 * That tab used to render `products`, which was the wrong entity for it:
 * products are the shopping catalogue and belong to a licence-verified shop,
 * shown on the work profile. A personal profile's selling is the
 * peer-to-peer kind — second hand, rent, swap, free — which is exactly what
 * the `marketplace` table holds and why the tab was named for it.
 *
 * Same stale-while-revalidate shape as useUserProducts: paint from cache
 * immediately, refresh behind it.
 */
export const useUserMarketplace = (
  refreshKey: number,
  showErrorPopup: (message: string) => void,
) => {
  const { currentUser } = useUser();
  const cached = currentUser?.id
    ? peekCache<MarketplaceItem[]>(marketplaceCacheKey(currentUser.id))?.data ?? null
    : null;
  const [items, setItems] = useState<MarketplaceItem[]>(cached ?? []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    const load = async () => {
      if (!currentUser?.id) {
        setLoading(false);
        return;
      }
      const key = marketplaceCacheKey(currentUser.id);
      try {
        const fromCache = await readCache<MarketplaceItem[]>(key);
        if (fromCache) {
          setItems(fromCache.data);
          setLoading(false);
        } else {
          setLoading(true);
        }

        const fresh = await fetchUserMarketplaceItems(currentUser.id);
        setItems(fresh ?? []);
        await writeCache(key, fresh ?? []);
      } catch (error) {
        console.error("Error loading user marketplace items:", error);
        showErrorPopup("Failed to load your marketplace listings");
      } finally {
        setLoading(false);
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      load();
    });
    return () => task.cancel();
  }, [currentUser?.id, refreshKey]);

  return { marketplaceItems: items, setMarketplaceItems: setItems, loadingMarketplace: loading };
};
