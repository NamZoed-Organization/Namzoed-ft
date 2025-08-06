// Path: app/(tabs)/services.tsx

import TopNavbar from "@/components/ui/TopNavbar";
import { serviceCategories } from "@/data/servicecategory";
import { router } from "expo-router";
import { FlatList, Image, Text, TouchableOpacity, View } from "react-native";

export default function ServiceScreen() {
  const handleCategoryPress = (category: any) => {
    router.push(`/(users)/servicedetail/${category.slug}`);
  };

  const renderCategoryItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      className="bg-white rounded-xl shadow-sm border border-gray-100 m-2 p-4 flex-row items-center"
      onPress={() => handleCategoryPress(item)}
      activeOpacity={0.7}
    >
      <View className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center mr-4">
        <Image
          source={{ uri: item.image }}
          className="w-8 h-8"
          resizeMode="contain"
        />
      </View>
      <View className="flex-1">
        <Text className="text-lg font-msemibold text-gray-900 mb-1">
          {item.name}
        </Text>
        <Text className="text-sm font-regular text-gray-500" numberOfLines={2}>
          {item.description}
        </Text>
      </View>
      <View className="w-6 h-6 bg-primary/20 rounded-full items-center justify-center">
        <Text className="text-primary font-bold">›</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-background">
      <TopNavbar />

      <View className="flex-1 px-4 pt-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-mbold text-primary mb-2">
            Services
          </Text>
          <Text className="text-base font-regular text-gray-500">
            Choose from our wide range of professional services
          </Text>
        </View>

        {/* Service Categories Grid */}
        <FlatList
          data={serviceCategories}
          renderItem={renderCategoryItem}
          keyExtractor={(item) => item.id}
          numColumns={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      </View>
    </View>
  );
}
