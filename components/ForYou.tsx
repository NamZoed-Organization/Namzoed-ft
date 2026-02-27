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
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { ArrowUpDown } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const CARD_ESTIMATED_SIZE = 196; // CARD_WIDTH (180) + marginRight (16)
const CARD_LIST_HEIGHT = 255; // imageFrame (140) + text area (~105) + marginBottom (10)

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
  const isMountedRef = useRef(true);
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
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const toggleSortMenu = () => {
    setShowSortMenu(!showSortMenu);
  };

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

  const sortedClosingSaleProducts = useMemo(() => {
    const closingSaleItems = products.filter(
      (p) => p.category === "food" && p.is_discount_active,
    );

    const sorted = [...closingSaleItems];
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

  const discountedProducts = useMemo(() => {
    return products.filter(
      (p) => p.is_currently_active && p.category !== "food",
    );
  }, [products]);

  const closingSaleFoodItems = useMemo(() => {
    return shuffleArray(sortedClosingSaleProducts);
  }, [sortedClosingSaleProducts]);

  const loadAllData = async () => {
    try {
      if (isMountedRef.current) {
        setLoading(true);
      }
      const [productsData, marketplaceData, servicesData] = await Promise.all([
        fetchProducts(0, 20),
        fetchMarketplaceItems(0, 20),
        fetchAllProviderServices(0, 20),
      ]);

      if (!isMountedRef.current) return;

      setProducts(shuffleArray(productsData.products || []).slice(0, 10));
      setMarketplaceItems(shuffleArray(marketplaceData.items || []).slice(0, 10));
      // Trim service objects to only the fields needed for card rendering
      // (drops `description` and excess images to reduce memory pressure)
      setServices(
        shuffleArray(servicesData || [])
          .slice(0, 10)
          .map((s) => ({
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
          } as ProviderServiceWithDetails))
      );
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadAllData();

    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      setIsClosingSaleTime(isClosingSaleActive());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

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
          <FlashList
            horizontal
            data={items}
            renderItem={({ item }) => renderCard(item)}
            keyExtractor={(item) => item.id}
            estimatedItemSize={CARD_ESTIMATED_SIZE}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 16 }}
            style={{ height: CARD_LIST_HEIGHT }}
            bounces={false}
            overScrollMode="never"
            ListFooterComponent={
              <HomeCard
                isSeeMore
                onPress={() => router.push(viewAllRoute as any)}
              />
            }
          />
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
    <View className="bg-background pt-4">
      {/* Closing Sale Banner */}
      <View className="mb-4">
        <ClosingSaleBanner foodItems={closingSaleFoodItems} />

        {isClosingSaleTime && (
          <View className="pb-4">
            {/* Sort Button */}
            <View className="px-4 mb-3">
              <TouchableOpacity
                onPress={toggleSortMenu}
                className="bg-white/90 backdrop-blur-sm px-3 py-2 rounded-xl shadow-sm border border-white/50 flex-row items-center self-start"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.9)" }}
              >
                <ArrowUpDown size={16} color="#1F2937" />
                <Text className="ml-1.5 text-xs font-semibold text-gray-700">
                  {getSortLabel(sortOrder)}
                </Text>
              </TouchableOpacity>

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

            {/* Closing Sale Preview Cards */}
            {closingSaleFoodItems.length > 0 && (
              <FlashList
                horizontal
                data={closingSaleFoodItems}
                keyExtractor={(item) => item.id}
                estimatedItemSize={CARD_ESTIMATED_SIZE}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 16 }}
                style={{ height: CARD_LIST_HEIGHT }}
                bounces={false}
                overScrollMode="never"
                renderItem={({ item }) => {
                  const discountedPrice = item.discount_percent
                    ? item.price - (item.price * item.discount_percent) / 100
                    : item.price;

                  return (
                    <HomeCard
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
                }}
              />
            )}
          </View>
        )}
      </View>

      {/* Flash Deals */}
      {renderSection(
        "🔥 Flash Deals",
        discountedProducts,
        (product: Product) => (
          <HomeCard
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

      {/* Products */}
      {renderSection(
        "Products",
        products,
        (product: Product) => {
          const isFood = product.category === "food";
          const isFoodWithClosingSale = isFood && product.is_discount_active;
          const displayPrice = isFoodWithClosingSale
            ? product.price
            : product.current_price || product.price;
          const hasDiscount =
            product.is_currently_active &&
            product.discount_percent &&
            !isFoodWithClosingSale;

          return (
            <HomeCard
                imageUrl={product.images[0] || "https://via.placeholder.com/200"}
              title={product.name}
              subtitle={product.category?.toUpperCase() || "PRODUCT"}
              price={
                displayPrice && displayPrice > 0
                  ? `Nu. ${displayPrice}`
                  : undefined
              }
              discountPercent={hasDiscount ? product.discount_percent : undefined}
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

      {/* Services */}
      {renderSection(
        "Services",
        services,
        (service: ProviderServiceWithDetails) => (
          <HomeCard
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

      {/* Marketplace */}
      {renderSection(
        "Marketplace",
        marketplaceItems,
        (item: MarketplaceItem) => (
          <HomeCard
            imageUrl={item.images[0] || "https://via.placeholder.com/200"}
            title={item.title}
            subtitle={item.type.replace("_", " ")}
            price={
              item.price && item.price > 0 ? `Nu. ${item.price}` : undefined
            }
            location={item.dzongkhag}
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
    </View>
  );
}
