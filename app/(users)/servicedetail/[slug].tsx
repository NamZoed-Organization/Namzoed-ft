// Path: app/(users)/servicedetail/[slug].tsx

import TopNavbar from "@/components/ui/TopNavbar";
import { getServiceCategoryBySlug } from "@/data/servicecategory";
import { getServiceProvidersByCategory } from "@/data/services";
import { router, useLocalSearchParams } from "expo-router";
import { Briefcase, Users } from "lucide-react-native";
import React, { useEffect, useState } from "react";
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
  services: ServiceOffering[];
  rating?: number;
  reviewCount?: number;
}

interface ServiceOffering {
  id: string;
  name: string;
  price: number;
  description?: string;
}

interface ExtendedServiceOffering extends ServiceOffering {
  providerId: string;
  providerName: string;
}

type TabType = 'services' | 'providers';

export default function ServiceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('services');
  const [allServices, setAllServices] = useState<ExtendedServiceOffering[]>([]);

  useEffect(() => {
    if (slug) {
      const foundCategory = getServiceCategoryBySlug(slug);
      if (foundCategory) {
        setCategory(foundCategory);
        const categoryProviders = getServiceProvidersByCategory(foundCategory.id);
        setProviders(categoryProviders);

        // Extract all services from all providers
        const services: ExtendedServiceOffering[] = [];
        categoryProviders.forEach(provider => {
          provider.services.forEach(service => {
            services.push({
              ...service,
              providerId: provider.id,
              providerName: provider.name,
            });
          });
        });
        setAllServices(services);
      }
    }
  }, [slug]);

  const renderServiceCard = ({ item }: { item: ExtendedServiceOffering }) => (
    <TouchableOpacity
      className="bg-white rounded-xl shadow-sm border border-gray-100 mb-3 p-4"
      onPress={() => router.push(`/(users)/providerdetail/${item.providerId}`)}
      activeOpacity={0.7}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-base font-msemibold text-gray-900 mb-1">
            {item.name}
          </Text>
          <Text className="text-sm font-regular text-gray-500">
            by {item.providerName}
          </Text>
        </View>
        <View className="bg-primary/10 px-3 py-1.5 rounded-lg">
          <Text className="text-base font-mbold text-primary">
            Nu. {item.price}
          </Text>
        </View>
      </View>

      {item.description && (
        <Text className="text-sm font-regular text-gray-600 mb-2" numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View className="flex-row items-center justify-end pt-2 border-t border-gray-100">
        <Text className="text-primary font-medium text-sm mr-1">
          View Provider
        </Text>
        <Text className="text-primary font-bold">›</Text>
      </View>
    </TouchableOpacity>
  );

  const renderProviderCard = ({ item }: { item: ServiceProvider }) => (
    <TouchableOpacity
      className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 p-4"
      onPress={() => router.push(`/(users)/providerdetail/${item.id}`)}
      activeOpacity={0.7}
    >
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

      <Text className="text-sm font-regular text-gray-600 mb-3" numberOfLines={2}>
        {item.description}
      </Text>

      <View className="border-t border-gray-100 pt-3">
        <Text className="text-sm font-medium text-gray-700 mb-2">
          Services Available:
        </Text>
        <View className="flex-row flex-wrap">
          {item.services.slice(0, 2).map((service) => (
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

  const renderEmptyState = (icon: typeof Briefcase, title: string, message: string) => (
    <View className="items-center justify-center py-12">
      {icon === Briefcase ? (
        <Briefcase size={48} color="#9CA3AF" />
      ) : (
        <Users size={48} color="#9CA3AF" />
      )}
      <Text className="text-lg font-msemibold text-gray-700 mb-2 mt-4">
        {title}
      </Text>
      <Text className="text-sm font-regular text-gray-500 text-center">
        {message}
      </Text>
    </View>
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

        {/* Tab Navigation */}
        <View className="bg-white border-b border-gray-100">
          <View className="flex-row px-4">
            <TouchableOpacity
              className={`flex-1 py-4 items-center border-b-2 ${
                activeTab === 'services' ? 'border-primary' : 'border-transparent'
              }`}
              onPress={() => setActiveTab('services')}
              activeOpacity={0.7}
            >
              <Briefcase size={20} color={activeTab === 'services' ? '#059669' : '#9CA3AF'} strokeWidth={2} />
              <Text className={`font-msemibold text-xs mt-1 ${
                activeTab === 'services' ? 'text-primary' : 'text-gray-500'
              }`}>
                Services
              </Text>
              <Text className={`text-xs mt-0.5 ${
                activeTab === 'services' ? 'text-primary' : 'text-gray-400'
              }`}>
                {allServices.length}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 py-4 items-center border-b-2 ${
                activeTab === 'providers' ? 'border-primary' : 'border-transparent'
              }`}
              onPress={() => setActiveTab('providers')}
              activeOpacity={0.7}
            >
              <Users size={20} color={activeTab === 'providers' ? '#059669' : '#9CA3AF'} strokeWidth={2} />
              <Text className={`font-msemibold text-xs mt-1 ${
                activeTab === 'providers' ? 'text-primary' : 'text-gray-500'
              }`}>
                Providers
              </Text>
              <Text className={`text-xs mt-0.5 ${
                activeTab === 'providers' ? 'text-primary' : 'text-gray-400'
              }`}>
                {providers.length}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        <View className="px-4 py-4">
          {activeTab === 'services' ? (
            allServices.length > 0 ? (
              <FlatList
                data={allServices}
                renderItem={renderServiceCard}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              renderEmptyState(
                Briefcase,
                "No Services Available",
                "There are currently no services available in this category."
              )
            )
          ) : (
            providers.length > 0 ? (
              <FlatList
                data={providers}
                renderItem={renderProviderCard}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              renderEmptyState(
                Users,
                "No Providers Available",
                "There are currently no service providers available in this category."
              )
            )
          )}
        </View>
      </ScrollView>
    </View>
  );
}
