// app/categories/[slug].tsx

import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

import SearchBar from "@/components/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import { categories as categoryData, SubCategory } from "@/data/categories";
import { Product, products } from "@/data/products"; // Import your products data

export default function CategoryDetailScreen() {
  const router = useRouter();
  const { slug, filter } = useLocalSearchParams<{ slug: string; filter?: string }>();
  const [searchQuery, setSearchQuery] = useState("");

  if (!slug) return null;

  // Convert slug back to category key
  const categoryKey = slug.replace(/-/g, " ");
  const subcategories: SubCategory[] = categoryData[categoryKey] || [];
  const activeFilter = filter ?? null;

  // Filter products based on category and subcategory
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(product => product.category === categoryKey);
    
    if (activeFilter) {
      filtered = filtered.filter(product => 
        product.tags.includes(activeFilter)
      );
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query) ||
        product.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [categoryKey, activeFilter, searchQuery]);

  const handleFilterPress = (subcategoryName: string) => {
    if (activeFilter === subcategoryName) {
      // Remove filter if already active
      router.push({
        pathname: "/categories/[slug]",
        params: { slug },
      });
    } else {
      // Apply new filter
      router.push({
        pathname: "/categories/[slug]",
        params: { slug, filter: subcategoryName },
      });
    }
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity 
      className="bg-white rounded-lg p-3 mb-3 shadow-sm border border-gray-100"
      onPress={() => {
        // Navigate to product detail page
        router.push({
          pathname: "/product/[id]",
          params: { id: item.id },
        });
      }}
    >
      <Image 
        source={item.image} 
        className="w-full h-40 rounded-lg mb-2" 
        resizeMode="cover" 
      />
      <Text className="text-base font-semibold text-gray-900 mb-1">
        {item.name}
      </Text>
      <Text className="text-sm text-gray-600 mb-2" numberOfLines={2}>
        {item.description}
      </Text>
      <View className="flex-row justify-between items-center">
        <Text className="text-lg font-bold text-primary">
          Nu. {item.price}
        </Text>
        <Text className="text-xs text-gray-500">
          {item.dzongkhag}
        </Text>
      </View>
      <View className="flex-row flex-wrap mt-2">
        {item.tags.map((tag, index) => (
          <Text key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full mr-1 mb-1">
            {tag}
          </Text>
        ))}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      className="flex-1 bg-background"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
    >
      <TopNavbar />

      <View className="px-4 mt-4 mb-2">
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

        <Text className="text-2xl font-semibold text-gray-900 mb-4 capitalize">
          {slug
            .split("-")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ")}
        </Text>

        {/* Filter Pills */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="mb-4"
        >
          <View className="flex-row">
            {/* All filter */}
            <TouchableOpacity
              className={`px-4 py-2 mr-2 rounded-full border ${
                !activeFilter ? "bg-primary border-primary" : "bg-white border-gray-300"
              }`}
              activeOpacity={0.8}
              onPress={() => router.push({
                pathname: "/categories/[slug]",
                params: { slug },
              })}
            >
              <Text
                className={`text-sm ${!activeFilter ? "text-white" : "text-gray-700"}`}
              >
                All ({filteredProducts.length})
              </Text>
            </TouchableOpacity>

            {/* Subcategory filters */}
            {subcategories.map((sub) => {
              const isActive = activeFilter === sub.name;
              const productCount = products.filter(p => 
                p.category === categoryKey && p.tags.includes(sub.name)
              ).length;
              
              return (
                <TouchableOpacity
                  key={sub.name}
                  className={`px-4 py-2 mr-2 rounded-full border ${
                    isActive ? "bg-primary border-primary" : "bg-white border-gray-300"
                  }`}
                  activeOpacity={0.8}
                  onPress={() => handleFilterPress(sub.name)}
                >
                  <Text
                    className={`text-sm ${isActive ? "text-white" : "text-gray-700"} capitalize`}
                  >
                    {sub.name} ({productCount})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Results count */}
        <Text className="text-sm text-gray-600 mb-3">
          {filteredProducts.length} products found
          {activeFilter && ` in "${activeFilter}"`}
          {searchQuery && ` for "${searchQuery}"`}
        </Text>

        {/* Products List */}
        {filteredProducts.length > 0 ? (
          <FlatList
            data={filteredProducts}
            renderItem={renderProduct}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View className="flex-1 items-center justify-center py-12">
            <Text className="text-gray-500 text-center">
              No products found
              {activeFilter && ` in "${activeFilter}"`}
              {searchQuery && ` for "${searchQuery}"`}
            </Text>
            {(activeFilter || searchQuery) && (
              <TouchableOpacity
                className="mt-4 bg-primary px-4 py-2 rounded-lg"
                onPress={() => {
                  setSearchQuery("");
                  router.push({
                    pathname: "/categories/[slug]",
                    params: { slug },
                  });
                }}
              >
                <Text className="text-white text-sm">Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}