// Path: app/(users)/index.tsx

import StaticBanner from "@/components/StaticBanner";
import ClosingSaleBanner from "@/components/ClosingSaleBanner";
import { CARD_LIST_HEIGHT, ForYouSection } from "@/components/ForYou";
import HomeCard from "@/components/HomeCard";
import SearchBar from "@/components/modals/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import { useForYouData, SortOrder } from "@/hooks/useForYouData";
import { useLivestreams } from "@/hooks/useLivestreams";
import { MarketplaceItem } from "@/lib/postMarketPlace";
import { Product } from "@/lib/productsService";
import { ProviderServiceWithDetails } from "@/lib/servicesService";
import { useAppRouter } from "@/utils/navigation";
import {
  ArrowUpDown,
  Briefcase,
  Coins,
  Eye,
  Heart,
  Radio,
  Ticket,
  Tv2,
  Users,
  Video,
} from "lucide-react-native";
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  InteractionManager,
  ListRenderItem,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabType = "foryou" | "featured" | "live" | "bidding" | "norbu";
type LiveFilter = "all" | "business" | "entertainment";

type PageItem =
  | { key: "header" }
  | { key: "closing-sale" }
  | { key: "flash-deals" }
  | { key: "products" }
  | { key: "services" }
  | { key: "marketplace" }
  | { key: "featured" }
  | { key: "live" }
  | { key: "coming-soon"; label: string }
  | { key: "footer" };

const SectionLoadingPlaceholder = React.memo(function SectionLoadingPlaceholder({
  title,
}: {
  title: string;
}) {
  return (
    <View className="px-4 py-4">
      <Text className="text-base font-semibold text-gray-900 mb-3">{title}</Text>
      <View className="bg-white rounded-2xl border border-gray-100 px-4 py-8 items-center">
        <ActivityIndicator size="small" color="#094569" />
        <Text className="text-sm text-gray-500 mt-3">Loading {title.toLowerCase()}...</Text>
      </View>
    </View>
  );
});

const TabContentLoadingState = React.memo(function TabContentLoadingState({
  label,
}: {
  label: string;
}) {
  return (
    <View className="min-h-96 justify-center items-center px-6 py-12">
      <ActivityIndicator size="small" color="#094569" />
      <Text className="text-sm text-gray-500 mt-3">Loading {label.toLowerCase()}...</Text>
    </View>
  );
});

