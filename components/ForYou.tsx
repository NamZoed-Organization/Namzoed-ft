import HomeCard from "@/components/HomeCard";
import CountdownTimer from "@/components/CountdownTimer";
import { fetchProducts, Product } from "@/lib/productsService";
import { fetchMarketplaceItems, MarketplaceItem } from "@/lib/postMarketPlace";
import { fetchAllProviderServices, ProviderServiceWithDetails } from "@/lib/servicesService";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  View,
} from "react-native";

const CARD_SPACING = 16;

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
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>([]);
  const [services, setServices] = useState<ProviderServiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, []);

  // Filter products with active discounts (excluding food items)
  const discountedProducts = useMemo(() => {
    return products.filter(p => p.is_currently_active && p.category !== "food");
  }, [products]);

  // Filter food products with active discounts
  const closingSaleProducts = useMemo(() => {
    return products.filter(p => p.is_currently_active && p.category === "food");
  }, [products]);

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
      setMarketplaceItems(shuffleArray(marketplaceData.items || []).slice(0, 10));
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
    renderCard: (item: any) => JSX.Element,
    viewAllRoute: string,
    showTimer?: boolean,
    timerEndTime?: string,
    showEmptyState?: boolean
  ) => {
    // For discount categories, don't render if empty
    if (items.length === 0 && !showEmptyState) return null;

    return (
      <View className="mb-8">
        <View className="flex-row items-center justify-between mb-4 px-4">
          <Text className="text-lg font-mbold text-gray-800">
            {title}
          </Text>
          {showTimer && timerEndTime && (
            <CountdownTimer endsAt={timerEndTime} compact={false} />
          )}
        </View>

        {items.length === 0 ? (
          <View className="px-4 py-8 items-center">
            <Text className="text-gray-500 text-sm">No products available at the moment</Text>
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
            <HomeCard isSeeMore onPress={() => router.push(viewAllRoute as any)} />
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
      {/* 1. Closing Sale - shown whenever there are food items with active discounts */}
      {renderSection(
        "🌙 Closing Sale",
        closingSaleProducts,
        (product: Product) => (
          <HomeCard
            key={product.id}
            imageUrl={product.images[0] || 'https://via.placeholder.com/200'}
            title={product.name}
            subtitle={product.category?.toUpperCase() || 'FOOD'}
            price={product.current_price && product.current_price > 0 ? `Nu. ${product.current_price}` : undefined}
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
        false
      )}

      {/* 2. Flash Deals - only shown if items exist */}
      {renderSection(
        "🔥 Flash Deals",
        discountedProducts,
        (product: Product) => (
          <HomeCard
            key={product.id}
            imageUrl={product.images[0] || 'https://via.placeholder.com/200'}
            title={product.name}
            subtitle={product.category?.toUpperCase() || 'PRODUCT'}
            price={product.current_price && product.current_price > 0 ? `Nu. ${product.current_price}` : undefined}
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
        false
      )}

      {/* 3. Products - always shown, with empty state */}
      {renderSection(
        "Products",
        products,
        (product: Product) => {
          const price = product.current_price || product.price;
          const hasDiscount = product.is_currently_active && product.discount_percent;
          const isFood = product.category === "food";

          return (
            <HomeCard
              key={product.id}
              imageUrl={product.images[0] || 'https://via.placeholder.com/200'}
              title={product.name}
              subtitle={product.category?.toUpperCase() || 'PRODUCT'}
              price={price && price > 0 ? `Nu. ${price}` : undefined}
              discountPercent={hasDiscount ? product.discount_percent : undefined}
              isClosingSale={hasDiscount && isFood}
              profileImage={(product as any).profiles?.avatar_url}
              profileName={(product as any).profiles?.name}
              onPress={() => handleProductPress(product)}
            />
          );
        },
        "/(users)/categories",
        false,
        undefined,
        true
      )}

      {/* 4. Services - always shown, with empty state */}
      {renderSection(
        "Services",
        services,
        (service: ProviderServiceWithDetails) => (
          <HomeCard
            key={service.id}
            imageUrl={service.images[0] || 'https://via.placeholder.com/200'}
            title={service.name}
            subtitle={service.service_categories?.name || 'Service'}
            profileImage={service.service_providers?.profile_url || service.service_providers?.profiles?.avatar_url}
            profileName={service.service_providers?.profiles?.name || service.service_providers?.name}
            onPress={() => handleServicePress(service)}
          />
        ),
        "/(users)/services/index",
        false,
        undefined,
        true
      )}

      {/* 5. Marketplace - always shown, with empty state */}
      {renderSection(
        "Marketplace",
        marketplaceItems,
        (item: MarketplaceItem) => (
          <HomeCard
            key={item.id}
            imageUrl={item.images[0] || 'https://via.placeholder.com/200'}
            title={item.title}
            subtitle={item.type.replace('_', ' ')}
            price={item.price && item.price > 0 ? `Nu. ${item.price}` : undefined}
            profileImage={(item as any).profiles?.avatar_url}
            profileName={(item as any).profiles?.name}
            onPress={() => handleMarketplacePress(item)}
          />
        ),
        "/(users)/marketplace",
        false,
        undefined,
        true
      )}
    </View>
  );
}
