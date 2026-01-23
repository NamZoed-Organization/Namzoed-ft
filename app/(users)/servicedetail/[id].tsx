import TopNavbar from "@/components/ui/TopNavbar";
import { useUser } from '@/contexts/UserContext';
import { fetchProviderServiceById, ProviderServiceWithDetails } from "@/lib/servicesService";
import { Href, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { MessageCircle, User, ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, Dimensions, Image, ScrollView, Text, TouchableOpacity, View, BackHandler } from 'react-native';

const { width } = Dimensions.get('window');

export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useUser();
  const [service, setService] = useState<ProviderServiceWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    loadService();
  }, [id]);

  // Handle Android back button
  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleGoBack();
        return true;
      });

      return () => backHandler.remove();
    }, [])
  );

  const handleGoBack = () => {
    if (service?.category_id) {
      // Get the category slug from the service
      const categorySlug = service.service_categories?.slug;
      if (categorySlug) {
        router.push(`/services/${categorySlug}` as Href);
      } else {
        router.push('/services' as Href);
      }
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/services' as Href);
    }
  };

  const loadService = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const data = await fetchProviderServiceById(id);
      setService(data);
    } catch (error) {
      console.error('Error loading service:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProvider = () => {
    if (!service) return;

    const providerId = service.service_providers?.user_id;

    // Check if it's the current user's service
    if (providerId === currentUser?.id) {
      // Navigate to own profile Work tab
      router.push('/(users)/profile?tab=work' as Href);
    } else {
      // Navigate to other user's profile Work tab
      router.push(`/(users)/profile/${providerId}?tab=work` as Href);
    }
  };

  const handleMessageProvider = () => {
    if (!service) return;

    const providerId = service.service_providers?.user_id;

    // Check if it's the current user's service
    if (providerId === currentUser?.id) {
      return;
    }

    // Navigate to chat with provider
    if (providerId) {
      router.push(`/(users)/chat/${providerId}` as Href);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white">
        <TopNavbar />
        <View className="bg-white border-b border-gray-200 px-4 py-3">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={handleGoBack}
              className="mr-4 p-2 -ml-2"
            >
              <ArrowLeft size={24} color="#000" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-gray-900 flex-1">
              Service Details
            </Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#059669" />
          <Text className="text-gray-500 mt-4">Loading service details...</Text>
        </View>
      </View>
    );
  }

  if (!service) {
    return (
      <View className="flex-1 bg-white">
        <TopNavbar />
        <View className="bg-white border-b border-gray-200 px-4 py-3">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={handleGoBack}
              className="mr-4 p-2 -ml-2"
            >
              <ArrowLeft size={24} color="#000" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-gray-900 flex-1">
              Service Details
            </Text>
          </View>
        </View>
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Service not found</Text>
        </View>
      </View>
    );
  }

  const providerName = service.service_providers?.name ||
                       service.service_providers?.profiles?.name ||
                       'Unknown Provider';
  const providerImage = service.service_providers?.profile_url ||
                       service.service_providers?.profiles?.avatar_url;
  const categoryName = service.service_categories?.name || 'Service';

  return (
    <View className="flex-1 bg-white">
      <TopNavbar />

      {/* Header with Back Button */}
      <View className="bg-white border-b border-gray-200 px-4 py-3">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={handleGoBack}
            className="mr-4 p-2 -ml-2"
          >
            <ArrowLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-900 flex-1">
            Service Details
          </Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        {service.images && service.images.length > 0 && (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(event) => {
                const slideIndex = Math.ceil(
                  event.nativeEvent.contentOffset.x / width
                );
                setActiveImageIndex(slideIndex);
              }}
              scrollEventThrottle={16}
            >
              {service.images.map((imageUrl, index) => (
                <Image
                  key={index}
                  source={{ uri: imageUrl }}
                  style={{ width, height: 300 }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>

            {/* Image Pagination Dots */}
            {service.images.length > 1 && (
              <View className="absolute bottom-4 left-0 right-0 flex-row justify-center">
                {service.images.map((_, index) => (
                  <View
                    key={index}
                    className={`w-2 h-2 rounded-full mx-1 ${
                      index === activeImageIndex ? 'bg-white' : 'bg-white/50'
                    }`}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        <View className="p-5">
          {/* Category Badge */}
          <View className="flex-row items-center mb-3">
            <View className="bg-primary/10 px-3 py-1 rounded-full">
              <Text className="text-primary font-msemibold text-xs">{categoryName}</Text>
            </View>
          </View>

          {/* Service Name */}
          <Text className="text-2xl font-mbold text-gray-900 mb-2">
            {service.name}
          </Text>

          {/* Service Description */}
          <View className="mt-4">
            <Text className="text-lg font-msemibold text-gray-900 mb-2">
              About this service
            </Text>
            <Text className="text-gray-600 leading-6">
              {service.description}
            </Text>
          </View>

          {/* Provider Info */}
          <View className="mt-6">
            <Text className="text-base font-msemibold text-gray-900 mb-3">
              Service Provider
            </Text>

            <View className="flex-row items-center">
              <View className="relative mr-3">
                {providerImage ? (
                  <Image
                    source={{ uri: providerImage }}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <View className="w-12 h-12 rounded-full bg-primary/20 items-center justify-center">
                    <User size={24} color="#059669" />
                  </View>
                )}
                {/* Verified Badge */}
                {service.service_providers?.status === 'verified' && (
                  <View className="absolute top-0 right-0 w-4 h-4 bg-blue-500 rounded-full items-center justify-center border border-white">
                    <CheckCircle2 size={10} color="white" fill="white" />
                  </View>
                )}
              </View>
              <View className="flex-1">
                <Text className="text-base font-msemibold text-gray-900">
                  {providerName}
                </Text>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="mt-6 space-y-3">
            <TouchableOpacity
              className="bg-primary p-4 rounded-xl mb-6 flex-row items-center justify-center"
              onPress={handleViewProvider}
              activeOpacity={0.7}
            >
              <Text className="text-white font-mbold text-base">View Provider Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-white border-2 border-primary p-4 rounded-xl flex-row items-center justify-center"
              onPress={handleMessageProvider}
              activeOpacity={0.7}
            >
              <MessageCircle size={20} color="#059669" />
              <Text className="text-primary font-mbold text-base ml-2">Send Message</Text>
            </TouchableOpacity>
          </View>

          {/* Spacing at bottom */}
          <View className="h-8" />
        </View>
      </ScrollView>
    </View>
  );
}