// ─── Memoised tab pills ───────────────────────────────────────────────────────
const TabPills = React.memo(function TabPills({
  activeTab,
  onTabPress,
}: {
  activeTab: TabType;
  onTabPress: (tab: TabType) => void;
}) {
  return (
    <View className="flex-row items-center w-full mx-auto mt-2 gap-2">
      {(
        [
          { key: "foryou",    Icon: Heart,  fill: true },
          { key: "featured",  Icon: Users,  fill: false },
          { key: "live",      Icon: Radio,  fill: false },
          { key: "norbu",     Icon: Coins,  fill: false },
          { key: "bidding",   Icon: Ticket, fill: false },
        ] as { key: TabType; Icon: any; fill: boolean }[]
      ).map(({ key, Icon, fill }) => (
        <TouchableOpacity
          key={key}
          onPress={() => onTabPress(key)}
          className={`flex-1 items-center px-2 py-3 rounded-lg shadow-sm ${
            activeTab === key ? "bg-primary" : "bg-white"
          }`}
        >
          <Icon
            size={20}
            color={activeTab === key ? "white" : "black"}
            fill={fill && activeTab === key ? "white" : "none"}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
});

// ─── Live tab ─────────────────────────────────────────────────────────────────
const LiveTab = React.memo(function LiveTab({
  onOpen,
}: {
  onOpen: (streamId: string) => void;
}) {
  const { livestreams, loading } = useLivestreams();
  const [filter, setFilter] = useState<LiveFilter>("all");

  const filtered =
    filter === "all"
      ? livestreams
      : livestreams.filter((s) => s.stream_type === filter);

  return (
    <View className="mt-4 px-4">
      <View className="flex-row gap-2 mb-4">
        {(["all", "business", "entertainment"] as LiveFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            activeOpacity={0.75}
            className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full ${
              filter === f ? "bg-primary" : "bg-white border border-gray-200"
            }`}
          >
            {f === "all" && <Radio size={13} color={filter === f ? "white" : "#6B7280"} />}
            {f === "business" && <Briefcase size={13} color={filter === f ? "white" : "#6B7280"} />}
            {f === "entertainment" && <Tv2 size={13} color={filter === f ? "white" : "#6B7280"} />}
            <Text className={`text-xs font-semibold ${filter === f ? "text-white" : "text-gray-500"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View className="min-h-64 justify-center items-center">
          <ActivityIndicator size="small" color="#094569" />
        </View>
      ) : filtered.length === 0 ? (
        <View className="min-h-64 justify-center items-center px-6">
          <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center mb-4">
            <Video size={28} color="#EF4444" />
          </View>
          <Text className="text-base font-semibold text-gray-700">No live streams right now</Text>
          <Text className="text-sm text-gray-400 mt-1 text-center">
            Be the first to go live!
          </Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {filtered.map((stream) => (
            <TouchableOpacity
              key={stream.id}
              onPress={() => onOpen(stream.id)}
              activeOpacity={0.85}
              style={{ width: "47%" }}
              className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100"
            >
              <View className="w-full bg-gray-100" style={{ height: 110 }}>
                {(stream.thumbnail || stream.profile_image) ? (
                  <Image
                    source={{ uri: stream.thumbnail || stream.profile_image }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-full bg-primary/10 items-center justify-center">
                    <Text className="text-primary font-bold text-3xl">
                      {(stream.username ?? "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View className="absolute top-2 left-2 bg-red-500 rounded px-1.5 py-0.5" style={{ borderWidth: 1, borderColor: "white" }}>
                  <Text className="text-white text-[9px] font-black">LIVE</Text>
                </View>
                <View className="absolute bottom-2 right-2 bg-black/50 rounded-full px-2 py-0.5 flex-row items-center gap-1">
                  <Eye size={10} color="white" />
                  <Text className="text-white text-[9px] font-semibold">{stream.viewer_count ?? 0}</Text>
                </View>
              </View>
              <View className="px-2.5 py-2 flex-row items-center gap-2">
                <View className="w-7 h-7 rounded-full bg-primary items-center justify-center">
                  <Text className="text-white font-bold text-xs">
                    {(stream.username ?? "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-semibold text-gray-800" numberOfLines={1}>
                    {stream.username ?? "Unknown"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useAppRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("foryou");
  const [renderedTab, setRenderedTab] = useState<TabType>("foryou");
  const [isTabContentPending, setIsTabContentPending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showLive, setShowLive] = useState(false);
  const [FeaturedSellersComponent, setFeaturedSellersComponent] = useState<React.ComponentType | null>(null);
  const [liveStreamId, setLiveStreamId] = useState<string | undefined>();
  const [LiveScrollScreen, setLiveScrollScreen] = useState<React.ComponentType<{
    initialStreamId?: string;
    onClose: () => void;
  }> | null>(null);
  const [liveScreenLoading, setLiveScreenLoading] = useState(false);

  useEffect(() => {
    if (showLive && !LiveScrollScreen && !liveScreenLoading) {
      setLiveScreenLoading(true);
      import("@/components/livestream/LiveScrollScreen")
        .then((m) => { setLiveScrollScreen(() => m.default); setLiveScreenLoading(false); })
        .catch(() => setLiveScreenLoading(false));
    }
  }, [showLive, LiveScrollScreen, liveScreenLoading]);

  useEffect(() => {
    if (activeTab === renderedTab) {
      setIsTabContentPending(false);
      return;
    }

    let cancelled = false;
    setIsTabContentPending(true);

    const task = InteractionManager.runAfterInteractions(() => {
      const loadTabDependencies = async () => {
        if (activeTab === "featured" && !FeaturedSellersComponent) {
          const module = await import("@/components/FeaturedSellers");
          if (!cancelled) {
            setFeaturedSellersComponent(() => module.default);
          }
        }
      };

      loadTabDependencies()
        .catch((error) => {
          console.error("Failed to prepare tab content:", error);
        })
        .finally(() => {
          if (cancelled) return;
          startTransition(() => {
            setRenderedTab(activeTab);
            setIsTabContentPending(false);
          });
        });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [activeTab, renderedTab, FeaturedSellersComponent]);

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
    reload,
  } = useForYouData();

  const handleTabPress = useCallback((tab: TabType) => {
    setActiveTab(tab);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    await reload();
    setRefreshing(false);
  }, [reload]);

  // ─── Stable card render callbacks ────────────────────────────────────────

  const renderClosingSaleCard = useCallback((item: Product) => {
    const dp = item.discount_percent
      ? item.price - (item.price * item.discount_percent) / 100
      : item.price;
    return (
      <HomeCard
        imageUrl={item.images[0] || ""}
        title={item.name} subtitle="FOOD"
        price={`Nu. ${dp.toLocaleString()}`}
        discountPercent={item.discount_percent} isClosingSale
        profileImage={(item as any).profiles?.avatar_url}
        profileName={(item as any).profiles?.name}
        isVerified={(item as any).isVerified}
        onPress={() => router.push(`/(users)/product/${item.id}` as any)}
      />
    );
  }, [router]);

  const renderFlashDealCard = useCallback((product: Product) => (
    <HomeCard
      imageUrl={product.images[0] || ""}
      title={product.name}
      subtitle={product.category?.toUpperCase() || "PRODUCT"}
      price={product.current_price && product.current_price > 0 ? `Nu. ${product.current_price}` : undefined}
      discountPercent={product.discount_percent} isClosingSale={false}
      profileImage={(product as any).profiles?.avatar_url}
      profileName={(product as any).profiles?.name}
      isVerified={(product as any).isVerified}
      onPress={() => router.push(`/(users)/product/${product.id}` as any)}
    />
  ), [router]);

  const renderProductCard = useCallback((product: Product) => {
    const isFoodSale = product.category === "food" && product.is_discount_active;
    const price = isFoodSale ? product.price : product.current_price || product.price;
    const hasDiscount = product.is_currently_active && product.discount_percent && !isFoodSale;
    return (
      <HomeCard
        imageUrl={product.images[0] || ""}
        title={product.name}
        subtitle={product.category?.toUpperCase() || "PRODUCT"}
        price={price && price > 0 ? `Nu. ${price}` : undefined}
        discountPercent={hasDiscount ? product.discount_percent : undefined}
        isClosingSale={false}
        profileImage={(product as any).profiles?.avatar_url}
        profileName={(product as any).profiles?.name}
        isVerified={(product as any).isVerified}
        onPress={() => router.push(`/(users)/product/${product.id}` as any)}
      />
    );
  }, [router]);

  const renderServiceCard = useCallback((service: ProviderServiceWithDetails) => (
    <HomeCard
      imageUrl={service.images[0] || ""}
      title={service.name}
      subtitle={service.service_categories?.name || "Service"}
      profileImage={service.service_providers?.profile_url || service.service_providers?.profiles?.avatar_url}
      profileName={service.service_providers?.name || service.service_providers?.profiles?.name}
      isVerified={(service.service_providers as any)?.verification_status === "verified"}
      onPress={() => router.push(`/(users)/servicedetail/${service.id}` as any)}
    />
  ), [router]);

  const renderMarketplaceCard = useCallback((item: MarketplaceItem) => (
    <HomeCard
      imageUrl={item.images[0] || ""}
      title={item.title}
      subtitle={item.type.replace("_", " ")}
      price={item.price && item.price > 0 ? `Nu. ${item.price}` : undefined}
      location={item.dzongkhag}
      profileImage={(item as any).profiles?.avatar_url}
      profileName={(item as any).profiles?.name}
      isVerified={item.isVerified}
      onPress={() => router.push(`/(users)/marketplace/${item.id}` as any)}
    />
  ), [router]);

  const goCategories = useCallback(() => router.push("/(users)/(tabs)/categories" as any), [router]);
  const goServices   = useCallback(() => router.push("/(users)/(tabs)/services" as any), [router]);
  const goMarketplace = useCallback(() => router.push("/(users)/(tabs)/marketplace" as any), [router]);

  // ─── Flat items list ──────────────────────────────────────────────────────
  const hasFlashDeals = !loading && discountedProducts.length > 0;
  const items = useMemo<PageItem[]>(() => {
    const result: PageItem[] = [{ key: "header" }];
    switch (activeTab) {
      case "foryou":
        result.push({ key: "closing-sale" });
        if (hasFlashDeals) result.push({ key: "flash-deals" });
        result.push({ key: "products" });
        result.push({ key: "services" });
        result.push({ key: "marketplace" });
        break;
      case "featured": result.push({ key: "featured" }); break;
      case "live":     result.push({ key: "live" }); break;
      case "norbu":    result.push({ key: "coming-soon", label: "Norbu Coin" }); break;
      case "bidding":  result.push({ key: "coming-soon", label: "Bidding" }); break;
    }
    result.push({ key: "footer" });
    return result;
  }, [activeTab, hasFlashDeals]);

  // Use ref to always have latest data in renderItem without changing its reference
  const dataRef = useRef({
    products, marketplaceItems, services, loading,
    isClosingSaleTime, sortOrder, showSortMenu,
    closingSaleFoodItems, discountedProducts,
    activeTab, renderedTab, isTabContentPending, searchQuery, refreshKey,
    renderClosingSaleCard, renderFlashDealCard, renderProductCard,
    renderServiceCard, renderMarketplaceCard,
    goCategories, goServices, goMarketplace,
    toggleSortMenu, selectSort, getSortLabel,
    FeaturedSellersComponent,
  });
  dataRef.current = {
    products, marketplaceItems, services, loading,
    isClosingSaleTime, sortOrder, showSortMenu,
    closingSaleFoodItems, discountedProducts,
    activeTab, renderedTab, isTabContentPending, searchQuery, refreshKey,
    renderClosingSaleCard, renderFlashDealCard, renderProductCard,
    renderServiceCard, renderMarketplaceCard,
    goCategories, goServices, goMarketplace,
    toggleSortMenu, selectSort, getSortLabel,
    FeaturedSellersComponent,
  };

  const renderItem = useCallback<ListRenderItem<PageItem>>(({ item }) => {
    const d = dataRef.current;
    const isCurrentTabReady = !d.isTabContentPending && d.renderedTab === d.activeTab;

    switch (item.key) {
      case "header":
        return (
          <View>
            <TopNavbar />
            <View className="px-4 gap-2">
              <SearchBar value={d.searchQuery} onChangeText={(t) => setSearchQuery(t)} />
              <StaticBanner />
              <TabPills activeTab={d.activeTab} onTabPress={handleTabPress} />
            </View>
          </View>
        );

      case "closing-sale":
        if (!isCurrentTabReady) {
          return <SectionLoadingPlaceholder title="Closing Sale" />;
        }
        return (
          <View style={{ marginBottom: 16, paddingTop: 8 }}>
            {d.isClosingSaleTime ? (
              /* ── Connected: banner + cards share one bordered container ── */
              <View
                style={{
                  marginHorizontal: 16,
                  borderWidth: 1.5,
                  borderColor: "#F59E0B",
                  borderRadius: 16,
                }}
              >
                {/* Top: gradient banner — clip only the top corners */}
                <View
                  style={{
                    borderTopLeftRadius: 14,
                    borderTopRightRadius: 14,
                    overflow: "hidden",
                  }}
                >
                  <ClosingSaleBanner
                    foodItems={d.closingSaleFoodItems}
                    connected
                  />
                </View>

                {/* Bottom: sort + cards — no background, shares the border */}
                <View style={{ paddingBottom: 14 }}>
                  {d.closingSaleFoodItems.length > 0 ? (
                    <>
                      <View style={{ paddingHorizontal: 14, marginTop: 10, marginBottom: 8 }}>
                        <TouchableOpacity
                          onPress={d.toggleSortMenu}
                          className="bg-white/90 px-3 py-2 rounded-xl shadow-sm border border-white/50 flex-row items-center self-start"
                          style={{ backgroundColor: "rgba(255,255,255,0.9)" }}
                        >
                          <ArrowUpDown size={16} color="#1F2937" />
                          <Text className="ml-1.5 text-xs font-semibold text-gray-700">
                            {d.getSortLabel(d.sortOrder)}
                          </Text>
                        </TouchableOpacity>
                        {d.showSortMenu && (
                          <View className="mt-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                            {(["latest","oldest","high_discount","low_discount","high_price","low_price"] as SortOrder[]).map((sort) => (
                              <TouchableOpacity
                                key={sort}
                                onPress={() => d.selectSort(sort)}
                                className={`p-3 border-b border-gray-100 ${d.sortOrder === sort ? "bg-primary/10" : ""}`}
                              >
                                <Text className={`text-sm font-medium ${d.sortOrder === sort ? "text-primary" : "text-gray-700"}`}>
                                  {d.getSortLabel(sort)}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                      <ScrollView
                        horizontal showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingLeft: 14, paddingRight: 14 }}
                        style={{ height: CARD_LIST_HEIGHT }}
                        bounces={false} overScrollMode="never" decelerationRate="fast"
                      >
                        {d.closingSaleFoodItems.map((c) => (
                          <View key={c.id}>{d.renderClosingSaleCard(c)}</View>
                        ))}
                      </ScrollView>
                    </>
                  ) : (
                    <View style={{ paddingHorizontal: 14, paddingVertical: 20, alignItems: "center" }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#9CA3AF" }}>
                        No items on sale right now
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ) : (
              /* ── Dormant: standalone banner, no connected border ── */
              <ClosingSaleBanner foodItems={d.closingSaleFoodItems} />
            )}
          </View>
        );

      case "flash-deals":
        if (!isCurrentTabReady) {
          return <SectionLoadingPlaceholder title="Flash Deals" />;
        }
        return (
          <ForYouSection
            title="🔥 Flash Deals"
            items={d.discountedProducts}
            loading={d.loading}
            renderCard={d.renderFlashDealCard}
            viewAllRoute="/(users)/(tabs)/categories"
            onViewAll={d.goCategories}
          />
        );

      case "products":
        if (!isCurrentTabReady) {
          return <SectionLoadingPlaceholder title="Products" />;
        }
        return (
          <ForYouSection
            title="Products"
            items={d.products}
            loading={d.loading}
            renderCard={d.renderProductCard}
            viewAllRoute="/(users)/(tabs)/categories"
            showEmptyState
            onViewAll={d.goCategories}
          />
        );

      case "services":
        if (!isCurrentTabReady) {
          return <SectionLoadingPlaceholder title="Services" />;
        }
        return (
          <ForYouSection
            title="Services"
            items={d.services}
            loading={d.loading}
            renderCard={d.renderServiceCard}
            viewAllRoute="/(users)/(tabs)/services"
            showEmptyState
            onViewAll={d.goServices}
          />
        );

      case "marketplace":
        if (!isCurrentTabReady) {
          return <SectionLoadingPlaceholder title="Marketplace" />;
        }
        return (
          <ForYouSection
            title="Marketplace"
            items={d.marketplaceItems}
            loading={d.loading}
            renderCard={d.renderMarketplaceCard}
            viewAllRoute="/(users)/(tabs)/marketplace"
            showEmptyState
            onViewAll={d.goMarketplace}
          />
        );

      case "featured": {
        if (!isCurrentTabReady || !d.FeaturedSellersComponent) {
          return <TabContentLoadingState label="Featured sellers" />;
        }
        const FeaturedSellers = d.FeaturedSellersComponent;
        return (
          <View className="mt-2 px-4">
            <FeaturedSellers key={`featured-${d.refreshKey}`} />
          </View>
        );
      }

      case "live":
        if (!isCurrentTabReady) {
          return <TabContentLoadingState label="Live streams" />;
        }
        return (
          <LiveTab onOpen={(id) => { setLiveStreamId(id); setShowLive(true); }} />
        );

      case "coming-soon":
        if (!isCurrentTabReady) {
          return <TabContentLoadingState label={item.label} />;
        }
        return (
          <View className="mt-6 min-h-96 justify-center items-center">
            <Text className="text-base font-semibold text-primary mb-2">
              {item.label} (Coming Soon)
            </Text>
          </View>
        );

      case "footer":
        return <View style={{ height: 40 }} />;

      default:
        return null;
    }
  }, [handleTabPress]);
  // renderItem is intentionally stable — it reads live data via dataRef

  return (
    <>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: 72 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        windowSize={5}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
        removeClippedSubviews={true}
        overScrollMode="never"
        bounces={true}
        extraData={`${activeTab}-${renderedTab}-${isTabContentPending}-${refreshKey}`}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#094569"]}
            tintColor="#094569"
          />
        }
      />

      {showLive && (
        <Modal
          visible={showLive}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowLive(false)}
        >
          {LiveScrollScreen ? (
            <LiveScrollScreen
              initialStreamId={liveStreamId}
              onClose={() => setShowLive(false)}
            />
          ) : (
            <View className="flex-1 bg-black items-center justify-center">
              <ActivityIndicator size="large" color="white" />
            </View>
          )}
        </Modal>
      )}
    </>
  );
}
