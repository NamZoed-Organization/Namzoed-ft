// app/(users)/categories/[slug].tsx
import ProductGrid from "@/components/ProductGrid";
import SearchBar from "@/components/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import { categories as categoryData, SubCategory } from "@/data/categories";
import { fetchProductsByCategory, ProductWithUser } from "@/lib/productsService";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function CategoryDetailScreen() {
  const router = useRouter();
  const { slug, filter } = useLocalSearchParams<{ slug: string; filter?: string }>();
  
  const [products, setProducts] = useState<ProductWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "price" | "none">("none");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const categoryKey = slug ? slug.replace(/-/g, " ") : "";
  const subcategories: SubCategory[] = categoryData[categoryKey] || [];
  const activeFilter = filter ?? null;

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

    if (sortBy === "price") {
      result.sort((a, b) => sortOrder === "asc" ? a.price - b.price : b.price - a.price);
    } else if (sortBy === "date") {
      result.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });
    }

    return result;
  }, [products, searchQuery, sortBy, sortOrder]);

  const handleFilterPress = (subcategoryName: string) => {
    if (activeFilter === subcategoryName) {
      router.setParams({ filter: undefined });
    } else {
      router.setParams({ filter: subcategoryName });
    }
  };

  if (!slug) return null;

  return (
    <View className="flex-1 bg-gray-50">
      <TopNavbar />
      
      <View className="px-4 py-2 bg-white border-b border-gray-100 shadow-sm z-10">
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
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
          <Text className="text-2xl font-bold text-gray-900 capitalize mb-3">
            {categoryKey}
          </Text>

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
            onPress={() => setShowSortDropdown(true)}
            className="flex-row items-center space-x-1 px-2 py-1 bg-white border border-gray-200 rounded-lg"
          >
            <Text className="text-sm font-semibold text-gray-700">
              {sortBy === "none" ? "Sort by" : sortBy === "price" ? "Price" : "Date"}
            </Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          <ProductGrid products={displayedProducts} loading={loading} />
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showSortDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSortDropdown(false)}
      >
        <TouchableOpacity 
          className="flex-1 bg-black/40 justify-end"
          activeOpacity={1}
          onPress={() => setShowSortDropdown(false)}
        >
          <View className="bg-white rounded-t-3xl p-6 pb-10">
            <View className="w-12 h-1 bg-gray-300 rounded-full self-center mb-6" />
            <Text className="text-xl font-bold text-gray-900 mb-4">Sort Products</Text>
            
            {[
              { label: "Newest First", value: "date", order: "desc" },
              { label: "Oldest First", value: "date", order: "asc" },
              { label: "Price: Low to High", value: "price", order: "asc" },
              { label: "Price: High to Low", value: "price", order: "desc" },
            ].map((option, idx) => (
              <TouchableOpacity
                key={idx}
                className="py-4 border-b border-gray-100 flex-row justify-between items-center"
                onPress={() => {
                  setSortBy(option.value as any);
                  setSortOrder(option.order as any);
                  setShowSortDropdown(false);
                }}
              >
                <Text className={`text-base ${sortBy === option.value && sortOrder === option.order ? "text-primary font-bold" : "text-gray-700"}`}>
                  {option.label}
                </Text>
                {sortBy === option.value && sortOrder === option.order && (
                  <View className="w-2 h-2 bg-primary rounded-full" />
                )}
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity 
              className="mt-6 py-4 bg-gray-100 rounded-xl items-center"
              onPress={() => setShowSortDropdown(false)}
            >
              <Text className="text-gray-900 font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}