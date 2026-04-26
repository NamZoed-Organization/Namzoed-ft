import AddServicesModal from "@/components/modals/AddServicesModal";
import TopNavbar from "@/components/ui/TopNavbar";
import { getServiceCategoryBySlug } from "@/data/servicecategory";
import { fetchProviderServicesByCategory, ProviderServiceWithDetails } from "@/lib/servicesService";
import { useAppRouter } from "@/utils/navigation";
import { getInitials } from "@/utils/initials";
import { Href, useLocalSearchParams, useFocusEffect } from "expo-router";
import { ArrowUpDown, Shuffle, ChevronLeft, Plus, Search, Verified } from "lucide-react-native";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { ActivityIndicator, FlatList, Image, StyleSheet, Text, TouchableOpacity, View, BackHandler } from "react-native";
import * as Haptics from "expo-haptics";
import { useUser } from "@/contexts/UserContext";

type SortOrder = 'latest' | 'oldest';

export default function ServiceDetailScreen() {
  const router = useAppRouter();
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

  const [showAddModal, setShowAddModal] = useState(false);
  const canAddService = !!currentUser?.id && slug !== "government-services";


  const loadServices = async () => {
    if (!slug) return;

    try {
      setLoading(true);
      const foundCategory = getServiceCategoryBySlug(slug);
      if (foundCategory) {
        setCategory(foundCategory);
        const providerServices = await fetchProviderServicesByCategory(slug);
        setServices(providerServices);
        loadProviders(providerServices);
      }
    } catch (error) {
      console.error('Error loading services:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProviders = (serviceList: ProviderServiceWithDetails[]) => {
    setLoadingProviders(true);

    // Derive unique providers directly from the already-fetched services
    const providerMap = new Map<string, any>();
    for (const svc of serviceList) {
      if (!svc.service_providers || svc.status === false) continue;
      const pid = svc.service_providers.id;
      if (!providerMap.has(pid)) {
        providerMap.set(pid, {
          ...svc.service_providers,
          created_at: svc.created_at,
          provider_services: [],
        });
      }
      providerMap.get(pid).provider_services.push({
        id: svc.id,
        name: svc.name,
        service_categories: { slug },
      });
    }

    setProviders(Array.from(providerMap.values()));
    setLoadingProviders(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadServices();
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
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.push('/services');
  };

  const renderServiceCard = ({ item }: { item: ProviderServiceWithDetails }) => {
    const providerName = item.service_providers?.name || item.service_providers?.profiles?.name || 'Unknown Provider';
    const providerImage = item.service_providers?.profiles?.avatar_url ||
                         item.service_providers?.profile_url;

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
            <View className="mr-1.5">
              {providerImage ? (
                <Image source={{ uri: providerImage }} className="w-6 h-6 rounded-full" />
              ) : (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: '#e0e7ef',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#094569' }}>
                    {getInitials(providerName)}
                  </Text>
                </View>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-[10px] text-gray-500">Service by</Text>
              <Text className="text-xs font-medium text-gray-900" numberOfLines={1}>{providerName}</Text>
              {item.service_providers?.verification_status === 'verified' && (
                <View className="flex-row items-center bg-blue-50 border border-[#094569] rounded-full px-1.5 py-0.5 gap-0.5 self-start mt-0.5">
                  <Verified size={9} color="#094569" />
                  <Text className="text-[9px] font-msemibold text-[#094569] leading-none">Verified</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderProviderCard = ({ item }: { item: any }) => {
    const providerName = item.name || item.profiles?.name || 'Unknown Provider';
    const providerImage = item.profiles?.avatar_url || item.profile_url;
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
          <View className="mb-2">
            {providerImage ? (
              <Image source={{ uri: providerImage }} className="w-16 h-16 rounded-full" />
            ) : (
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: '#e0e7ef',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: '700', color: '#094569' }}>
                  {getInitials(providerName)}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-sm font-msemibold text-gray-900 text-center" numberOfLines={1}>
            {providerName}
          </Text>
          {item.verification_status === 'verified' && (
            <View className="flex-row items-center bg-blue-50 border border-[#094569] rounded-full px-1.5 py-0.5 gap-0.5 mt-0.5">
              <Verified size={9} color="#094569" />
              <Text className="text-[9px] font-msemibold text-[#094569] leading-none">Verified</Text>
            </View>
          )}
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

      {/* Top bar: back + title + add */}
      <View className="flex-row items-center px-4 pt-2 pb-2 bg-background">
        <TouchableOpacity
          onPress={handleBackPress}
          activeOpacity={0.7}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: '#ffffff',
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 2,
          }}
        >
          <ChevronLeft size={22} color="#0f172a" strokeWidth={2.5} />
        </TouchableOpacity>

        <Text
          className="text-xl font-mbold text-gray-900 flex-1 mx-3"
          numberOfLines={1}
        >
          {category.name}
        </Text>

        {canAddService && (
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            activeOpacity={0.85}
            style={{
              height: 40,
              paddingHorizontal: 16,
              borderRadius: 20,
              backgroundColor: '#094569',
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#094569',
              shadowOpacity: 0.25,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              elevation: 3,
            }}
          >
            <Plus size={16} color="white" strokeWidth={2.8} />
            <Text className="text-white font-msemibold text-sm ml-1">Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Segmented tabs */}
      <View className="px-4 pb-2 bg-background">
        <View
          style={{
            backgroundColor: '#f1f5f9',
            borderRadius: 999,
            padding: 4,
            flexDirection: 'row',
          }}
        >
          <TouchableOpacity
            onPress={() => setActiveTab('services')}
            activeOpacity={0.85}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: activeTab === 'services' ? '#ffffff' : 'transparent',
              shadowColor: activeTab === 'services' ? '#000' : 'transparent',
              shadowOpacity: activeTab === 'services' ? 0.08 : 0,
              shadowRadius: activeTab === 'services' ? 4 : 0,
              shadowOffset: { width: 0, height: 1 },
              elevation: activeTab === 'services' ? 2 : 0,
            }}
          >
            <Text
              className={`text-center text-sm font-msemibold ${
                activeTab === 'services' ? 'text-primary' : 'text-gray-500'
              }`}
            >
              Services
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('providers')}
            activeOpacity={0.85}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: activeTab === 'providers' ? '#ffffff' : 'transparent',
              shadowColor: activeTab === 'providers' ? '#000' : 'transparent',
              shadowOpacity: activeTab === 'providers' ? 0.08 : 0,
              shadowRadius: activeTab === 'providers' ? 4 : 0,
              shadowOffset: { width: 0, height: 1 },
              elevation: activeTab === 'providers' ? 2 : 0,
            }}
          >
            <Text
              className={`text-center text-sm font-msemibold ${
                activeTab === 'providers' ? 'text-primary' : 'text-gray-500'
              }`}
            >
              Providers
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Count + Sort / Shuffle toolbar */}
      <View className="flex-row items-center px-4 pt-1 pb-2 gap-x-2 bg-background">
        <View className="bg-primary/10 px-3 py-1.5 rounded-full">
          <Text className="text-primary font-msemibold text-xs">
            {activeTab === 'services'
              ? `${services.length} ${services.length === 1 ? 'Service' : 'Services'}`
              : `${providers.length} ${providers.length === 1 ? 'Provider' : 'Providers'}`}
          </Text>
        </View>
        <View className="flex-1" />
        {((activeTab === 'services' && services.length > 0) ||
          (activeTab === 'providers' && providers.length > 0)) &&
          (activeTab === 'services' ? (
            <>
              <TouchableOpacity
                onPress={toggleSortOrder}
                className={`px-3 py-1.5 rounded-full border flex-row items-center gap-x-1 ${
                  !isShuffled ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                }`}
                activeOpacity={0.8}
              >
                <ArrowUpDown size={13} color={!isShuffled ? '#FFFFFF' : '#475569'} />
                {!isShuffled && (
                  <Text className="text-[11px] font-msemibold text-white">
                    {sortOrder === 'latest' ? 'Latest' : 'Oldest'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleShuffle}
                className={`px-3 py-1.5 rounded-full border flex-row items-center gap-x-1 ${
                  isShuffled ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                }`}
                activeOpacity={0.8}
              >
                <Shuffle size={13} color={isShuffled ? '#FFFFFF' : '#094569'} />
                <Text
                  className={`text-[11px] font-msemibold ${
                    isShuffled ? 'text-white' : 'text-primary'
                  }`}
                >
                  Shuffle
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                onPress={toggleProviderSortOrder}
                className={`px-3 py-1.5 rounded-full border flex-row items-center gap-x-1 ${
                  !isProviderShuffled ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                }`}
                activeOpacity={0.8}
              >
                <ArrowUpDown size={13} color={!isProviderShuffled ? '#FFFFFF' : '#475569'} />
                {!isProviderShuffled && (
                  <Text className="text-[11px] font-msemibold text-white">
                    {providerSortOrder === 'latest' ? 'Latest' : 'Oldest'}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleProviderShuffle}
                className={`px-3 py-1.5 rounded-full border flex-row items-center gap-x-1 ${
                  isProviderShuffled ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                }`}
                activeOpacity={0.8}
              >
                <Shuffle size={13} color={isProviderShuffled ? '#FFFFFF' : '#094569'} />
                <Text
                  className={`text-[11px] font-msemibold ${
                    isProviderShuffled ? 'text-white' : 'text-primary'
                  }`}
                >
                  Shuffle
                </Text>
              </TouchableOpacity>
            </>
          ))}
      </View>

      {/* Search trigger (opens modal scoped to this category) */}
      <TouchableOpacity
        onPress={() => router.push(`/(users)/services/search?scope=${slug}` as any)}
        activeOpacity={0.85}
        style={slugStyles.searchContainer}
      >
        <Search size={15} color="#94A3B8" style={{ marginRight: 8 }} />
        <Text style={slugStyles.searchPlaceholder}>
          {`Search ${category?.name?.toLowerCase() || 'services'}...`}
        </Text>
      </TouchableOpacity>

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

      {canAddService && currentUser?.id && (
        <AddServicesModal
          isVisible={showAddModal}
          onClose={() => setShowAddModal(false)}
          userId={currentUser.id}
          onSuccess={() => {
            setShowAddModal(false);
            loadServices();
          }}
          lockedCategorySlug={slug}
        />
      )}

    </View>
  );
}

const slugStyles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 13,
    color: "#94A3B8",
  },
});
