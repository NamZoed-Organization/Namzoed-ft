import { useUser } from "@/contexts/UserContext";
import { fetchProductById, ProductWithUser } from "@/lib/productsService";
import { supabase } from "@/lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import ReportProductModal from "@/components/ReportProductModal";
import CountdownTimer from "@/components/CountdownTimer";

function DetailSkeleton() {
  return (
    <View className="flex-1 bg-white">
      <View className="w-full h-72 bg-gray-200 animate-pulse" />
      <View className="p-4">
        <View className="h-6 bg-gray-200 rounded w-3/4 mb-3 animate-pulse" />
        <View className="h-5 bg-gray-200 rounded w-1/3 mb-4 animate-pulse" />
        <View className="flex-row items-center gap-2 mb-2">
          <View className="h-4 bg-gray-100 rounded w-24 animate-pulse" />
        </View>
        <View className="flex-row items-center gap-2 mb-4">
          <View className="h-4 bg-gray-100 rounded w-32 animate-pulse" />
        </View>
        <View className="h-4 bg-gray-100 rounded w-full mb-2 animate-pulse" />
        <View className="h-4 bg-gray-100 rounded w-full mb-2 animate-pulse" />
        <View className="h-4 bg-gray-100 rounded w-2/3 mb-6 animate-pulse" />
        <View className="h-12 bg-gray-200 rounded-lg w-full animate-pulse" />
      </View>
    </View>
  );
}

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useUser();

  const [product, setProduct] = useState<ProductWithUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Bookmark State
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Refresh & Report State
  const [refreshing, setRefreshing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Load product data - wrapped in useCallback for useFocusEffect
  const loadProduct = useCallback(async (isRefreshing = false) => {
    if (!id) return;

    if (!isRefreshing) setLoading(true);
    setError(null);
    try {
      const data = await fetchProductById(id);
      setProduct(data);

      // Check if bookmarked
      if (currentUser) {
        const { data: bookmarkData } = await supabase
          .from('user_bookmarks')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('product_id', id)
          .single();

        setIsBookmarked(!!bookmarkData);
      }
    } catch (err: any) {
      console.error("Error loading product:", err);
      setError(err.message || "Failed to load product");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, currentUser]);

  // Reload data every time screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadProduct();
    }, [loadProduct])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadProduct(true);
  };

  const toggleBookmark = async () => {
    if (!currentUser) {
        Alert.alert("Sign in required", "Please sign in to save items.");
        return;
    }
    if (!product) return;

    // Optimistic Update
    const previousState = isBookmarked;
    setIsBookmarked(!isBookmarked);

    try {
        if (previousState) {
            // Remove
            const { error } = await supabase
                .from('user_bookmarks')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('product_id', product.id);
            if (error) throw error;
        } else {
            // Add
            const { error } = await supabase
                .from('user_bookmarks')
                .insert({
                    user_id: currentUser.id,
                    product_id: product.id
                });
            if (error) throw error;
        }
    } catch (err) {
        console.error("Bookmark error:", err);
        setIsBookmarked(previousState); // Revert
        Alert.alert("Error", "Failed to update bookmark");
    }
  };

  const handleMessageSeller = () => {
    if (!product) return;

    // Prevent messaging yourself on your own product
    if (currentUser?.id === product.user_id) {
      Alert.alert("Info", "This is your own product");
      return;
    }

    // Navigate to chat with seller
    router.push(`/(users)/chat/${product.user_id}`);
  };

  const handleReportProduct = () => {
    if (!currentUser) {
      Alert.alert("Sign in required", "Please sign in to report products.");
      return;
    }
    setShowReportModal(true);
  };

  if (loading) return <DetailSkeleton />;

  if (error || !product) {
    return (
      <View className="flex-1 justify-center items-center bg-white px-4">
        <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
        <Text className="text-gray-600 text-center mt-4 mb-6">
          {error || "Product not found."}
        </Text>
        <TouchableOpacity 
          className="bg-primary px-6 py-3 rounded-lg"
          onPress={() => router.back()}
        >
          <Text className="text-white font-semibold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasImages = product.images && product.images.length > 0;
  const images = hasImages ? product.images : [];
  const mainImage = hasImages ? { uri: images[activeImageIndex] } : null;

  return (
    <View className="flex-1 bg-white">
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
        {/* Main Image */}
        {mainImage ? (
          <Image
            source={mainImage}
            className="w-full h-72 bg-gray-100"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-72 bg-gray-200 items-center justify-center">
            <Ionicons name="image-outline" size={48} color="#9CA3AF" />
          </View>
        )}

        {/* Image Thumbnails */}
        {images.length > 1 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            className="px-4 py-3 bg-gray-50"
          >
            {images.map((img, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setActiveImageIndex(index)}
                className={`mr-2 rounded-lg overflow-hidden border-2 ${
                  activeImageIndex === index ? 'border-primary' : 'border-transparent'
                }`}
              >
                <Image 
                  source={{ uri: img }} 
                  className="w-16 h-16 bg-gray-200" 
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Content Section */}
        <View className="p-4 relative">

          {/* Report & Bookmark Buttons Row */}
          <View className="flex-row absolute top-4 right-4 z-10 gap-2">
            {/* Report Button */}
            <TouchableOpacity
              onPress={handleReportProduct}
              className="w-10 h-10 bg-white rounded-full items-center justify-center shadow-sm border border-gray-200"
            >
              <Ionicons name="flag-outline" size={20} color="#EF4444" />
            </TouchableOpacity>

            {/* Bookmark Button */}
            <TouchableOpacity
              onPress={toggleBookmark}
              className="w-10 h-10 bg-primary rounded-full items-center justify-center shadow-sm"
            >
              <Ionicons
                name={isBookmarked ? "bookmark" : "bookmark-outline"}
                size={22}
                color="#FBBF24"
              />
            </TouchableOpacity>
          </View>

          {/* Category & Tags */}
          <View className="flex-row flex-wrap gap-2 mb-3 pr-12">
            <View className="bg-gray-100 px-3 py-1 rounded-full">
              <Text className="text-xs text-gray-600">{product.category}</Text>
            </View>
            {product.tags?.slice(0, 3).map((tag, i) => (
              <View key={i} className="bg-primary/10 px-3 py-1 rounded-full">
                <Text className="text-xs text-primary">{tag}</Text>
              </View>
            ))}
          </View>

          {/* Title */}
          <Text className="text-xl font-bold text-gray-900 mb-2 pr-2">
            {product.name}
          </Text>

          {/* Price Display with Discount Support */}
          <View className="mb-4">
            {product.is_currently_active ? (
              // Show discount pricing
              <View>
                {/* Original price struck through */}
                <Text className="text-base text-gray-400 line-through mb-1">
                  Nu. {product.price.toLocaleString()}
                </Text>

                {/* Discounted price + badge + time remaining in same row */}
                <View className="flex-row items-center gap-3 flex-wrap">
                  <Text className="text-2xl font-bold text-primary">
                    Nu. {product.current_price?.toLocaleString()}
                  </Text>

                  {/* Discount badge */}
                  <View className="bg-red-500 px-2 py-1 rounded-md">
                    <Text className="text-white text-xs font-bold">
                      -{product.discount_percent}% OFF
                    </Text>
                  </View>

                  {/* Time remaining */}
                  <CountdownTimer endsAt={product.discount_ends_at} />
                </View>
              </View>
            ) : (
              // Show regular price (no discount)
              <Text className="text-2xl font-bold text-primary">
                Nu. {product.price.toLocaleString()}
              </Text>
            )}
          </View>

          {/* Seller Info */}
          {product.profiles?.name && (
            <View className="flex-row items-center gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
              <View className="w-10 h-10 bg-gray-300 rounded-full items-center justify-center">
                <Ionicons name="person" size={20} color="#6B7280" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-900">
                  {product.profiles.name}
                </Text>
                <Text className="text-xs text-gray-500">Seller</Text>
              </View>
              {/* Message Button */}
              <TouchableOpacity
                onPress={handleMessageSeller}
                className="bg-primary px-4 py-2 rounded-lg flex-row items-center gap-1"
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-outline" size={16} color="white" />
                <Text className="text-white font-semibold text-sm">Chat</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Description */}
          <Text className="text-sm font-semibold text-gray-900 mb-2">Description</Text>
          <Text className="text-base text-gray-600 leading-6 mb-6">
            {product.description || "No description provided."}
          </Text>

          {/* Posted Date */}
          <Text className="text-xs text-gray-400 mb-6">
            Posted {new Date(product.created_at).toLocaleDateString()}
          </Text>
        </View>
      </ScrollView>

      {/* Report Modal */}
      {currentUser && product && product.user_id && (
        <ReportProductModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          productId={product.id}
          productName={product.name}
          productOwnerId={product.user_id}
          currentUserId={currentUser.id}
          onReportSuccess={() => {
            setShowReportModal(false);
          }}
        />
      )}
    </View>
  );
}