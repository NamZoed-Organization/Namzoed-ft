// app/categories.tsx

import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, ImageBackground, ImageSourcePropType, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";

import CreateProductModal from "@/components/CreateProductModal";
import SearchBar from "@/components/SearchBar";
import CategorySkeleton from "@/components/ui/CategorySkeleton";
import TopNavbar from "@/components/ui/TopNavbar";
import { useUser } from "@/contexts/UserContext";
import { categories as categoryData } from "@/data/categories";
import { supabase } from "@/lib/supabase";

const slugify = (str: string): string => str;

const categoryImages: Record<string, ImageSourcePropType> = {
  "fashion": require("@/assets/category/fashion_category.png"),
  "food": require("@/assets/category/food_category.png"),
  "beauty": require("@/assets/category/beauty_category.png"),
  "kids-and-toys": require("@/assets/category/kids_category.png"),
  "electronics": require("@/assets/category/electronics_category.png"),
  "home-and-living": require("@/assets/category/home_category.png"),
};

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

  const fetchCounts = async () => {
    try {
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

  // Refresh data when screen comes into focus (after modal closes or navigation)
  useFocusEffect(
    useCallback(() => {
      fetchCounts();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    await fetchCounts();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    setRefreshing(false);
  };

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, fadeAnim]);

  const processedCategories = useMemo(() => {
    return Object.keys(categoryData).map((key) => {
      const productsInCategory = realProducts.filter(p => p.category === key);
      const totalCount = productsInCategory.length;

      const subcategories = categoryData[key].map(subStatic => {
        const count = productsInCategory.filter(p => p.tags && p.tags.includes(subStatic.name)).length;
        return { ...subStatic, count };
      });

      const topSubcategory = subcategories.length > 0 
        ? subcategories.reduce((max, current) => (current.count > max.count ? current : max))
        : null;

      return {
        key,
        totalCount,
        topSubcategory,
        image: categoryImages[key] || require("@/assets/category/fashion_category.png")
      };
    });
  }, [realProducts]);

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
      pathname: "/categories/[slug]",
      params: { slug },
    });
  };

  const handleSubcategoryPress = (categoryKey: string, subcategoryName: string) => {
    const slug = slugify(categoryKey);
    router.push({
      pathname: "/categories/[slug]",
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

  // Calculate card widths for proper 3-column layout
  const { width: screenWidth } = require('react-native').Dimensions.get('window');
  const subcategoryCardWidth = (screenWidth - 32 - 24) / 3; // 32 = padding, 24 = gaps (12*2)

  return (
    <View className="flex-1 bg-[#f8f9fa]">
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
        <View className="px-4 gap-2 mb-20">
          <TopNavbar />
          
          {/* SEARCH BAR + POST BUTTON */}
          <View className="flex-row items-center gap-3 mb-4">
            <View className="flex-1">
              <SearchBar
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search categories..."
              />
            </View>

            <TouchableOpacity
              onPress={handleCreatePress}
              activeOpacity={0.85}
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              <LinearGradient
                colors={['#094569', '#0a5a8a', '#0b6ba8']}
                start={[0, 0]}
                end={[1, 1]}
                style={{
                  width: '100%',
                  height: '100%',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Plus color="white" size={26} strokeWidth={2.5} />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {loading ? (
            <CategorySkeleton />
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              {/* Section 1: Main Category Cards */}
              <View className="mb-6">
                <View style={{ marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 3,
                      height: 20,
                      backgroundColor: '#094569',
                      borderRadius: 2,
                      marginRight: 10,
                    }}
                  />
                  <View>
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: '600',
                        color: '#1a1a1a',
                        letterSpacing: -0.3,
                        marginBottom: 4,
                      }}
                    >
                      {searchQuery ? "Search Results" : "Categories"}
                    </Text>
                    {!searchQuery && (
                      <Text style={{ fontSize: 14, color: '#888', fontWeight: '400' }}>
                        Explore all products
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              <View className="flex flex-row flex-wrap justify-between gap-y-4">
                {filteredCategories.map((cat, index) => (
                  <TouchableOpacity
                    key={cat.key}
                    className="w-[48%]"
                    activeOpacity={0.95}
                    onPress={() => handleCategoryPress(cat.key)}
                    style={{
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.1,
                      shadowRadius: 12,
                      elevation: 5,
                    }}
                  >
                    <View
                      style={{
                        height: 220,
                        borderRadius: 20,
                        overflow: 'hidden',
                        backgroundColor: '#fff',
                      }}
                    >
                      <ImageBackground
                        source={cat.image}
                        resizeMode="cover"
                        style={{ flex: 1, width: '100%', height: '100%' }}
                      >
                        {/* Premium overlay with better gradient */}
                        <View
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                          }}
                        >
                          <LinearGradient
                            colors={[
                              'rgba(0,0,0,0.1)',
                              'rgba(0,0,0,0.3)',
                              'rgba(0,0,0,0.9)'
                            ]}
                            locations={[0, 0.5, 1]}
                            style={{ flex: 1 }}
                          >
                            <View
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                paddingHorizontal: 16,
                                paddingBottom: 16,
                                paddingTop: 8,
                              }}
                            >
                              {/* Decorative line */}
                              <View
                                style={{
                                  width: 32,
                                  height: 3,
                                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                  borderRadius: 2,
                                  marginBottom: 10,
                                }}
                              />

                              <Text
                                style={{
                                  color: 'white',
                                  fontSize: 17,
                                  fontWeight: '700',
                                  marginBottom: 6,
                                  letterSpacing: -0.3,
                                  textShadowColor: 'rgba(0, 0, 0, 0.3)',
                                  textShadowOffset: { width: 0, height: 1 },
                                  textShadowRadius: 3,
                                }}
                                className="capitalize"
                              >
                                {cat.key.replace('-', ' & ')}
                              </Text>

                              <Text style={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                fontSize: 11,
                                fontWeight: '500',
                              }}>
                                {cat.totalCount} items
                              </Text>
                            </View>
                          </LinearGradient>
                        </View>
                      </ImageBackground>
                    </View>
                  </TouchableOpacity>
                ))}

                {filteredCategories.length === 0 && (
                  <View className="w-full py-10 items-center">
                    <Text className="text-gray-500">No categories found.</Text>
                  </View>
                )}
              </View>

              {/* Section 2: Popular Sub Categories - 3 COLUMNS */}
              {!searchQuery && (
                <>
                  <View className="mt-8 mb-5">
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 3,
                          height: 20,
                          backgroundColor: '#094569',
                          borderRadius: 2,
                          marginRight: 10,
                        }}
                      />
                      <View>
                        <Text
                          style={{
                            fontSize: 22,
                            fontWeight: '600',
                            color: '#1a1a1a',
                            letterSpacing: -0.3,
                            marginBottom: 4,
                          }}
                        >
                          Trending
                        </Text>
                        <Text style={{ fontSize: 14, color: '#888', fontWeight: '400' }}>
                          Popular right now
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 10,
                      marginBottom: 24,
                    }}
                  >
                    {processedCategories.map((cat, idx) => {
                      if (!cat.topSubcategory || cat.topSubcategory.count === 0) return null;

                      return (
                        <TouchableOpacity
                          key={`${cat.key}-sub`}
                          style={{
                            width: subcategoryCardWidth,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.06,
                            shadowRadius: 8,
                            elevation: 3,
                          }}
                          activeOpacity={0.85}
                          onPress={() => handleSubcategoryPress(cat.key, cat.topSubcategory!.name)}
                        >
                          <View
                            style={{
                              backgroundColor: 'white',
                              borderRadius: 14,
                              padding: 12,
                              height: 110,
                              borderWidth: 1,
                              borderColor: 'rgba(0, 0, 0, 0.05)',
                              justifyContent: 'space-between',
                            }}
                          >
                            <View>
                              {/* Top accent line */}
                              <View
                                style={{
                                  width: 20,
                                  height: 2.5,
                                  backgroundColor: '#094569',
                                  borderRadius: 2,
                                  marginBottom: 8,
                                }}
                              />

                              {/* Category Badge */}
                              <View
                                style={{
                                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                                  paddingHorizontal: 7,
                                  paddingVertical: 3,
                                  borderRadius: 5,
                                  alignSelf: 'flex-start',
                                  marginBottom: 8,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 8,
                                    fontWeight: '700',
                                    color: '#666',
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  {cat.key.replace('-', ' & ')}
                                </Text>
                              </View>

                              {/* Subcategory Name */}
                              <Text
                                numberOfLines={2}
                                style={{
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color: '#1a1a1a',
                                  textTransform: 'capitalize',
                                  lineHeight: 17,
                                }}
                              >
                                {cat.topSubcategory.name}
                              </Text>
                            </View>

                            {/* Count - lighter, no box */}
                            <Text style={{ fontSize: 10, color: '#bbb', fontWeight: '500' }}>
                              {cat.topSubcategory.count} items
                            </Text>
                          </View>
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

      <CreateProductModal 
        isVisible={isModalVisible} 
        onClose={() => setModalVisible(false)} 
        userId={currentUserId}
      />
    </View>
  );
}