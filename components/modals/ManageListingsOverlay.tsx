import CountdownTimer from "@/components/CountdownTimer";
import EditMarketplaceModal from "@/components/modals/EditMarketplaceModal";
import EditProductModal from "@/components/modals/EditProductModal";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import {
  fetchUserMarketplaceItems,
  MarketplaceItem,
} from "@/lib/postMarketPlace";
import { fetchUserProducts, Product } from "@/lib/productsService";
import { supabase } from "@/lib/supabase";
import { FlashList } from "@shopify/flash-list";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ArrowUpDown,
  Bookmark,
  CheckCircle2,
  Edit3,
  Eye,
  Package,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeOutDown,
  FadeOutLeft,
  Layout,
} from "react-native-reanimated";

interface BookmarkedItem {
  id: string;
  product_id?: string;
  marketplace_id?: string;
  created_at: string;
  products?: {
    id: string;
    name: string;
    price: number;
    images: string[];
  };
  marketplace?: {
    id: string;
    title: string;
    price: number;
    images: string[];
    type: string;
  };
}

interface ManageListingsOverlayProps {
  onClose: () => void;
  userId: string;
}

type TabType = "products" | "marketplace" | "bookmarks" | "edit";
type SortOrder = "latest" | "oldest";

export default function ManageListingsOverlay({
  onClose,
  userId,
}: ManageListingsOverlayProps) {
  const router = useRouter();

  // States
  const [activeTab, setActiveTab] = useState<TabType>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>(
    [],
  );
  const [bookmarks, setBookmarks] = useState<BookmarkedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");

  // Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Edit States
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [marketplaceItemToEdit, setMarketplaceItemToEdit] =
    useState<MarketplaceItem | null>(null);
  const [previousTab, setPreviousTab] = useState<TabType>("products");

  useEffect(() => {
    loadData();
  }, [userId]);

  // Reset selection when switching tabs
  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    setIsSelectionMode(false);
    setSelectedIds([]);
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortOrder((prev) => (prev === "latest" ? "oldest" : "latest"));
  };

  // Edit handlers
  const handleEditProduct = (product: Product) => {
    setPreviousTab(activeTab); // Remember current tab (usually 'products')
    setProductToEdit(product);
    setActiveTab("edit"); // Switch to hidden edit tab
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleEditMarketplaceItem = (item: MarketplaceItem) => {
    setPreviousTab(activeTab); // Remember current tab (usually 'marketplace')
    setMarketplaceItemToEdit(item);
    setActiveTab("edit"); // Switch to hidden edit tab
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleExitEdit = () => {
    setActiveTab(previousTab); // Return to previous tab
    setProductToEdit(null);
    setMarketplaceItemToEdit(null); // Reset marketplace edit state
    loadData(); // Refresh data
  };

  const loadData = async () => {
    try {
      if (!refreshing) setLoading(true);
      const [productsData, marketplaceData, { data: bookmarksData }] =
        await Promise.all([
          fetchUserProducts(userId),
          fetchUserMarketplaceItems(userId),
          supabase
            .from("user_bookmarks")
            .select(
              `
            id,
            product_id,
            marketplace_id,
            created_at,
            products (id, name, price, images),
            marketplace (id, title, price, images, type)
          `,
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
        ]);

      // Debug: Log products with discount info
      console.log(
        "ManageListingsOverlay loaded products:",
        productsData?.map((p) => ({
          name: p.name,
          is_currently_active: p.is_currently_active,
          discount_percent: p.discount_percent,
          current_price: p.current_price,
        })),
      );

      setProducts(productsData || []);
      setMarketplaceItems(marketplaceData || []);

      const formattedBookmarks = (bookmarksData as any[])
        ?.map((item) => ({
          ...item,
          products: item.products
            ? Array.isArray(item.products)
              ? item.products[0]
              : item.products
            : null,
          marketplace: item.marketplace
            ? Array.isArray(item.marketplace)
              ? item.marketplace[0]
              : item.marketplace
            : null,
        }))
        .filter(
          (item) => item.products || item.marketplace,
        ) as BookmarkedItem[];

      setBookmarks(formattedBookmarks);
    } catch (error) {
      console.error("Error loading listings:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  // --- SELECTION LOGIC ---

  const toggleSelection = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleLongPress = (id: string) => {
    if (!isSelectionMode) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIsSelectionMode(true);
      setSelectedIds([id]);
    }
  };

  const handleDeleteSelected = () => {
    const tabName =
      activeTab === "products"
        ? "Products"
        : activeTab === "marketplace"
          ? "Listings"
          : "Bookmarks";

    Alert.alert(
      `Delete ${tabName}`,
      `Are you sure you want to remove ${selectedIds.length} items? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const table =
              activeTab === "products"
                ? "products"
                : activeTab === "marketplace"
                  ? "marketplace"
                  : "user_bookmarks";

            const { error } = await supabase
              .from(table)
              .delete()
              .in("id", selectedIds);

            if (!error) {
              if (activeTab === "products")
                setProducts((p) =>
                  p.filter((i) => !selectedIds.includes(i.id)),
                );
              if (activeTab === "marketplace")
                setMarketplaceItems((m) =>
                  m.filter((i) => !selectedIds.includes(i.id)),
                );
              if (activeTab === "bookmarks")
                setBookmarks((b) =>
                  b.filter((i) => !selectedIds.includes(i.id)),
                );

              setIsSelectionMode(false);
              setSelectedIds([]);
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            }
          },
        },
      ],
    );
  };

  // --- RENDER ITEM ---

  const renderItem = ({ item }: { item: any }) => {
    const isSelected = selectedIds.includes(item.id);

    // Normalize data based on tab type
    const title =
      item.name || item.title || item.products?.name || item.marketplace?.title;
    const price = item.price || item.products?.price || item.marketplace?.price;
    const image =
      item.images?.[0] ||
      item.products?.images?.[0] ||
      item.marketplace?.images?.[0];
    const typeLabel = item.type || item.marketplace?.type; // For marketplace (rent/secondhand)

    return (
      <Animated.View
        entering={FadeInRight}
        exiting={FadeOutLeft}
        layout={Layout.springify()}
        className="px-4 mb-3"
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => handleLongPress(item.id)}
          onPress={() => (isSelectionMode ? toggleSelection(item.id) : null)}
          className={`flex-row items-center bg-white rounded-[24px] p-3 shadow-sm border-2 ${
            isSelected ? "border-primary bg-blue-50/50" : "border-transparent"
          }`}
        >
          {/* Image */}
          <View className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100">
            <ImageWithFallback
              source={{ uri: image || "" }}
              className="w-full h-full"
              resizeMode="cover"
            />
            {isSelected && (
              <View className="absolute inset-0 bg-primary/30 items-center justify-center">
                <CheckCircle2 color="white" size={28} strokeWidth={3} />
              </View>
            )}
          </View>

          {/* Details */}
          <View className="flex-1 ml-4">
            {typeLabel && (
              <Text className="text-[10px] font-mbold text-primary uppercase tracking-tighter mb-0.5">
                {typeLabel}
              </Text>
            )}
            <Text
              className="text-gray-900 font-msemibold text-base"
              numberOfLines={1}
            >
              {title}
            </Text>

            {/* Price with Discount Info - only for products tab */}
            {activeTab === "products" && item.is_currently_active ? (
              <View className="gap-1">
                {/* Conditional Badge: Closing Sale (Food) vs Discount (Non-Food) */}
                {item.category === "food" ? (
                  <View className="bg-amber-500 px-1.5 py-0.5 rounded self-start flex-row items-center gap-1">
                    <Text className="text-white text-[10px]">🌙</Text>
                    <Text className="text-white text-[10px] font-bold">
                      CLOSING SALE -{item.discount_percent}%
                    </Text>
                  </View>
                ) : (
                  <View className="bg-green-500 px-1.5 py-0.5 rounded self-start">
                    <Text className="text-white text-[10px] font-bold">
                      -{item.discount_percent}% OFF
                    </Text>
                  </View>
                )}

                {/* Prices in one row */}
                <View className="flex-row items-center gap-2 flex-wrap">
                  <Text className="text-xs text-gray-400 line-through">
                    Nu. {item.price?.toLocaleString()}
                  </Text>
                  <Text
                    className={`text-base font-mbold ${item.category === "food" ? "text-amber-600" : "text-primary"}`}
                  >
                    Nu. {item.current_price?.toLocaleString()}
                  </Text>
                </View>

                {/* Countdown Timer */}
                <CountdownTimer endsAt={item.discount_ends_at} compact={true} />
              </View>
            ) : (
              <Text className="text-primary font-mbold text-lg">
                Nu. {price?.toLocaleString()}
              </Text>
            )}
          </View>

          {/* Regular Action Buttons */}
          {!isSelectionMode && (
            <View className="flex-row items-center gap-x-2">
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  let path;
                  if (activeTab === "marketplace") {
                    path = `/(users)/marketplace/${item.id}`;
                  } else if (activeTab === "bookmarks") {
                    // For bookmarks, check if it's a product or marketplace item
                    if (item.product_id) {
                      path = `/(users)/product/${item.product_id}`;
                    } else if (item.marketplace_id) {
                      path = `/(users)/marketplace/${item.marketplace_id}`;
                    }
                  } else {
                    path = `/(users)/product/${item.id}`;
                  }
                  router.push(path as any);
                }}
                className="w-9 h-9 bg-gray-50 items-center justify-center rounded-full border border-gray-100"
              >
                <Eye size={16} color="#4B5563" />
              </TouchableOpacity>
              {activeTab === "products" && (
                <TouchableOpacity
                  onPress={() => handleEditProduct(item)}
                  className="w-9 h-9 bg-gray-50 items-center justify-center rounded-full border border-gray-100"
                >
                  <Edit3 size={16} color="#4B5563" />
                </TouchableOpacity>
              )}
              {activeTab === "marketplace" && (
                <TouchableOpacity
                  onPress={() => handleEditMarketplaceItem(item)}
                  className="w-9 h-9 bg-gray-50 items-center justify-center rounded-full border border-gray-100"
                >
                  <Edit3 size={16} color="#4B5563" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Memoize data for the FlashList with sorting
  const currentListData = useMemo(() => {
    let data: any[] = [];
    if (activeTab === "products") data = [...products];
    else if (activeTab === "marketplace") data = [...marketplaceItems];
    else data = [...bookmarks];

    // Sort by created_at
    return data.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "latest" ? dateB - dateA : dateA - dateB;
    });
  }, [activeTab, products, marketplaceItems, bookmarks, sortOrder]);

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      {/* Premium Header */}
      <BlurView
        intensity={90}
        tint="light"
        className="pt-14 pb-2 z-10 border-b border-gray-200/50"
      >
        <View className="flex-row items-center justify-between px-6 mb-4">
          <View>
            <Text className="text-2xl font-mbold text-gray-900">
              {isSelectionMode
                ? `${selectedIds.length} Selected`
                : "My Listings"}
            </Text>
            {!isSelectionMode && (
              <Text className="text-gray-500 text-xs font-mregular">
                Manage your items and saves
              </Text>
            )}
          </View>
          <View className="flex-row items-center gap-x-2">
            {!isSelectionMode && (
              <TouchableOpacity
                onPress={toggleSortOrder}
                className="bg-white p-2 rounded-full shadow-sm border border-gray-100"
              >
                <View className="flex-row items-center gap-x-1">
                  <ArrowUpDown size={16} color="#1F2937" />
                  <Text className="text-xs font-msemibold text-gray-700">
                    {sortOrder === "latest" ? "Latest" : "Oldest"}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={
                isSelectionMode
                  ? () => {
                      setIsSelectionMode(false);
                      setSelectedIds([]);
                    }
                  : onClose
              }
              className="bg-white p-2 rounded-full shadow-sm border border-gray-100"
            >
              <X size={20} color="#1F2937" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Bar - hidden when editing */}
        {activeTab !== "edit" && (
          <View className="flex-row px-4 pb-2 gap-x-2">
            {[
              {
                id: "products",
                label: "Products",
                icon: Package,
                count: products.length,
              },
              {
                id: "marketplace",
                label: "Market",
                icon: ShoppingBag,
                count: marketplaceItems.length,
              },
              {
                id: "bookmarks",
                label: "Saves",
                icon: Bookmark,
                count: bookmarks.length,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isTabActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => handleTabChange(tab.id as TabType)}
                  className={`flex-1 flex-row items-center justify-center py-2.5 rounded-2xl border ${
                    isTabActive
                      ? "bg-primary border-primary"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <Icon size={14} color={isTabActive ? "white" : "#64748B"} />
                  <Text
                    className={`ml-2 text-[11px] font-mbold ${isTabActive ? "text-white" : "text-gray-500"}`}
                  >
                    {tab.label} ({tab.count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Back button - shown when editing */}
        {activeTab === "edit" && (
          <View className="px-4 pb-2">
            <TouchableOpacity
              onPress={handleExitEdit}
              className="flex-row items-center bg-white py-2.5 px-4 rounded-2xl border border-gray-200"
            >
              <ArrowLeft size={18} color="#1F2937" />
              <Text className="text-gray-700 font-msemibold ml-2">
                Back to Products
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </BlurView>

      {/* Main List - hidden when editing */}
      {activeTab !== "edit" && (
        <View className="flex-1">
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#094569" />
            </View>
          ) : (
            <FlashList
              data={currentListData}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: 20, paddingBottom: 150 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#094569"
                />
              }
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center pt-32 px-10">
                  <View className="w-16 h-16 bg-gray-100 rounded-full items-center justify-center mb-4">
                    <Package size={28} color="#94A3B8" />
                  </View>
                  <Text className="text-gray-800 font-mbold text-lg">
                    Nothing here yet
                  </Text>
                  <Text className="text-gray-500 text-center mt-2 font-mregular">
                    Items in this category will appear here.
                  </Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Context-Aware Floating Deletion Bar */}
      {isSelectionMode && (
        <Animated.View
          entering={FadeInDown.duration(400)}
          exiting={FadeOutDown}
          className="absolute bottom-10 left-6 right-6 h-20 bg-gray-900 rounded-[35px] flex-row items-center justify-between px-8 shadow-2xl"
        >
          <View>
            <Text className="text-white font-mbold text-lg">
              {selectedIds.length}
            </Text>
            <Text className="text-gray-400 text-[10px] uppercase tracking-widest font-mbold">
              Selected {activeTab}
            </Text>
          </View>
          <View className="flex-row items-center gap-x-4">
            <TouchableOpacity
              onPress={() => {
                setIsSelectionMode(false);
                setSelectedIds([]);
              }}
            >
              <Text className="text-gray-400 font-msemibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleDeleteSelected}
              className="bg-red-500 flex-row items-center px-6 py-3 rounded-full"
            >
              <Trash2 size={18} color="white" />
              <Text className="text-white font-mbold ml-2">Delete</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Edit Product Modal - Shows when activeTab is 'edit' */}
      {activeTab === "edit" && productToEdit && (
        <EditProductModal
          isVisible={true}
          onClose={handleExitEdit}
          product={productToEdit}
          userId={userId}
          onSuccess={handleExitEdit}
        />
      )}

      {/* Edit Marketplace Modal - Shows when activeTab is 'edit' */}
      {activeTab === "edit" && marketplaceItemToEdit && (
        <EditMarketplaceModal
          isVisible={true}
          onClose={handleExitEdit}
          item={marketplaceItemToEdit}
          userId={userId}
          onSuccess={handleExitEdit}
        />
      )}
    </View>
  );
}
