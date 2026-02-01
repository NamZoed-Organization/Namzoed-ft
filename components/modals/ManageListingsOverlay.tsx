import CountdownTimer from "@/components/CountdownTimer";
import EditMarketplaceModal from "@/components/modals/EditMarketplaceModal";
import EditProductModal from "@/components/modals/EditProductModal";
import ImageViewer from "@/components/modals/ImageViewer";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import {
  fetchUserMarketplaceItems,
  MarketplaceItem,
} from "@/lib/postMarketPlace";
import { fetchUserProducts, Product } from "@/lib/productsService";
import { supabase } from "@/lib/supabase";
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
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

interface BookmarkedItem {
  id: string;
  product_id?: string;
  marketplace_id?: string;
  post_id?: string;
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
  posts?: {
    id: string;
    content: string;
    images: string[];
    likes: number;
    comments: number;
    user_id: string;
    profiles?: {
      full_name: string;
    };
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

  // Image Viewer States
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

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
      const [productsData, marketplaceData, { data: bookmarksData, error: bookmarksError }] =
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
            post_id,
            created_at,
            products (id, name, price, images, category),
            marketplace (id, title, price, images, type),
            posts (id, content, images, likes, comments, user_id, profiles:user_id (name))
          `,
            )
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
        ]);

      // Debug logging
      console.log("📚 Raw bookmarks data:", bookmarksData);
      console.log("❌ Bookmarks error:", bookmarksError);
      console.log("👤 User ID:", userId);

      setProducts(productsData || []);
      setMarketplaceItems(marketplaceData || []);

      const formattedBookmarks = ((bookmarksData as any[]) || [])
        .map((item) => ({
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
          posts: item.posts
            ? Array.isArray(item.posts)
              ? item.posts[0]
              : item.posts
            : null,
        }))
        .filter(
          (item) => item.products || item.marketplace || item.posts,
        ) as BookmarkedItem[];

      console.log("✅ Formatted bookmarks:", formattedBookmarks);
      console.log("📊 Bookmark count:", formattedBookmarks.length);

      setBookmarks(formattedBookmarks || []);
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

  // Memoized ListItem component to prevent unnecessary re-renders
  const ListItem = React.memo(({
    item,
    isSelected,
    onLongPress,
    onPress
  }: {
    item: any;
    isSelected: boolean;
    onLongPress: () => void;
    onPress: () => void;
  }) => {
    // Handle category headers
    if (item.type === "category_header") {
      return (
        <View className="px-4 py-3 mt-2">
          <Text className="text-sm font-mbold text-gray-700 uppercase tracking-wider">
            {item.category.replace("-", " & ")}
          </Text>
        </View>
      );
    }

    // Normalize data
    const isPost = !!item.posts || !!item.post_id;
    const title = item.name || item.title || item.products?.name || item.marketplace?.title ||
                  (item.posts?.content ? item.posts.content.substring(0, 50) + (item.posts.content.length > 50 ? "..." : "") : "Post");
    const price = item.price || item.products?.price || item.marketplace?.price;
    const image = item.images?.[0] || item.products?.images?.[0] || item.marketplace?.images?.[0] || item.posts?.images?.[0];
    const typeLabel = item.type || item.marketplace?.type;
    const hasActiveDiscount = activeTab === "products" && item.is_currently_active;
    const isFood = item.category === "food";
    const postUsername = item.posts?.profiles?.name || "Unknown User";

    return (
      <View className="px-4 mb-3">
        <TouchableOpacity
          activeOpacity={0.7}
          onLongPress={onLongPress}
          onPress={onPress}
          className={`flex-row items-center bg-white rounded-xl p-3 border ${
            isSelected ? "border-primary bg-blue-50" : "border-gray-200"
          }`}
        >
          {/* Image */}
          <View className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
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
            {/* Type label for marketplace or post */}
            {isPost ? (
              <Text className="text-[10px] font-mbold text-pink-600 uppercase tracking-tighter mb-0.5">
                POST
              </Text>
            ) : typeLabel && (activeTab === "marketplace" || (activeTab === "bookmarks" && item.marketplace)) ? (
              <Text className="text-[10px] font-mbold text-primary uppercase tracking-tighter mb-0.5">
                {typeLabel}
              </Text>
            ) : null}
            <Text className="text-gray-900 font-msemibold text-lg" numberOfLines={1}>
              {title}
            </Text>

            {/* Price with Discount Info or Post Info */}
            {isPost ? (
              <Text className="text-gray-500 text-sm mt-0.5">
                by {postUsername}
              </Text>
            ) : hasActiveDiscount ? (
              <View className="gap-1">
                {/* Badge */}
                <View className={`${isFood ? "bg-amber-500" : "bg-green-500"} px-1.5 py-0.5 rounded self-start ${isFood ? "flex-row items-center gap-1" : ""}`}>
                  {isFood && <Text className="text-white text-[10px]">🌙</Text>}
                  <Text className="text-white text-[10px] font-bold">
                    {isFood ? `CLOSING SALE -${item.discount_percent}%` : `-${item.discount_percent}% OFF`}
                  </Text>
                </View>

                {/* Prices */}
                <View className="flex-row items-center gap-2">
                  <Text className="text-xs text-gray-400 line-through">
                    Nu. {item.price?.toLocaleString()}
                  </Text>
                  <Text className={`text-base font-mbold ${isFood ? "text-amber-600" : "text-primary"}`}>
                    Nu. {item.current_price?.toLocaleString()}
                  </Text>
                </View>

                {/* Countdown - Isolated to prevent re-render cascade */}
                <CountdownTimer endsAt={item.discount_ends_at} compact={true} />
              </View>
            ) : (
              <Text className="text-primary font-mbold text-lg">
                Nu. {price?.toLocaleString()}
              </Text>
            )}
          </View>

          {/* Action Buttons */}
          {!isSelectionMode && (
            <View className="flex-row items-center gap-x-2">
              <TouchableOpacity
                onPress={() => {
                  // Handle posts differently - open ImageViewer
                  if (isPost && item.posts) {
                    setSelectedPost({
                      id: item.posts.id,
                      user_id: item.posts.user_id,
                      content: item.posts.content,
                      images: item.posts.images || [],
                      likes: item.posts.likes || 0,
                      comments: item.posts.comments || 0,
                      userName: postUsername,
                    });
                    setShowImageViewer(true);
                    return;
                  }

                  // Handle products and marketplace items
                  onClose();
                  let path;
                  if (activeTab === "marketplace") {
                    path = `/(users)/marketplace/${item.id}`;
                  } else if (activeTab === "bookmarks") {
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
      </View>
    );
  });

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const isSelected = selectedIds.includes(item.id);
      return (
        <ListItem
          item={item}
          isSelected={isSelected}
          onLongPress={() => handleLongPress(item.id)}
          onPress={() => (isSelectionMode ? toggleSelection(item.id) : null)}
        />
      );
    },
    [
      selectedIds,
      isSelectionMode,
      handleLongPress,
      toggleSelection,
    ],
  );

  // Memoize data for the FlashList with sorting and grouping
  const currentListData = useMemo(() => {
    let data: any[] = [];
    if (activeTab === "products") {
      // Group products by category
      const grouped: { [key: string]: any[] } = {};
      products.forEach((product) => {
        const category = product.category || "uncategorized";
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(product);
      });

      // Sort products within each category
      Object.keys(grouped).forEach((category) => {
        grouped[category].sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return sortOrder === "latest" ? dateB - dateA : dateA - dateB;
        });
      });

      // Convert to flat array with category headers
      // Sort categories: food first, then alphabetically
      const flatData: any[] = [];
      Object.keys(grouped)
        .sort((a, b) => {
          if (a === "food") return -1;
          if (b === "food") return 1;
          return a.localeCompare(b);
        })
        .forEach((category) => {
          // Add category header
          flatData.push({
            type: "category_header",
            category: category,
            id: `header-${category}`,
          });
          // Add products in this category
          flatData.push(...grouped[category]);
        });

      return flatData;
    } else if (activeTab === "marketplace") {
      // Group marketplace items by type
      const grouped: { [key: string]: any[] } = {};
      marketplaceItems.forEach((item) => {
        const category = item.type || "uncategorized";
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(item);
      });

      // Sort items within each category
      Object.keys(grouped).forEach((category) => {
        grouped[category].sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return sortOrder === "latest" ? dateB - dateA : dateA - dateB;
        });
      });

      // Convert to flat array with category headers
      // Sort categories alphabetically
      const flatData: any[] = [];
      Object.keys(grouped)
        .sort((a, b) => a.localeCompare(b))
        .forEach((category) => {
          // Add category header
          flatData.push({
            type: "category_header",
            category: category,
            id: `header-${category}`,
          });
          // Add items in this category
          flatData.push(...grouped[category]);
        });

      return flatData;
    } else if (activeTab === "bookmarks") {
      // Group bookmarks by category/type
      const grouped: { [key: string]: any[] } = {};
      bookmarks.forEach((bookmark) => {
        let category = "uncategorized";

        // Determine category based on bookmark type
        if (bookmark.products) {
          category = bookmark.products.category || "products";
        } else if (bookmark.marketplace) {
          category = bookmark.marketplace.type || "marketplace";
        } else if (bookmark.posts) {
          category = "posts";
        }

        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(bookmark);
      });

      // Sort bookmarks within each category
      Object.keys(grouped).forEach((category) => {
        grouped[category].sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return sortOrder === "latest" ? dateB - dateA : dateA - dateB;
        });
      });

      // Convert to flat array with category headers
      // Sort categories: food, fashion, rent, posts, then others alphabetically
      const flatData: any[] = [];
      Object.keys(grouped)
        .sort((a, b) => {
          // Priority order: food -> fashion -> rent -> posts -> others
          const getPriority = (cat: string): number => {
            if (cat === "food") return 1;
            if (cat === "fashion") return 2;
            if (cat === "rent") return 3;
            if (cat === "posts") return 4;
            return 5; // Others
          };

          const priorityA = getPriority(a);
          const priorityB = getPriority(b);

          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }

          // If both are "others" (priority 5), sort alphabetically
          return a.localeCompare(b);
        })
        .forEach((category) => {
          // Add category header
          flatData.push({
            type: "category_header",
            category: category,
            id: `header-${category}`,
          });
          // Add bookmarks in this category
          flatData.push(...grouped[category]);
        });

      return flatData;
    } else {
      data = [...bookmarks];
    }

    // Sort by created_at for non-product tabs
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
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingTop: 20, paddingBottom: 150 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#094569"
                  progressViewOffset={20}
                />
              }
            >
              {currentListData.length === 0 ? (
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
              ) : (
                currentListData.map((item) => (
                  <View key={item.id}>
                    {renderItem({ item })}
                  </View>
                ))
              )}
            </ScrollView>
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

      {/* Image Viewer for Posts */}
      {showImageViewer && selectedPost && (
        <ImageViewer
          visible={showImageViewer}
          images={selectedPost.images}
          initialIndex={0}
          onClose={() => {
            setShowImageViewer(false);
            setSelectedPost(null);
          }}
          postContent={selectedPost.content}
          username={selectedPost.userName}
          likes={selectedPost.likes}
          comments={selectedPost.comments}
        />
      )}
    </View>
  );
}
