// app/categories.tsx

import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, ImageBackground, ImageSourcePropType, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

// Make sure to import your actual images here
import allImage from "@/assets/images/all.png";
// import clothingImage from "@/assets/images/clothing.png"; 

import CreateProductModal from "@/components/CreateProductModal";
import SearchBar from "@/components/SearchBar";
import CategorySkeleton from "@/components/ui/CategorySkeleton";
import TopNavbar from "@/components/ui/TopNavbar";
import { useUser } from "@/contexts/UserContext";
import { categories as categoryData } from "@/data/categories";
import { supabase } from "@/lib/supabase";

// 1. Move static helpers outside the component
const slugify = (str: string): string =>
  str.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-");

// 2. Image Mapping
const categoryImages: Record<string, ImageSourcePropType> = {
  "All": allImage,
  // "Clothing": clothingImage,
};

// Simplified interface for fetching just what we need for counting
interface ProductSummary {
  category: string;
  tags: string[] | null;
}

export default function CategoriesScreen() {
  const router = useRouter();
  const { currentUser } = useUser();

  const [searchQuery, setSearchQuery] = useState("");
  const [isModalVisible, setModalVisible] = useState(false);
  const [realProducts, setRealProducts] = useState<ProductSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const currentUserId = currentUser?.id || ""; 

  // 3. Fetch Real Data for Counts
  const fetchCounts = async () => {
    try {
      // We only select category and tags to keep the fetch light
      const { data, error } = await supabase
        .from('products')
        .select('category, tags');

      if (error) throw error;
      setRealProducts(data || []);
    } catch (error) {
      console.error("Error fetching category counts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);

    // Fade out before refresh
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    await fetchCounts();

    // Fade in after refresh
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    setRefreshing(false);
  };

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

  // 4. Process data dynamically using useMemo
  const processedCategories = useMemo(() => {
    return Object.keys(categoryData).map((key) => {
      // Filter real products for this category
      const productsInCategory = realProducts.filter(p => p.category === key);
      const totalCount = productsInCategory.length;

      // Calculate subcategory counts dynamically
      const subcategories = categoryData[key].map(subStatic => {
        const count = productsInCategory.filter(p => p.tags && p.tags.includes(subStatic.name)).length;
        return { ...subStatic, count };
      });

      // Find top subcategory based on real data
      const topSubcategory = subcategories.length > 0 
        ? subcategories.reduce((max, current) => (current.count > max.count ? current : max))
        : null;

      return {
        key,
        totalCount,
        topSubcategory,
        image: categoryImages[key] || allImage 
      };
    });
  }, [realProducts]);

  // 5. Filter data for search
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return processedCategories;
    const lowerQuery = searchQuery.toLowerCase();
    return processedCategories.filter((cat) => {
        const matchesCategory = cat.key.toLowerCase().includes(lowerQuery);
        const matchesSub = cat.topSubcategory?.name.toLowerCase().includes(lowerQuery);
        return matchesCategory || matchesSub;
    });
  }, [searchQuery, processedCategories]);

  const handleCategoryPress = (categoryKey: string) => {
    const slug = slugify(categoryKey);
    router.push({
      pathname: "/(users)/categories/[slug]",
      params: { slug },
    });
  };

  const handleSubcategoryPress = (categoryKey: string, subcategoryName: string) => {
    const slug = slugify(categoryKey);
    router.push({
      pathname: "/(users)/categories/[slug]",
      params: { 
        slug, 
        filter: subcategoryName 
      },
    });
  };

  const handleCreatePress = () => {
    if (!currentUserId) {
       // Optional: Add logic to show login modal
    }
    setModalVisible(true);
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#000"
            colors={["#000"]}
          />
        }
      >
        <View className="px-4 gap-2 mb-10">
          <TopNavbar />
          
          {/* SEARCH BAR + POST BUTTON ROW */}
          <View className="flex-row items-center gap-2 mb-2">
             <View className="flex-1">
                <SearchBar value={searchQuery} onChangeText={setSearchQuery} />
             </View>
             
             <TouchableOpacity 
                onPress={handleCreatePress}
                className="bg-primary w-12 h-12 rounded-xl justify-center items-center shadow-sm"
                activeOpacity={0.8}
             >
                <Plus color="white" size={24} />
             </TouchableOpacity>
          </View>

          {loading ? (
            <CategorySkeleton />
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              {/* Section 1: Main Cards */}
              <Text className="text-xl font-semibold text-gray-900 mt-2 mb-2">
                {searchQuery ? "Search Results" : "All Categories"}
              </Text>

              <View className="flex flex-row flex-wrap justify-between gap-y-4">
                {filteredCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    className="w-[48%] h-56 rounded-2xl overflow-hidden bg-white shadow-sm"
                    activeOpacity={0.85}
                    onPress={() => handleCategoryPress(cat.key)}
                  >
                    <ImageBackground
                      source={cat.image}
                      resizeMode="cover"
                      className="flex-1"
                    >
                      <LinearGradient
                        colors={["rgba(0,0,0,0.7)", "transparent"]}
                        start={[0, 1]}
                        end={[0, 0]}
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                        }}
                      >
                        <Text className="text-white text-base font-semibold capitalize">
                          {cat.key}
                        </Text>
                        <Text className="text-white text-xs">
                          {cat.totalCount} products
                        </Text>
                      </LinearGradient>
                    </ImageBackground>
                  </TouchableOpacity>
                ))}

                {filteredCategories.length === 0 && (
                  <View className="w-full py-10 items-center">
                    <Text className="text-gray-500">No categories found.</Text>
                  </View>
                )}
              </View>

              {/* Section 2: Popular Sub Categories */}
              {!searchQuery && (
                <>
                  <Text className="text-xl font-semibold text-gray-900 mt-6 mb-4">
                    Popular Sub Categories
                  </Text>

                  <View className="flex flex-row flex-wrap justify-between gap-y-3 mb-14">
                    {processedCategories.map((cat) => {
                      if (!cat.topSubcategory || cat.topSubcategory.count === 0) return null;

                      return (
                        <TouchableOpacity
                          key={`${cat.key}-sub`}
                          className="w-[48%] bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-100"
                          activeOpacity={0.7}
                          onPress={() => handleSubcategoryPress(cat.key, cat.topSubcategory!.name)}
                        >
                          <Text className="text-sm font-medium text-gray-800 capitalize mb-1" numberOfLines={1}>
                            {cat.topSubcategory.name}
                          </Text>
                          <Text className="text-xs text-gray-500 mb-1">
                            {cat.topSubcategory.count} items
                          </Text>
                          <Text className="text-xs text-primary capitalize">
                            in {cat.key}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </Animated.View>
          )}
        </View>
      </ScrollView>

      {/* The Create Product Overlay */}
      <CreateProductModal 
        isVisible={isModalVisible} 
        onClose={() => setModalVisible(false)} 
        userId={currentUserId}
      />
    </View>
  );
}
