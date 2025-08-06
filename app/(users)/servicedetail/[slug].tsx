// Path: app/(users)/servicedetail/[slug].tsx

import TopNavbar from "@/components/ui/TopNavbar";
import { getServiceCategoryBySlug } from "@/data/servicecategory";
import { getServiceProvidersByCategory } from "@/data/services";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Image, ScrollView, Text, TouchableOpacity, View } from "react-native";

interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  image: string;
  slug: string;
}

interface ServiceProvider {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  phone: string;
  images: string[];
  description: string;
  location: string;
  available: boolean;
  services: any[];
  rating?: number;
  reviewCount?: number;
}

export default function ServiceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);

  useEffect(() => {
    if (slug) {
      const foundCategory = getServiceCategoryBySlug(slug);
      if (foundCategory) {
        setCategory(foundCategory);
        const categoryProviders = getServiceProvidersByCategory(foundCategory.id);
        setProviders(categoryProviders);
      }
    }
  }, [slug]);

  const handleProviderPress = (provider: ServiceProvider) => {
    router.push(`/(users)/providerdetail/${provider.id}`);
  };

  const renderProviderCard = ({ item }: { item: ServiceProvider }) => (
    <TouchableOpacity
      className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 p-4"
      onPress={() => handleProviderPress(item)}
      activeOpacity={0.7}
    >
      {/* Provider Header */}
      <View className="flex-row items-center mb-3">
        <Image 
          source={{ uri: item.images[0] }} 
          className="w-16 h-16 rounded-full mr-4"
          resizeMode="cover"
        />
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-msemibold text-gray-900">
              {item.name}
            </Text>
            <View className={`px-2 py-1 rounded-full ${
              item.available ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <Text className={`text-xs font-medium ${
                item.available ? 'text-green-600' : 'text-red-600'
              }`}>
                {item.available ? 'Available' : 'Unavailable'}
              </Text>
            </View>
          </View>
          
          <Text className="text-sm font-regular text-gray-500 mb-1">
            📍 {item.location}
          </Text>
          
          {item.rating && (
            <View className="flex-row items-center">
              <Text className="text-sm font-medium text-yellow-500">
                ⭐ {item.rating}
              </Text>
              <Text className="text-xs font-regular text-gray-400 ml-1">
                ({item.reviewCount} reviews)
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Description */}
      <Text className="text-sm font-regular text-gray-600 mb-3" numberOfLines={2}>
        {item.description}
      </Text>

      {/* Services Preview */}
      <View className="border-t border-gray-100 pt-3">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Services Available:
        </Text>
        <View className="flex-row flex-wrap">
          {item.services.slice(0, 2).map((service, index) => (
            <View 
              key={service.id} 
              className="bg-primary/10 px-3 py-1 rounded-full mr-2 mb-2"
            >
              <Text className="text-xs font-medium text-primary">
                {service.name} - Nu. {service.price}
              </Text>
            </View>
          ))}
          {item.services.length > 2 && (
            <View className="bg-gray-100 px-3 py-1 rounded-full">
              <Text className="text-xs font-medium text-gray-600">
                +{item.services.length - 2} more
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Contact Info */}
      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <Text className="text-sm font-medium text-gray-700">
          📞 {item.phone}
        </Text>
        <View className="flex-row items-center">
          <Text className="text-primary font-medium text-sm mr-2">
            View Details
          </Text>
          <Text className="text-primary font-bold">›</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (!category) {
    return (
      <View className="flex-1 bg-background">
        <TopNavbar />
        <View className="flex-1 items-center justify-center px-4">
          <Text className="text-xl font-mbold text-gray-700">
            Service Category Not Found
          </Text>
          <Text className="text-sm font-regular text-gray-500 text-center mt-2">
            The requested service category could not be found.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <TopNavbar />
      
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Category Header */}
        <View className="bg-white border-b border-gray-100 px-4 py-6">
          <View className="flex-row items-center mb-3">
            <View className="w-16 h-16 bg-primary/10 rounded-full items-center justify-center mr-4">
              <Image 
                source={{ uri: category.image }} 
                className="w-8 h-8"
                resizeMode="contain"
              />
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-mbold text-gray-900 mb-1">
                {category.name}
              </Text>
              <Text className="text-sm font-regular text-gray-500">
                {category.description}
              </Text>
            </View>
          </View>
        </View>

        {/* Providers List */}
        <View className="px-4 py-4">
          {providers.length > 0 ? (
            <>
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-lg font-msemibold text-gray-900">
                  Service Providers
                </Text>
                <Text className="text-sm font-regular text-gray-500">
                  {providers.length} available
                </Text>
              </View>
              
              <FlatList
                data={providers}
                renderItem={renderProviderCard}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            </>
          ) : (
            <View className="items-center justify-center py-12">
              <Text className="text-lg font-msemibold text-gray-700 mb-2">
                No Providers Available
              </Text>
              <Text className="text-sm font-regular text-gray-500 text-center">
                There are currently no service providers available in this category.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}