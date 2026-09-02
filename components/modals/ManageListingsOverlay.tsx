import CountdownTimer from "@/components/CountdownTimer";
import EditMarketplaceModal from "@/components/modals/EditMarketplaceModal";
import EditProductModal from "@/components/modals/EditProductModal";
import ImageViewer from "@/components/modals/ImageViewer";
import ImageWithFallback from "@/components/ui/ImageWithFallback";
import CircularLoader from "@/components/ui/CircularLoader";
import PopupMessage from "@/components/ui/PopupMessage";
import {
  fetchUserMarketplaceItems,
  MarketplaceItem,
} from "@/lib/postMarketPlace";
import { fetchUserProducts, Product } from "@/lib/productsService";
import { supabase } from "@/lib/supabase";
import { useAppRouter } from "@/utils/navigation";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  ArrowUpDown,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
  Package,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

interface BookmarkedItem {
  id: string;
  product_id?: string;
  marketplace_id?: string;
  post_id?: string;
  service_id?: string;
  created_at: string;
  products?: {
    id: string;
    name: string;
    price: number;
    images: string[];
    category?: string;
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
  provider_services?: {
    id: string;
    name: string;
    images: string[];
    service_categories?: { name: string };
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
  const router = useAppRouter();

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

  // Delete confirm popup
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Collapsible sections state for Saves tab (all collapsed by default)
  const [collapsedSections, setCollapsedSections] = useState<{
    posts: boolean;
    products: boolean;
    marketplace: boolean;
    services: boolean;
  }>({ posts: true, products: true, marketplace: true, services: true });

  const toggleSection = useCallback(
    (section: "posts" | "products" | "marketplace" | "services") => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCollapsedSections((prev) => ({ ...prev, [section]: !prev[section] }));
    },
    [],
  );

  useEffect(() => {
    loadData();
  }, [userId]);

  // Reset selection when switching tabs
  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveTab(tab);
    setIsSelectionMode(false);
    setSelectedIds([]);
  };

  const SWIPEABLE_TABS: TabType[] = ["products", "marketplace", "bookmarks"];

