// app/categories/[slug].tsx

import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Image, Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import SearchBar from "@/components/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import { categories as categoryData, SubCategory } from "@/data/categories";
import { Product, products } from "@/data/products"; // Import your products data

export default function CategoryDetailScreen() {
  const router = useRouter();
  const { slug, filter } = useLocalSearchParams<{ slug: string; filter?: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "price" | "none">("none");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  if (!slug) return null;

  // Convert slug back to category key
  const categoryKey = slug.replace(/-/g, " ");
  const subcategories: SubCategory[] = categoryData[categoryKey] || [];
  const activeFilter = filter ?? null;

  // Filter and sort products based on category and subcategory
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
    
    // Sort products
    if (sortBy === "price") {
      filtered = filtered.sort((a, b) => {
        const priceA = parseFloat(a.price.toString());
        const priceB = parseFloat(b.price.toString());
        return sortOrder === "asc" ? priceA - priceB : priceB - priceA;
      });
    } else if (sortBy === "date") {
      filtered = filtered.sort((a, b) => {
        const dateA = new Date(a.dateAdded).getTime();
        const dateB = new Date(b.dateAdded).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      });
    }
    
    return filtered;
  }, [categoryKey, activeFilter, searchQuery, sortBy, sortOrder]);

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

  const renderProduct = ({ item, index }: { item: Product; index: number }) => {
    const isLeftColumn = index % 2 === 0;
    return (
      <TouchableOpacity 
        className={`bg-white rounded-lg p-3 mb-3 shadow-sm border border-gray-100 flex-1 ${isLeftColumn ? 'mr-2' : 'ml-2'}`}
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
          className="w-full rounded-lg mb-2" 
          style={{ aspectRatio: 1, height: undefined }}
          resizeMode="cover" 
        />
        <Text className="text-sm font-semibold text-gray-900 mb-1" numberOfLines={2}>
          {item.name}
        </Text>
        <Text className="text-xs text-gray-600 mb-2" numberOfLines={3}>
          {item.description}
        </Text>
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm font-bold text-primary">
            Nu. {item.price}
          </Text>
          <Text className="text-xs text-gray-500">
            {item.dzongkhag}
          </Text>
        </View>
        <View className="flex-row flex-wrap">
          {item.tags.slice(0, 2).map((tag, tagIndex) => (
            <Text key={tagIndex} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full mr-1 mb-1">
              {tag}
            </Text>
          ))}
          {item.tags.length > 2 && (
            <Text className="text-xs text-gray-400 px-2 py-1">
              +{item.tags.length - 2}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

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

        {/* Results count and Sort button */}
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-sm text-gray-600">
            {filteredProducts.length} products found
            {activeFilter && ` in "${activeFilter}"`}
            {searchQuery && ` for "${searchQuery}"`}
          </Text>
          
          <TouchableOpacity 
            className="flex-row items-center bg-white border border-gray-300 px-3 py-2 rounded-lg"
            onPress={() => setShowSortDropdown(true)}
          >
            <Text className="text-sm text-gray-700 mr-1">
              {sortBy === "none" ? "Sort" : sortBy === "price" ? "Price" : "Date"}
            </Text>
            <Text className="text-gray-500">▼</Text>
          </TouchableOpacity>
        </View>

        {/* Products List */}
        {filteredProducts.length > 0 ? (
          <FlatList
            data={filteredProducts}
            renderItem={renderProduct}
            keyExtractor={(item) => item.id}
            numColumns={2}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={{ justifyContent: 'space-between' }}
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
      
      {/* Sort Dropdown Modal */}
      <Modal
        visible={showSortDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSortDropdown(false)}
      >
        <TouchableOpacity 
          className="flex-1 bg-black/50 justify-center items-center"
          activeOpacity={1}
          onPress={() => setShowSortDropdown(false)}
        >
          <View className="bg-white rounded-lg p-4 mx-8 w-64">
            <Text className="text-lg font-semibold text-gray-900 mb-4">Sort by</Text>
            
            {/* None/Default */}
            <TouchableOpacity 
              className={`p-3 rounded-lg mb-2 ${sortBy === "none" ? "bg-primary" : "bg-gray-50"}`}
              onPress={() => {
                setSortBy("none");
                setShowSortDropdown(false);
              }}
            >
              <Text className={`text-sm font-medium ${sortBy === "none" ? "text-white" : "text-gray-700"}`}>
                Default
              </Text>
            </TouchableOpacity>
            
            {/* Price Low to High */}
            <TouchableOpacity 
              className={`p-3 rounded-lg mb-2 ${sortBy === "price" && sortOrder === "asc" ? "bg-primary" : "bg-gray-50"}`}
              onPress={() => {
                setSortBy("price");
                setSortOrder("asc");
                setShowSortDropdown(false);
              }}
            >
              <Text className={`text-sm font-medium ${sortBy === "price" && sortOrder === "asc" ? "text-white" : "text-gray-700"}`}>
                Price: Low to High
              </Text>
            </TouchableOpacity>
            
            {/* Price High to Low */}
            <TouchableOpacity 
              className={`p-3 rounded-lg mb-2 ${sortBy === "price" && sortOrder === "desc" ? "bg-primary" : "bg-gray-50"}`}
              onPress={() => {
                setSortBy("price");
                setSortOrder("desc");
                setShowSortDropdown(false);
              }}
            >
              <Text className={`text-sm font-medium ${sortBy === "price" && sortOrder === "desc" ? "text-white" : "text-gray-700"}`}>
                Price: High to Low
              </Text>
            </TouchableOpacity>
            
            {/* Date Newest First */}
            <TouchableOpacity 
              className={`p-3 rounded-lg mb-2 ${sortBy === "date" && sortOrder === "desc" ? "bg-primary" : "bg-gray-50"}`}
              onPress={() => {
                setSortBy("date");
                setSortOrder("desc");
                setShowSortDropdown(false);
              }}
            >
              <Text className={`text-sm font-medium ${sortBy === "date" && sortOrder === "desc" ? "text-white" : "text-gray-700"}`}>
                Date: Newest First
              </Text>
            </TouchableOpacity>
            
            {/* Date Oldest First */}
            <TouchableOpacity 
              className={`p-3 rounded-lg ${sortBy === "date" && sortOrder === "asc" ? "bg-primary" : "bg-gray-50"}`}
              onPress={() => {
                setSortBy("date");
                setSortOrder("asc");
                setShowSortDropdown(false);
              }}
            >
              <Text className={`text-sm font-medium ${sortBy === "date" && sortOrder === "asc" ? "text-white" : "text-gray-700"}`}>
                Date: Oldest First
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}