import TopNavbar from "@/components/ui/TopNavbar";
import { getServiceCategoryBySlug } from "@/data/servicecategory";
import { fetchAllServiceProviders, fetchProviderServicesByCategory, ProviderServiceWithDetails } from "@/lib/servicesService";
import { Href, router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { User, ArrowUpDown, Shuffle, ChevronLeft, CheckCircle2 } from "lucide-react-native";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View, BackHandler } from "react-native";
import * as Haptics from "expo-haptics";
import { useUser } from "@/contexts/UserContext";

type SortOrder = 'latest' | 'oldest';

export default function ServiceDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { currentUser } = useUser();

  const [category, setCategory] = useState<any>(null);
  const [services, setServices] = useState<ProviderServiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'services' | 'providers'>('services');
  const [providers, setProviders] = useState<any[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest');
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffling, setShuffling] = useState(false);
  const [shuffleKey, setShuffleKey] = useState(0);

  // Provider sorting and shuffling states
  const [providerSortOrder, setProviderSortOrder] = useState<SortOrder>('latest');
  const [isProviderShuffled, setIsProviderShuffled] = useState(false);
  const [providerShuffling, setProviderShuffling] = useState(false);
  const [providerShuffleKey, setProviderShuffleKey] = useState(0);

  const loadServices = async () => {
    if (!slug) return;

    try {
      setLoading(true);
      const foundCategory = getServiceCategoryBySlug(slug);
      if (foundCategory) {
        setCategory(foundCategory);
        const providerServices = await fetchProviderServicesByCategory(slug);
        setServices(providerServices);
      }
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = async () => {
    if (!slug) return;

    try {
      setLoadingProviders(true);
      const allProviders = await fetchAllServiceProviders();

      // Filter providers who have services in this category
      const providersInCategory = allProviders.filter(provider =>
        provider.provider_services?.some((service: any) =>
          service.service_categories?.slug === slug
        )
      );

      setProviders(providersInCategory);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (activeTab === 'services') {
      await loadServices();
    } else {
      await loadProviders();
    }
    setRefreshing(false);
  };

  // Toggle sort order
  const toggleSortOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isShuffled) {
      // If shuffled, reset to sorted state
      setIsShuffled(false);
      setSortOrder('latest');
    } else {
      // Toggle between latest and oldest
      setSortOrder(prev => prev === 'latest' ? 'oldest' : 'latest');
    }
  };

  // Shuffle services
  const handleShuffle = async () => {
    console.log('Shuffling');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShuffling(true);
    setIsShuffled(true);

    // Increment shuffle key to force re-shuffle
    setShuffleKey(prev => prev + 1);

    // Simulate loading animation
    await new Promise(resolve => setTimeout(resolve, 500));

    setShuffling(false);
  };

  // Toggle provider sort order
  const toggleProviderSortOrder = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isProviderShuffled) {
      // If shuffled, reset to sorted state
      setIsProviderShuffled(false);
      setProviderSortOrder('latest');
    } else {
      // Toggle between latest and oldest
      setProviderSortOrder(prev => prev === 'latest' ? 'oldest' : 'latest');
    }
  };

  // Shuffle providers
  const handleProviderShuffle = async () => {
    console.log('Shuffling Providers');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProviderShuffling(true);
    setIsProviderShuffled(true);

    // Increment shuffle key to force re-shuffle
    setProviderShuffleKey(prev => prev + 1);

    // Simulate loading animation
    await new Promise(resolve => setTimeout(resolve, 500));

    setProviderShuffling(false);
  };

  // Memoize sorted/shuffled services
  const displayedServices = useMemo(() => {
    // Filter out deactivated services (status === false)
    const activeServices = services.filter(service => service.status !== false);

    if (isShuffled) {
      // Fisher-Yates shuffle algorithm
      const shuffled = [...activeServices];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    } else {
      // Sort by created_at
      return [...activeServices].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'latest' ? dateB - dateA : dateA - dateB;
      });
    }
  }, [services, sortOrder, isShuffled, shuffleKey]);

  // Memoize sorted/shuffled providers
  const displayedProviders = useMemo(() => {
    if (isProviderShuffled) {
      // Fisher-Yates shuffle algorithm
      const shuffled = [...providers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    } else {
      // Sort by created_at
      return [...providers].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return providerSortOrder === 'latest' ? dateB - dateA : dateA - dateB;
      });
    }
  }, [providers, providerSortOrder, isProviderShuffled, providerShuffleKey]);

  useEffect(() => {
    loadServices();
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'providers') {
      loadProviders();
    }
  }, [activeTab, slug]);

  // Handle Android back button
  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBackPress();
        return true;
      });

      return () => backHandler.remove();
    }, [])
  );

  const handleBackPress = () => {
    router.push('/services');
  };

  const renderServiceCard = ({ item }: { item: ProviderServiceWithDetails }) => {
    const providerName = item.service_providers?.profiles?.name || 'Unknown Provider';
    const providerImage = item.service_providers?.profile_url ||
                         item.service_providers?.profiles?.avatar_url;

    // Prevent stretching when there's only one item
    const cardStyle = displayedServices.length === 1 ? { maxWidth: '48%' } : {};

    return (
      <TouchableOpacity
        className="bg-white rounded-xl shadow-sm border border-gray-100 mb-3 overflow-hidden flex-1 mx-1.5"
        style={cardStyle}
        onPress={() => router.push(`/servicedetail/${item.id}` as Href)}
        activeOpacity={0.7}
      >
        {/* Service Image */}
        {item.images && item.images.length > 0 && (
          <Image
            source={{ uri: item.images[0] }}
            className="w-full h-32"
            resizeMode="cover"
          />
        )}

        {/* Service Info */}
        <View className="p-3">
          <Text className="text-base font-msemibold text-gray-900 mb-1" numberOfLines={1}>
            {item.name}
          </Text>

          <Text className="text-xs text-gray-600 mb-2" numberOfLines={2}>
            {item.description}
          </Text>

          {/* Provider Info */}
          <View className="flex-row items-center pt-2 border-t border-gray-100">
            <View className="relative mr-1.5">
              {providerImage ? (
                <Image
                  source={{ uri: providerImage }}
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <View className="w-6 h-6 rounded-full bg-gray-200" />
              )}
              {/* Verified Badge for small avatar */}
              {item.service_providers?.status === 'verified' && (
                <View className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full items-center justify-center border border-white">
                  <CheckCircle2 size={8} color="white" fill="white" />
                </View>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-[10px] text-gray-500">Service by</Text>
              <Text className="text-xs font-medium text-gray-900" numberOfLines={1}>{providerName}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderProviderCard = ({ item }: { item: any }) => {
    const providerName = item.name || item.profiles?.name || 'Unknown Provider';
    const providerImage = item.profile_url || item.profiles?.avatar_url;
    const userId = item.user_id;

    // Count services in this category
    const servicesInCategory = item.provider_services?.filter((service: any) =>
      service.service_categories?.slug === slug
    ) || [];
    const serviceCount = servicesInCategory.length;

    const handleProviderPress = () => {
      if (!userId) return;

      // Check if it's the current user's provider card
      if (currentUser && userId === currentUser.id) {
        // Navigate to own profile Work tab
        router.push('/(users)/profile?tab=work' as Href);
      } else {
        // Navigate to other user's profile Work tab
        router.push(`/(users)/profile/${userId}?tab=work` as Href);
      }
    };

    // Prevent stretching when there's only one item
    const cardStyle = displayedProviders.length === 1 ? { maxWidth: '48%' } : {};

    return (
      <TouchableOpacity
        className="bg-white rounded-xl shadow-sm border border-gray-100 mb-3 p-3 flex-1 mx-1.5"
        style={cardStyle}
        onPress={handleProviderPress}
        activeOpacity={0.7}
      >
        <View className="items-center mb-2">
          <View className="relative mb-2">
            {providerImage ? (
              <Image
                source={{ uri: providerImage }}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <View className="w-16 h-16 rounded-full bg-primary/20 items-center justify-center">
                <User size={24} color="#059669" />
              </View>
            )}
            {/* Verified Badge */}
            {item.status === 'verified' && (
              <View className="absolute top-0 right-0 w-5 h-5 bg-blue-500 rounded-full items-center justify-center border-2 border-white">
                <CheckCircle2 size={12} color="white" fill="white" />
              </View>
            )}
          </View>
          <Text className="text-sm font-msemibold text-gray-900 text-center" numberOfLines={1}>
            {providerName}
          </Text>
          <Text className="text-xs text-gray-500 text-center">
            {serviceCount} {serviceCount === 1 ? 'Service' : 'Services'}
          </Text>
        </View>

        {/* Services offered in this category */}
        <View className="flex-row flex-wrap gap-1 justify-center">
          {servicesInCategory.slice(0, 2).map((service: any, index: number) => (
            <View key={index} className="bg-primary/10 px-2 py-0.5 rounded-full">
              <Text className="text-primary font-msemibold text-[10px]" numberOfLines={1}>
                {service.name}
              </Text>
            </View>
          ))}
          {serviceCount > 2 && (
            <View className="bg-gray-100 px-2 py-0.5 rounded-full">
              <Text className="text-gray-600 font-msemibold text-[10px]">
                +{serviceCount - 2}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center py-20">
      <Text className="text-gray-400 text-lg font-msemibold mb-2">
        {activeTab === 'services' ? 'No Services Yet' : 'No Providers Yet'}
      </Text>
      <Text className="text-gray-400 text-sm text-center px-8">
        {activeTab === 'services'
          ? 'Be the first to offer services in this category!'
          : 'No providers are offering services in this category yet.'}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <TopNavbar />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#059669" />
          <Text className="text-gray-500 mt-4">Loading services...</Text>
        </View>
      </View>
    );
  }

  if (!category) {
    return (
      <View className="flex-1 bg-background">
        <TopNavbar />
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-500">Category not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <TopNavbar />

      {/* Back Button */}
      <View className="flex-row items-center gap-2 px-4 py-2 bg-white">
        <TouchableOpacity
          onPress={handleBackPress}
          activeOpacity={0.7}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: '#f5f5f5',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={24} color="#1a1a1a" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-gray-900">Back to Services</Text>
      </View>

      {/* Category Header */}
      <View className="p-4 bg-white border-b border-gray-100">
        <Text className="text-2xl font-mbold text-gray-900">{category.name}</Text>
        <Text className="text-gray-500 mt-1">{category.description}</Text>
        <View className="flex-row items-center justify-between mt-2">
          <View className="bg-primary/10 px-3 py-1 rounded-full">
            <Text className="text-primary font-msemibold text-xs">
              {activeTab === 'services'
                ? `${services.length} ${services.length === 1 ? 'Service' : 'Services'} Available`
                : `${providers.length} ${providers.length === 1 ? 'Provider' : 'Providers'}`}
            </Text>
          </View>

          {/* Sort and Shuffle buttons */}
          {activeTab === 'services' && services.length > 0 && (
            <View className="flex-row items-center gap-x-2">
              <TouchableOpacity
                onPress={toggleSortOrder}
                className={`px-3 py-1.5 rounded-full shadow-sm border flex-row items-center gap-x-1 ${
                  !isShuffled ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                }`}
                activeOpacity={0.7}
              >
                <ArrowUpDown size={14} color={!isShuffled ? "#FFFFFF" : "#1F2937"} />
                {!isShuffled && (
                  <Text className="text-xs font-msemibold text-white">
                    {sortOrder === 'latest' ? 'Latest' : 'Oldest'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleShuffle}
                className={`px-3 py-1.5 rounded-full shadow-sm border flex-row items-center gap-x-1 ${
                  isShuffled ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                }`}
                activeOpacity={0.7}
              >
                <Shuffle size={14} color={isShuffled ? "#FFFFFF" : "#059669"} />
                <Text className={`text-xs font-msemibold ${isShuffled ? 'text-white' : 'text-primary'}`}>
                  Shuffle
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {activeTab === 'providers' && providers.length > 0 && (
            <View className="flex-row items-center gap-x-2">
              <TouchableOpacity
                onPress={toggleProviderSortOrder}
                className={`px-3 py-1.5 rounded-full shadow-sm border flex-row items-center gap-x-1 ${
                  !isProviderShuffled ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                }`}
                activeOpacity={0.7}
              >
                <ArrowUpDown size={14} color={!isProviderShuffled ? "#FFFFFF" : "#1F2937"} />
                {!isProviderShuffled && (
                  <Text className="text-xs font-msemibold text-white">
                    {providerSortOrder === 'latest' ? 'Latest' : 'Oldest'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleProviderShuffle}
                className={`px-3 py-1.5 rounded-full shadow-sm border flex-row items-center gap-x-1 ${
                  isProviderShuffled ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                }`}
                activeOpacity={0.7}
              >
                <Shuffle size={14} color={isProviderShuffled ? "#FFFFFF" : "#059669"} />
                <Text className={`text-xs font-msemibold ${isProviderShuffled ? 'text-white' : 'text-primary'}`}>
                  Shuffle
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={() => setActiveTab('services')}
          className={`flex-1 py-3 border-b-2 ${
            activeTab === 'services' ? 'border-primary' : 'border-transparent'
          }`}
          activeOpacity={0.7}
        >
          <Text
            className={`text-center font-msemibold ${
              activeTab === 'services' ? 'text-primary' : 'text-gray-500'
            }`}
          >
            Services
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setActiveTab('providers')}
          className={`flex-1 py-3 border-b-2 ${
            activeTab === 'providers' ? 'border-primary' : 'border-transparent'
          }`}
          activeOpacity={0.7}
        >
          <Text
            className={`text-center font-msemibold ${
              activeTab === 'providers' ? 'text-primary' : 'text-gray-500'
            }`}
          >
            Providers
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'services' ? (
        shuffling ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#059669" />
            <Text className="text-gray-500 mt-4 font-msemibold">Shuffling...</Text>
          </View>
        ) : (
          <FlatList
            key={`${isShuffled ? 'shuffled' : sortOrder}-${shuffleKey}`}
            data={displayedServices}
            renderItem={renderServiceCard}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={{ padding: 12 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
        )
      ) : loadingProviders ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#059669" />
          <Text className="text-gray-500 mt-4">Loading providers...</Text>
        </View>
      ) : providerShuffling ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#059669" />
          <Text className="text-gray-500 mt-4 font-msemibold">Shuffling...</Text>
        </View>
      ) : (
        <FlatList
          key={`${isProviderShuffled ? 'shuffled' : providerSortOrder}-${providerShuffleKey}`}
          data={displayedProviders}
          renderItem={renderProviderCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={{ padding: 12 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      )}
    </View>
  );
}
