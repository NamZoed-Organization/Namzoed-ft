import ClosingSaleBanner from "@/components/ClosingSaleBanner";
import CountdownTimer from "@/components/CountdownTimer";
import HomeCard from "@/components/HomeCard";
import { fetchMarketplaceItems, MarketplaceItem } from "@/lib/postMarketPlace";
import { fetchProducts, Product } from "@/lib/productsService";
import {
  fetchAllProviderServices,
  ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { isClosingSaleActive } from "@/utils/timeHelpers";
import { useRouter } from "expo-router";
import { ArrowUpDown } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const CARD_SPACING = 16;

type SortOrder =
  | "latest"
  | "oldest"
  | "high_discount"
  | "low_discount"
  | "high_price"
  | "low_price";

// Shuffle array helper function
const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function ForYou() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>(
    [],
  );
  const [services, setServices] = useState<ProviderServiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClosingSaleTime, setIsClosingSaleTime] = useState(
    isClosingSaleActive(),
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const [showSortMenu, setShowSortMenu] = useState(false);

  useEffect(() => {
    loadAllData();

    // Check closing sale time every second
    const interval = setInterval(() => {
      setIsClosingSaleTime(isClosingSaleActive());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Toggle sort menu
  const toggleSortMenu = () => {
    setShowSortMenu(!showSortMenu);
  };

  // Get sort label
  const getSortLabel = (sort: SortOrder) => {
    switch (sort) {
      case "latest":
        return "Latest";
      case "oldest":
        return "Oldest";
      case "high_discount":
        return "High Discount";
      case "low_discount":
        return "Low Discount";
      case "high_price":
        return "Higher Price";
      case "low_price":
        return "Lower Price";
      default:
        return "Latest";
    }
  };

  // Sort ONLY closing sale products based on sortOrder
  const sortedClosingSaleProducts = useMemo(() => {
    const closingSaleItems = products.filter(
      (p) => p.category === "food" && p.is_discount_active,
    );

    switch (sortOrder) {
      case "latest":
        return closingSaleItems.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      case "oldest":
        return closingSaleItems.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      case "high_discount":
        return closingSaleItems.sort(
          (a, b) => (b.discount_percent || 0) - (a.discount_percent || 0),
        );
      case "low_discount":
        return closingSaleItems.sort(
          (a, b) => (a.discount_percent || 0) - (b.discount_percent || 0),
        );
      case "high_price":
        return closingSaleItems.sort(
          (a, b) => (b.current_price || b.price) - (a.current_price || a.price),
        );
      case "low_price":
        return closingSaleItems.sort(
          (a, b) => (a.current_price || a.price) - (b.current_price || b.price),
        );
      default:
        return closingSaleItems;
    }
  }, [products, sortOrder]);

  // Filter products with active discounts (excluding food items) - NO SORTING
  const discountedProducts = useMemo(() => {
    return products.filter(
      (p) => p.is_currently_active && p.category !== "food",
    );
  }, [products]);

  // Shuffled closing sale food items for banner
  const closingSaleFoodItems = useMemo(() => {
    return shuffleArray(sortedClosingSaleProducts);
  }, [sortedClosingSaleProducts]);

  // Active closing sale products (for section - shows only during 8-10pm)
  const activeClosingSaleProducts = useMemo(() => {
    return sortedClosingSaleProducts.filter((p) => p.is_currently_active);
  }, [sortedClosingSaleProducts]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [productsData, marketplaceData, servicesData] = await Promise.all([
        fetchProducts(0, 20),
        fetchMarketplaceItems(0, 20),
        fetchAllProviderServices(0, 20),
      ]);

      // Shuffle items within each category and take first 10 items
      setProducts(shuffleArray(productsData.products || []).slice(0, 10));
      setMarketplaceItems(
        shuffleArray(marketplaceData.items || []).slice(0, 10),
      );
      setServices(shuffleArray(servicesData || []).slice(0, 10));
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProductPress = (product: Product) => {
    router.push(`/(users)/product/${product.id}` as any);
  };

  const handleMarketplacePress = (item: MarketplaceItem) => {
    router.push(`/(users)/marketplace/${item.id}` as any);
  };

  const handleServicePress = (service: ProviderServiceWithDetails) => {
    router.push(`/(users)/servicedetail/${service.id}` as any);
  };

  const renderSection = (
    title: string,
    items: any[],
    renderCard: (item: any) => React.ReactElement,
    viewAllRoute: string,
    showTimer?: boolean,
    timerEndTime?: string,
    showEmptyState?: boolean,
  ) => {
    // For discount categories, don't render if empty
    if (items.length === 0 && !showEmptyState) return null;

    return (
      <View className="mb-8">
        <View className="flex-row items-center justify-between mb-4 px-4">
          <Text className="text-lg font-mbold text-gray-800">{title}</Text>
          {showTimer && timerEndTime && (
            <CountdownTimer endsAt={timerEndTime} compact={false} />
          )}
        </View>

        {items.length === 0 ? (
          <View className="px-4 py-8 items-center">
            <Text className="text-gray-500 text-sm">
              No products available at the moment
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingLeft: 16,
            }}
          >
            {items.map((item) => renderCard(item))}
            <HomeCard
              isSeeMore
              onPress={() => router.push(viewAllRoute as any)}
            />
          </ScrollView>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" color="#094569" />
        <Text className="text-gray-500 mt-2">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background pt-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Closing Sale Banner - Always shown at top */}
        <ClosingSaleBanner foodItems={closingSaleFoodItems} />

        {/* Sort Button - Above preview cards */}
        <View className="px-4 mb-3">
          <TouchableOpacity
            onPress={toggleSortMenu}
            className="bg-white px-3 py-2 rounded-xl shadow-sm border border-gray-200 flex-row items-center self-start"
          >
            <ArrowUpDown size={16} color="#1F2937" />
            <Text className="ml-1.5 text-xs font-semibold text-gray-700">
              {getSortLabel(sortOrder)}
            </Text>
          </TouchableOpacity>

          {/* Sort Menu Dropdown */}
          {showSortMenu && (
            <View className="mt-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              {(
                [
                  "latest",
                  "oldest",
                  "high_discount",
                  "low_discount",
                  "high_price",
                  "low_price",
                ] as SortOrder[]
              ).map((sort) => (
                <TouchableOpacity
                  key={sort}
                  onPress={() => {
                    setSortOrder(sort);
                    setShowSortMenu(false);
                  }}
                  className={`p-3 border-b border-gray-100 ${sortOrder === sort ? "bg-primary/10" : ""}`}
                >
                  <Text
                    className={`text-sm font-medium ${sortOrder === sort ? "text-primary" : "text-gray-700"}`}
                  >
                    {getSortLabel(sort)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Closing Sale Preview Cards - Below sort button */}
        {closingSaleFoodItems.length > 0 && (
          <View className="mb-4">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 16 }}
            >
              {closingSaleFoodItems.map((item) => {
                const discountedPrice = item.discount_percent
                  ? item.price - (item.price * item.discount_percent) / 100
                  : item.price;

                return (
                  <HomeCard
                    key={item.id}
                    imageUrl={
                      item.images[0] || "https://via.placeholder.com/140"
                    }
                    title={item.name}
                    subtitle="FOOD"
                    price={`Nu. ${discountedPrice.toLocaleString()}`}
                    discountPercent={item.discount_percent}
                    isClosingSale={true}
                    profileImage={(item as any).profiles?.avatar_url}
                    profileName={(item as any).profiles?.name}
                    onPress={() =>
                      router.push(`/(users)/product/${item.id}` as any)
                    }
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 1. Closing Sale Section - Only shown during 8pm-10pm */}
        {isClosingSaleTime &&
          renderSection(
            "🌙 Closing Sale",
            activeClosingSaleProducts,
            (product: Product) => (
              <HomeCard
                key={product.id}
                imageUrl={
                  product.images[0] || "https://via.placeholder.com/200"
                }
                title={product.name}
                subtitle={product.category?.toUpperCase() || "FOOD"}
                price={
                  product.current_price && product.current_price > 0
                    ? `Nu. ${product.current_price}`
                    : undefined
                }
                discountPercent={product.discount_percent}
                isClosingSale={true}
                profileImage={(product as any).profiles?.avatar_url}
                profileName={(product as any).profiles?.name}
                onPress={() => handleProductPress(product)}
              />
            ),
            "/(users)/categories",
            false,
            undefined,
            false,
          )}

        {/* 2. Flash Deals - only shown if items exist */}
        {renderSection(
          "🔥 Flash Deals",
          discountedProducts,
          (product: Product) => (
            <HomeCard
              key={product.id}
              imageUrl={product.images[0] || "https://via.placeholder.com/200"}
              title={product.name}
              subtitle={product.category?.toUpperCase() || "PRODUCT"}
              price={
                product.current_price && product.current_price > 0
                  ? `Nu. ${product.current_price}`
                  : undefined
              }
              discountPercent={product.discount_percent}
              isClosingSale={false}
              profileImage={(product as any).profiles?.avatar_url}
              profileName={(product as any).profiles?.name}
              onPress={() => handleProductPress(product)}
            />
          ),
          "/(users)/categories",
          false,
          undefined,
          false,
        )}

        {/* 3. Products - always shown, with empty state */}
        {renderSection(
          "Products",
          products,
          (product: Product) => {
            const isFood = product.category === "food";
            const isFoodWithClosingSale = isFood && product.is_discount_active;

            // For food items with closing sale: show original price, no discount badge
            // For other items: show discounted price if available
            const displayPrice = isFoodWithClosingSale
              ? product.price
              : product.current_price || product.price;

            const hasDiscount =
              product.is_currently_active &&
              product.discount_percent &&
              !isFoodWithClosingSale;

            return (
              <HomeCard
                key={product.id}
                imageUrl={
                  product.images[0] || "https://via.placeholder.com/200"
                }
                title={product.name}
                subtitle={product.category?.toUpperCase() || "PRODUCT"}
                price={
                  displayPrice && displayPrice > 0
                    ? `Nu. ${displayPrice}`
                    : undefined
                }
                discountPercent={
                  hasDiscount ? product.discount_percent : undefined
                }
                isClosingSale={false}
                profileImage={(product as any).profiles?.avatar_url}
                profileName={(product as any).profiles?.name}
                onPress={() => handleProductPress(product)}
              />
            );
          },
          "/(users)/categories",
          false,
          undefined,
          true,
        )}

        {/* 4. Services - always shown, with empty state */}
        {renderSection(
          "Services",
          services,
          (service: ProviderServiceWithDetails) => (
            <HomeCard
              key={service.id}
              imageUrl={service.images[0] || "https://via.placeholder.com/200"}
              title={service.name}
              subtitle={service.service_categories?.name || "Service"}
              profileImage={
                service.service_providers?.profile_url ||
                service.service_providers?.profiles?.avatar_url
              }
              profileName={
                service.service_providers?.profiles?.name ||
                service.service_providers?.name
              }
              onPress={() => handleServicePress(service)}
            />
          ),
          "/(users)/services/index",
          false,
          undefined,
          true,
        )}

        {/* 5. Marketplace - always shown, with empty state */}
        {renderSection(
          "Marketplace",
          marketplaceItems,
          (item: MarketplaceItem) => (
            <HomeCard
              key={item.id}
              imageUrl={item.images[0] || "https://via.placeholder.com/200"}
              title={item.title}
              subtitle={item.type.replace("_", " ")}
              price={
                item.price && item.price > 0 ? `Nu. ${item.price}` : undefined
              }
              profileImage={(item as any).profiles?.avatar_url}
              profileName={(item as any).profiles?.name}
              onPress={() => handleMarketplacePress(item)}
            />
          ),
          "/(users)/marketplace",
          false,
          undefined,
          true,
        )}
      </ScrollView>
    </View>
  );
}
