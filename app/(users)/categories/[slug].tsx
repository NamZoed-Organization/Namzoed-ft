// app/(users)/categories/[slug].tsx
import ProductGrid from "@/components/ProductGrid";
import SearchBar from "@/components/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import { categories as categoryData, SubCategory } from "@/data/categories";
import { fetchProductsByCategory, ProductWithUser } from "@/lib/productsService";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowUpDown, ChevronLeft } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function CategoryDetailScreen() {
  const router = useRouter();
  const { slug, filter } = useLocalSearchParams<{ slug: string; filter?: string }>();

  const [products, setProducts] = useState<ProductWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<"latest" | "oldest" | "cheapest" | "priciest">("latest");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Category key is now the same as the slug (both use slug format)
  const categoryKey = slug || "";
  const subcategories: SubCategory[] = categoryData[categoryKey] || [];
  const activeFilter = filter ?? null;

  // Category taglines
  const categoryTaglines: Record<string, string> = {
    fashion: "Dress to impress. Style that speaks.",
    food: "Fresh flavors, local taste. Eat well, live well.",
    beauty: "Glow different. Be unapologetically you.",
    "kids-and-toys": "Play, learn, grow. Joy in every moment.",
    electronics: "Smart tech for smarter lives.",
    "home-and-living": "Make your space truly yours.",
  };
  const tagline = categoryTaglines[categoryKey] || "Discover something amazing.";

  const loadProducts = async () => {
    setLoading(true);
    try {
      const { products: data } = await fetchProductsByCategory(categoryKey, activeFilter);
      setProducts(data);
    } catch (err) {
      console.error("Error loading products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!categoryKey) return;
    loadProducts();
  }, [categoryKey, activeFilter]);

  // Handle Android back button - re-register on focus
  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBackPress();
        return true; // Prevent default back behavior
      });

      return () => backHandler.remove();
    }, [])
  );

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (categoryKey) {
        loadProducts();
      }
    }, [categoryKey, activeFilter])
  );

  // Fade-in animation when data loads
  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim]);

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);

    // Fade out before refresh
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    await loadProducts();

    // Fade in after refresh
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    setRefreshing(false);
  };

  const displayedProducts = useMemo(() => {
    let result = [...products];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }

    // Sort based on sortMode
    if (sortMode === "latest") {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sortMode === "oldest") {
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortMode === "cheapest") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortMode === "priciest") {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [products, searchQuery, sortMode]);

  const handleFilterPress = (subcategoryName: string) => {
    if (activeFilter === subcategoryName) {
      router.setParams({ filter: undefined });
    } else {
      router.setParams({ filter: subcategoryName });
    }
  };

  const handleBackPress = () => {
    router.push('/categories');
  };

  if (!slug) return null;

  return (
    <View className="flex-1 bg-gray-50">
      <TopNavbar />

      <View className="flex-row items-center gap-2 px-4 py-2">
        <TouchableOpacity
          onPress={handleBackPress}
          activeOpacity={0.7}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: '#f5f5f5',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={24} color="#1a1a1a" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000"
            colors={["#000"]}
          />
        }
      >
        <View className="mb-4">
          {/* Category Header */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">
              {categoryKey.replace(/-/g, " ")}
            </Text>
            <Text className="text-xl font-bold text-gray-900">
              {tagline}
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1">
            <TouchableOpacity
              className={`px-4 py-2 mr-2 rounded-full border ${!activeFilter ? "bg-black border-black" : "bg-white border-gray-200"}`}
              onPress={() => router.setParams({ filter: undefined })}
            >
              <Text className={`text-sm font-medium ${!activeFilter ? "text-white" : "text-gray-700"}`}>All</Text>
            </TouchableOpacity>

            {subcategories.map((sub) => (
              <TouchableOpacity
                key={sub.name}
                className={`px-4 py-2 mr-2 rounded-full border ${activeFilter === sub.name ? "bg-black border-black" : "bg-white border-gray-200"}`}
                onPress={() => handleFilterPress(sub.name)}
              >
                <Text className={`text-sm font-medium ${activeFilter === sub.name ? "text-white" : "text-gray-700"}`}>
                  {sub.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-sm text-gray-500 font-medium">
            {displayedProducts.length} items found
          </Text>
          <TouchableOpacity
            onPress={() => {
              // Cycle: latest → oldest → cheapest → priciest → latest
              const order: Array<"latest" | "oldest" | "cheapest" | "priciest"> = ["latest", "oldest", "cheapest", "priciest"];
              const currentIndex = order.indexOf(sortMode);
              const nextIndex = (currentIndex + 1) % order.length;
              setSortMode(order[nextIndex]);
            }}
            className="bg-white p-2 rounded-xl shadow-sm border border-gray-100"
          >
            <View className="flex-row items-center gap-1">
              <ArrowUpDown size={14} color="#1F2937" />
              <Text className="text-xs font-semibold text-gray-700 capitalize">
                {sortMode}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <ProductGrid products={displayedProducts} loading={loading} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}