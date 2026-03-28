import ClosingSaleBanner from "@/components/ClosingSaleBanner";
import CountdownTimer from "@/components/CountdownTimer";
import HomeCard from "@/components/HomeCard";
import { useForYouData, SortOrder } from "@/hooks/useForYouData";
import { MarketplaceItem } from "@/lib/postMarketPlace";
import { Product } from "@/lib/productsService";
import { ProviderServiceWithDetails } from "@/lib/servicesService";
import { FlashList } from "@shopify/flash-list";
import { useAppRouter } from "@/utils/navigation";
import { ArrowUpDown } from "lucide-react-native";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export const CARD_ESTIMATED_SIZE = 196;
export const CARD_LIST_HEIGHT = 255;

// ─── Skeleton card ────────────────────────────────────────────────────────────
const SkeletonCard = React.memo(function SkeletonCard() {
  return (
    <View
      style={{
        width: 160,
        height: CARD_LIST_HEIGHT,
        borderRadius: 16,
        backgroundColor: "#e5e7eb",
        marginRight: 12,
        overflow: "hidden",
      }}
    >
      {/* Image placeholder */}
      <View style={{ width: "100%", height: 120, backgroundColor: "#d1d5db" }} />
      {/* Text placeholders */}
      <View style={{ padding: 10, gap: 6 }}>
        <View style={{ height: 10, width: "80%", backgroundColor: "#d1d5db", borderRadius: 4 }} />
        <View style={{ height: 10, width: "50%", backgroundColor: "#d1d5db", borderRadius: 4 }} />
        <View style={{ height: 10, width: "60%", backgroundColor: "#d1d5db", borderRadius: 4 }} />
      </View>
    </View>
  );
});

export interface SectionProps {
  title: string;
  items: any[];
  loading?: boolean;
  renderCard: (item: any) => React.ReactElement;
  viewAllRoute: string;
  showTimer?: boolean;
  timerEndTime?: string;
  showEmptyState?: boolean;
  onViewAll: () => void;
}

export const ForYouSection = React.memo(function ForYouSection({
  title,
  items,
  loading,
  renderCard,
  showTimer,
  timerEndTime,
  showEmptyState,
  onViewAll,
}: SectionProps) {
  if (!loading && items.length === 0 && !showEmptyState) return null;

  return (
    <View style={{ marginBottom: 32 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          paddingHorizontal: 16,
        }}
      >
        {loading ? (
          <View style={{ height: 16, width: 100, backgroundColor: "#e5e7eb", borderRadius: 6 }} />
        ) : (
          <Text className="text-lg font-mbold text-gray-800">{title}</Text>
        )}
        {showTimer && timerEndTime && (
          <CountdownTimer endsAt={timerEndTime} compact={false} />
        )}
      </View>

      {loading ? (
        /* Skeleton row */
        <View
          style={{
            flexDirection: "row",
            paddingLeft: 16,
            height: CARD_LIST_HEIGHT,
          }}
        >
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <View
          style={{ paddingHorizontal: 16, paddingVertical: 32, alignItems: "center" }}
        >
          <Text style={{ color: "#6B7280", fontSize: 14 }}>
            No products available at the moment
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16 }}
          style={{ height: CARD_LIST_HEIGHT }}
          bounces={false}
          overScrollMode="never"
          decelerationRate="fast"
          removeClippedSubviews={false}
        >
          {items.map((item) => (
            <View key={item.id}>{renderCard(item)}</View>
          ))}
          <HomeCard isSeeMore onPress={onViewAll} />
        </ScrollView>
      )}
    </View>
  );
});

