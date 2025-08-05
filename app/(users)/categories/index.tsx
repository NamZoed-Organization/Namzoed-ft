// app/categories.tsx

import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ImageBackground, ScrollView, Text, TouchableOpacity, View } from "react-native";

import allImage from "@/assets/images/all.png";
import SearchBar from "@/components/SearchBar";
import TopNavbar from "@/components/ui/TopNavbar";
import { categories as categoryData, SubCategory } from "@/data/categories";

export default function CategoriesScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const mainCategories = Object.keys(categoryData);

  const slugify = (str: string): string =>
    str.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-");

  // Get the subcategory with the most products for each main category
  const getTopSubcategory = (categoryKey: string): SubCategory => {
    const subcategories = categoryData[categoryKey];
    return subcategories.reduce((max, current) => 
      current.count > max.count ? current : max
    );
  };

  const handleCategoryPress = (categoryKey: string) => {
    const slug = slugify(categoryKey);
    router.push({
      pathname: "/categories/[slug]",
      params: { slug },
    });
  };

  const handleSubcategoryPress = (categoryKey: string, subcategory: SubCategory) => {
    const slug = slugify(categoryKey);
    router.push({
      pathname: "/categories/[slug]",
      params: { 
        slug, 
        filter: subcategory.name 
      },
    });
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
    >
      <View className="px-4 gap-2 mb-10">
        <TopNavbar />
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

        <Text className="text-xl font-semibold text-gray-900 mt-2 mb-2">
          All Categories
        </Text>

        <View className="flex flex-row flex-wrap justify-between gap-y-4">
          {mainCategories.map((cat) => {
            const totalProducts = categoryData[cat].reduce((sum, sub) => sum + sub.count, 0);
            
            return (
              <TouchableOpacity
                key={cat}
                className="w-[48%] h-56 rounded-2xl overflow-hidden bg-white shadow-sm"
                activeOpacity={0.85}
                onPress={() => handleCategoryPress(cat)}
              >
                <ImageBackground
                  source={allImage}
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
                      {cat}
                    </Text>
                    <Text className="text-white text-xs">
                      {totalProducts}+ products
                    </Text>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="text-xl font-semibold text-gray-900 mt-6 mb-4">
          Popular Sub Categories
        </Text>

        <View className="flex flex-row flex-wrap justify-between gap-y-3 mb-14">
          {mainCategories.map((cat) => {
            const topSubcategory = getTopSubcategory(cat);
            
            return (
              <TouchableOpacity
                key={`${cat}-sub`}
                className="w-[48%] bg-white rounded-lg px-4 py-3 shadow-sm border border-gray-100 "
                activeOpacity={0.7}
                onPress={() => handleSubcategoryPress(cat, topSubcategory)}
              >
                <Text className="text-sm font-medium text-gray-800 capitalize mb-1">
                  {topSubcategory.name}
                </Text>
                <Text className="text-xs text-gray-500 mb-1">
                  {topSubcategory.count} items
                </Text>
                <Text className="text-xs text-primary capitalize">
                  in {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}