  const swipeGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (activeTab === "edit") return;
      const idx = SWIPEABLE_TABS.indexOf(activeTab);
      if (e.translationX < -50 && idx < SWIPEABLE_TABS.length - 1) {
        handleTabChange(SWIPEABLE_TABS[idx + 1]);
      } else if (e.translationX > 50 && idx > 0) {
        handleTabChange(SWIPEABLE_TABS[idx - 1]);
      }
    });

  // Toggle sort order
  const toggleSortOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSortOrder((prev) => (prev === "latest" ? "oldest" : "latest"));
  };

  // Edit handlers
  const handleEditProduct = (product: Product) => {
    setPreviousTab(activeTab); // Remember current tab (usually 'products')
    setProductToEdit(product);
    setActiveTab("edit"); // Switch to hidden edit tab
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handleEditMarketplaceItem = (item: MarketplaceItem) => {
    setPreviousTab(activeTab); // Remember current tab (usually 'marketplace')
    setMarketplaceItemToEdit(item);
    setActiveTab("edit"); // Switch to hidden edit tab
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
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
      const [
        productsData,
        marketplaceData,
        { data: bookmarksData, error: bookmarksError },
      ] = await Promise.all([
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
            service_id,
            created_at,
            products (id, name, price, images, category),
            marketplace (id, title, price, images, type),
            posts (id, content, images, likes, comments, user_id, profiles:user_id (name)),
            provider_services (id, name, images, service_categories (name))
          `,
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      // Debug logging
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
          provider_services: item.provider_services
            ? Array.isArray(item.provider_services)
              ? item.provider_services[0]
              : item.provider_services
            : null,
        }))
        .filter(
          (item) =>
            item.products ||
            item.marketplace ||
            item.posts ||
            item.provider_services,
        ) as BookmarkedItem[];

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    const table =
      activeTab === "products"
        ? "products"
        : activeTab === "marketplace"
          ? "marketplace"
          : "user_bookmarks";

    const { error } = await supabase.from(table).delete().in("id", selectedIds);

    if (!error) {
      if (activeTab === "products")
        setProducts((p) => p.filter((i) => !selectedIds.includes(i.id)));
      if (activeTab === "marketplace")
        setMarketplaceItems((m) =>
          m.filter((i) => !selectedIds.includes(i.id)),
        );
      if (activeTab === "bookmarks")
        setBookmarks((b) => b.filter((i) => !selectedIds.includes(i.id)));

      setIsSelectionMode(false);
      setSelectedIds([]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // --- RENDER ITEM ---

  // Memoized ListItem component to prevent unnecessary re-renders
  const ListItem = React.memo(
    ({
      item,
      isSelected,
      onLongPress,
      onPress,
    }: {
      item: any;
      isSelected: boolean;
      onLongPress: () => void;
      onPress: () => void;
    }) => {
      // Handle category headers (Products/Marketplace tabs)
      if (item.type === "category_header") {
        return (
          <View className="px-4 py-3 mt-2">
            <Text className="text-sm font-mbold text-gray-700 uppercase tracking-wider">
              {item.category.replace("-", " & ")}
            </Text>
          </View>
        );
      }

      // Handle collapsible section headers (Saves tab)
      if (item.type === "section_header") {
        const isCollapsed =
          collapsedSections[
            item.section as "posts" | "products" | "marketplace" | "services"
          ];
        return (
          <TouchableOpacity
            onPress={onPress}
            className="px-4 py-2 mt-0.5 flex-row items-center justify-between"
            activeOpacity={0.7}
          >
            <View className="flex-row items-center gap-x-2">
              <Text className="text-base font-mbold text-gray-900">
                {item.title}
              </Text>
              <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                <Text className="text-xs font-mbold text-primary">
                  {item.count}
                </Text>
              </View>
            </View>
            {isCollapsed ? (
              <ChevronRight size={18} color="#6B7280" />
            ) : (
              <ChevronDown size={18} color="#6B7280" />
            )}
          </TouchableOpacity>
        );
      }

      // Normalize data
      const isPost = !!item.posts || !!item.post_id;
      const isService = !!item.provider_services || !!item.service_id;
      const title =
        item.name ||
        item.title ||
        item.products?.name ||
        item.marketplace?.title ||
        item.provider_services?.name ||
        (item.posts?.content
          ? item.posts.content.substring(0, 50) +
            (item.posts.content.length > 50 ? "..." : "")
          : "Post");
      const price =
        item.price || item.products?.price || item.marketplace?.price;
      const image =
        item.images?.[0] ||
        item.products?.images?.[0] ||
        item.marketplace?.images?.[0] ||
        item.posts?.images?.[0] ||
        item.provider_services?.images?.[0];
      const hasActiveDiscount =
        activeTab === "products" && item.is_currently_active;
      const isFood = item.category === "food";
      const postUsername = item.posts?.profiles?.name || "Unknown User";

      // Category badge for Saves tab
      const categoryTag =
        activeTab === "bookmarks"
          ? item.products?.category ||
            item.marketplace?.type ||
            item.provider_services?.service_categories?.name
          : null;
      // Category badge for Products/Marketplace tabs
      const typeLabel =
        activeTab === "marketplace"
          ? item.type || item.marketplace?.type
          : null;

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
          <View
            style={{ borderRadius: 12, borderCurve: "continuous" }} className="w-20 h-20 overflow-hidden bg-gray-100">
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
              {/* Type label for marketplace tab */}
              {!isPost && typeLabel && activeTab === "marketplace" ? (
                <Text className="text-[10px] font-mbold text-primary uppercase tracking-tighter mb-0.5">
                  {typeLabel}
                </Text>
              ) : null}

              <Text
                className="text-gray-900 font-msemibold text-lg"
                numberOfLines={1}
              >
                {title}
              </Text>

              {/* Category tag pill for Saves tab */}
              {categoryTag && activeTab === "bookmarks" && (
                <View
                  className={`self-start px-2 py-0.5 rounded-full mt-1 mb-0.5 ${
                    isService
                      ? "bg-purple-100"
                      : isPost
                        ? "bg-pink-100"
                        : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-[10px] font-mbold capitalize ${
                      isService
                        ? "text-purple-700"
                        : isPost
                          ? "text-pink-700"
                          : "text-gray-600"
                    }`}
                  >
                    {categoryTag}
                  </Text>
                </View>
              )}

              {/* Price with Discount Info or Post Info */}
              {isPost ? (
                <Text className="text-gray-500 text-sm mt-0.5">
                  by {postUsername}
                </Text>
              ) : hasActiveDiscount ? (
                <View className="gap-1">
                  {/* Badge */}
                  <View
                    className={`${isFood ? "bg-amber-500" : "bg-green-500"} px-1.5 py-0.5 rounded self-start ${isFood ? "flex-row items-center gap-1" : ""}`}
                  >
                    {isFood && (
                      <Text className="text-white text-[10px]">🌙</Text>
                    )}
                    <Text className="text-white text-[10px] font-bold">
                      {isFood
                        ? `CLOSING SALE -${item.discount_percent}%`
                        : `-${item.discount_percent}% OFF`}
                    </Text>
                  </View>

                  {/* Prices */}
                  <View className="flex-row items-center gap-2">
                    <Text className="text-xs text-gray-400 line-through">
                      Nu. {item.price?.toLocaleString()}
                    </Text>
                    <Text
                      className={`text-base font-mbold ${isFood ? "text-amber-600" : "text-primary"}`}
                    >
                      Nu. {item.current_price?.toLocaleString()}
                    </Text>
                  </View>

                  {/* Countdown - Isolated to prevent re-render cascade */}
                  <CountdownTimer
                    endsAt={item.discount_ends_at}
                    compact={true}
                  />
                </View>
              ) : (
                <Text className="text-primary font-mbold text-lg">
                  {price ? `Nu. ${price?.toLocaleString()}` : ""}
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
                      } else if (item.service_id) {
                        path = `/(users)/servicedetail/${item.service_id}`;
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
    },
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      if (item.type === "section_header") {
        return (
          <ListItem
            item={item}
            isSelected={false}
            onLongPress={() => {}}
            onPress={() => toggleSection(item.section)}
          />
        );
      }
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
      toggleSection,
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
      const sortItems = (items: any[]) =>
        [...items].sort((a, b) => {
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          return sortOrder === "latest" ? dateB - dateA : dateA - dateB;
        });

      const postBookmarks = sortItems(bookmarks.filter((b) => b.posts));
      const productBookmarks = sortItems(bookmarks.filter((b) => b.products));
      const marketplaceBookmarks = sortItems(
        bookmarks.filter((b) => b.marketplace),
      );
      const serviceBookmarks = sortItems(
        bookmarks.filter((b) => b.provider_services),
      );

      const flatData: any[] = [];

      if (postBookmarks.length > 0) {
        flatData.push({
          type: "section_header",
          section: "posts",
          title: "Posts",
          count: postBookmarks.length,
          id: "section-posts",
        });
        if (!collapsedSections.posts) {
          flatData.push(...postBookmarks);
        }
      }

      if (productBookmarks.length > 0) {
        flatData.push({
          type: "section_header",
          section: "products",
          title: "Products",
          count: productBookmarks.length,
          id: "section-products",
        });
        if (!collapsedSections.products) {
          flatData.push(...productBookmarks);
        }
      }

      if (marketplaceBookmarks.length > 0) {
        flatData.push({
          type: "section_header",
          section: "marketplace",
          title: "Marketplace",
          count: marketplaceBookmarks.length,
          id: "section-marketplace",
        });
        if (!collapsedSections.marketplace) {
          flatData.push(...marketplaceBookmarks);
        }
      }

      if (serviceBookmarks.length > 0) {
        flatData.push({
          type: "section_header",
          section: "services",
          title: "Services",
          count: serviceBookmarks.length,
          id: "section-services",
        });
        if (!collapsedSections.services) {
          flatData.push(...serviceBookmarks);
        }
      }

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
  }, [
    activeTab,
    products,
    marketplaceItems,
    bookmarks,
    sortOrder,
    collapsedSections,
  ]);

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
            {!isSelectionMode && activeTab !== "edit" && (
              <>
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
                <TouchableOpacity
                  onPress={() => {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                    setIsSelectionMode(true);
                  }}
                  className="bg-white p-2 rounded-full shadow-sm border border-gray-100"
                >
                  <Trash2 size={16} color="#EF4444" />
                </TouchableOpacity>
              </>
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
              style={{ borderRadius: 16, borderCurve: "continuous" }}
              onPress={handleExitEdit}
              className="flex-row items-center bg-white py-2.5 px-4 border border-gray-200"
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
        <GestureDetector gesture={swipeGesture}>
          <View className="flex-1">
            {loading ? (
              <View className="flex-1 items-center justify-center">
                <CircularLoader size="large" color="#094569" />
              </View>
            ) : (
              <FlatList
              data={currentListData}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingTop: activeTab === "bookmarks" ? 8 : 20,
                paddingBottom: 150,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#094569"
                    progressViewOffset={20}
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
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                windowSize={10}
                initialNumToRender={8}
              />
            )}
          </View>
        </GestureDetector>
      )}

      {/* Context-Aware Floating Deletion Bar */}
      {isSelectionMode && (
        <Animated.View
          style={{ borderRadius: 35, borderCurve: "continuous" }}
          entering={FadeInDown.duration(400)}
          exiting={FadeOutDown}
          className="absolute bottom-10 left-6 right-6 h-20 bg-gray-900 flex-row items-center justify-between px-8 shadow-2xl"
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
          postId={selectedPost.id}
          postUserId={selectedPost.user_id}
          postContent={selectedPost.content}
        />
      )}

      {/* Delete Confirm Popup */}
      {showDeleteConfirm && (
        <PopupMessage
          visible={showDeleteConfirm}
          type="warning"
          title={`Delete ${selectedIds.length} item${selectedIds.length !== 1 ? "s" : ""}?`}
          message="This cannot be undone."
          onHide={() => setShowDeleteConfirm(false)}
          actions={[
            {
              label: "Cancel",
              style: "cancel",
              onPress: () => setShowDeleteConfirm(false),
            },
            {
              label: "Delete",
              style: "destructive",
              onPress: confirmDelete,
            },
          ]}
        />
      )}
    </View>
  );
}