// Default export kept for any existing usages
export default function ForYou() {
  const router = useAppRouter();
  const {
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
  } = useForYouData();

  const renderClosingSaleCard = useCallback(
    (item: Product) => {
      const discountedPrice = item.discount_percent
        ? item.price - (item.price * item.discount_percent) / 100
        : item.price;
      return (
        <HomeCard
          imageUrl={item.images[0] || "https://via.placeholder.com/140"}
          title={item.name}
          subtitle="FOOD"
          price={`Nu. ${discountedPrice.toLocaleString()}`}
          discountPercent={item.discount_percent}
          isClosingSale
          profileImage={(item as any).profiles?.avatar_url}
          profileName={(item as any).profiles?.name}
          onPress={() => router.push(`/(users)/product/${item.id}` as any)}
        />
      );
    },
    [router],
  );

  const renderFlashDealCard = useCallback(
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
        onPress={() => router.push(`/(users)/product/${product.id}` as any)}
      />
    ),
    [router],
  );

  const renderProductCard = useCallback(
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
          price={displayPrice && displayPrice > 0 ? `Nu. ${displayPrice}` : undefined}
          discountPercent={hasDiscount ? product.discount_percent : undefined}
          isClosingSale={false}
          profileImage={(product as any).profiles?.avatar_url}
          profileName={(product as any).profiles?.name}
          onPress={() => router.push(`/(users)/product/${product.id}` as any)}
        />
      );
    },
    [router],
  );

  const renderServiceCard = useCallback(
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
        onPress={() =>
          router.push(`/(users)/servicedetail/${service.id}` as any)
        }
      />
    ),
    [router],
  );

  const renderMarketplaceCard = useCallback(
    (item: MarketplaceItem) => (
      <HomeCard
        imageUrl={item.images[0] || "https://via.placeholder.com/200"}
        title={item.title}
        subtitle={item.type.replace("_", " ")}
        price={item.price && item.price > 0 ? `Nu. ${item.price}` : undefined}
        location={item.dzongkhag}
        profileImage={(item as any).profiles?.avatar_url}
        profileName={(item as any).profiles?.name}
        onPress={() => router.push(`/(users)/marketplace/${item.id}` as any)}
      />
    ),
    [router],
  );

  const goCategories = useCallback(
    () => router.push("/(users)/categories" as any),
    [router],
  );
  const goServices = useCallback(
    () => router.push("/(users)/services/index" as any),
    [router],
  );
  const goMarketplace = useCallback(
    () => router.push("/(users)/marketplace" as any),
    [router],
  );

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
      <View style={{ marginBottom: 16 }}>
        <ClosingSaleBanner foodItems={closingSaleFoodItems} />
        {isClosingSaleTime && (
          <View style={{ paddingBottom: 16 }}>
            <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
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
                      onPress={() => selectSort(sort)}
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
            {closingSaleFoodItems.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 16 }}
                style={{ height: CARD_LIST_HEIGHT }}
                bounces={false}
                overScrollMode="never"
                decelerationRate="fast"
                removeClippedSubviews={false}
              >
                {closingSaleFoodItems.map((item) => (
                  <View key={item.id}>{renderClosingSaleCard(item)}</View>
                ))}
              </ScrollView>
            )}
          </View>
        )}
      </View>

      {discountedProducts.length > 0 && (
        <ForYouSection
          title="🔥 Flash Deals"
          items={discountedProducts}
          renderCard={renderFlashDealCard}
          viewAllRoute="/(users)/categories"
          onViewAll={goCategories}
        />
      )}

      <ForYouSection
        title="Products"
        items={products}
        renderCard={renderProductCard}
        viewAllRoute="/(users)/categories"
        showEmptyState
        onViewAll={goCategories}
      />

      <ForYouSection
        title="Services"
        items={services}
        renderCard={renderServiceCard}
        viewAllRoute="/(users)/services/index"
        showEmptyState
        onViewAll={goServices}
      />

      <ForYouSection
        title="Marketplace"
        items={marketplaceItems}
        renderCard={renderMarketplaceCard}
        viewAllRoute="/(users)/marketplace"
        showEmptyState
        onViewAll={goMarketplace}
      />
    </View>
  );
}
