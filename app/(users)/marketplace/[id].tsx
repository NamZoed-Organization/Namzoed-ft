import { useLocalSearchParams, useRouter, Stack, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  MessageCircle,
  Phone,
  User,
  ChevronLeft,
  ChevronRight,
  Flag,
  Bookmark,
} from 'lucide-react-native';
import { fetchMarketplaceItemById, MarketplaceItemWithUser } from '@/lib/postMarketPlace';
import { supabase } from '@/lib/supabase';
import ImageWithFallback from '@/components/ui/ImageWithFallback';
import MarketplaceImageViewer from '@/components/MarketplaceImageViewer';
import ReportProductModal from '@/components/ReportProductModal';
import { useUser } from '@/contexts/UserContext';

const { width: screenWidth } = Dimensions.get('window');

export default function MarketplaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useUser();
  const [item, setItem] = useState<MarketplaceItemWithUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadItem = useCallback(async (isRefreshing = false) => {
    if (!id) return;

    try {
      if (!isRefreshing) setIsLoading(true);
      const data = await fetchMarketplaceItemById(id);
      setItem(data);

      // Check if bookmarked
      if (currentUser) {
        const { data: bookmarkData } = await supabase
          .from('user_bookmarks')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('marketplace_id', id)
          .single();

        setIsBookmarked(!!bookmarkData);
      }
    } catch (error) {
      console.error('Error loading item:', error);
      Alert.alert('Error', 'Failed to load item details');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [id, currentUser]);

  // Reload data every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadItem();
    }, [loadItem])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadItem(true);
  };

  const handleCall = () => {
    if (item?.profiles?.phone) {
      Linking.openURL(`tel:${item.profiles.phone}`);
    } else {
      Alert.alert('No Phone', 'Phone number not available');
    }
  };

  const handleMessage = () => {
    if (currentUser?.id === item?.user_id) {
      Alert.alert('Your Listing', 'This is your own product');
      return;
    }

    if (item?.user_id) {
      router.push(`/(users)/chat/${item.user_id}` as any);
    }
  };

  const handleReportItem = () => {
    if (!currentUser) {
      Alert.alert("Sign in required", "Please sign in to report items.");
      return;
    }
    setShowReportModal(true);
  };

  const toggleBookmark = async () => {
    if (!currentUser) {
      Alert.alert("Sign in required", "Please sign in to bookmark items.");
      return;
    }
    if (!item) return;

    // Optimistic update
    const previousState = isBookmarked;
    setIsBookmarked(!isBookmarked);

    try {
      if (previousState) {
        // Remove bookmark
        const { error } = await supabase
          .from('user_bookmarks')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('marketplace_id', item.id);
        if (error) throw error;
      } else {
        // Add bookmark
        const { error } = await supabase
          .from('user_bookmarks')
          .insert({
            user_id: currentUser.id,
            marketplace_id: item.id
          });
        if (error) throw error;
      }
    } catch (err) {
      console.error("Bookmark error:", err);
      setIsBookmarked(previousState); // Revert
      Alert.alert("Error", "Failed to update bookmark");
    }
  };

  const nextImage = () => {
    if (item?.images && currentImageIndex < item.images.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    }
  };

  const prevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#094569" />
        <Text className="text-sm text-gray-600 mt-2">Loading details...</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-lg text-gray-600">Item not found</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-4 px-6 py-3 bg-primary rounded-lg"
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="bg-white border-b border-gray-200 pt-12 pb-4 px-4">
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-4 p-2 -ml-2"
            >
              <ArrowLeft size={24} color="#000" />
            </TouchableOpacity>
            <Text className="text-xl font-bold text-gray-900 flex-1">
              Item Details
            </Text>
            {/* Action Buttons */}
            <View className="flex-row items-center gap-2">
              {/* Bookmark Button */}
              <TouchableOpacity
                onPress={toggleBookmark}
                className="w-10 h-10 items-center justify-center"
              >
                <Bookmark
                  size={22}
                  color={isBookmarked ? "#FBBF24" : "#666"}
                  fill={isBookmarked ? "#FBBF24" : "none"}
                />
              </TouchableOpacity>

              {/* Report Button */}
              <TouchableOpacity
                onPress={handleReportItem}
                className="p-2 -mr-2"
              >
                <Flag size={22} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#094569"
              colors={["#094569"]}
            />
          }
        >
          {/* Image Carousel */}
          <View className="relative">
            <TouchableOpacity
              onPress={() => setShowImageViewer(true)}
              activeOpacity={0.9}
            >
              <ImageWithFallback
                source={{ uri: item.images[currentImageIndex] || '' }}
                className="w-full h-80"
                resizeMode="cover"
              />
            </TouchableOpacity>

            {/* Image Navigation */}
            {item.images.length > 1 && (
              <>
                {/* Previous Button */}
                {currentImageIndex > 0 && (
                  <TouchableOpacity
                    onPress={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-2"
                  >
                    <ChevronLeft size={24} color="white" />
                  </TouchableOpacity>
                )}

                {/* Next Button */}
                {currentImageIndex < item.images.length - 1 && (
                  <TouchableOpacity
                    onPress={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 rounded-full p-2"
                  >
                    <ChevronRight size={24} color="white" />
                  </TouchableOpacity>
                )}

                {/* Image Counter */}
                <View className="absolute bottom-4 right-4 bg-black/70 px-3 py-1 rounded-full">
                  <Text className="text-white text-sm font-medium">
                    {currentImageIndex + 1} / {item.images.length}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Content */}
          <View className="p-4">
            {/* Type Badge */}
            <View className="flex-row mb-3">
              <View className="bg-primary/10 px-3 py-1 rounded-full">
                <Text className="text-primary text-xs font-semibold uppercase">
                  {item.type}
                </Text>
              </View>
            </View>

            {/* Title */}
            <Text className="text-2xl font-bold text-gray-900 mb-3">
              {item.title}
            </Text>

            {/* Price */}
            {(item.type === 'rent' || item.type === 'secondhand') && item.price > 0 && (
              <Text className="text-3xl font-bold text-primary mb-4">
                Nu. {item.price.toLocaleString()}
              </Text>
            )}

            {/* Location & Date */}
            <View className="flex-row items-center mb-4 gap-4">
              {item.dzongkhag && (
                <View className="flex-row items-center">
                  <MapPin size={16} color="#666" />
                  <Text className="text-sm text-gray-600 ml-1">{item.dzongkhag}</Text>
                </View>
              )}
              <View className="flex-row items-center">
                <Calendar size={16} color="#666" />
                <Text className="text-sm text-gray-600 ml-1">
                  {formatDate(item.created_at)}
                </Text>
              </View>
            </View>

            {/* Description */}
            <View className="mb-6">
              <Text className="text-lg font-semibold text-gray-900 mb-2">
                Description
              </Text>
              <Text className="text-base text-gray-700 leading-6">
                {item.description}
              </Text>
            </View>

            {/* Tags */}
            {item.tags && item.tags.length > 0 && (
              <View className="mb-6">
                <Text className="text-lg font-semibold text-gray-900 mb-2">
                  Tags
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {item.tags.map((tag: string, index: number) => (
                    <View key={index} className="bg-blue-100 px-3 py-2 rounded-lg">
                      <Text className="text-sm text-blue-800 font-medium">{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Seller Info */}
            <View className="bg-gray-50 rounded-xl p-4 mb-6">
              <Text className="text-lg font-semibold text-gray-900 mb-3">
                Seller Information
              </Text>
              <View className="flex-row items-center mb-3">
                <View className="w-12 h-12 bg-gray-300 rounded-full items-center justify-center mr-3">
                  <User size={24} color="#666" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">
                    {item.profiles?.name || 'Anonymous User'}
                  </Text>
                  {item.profiles?.email && (
                    <Text className="text-sm text-gray-600">{item.profiles.email}</Text>
                  )}
                </View>
              </View>

              {/* Contact Button */}
              <TouchableOpacity
                onPress={handleMessage}
                className="bg-primary flex-row items-center justify-center py-3 rounded-lg mt-2"
              >
                <MessageCircle size={18} color="white" />
                <Text className="text-white font-semibold ml-2">Message</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Spacing */}
          <View className="h-20" />
        </ScrollView>
      </View>

      {/* Image Viewer Modal */}
      {item && (
        <MarketplaceImageViewer
          visible={showImageViewer}
          images={item.images}
          initialIndex={currentImageIndex}
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {/* Report Modal */}
      {currentUser?.id && item && item.user_id && (
        <ReportProductModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          productId={item.id}
          productName={item.title}
          productOwnerId={item.user_id}
          currentUserId={currentUser.id}
          onReportSuccess={() => {
            setShowReportModal(false);
          }}
        />
      )}
    </>
  );
}
