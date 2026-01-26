import HomeCard from "@/components/HomeCard";
import { fetchProducts, Product } from "@/lib/productsService";
import { fetchMarketplaceItems, MarketplaceItem } from "@/lib/postMarketPlace";
import { fetchAllProviderServices, ProviderServiceWithDetails } from "@/lib/servicesService";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [productsData, marketplaceData, servicesData] = await Promise.all([
        fetchProducts(0, 20),
        fetchMarketplaceItems(0, 20),
        fetchAllProviderServices(0, 20),
      ]);

      // Shuffle and take first 10 items
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
    viewAllRoute: string
  ) => {
    if (items.length === 0) return null;

    return (
      <View className="mb-8">
        <Text className="text-lg font-mbold text-gray-800 mb-4 px-4">
          {title}
        </Text>

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
      {/* Products Section */}
      {renderSection(
        "Products",
        products,
        (product: Product) => (
          <HomeCard
            key={product.id}
            imageUrl={product.images[0] || 'https://via.placeholder.com/200'}
            title={product.name}
            subtitle={`Nu. ${product.current_price || product.price}`}
            onPress={() => handleProductPress(product)}
          />
        ),
        "/(users)/categories"
      )}

      {/* Marketplace Section */}
      {renderSection(
        "Marketplace",
        marketplaceItems,
        (item: MarketplaceItem) => (
          <HomeCard
            key={item.id}
            imageUrl={item.images[0] || 'https://via.placeholder.com/200'}
            title={item.title}
            subtitle={item.type.replace('_', ' ')}
            onPress={() => handleMarketplacePress(item)}
          />
        ),
        "/(users)/marketplace"
      )}

      {/* Services Section */}
      {renderSection(
        "Services",
        services,
        (service: ProviderServiceWithDetails) => (
          <HomeCard
            key={service.id}
            imageUrl={service.images[0] || 'https://via.placeholder.com/200'}
            title={service.name}
            subtitle={service.service_providers?.profiles?.name || service.service_categories?.name || 'Service'}
            onPress={() => handleServicePress(service)}
          />
        ),
        "/(users)/services/index"
      )}
    </View>
  );
}
