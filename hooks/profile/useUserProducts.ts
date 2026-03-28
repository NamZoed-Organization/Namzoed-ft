import { useUser } from "@/contexts/UserContext";
import { fetchUserProducts, Product } from "@/lib/productsService";
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

export const useUserProducts = (
  refreshKey: number,
  showErrorPopup: (message: string) => void,
) => {
  const { currentUser } = useUser();
  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    const loadProducts = async () => {
      if (!currentUser?.id) {
        setLoadingProducts(false);
        return;
      }
      try {
        setLoadingProducts(true);
        const products = await fetchUserProducts(currentUser.id);
        setUserProducts(products);
      } catch (error) {
        console.error("Error loading user products:", error);
        showErrorPopup("Failed to load your products");
      } finally {
        setLoadingProducts(false);
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      loadProducts();
    });
    return () => task.cancel();
  }, [currentUser?.id, refreshKey]);

  return {
    userProducts,
    setUserProducts,
    loadingProducts,
  };
};
