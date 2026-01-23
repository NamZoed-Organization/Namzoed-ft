import { useUser } from "@/contexts/UserContext";
import { fetchProductById, ProductWithUser } from "@/lib/productsService";
import { supabase } from "@/lib/supabase";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  Bookmark,
  Clock,
  Flag,
  MessageCircle,
  Moon,
  Package,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Tag,
  User,
  Verified
} from "lucide-react-native";
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  BackHandler,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Animated as RNAnimated,
  Share
} from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import ReportProductModal from "@/components/ReportProductModal";
import CountdownTimer from "@/components/CountdownTimer";
import PopupMessage from "@/components/ui/PopupMessage";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.45;

// Premium Skeleton Loader
function DetailSkeleton() {
  const shimmerAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const shimmer = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        RNAnimated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View className="flex-1 bg-[#FAFBFC]">
      <StatusBar barStyle="light-content" />
      <RNAnimated.View style={{ opacity, height: IMAGE_HEIGHT }} className="w-full bg-gray-200" />
      <View className="bg-white -mt-8 rounded-t-[32px] flex-1 px-6 pt-8">
        <RNAnimated.View style={{ opacity }} className="h-8 bg-gray-100 rounded-2xl w-3/4 mb-4" />
        <RNAnimated.View style={{ opacity }} className="h-10 bg-gray-100 rounded-2xl w-1/2 mb-6" />
        <RNAnimated.View style={{ opacity }} className="h-20 bg-gray-50 rounded-3xl w-full mb-6" />
        <RNAnimated.View style={{ opacity }} className="h-4 bg-gray-100 rounded-xl w-full mb-3" />
        <RNAnimated.View style={{ opacity }} className="h-4 bg-gray-100 rounded-xl w-full mb-3" />
        <RNAnimated.View style={{ opacity }} className="h-4 bg-gray-100 rounded-xl w-2/3" />
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

  // Popup states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');

  const showSuccessPopup = (message: string) => {
    setPopupMessage(message);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const showErrorPopup = (message: string) => {
    setPopupMessage(message);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  // Load product data
  const loadProduct = useCallback(async (isRefreshing = false) => {
    if (!id) return;

    if (!isRefreshing) setLoading(true);
    setError(null);
    try {
      const data = await fetchProductById(id);
      setProduct(data);

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

  useFocusEffect(
    useCallback(() => {
      loadProduct();
    }, [loadProduct])
  );

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleGoBack();
      return true;
    });
    return () => backHandler.remove();
  }, [product]);

  const handleGoBack = () => {
    if (product?.category) {
      router.push(`/categories/${product.category}`);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/categories');
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadProduct(true);
  };

  const toggleBookmark = async () => {
    if (!currentUser) {
      showErrorPopup("Please sign in to save items");
      return;
    }
    if (!product) return;

    const previousState = isBookmarked;
    setIsBookmarked(!isBookmarked);

    try {
      if (previousState) {
        const { error } = await supabase
          .from('user_bookmarks')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('product_id', product.id);
        if (error) throw error;
        showSuccessPopup("Removed from saves");
      } else {
        const { error } = await supabase
          .from('user_bookmarks')
          .insert({
            user_id: currentUser.id,
            product_id: product.id
          });
        if (error) throw error;
        showSuccessPopup("Saved to collection");
      }
    } catch (err) {
      console.error("Bookmark error:", err);
      setIsBookmarked(previousState);
      showErrorPopup("Failed to update bookmark");
    }
  };

  const handleMessageSeller = () => {
    if (!product) return;
    if (currentUser?.id === product.user_id) {
      showSuccessPopup("This is your own product");
      return;
    }
    router.push(`/(users)/chat/${product.user_id}`);
  };

  const handleShare = async () => {
    if (!product) return;
    try {
      await Share.share({
        message: `Check out ${product.name} for Nu. ${product.current_price || product.price} on Namzoed!`,
        title: product.name,
      });
    } catch (error) {
      console.error("Share error:", error);
    }
  };

  const handleReportProduct = () => {
    if (!currentUser) {
      showErrorPopup("Please sign in to report products");
      return;
    }
    setShowReportModal(true);
  };

  if (loading) return <DetailSkeleton />;

  if (error || !product) {
    return (
      <View className="flex-1 justify-center items-center bg-[#FAFBFC] px-6">
        <StatusBar barStyle="dark-content" />
        <View className="w-24 h-24 bg-gray-100 rounded-full items-center justify-center mb-6">
          <Package size={40} color="#9CA3AF" />
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-2">
          Oops! Something went wrong
        </Text>
        <Text className="text-gray-500 text-center mb-8">
          {error || "We couldn't find this product. It may have been removed."}
        </Text>
        <TouchableOpacity
          className="bg-primary px-8 py-4 rounded-2xl shadow-lg"
          onPress={handleGoBack}
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold text-base">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasImages = product.images && product.images.length > 0;
  const images = hasImages ? product.images : [];
  const mainImage = hasImages ? { uri: images[activeImageIndex] } : null;
  const savings = product.is_currently_active
    ? product.price - (product.current_price || 0)
    : 0;

  return (
    <View className="flex-1 bg-[#FAFBFC]">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bounces={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#094569"
            colors={["#094569"]}
          />
        }
      >
        {/* Hero Image Section */}
        <View style={{ height: IMAGE_HEIGHT }}>
          {mainImage ? (
            <Image
              source={mainImage}
              style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
              resizeMode="cover"
            />
          ) : (
            <View
              className="bg-gray-200 items-center justify-center"
              style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
            >
              <Package size={64} color="#D1D5DB" />
            </View>
          )}

          {/* Gradient Overlay */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent', 'transparent', 'rgba(0,0,0,0.3)']}
            locations={[0, 0.3, 0.7, 1]}
            className="absolute inset-0"
          />

          {/* Top Navigation Bar */}
          <View className="absolute top-0 left-0 right-0 pt-14 px-5">
            <View className="flex-row justify-between items-center">
              {/* Back Button */}
              <TouchableOpacity
                onPress={handleGoBack}
                activeOpacity={0.8}
                className="w-11 h-11 rounded-full overflow-hidden"
              >
                <BlurView intensity={30} tint="dark" className="flex-1 items-center justify-center">
                  <ArrowLeft size={22} color="white" strokeWidth={2.5} />
                </BlurView>
              </TouchableOpacity>

              {/* Right Actions */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleShare}
                  activeOpacity={0.8}
                  className="w-11 h-11 rounded-full overflow-hidden"
                >
                  <BlurView intensity={30} tint="dark" className="flex-1 items-center justify-center">
                    <Share2 size={20} color="white" />
                  </BlurView>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={toggleBookmark}
                  activeOpacity={0.8}
                  className="w-11 h-11 rounded-full overflow-hidden"
                >
                  <BlurView intensity={30} tint="dark" className="flex-1 items-center justify-center">
                    <Bookmark
                      size={20}
                      color={isBookmarked ? "#FBBF24" : "white"}
                      fill={isBookmarked ? "#FBBF24" : "transparent"}
                    />
                  </BlurView>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Image Pagination Dots */}
          {images.length > 1 && (
            <View className="absolute bottom-6 left-0 right-0 flex-row justify-center gap-2">
              {images.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setActiveImageIndex(index)}
                  activeOpacity={0.8}
                >
                  <View
                    className={`h-2 rounded-full ${
                      activeImageIndex === index
                        ? 'bg-white w-6'
                        : 'bg-white/40 w-2'
                    }`}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Content Card */}
        <Animated.View
          entering={FadeInUp.duration(400).delay(100)}
          className="bg-white -mt-8 rounded-t-[32px] min-h-screen"
          style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 20,
            elevation: 20,
          }}
        >
          {/* Drag Indicator */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 bg-gray-200 rounded-full" />
          </View>

          <View className="px-6 pt-4 pb-32">
            {/* Category & Tags */}
            <Animated.View
              entering={FadeInDown.duration(300).delay(200)}
              className="flex-row flex-wrap gap-2 mb-4"
            >
              <View className="bg-primary/10 px-4 py-1.5 rounded-full flex-row items-center gap-1.5">
                <Tag size={12} color="#094569" />
                <Text className="text-xs font-semibold text-primary">{product.category}</Text>
              </View>
              {product.tags?.slice(0, 2).map((tag, i) => (
                <View key={i} className="bg-gray-100 px-3 py-1.5 rounded-full">
                  <Text className="text-xs text-gray-600">{tag}</Text>
                </View>
              ))}
            </Animated.View>

            {/* Product Title */}
            <Animated.Text
              entering={FadeInDown.duration(300).delay(250)}
              className="text-2xl font-bold text-gray-900 mb-4 leading-tight"
            >
              {product.name}
            </Animated.Text>

            {/* Price Section - Closing Sale for Food, Regular Discount for others */}
            <Animated.View
              entering={FadeInDown.duration(300).delay(300)}
              className="mb-6"
            >
              {product.is_currently_active ? (
                product.category === 'food' ? (
                  /* ========== CLOSING SALE (Food) ========== */
                  <View className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 rounded-3xl border border-amber-200">
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center gap-2">
                        <View className="bg-amber-500 px-3 py-1.5 rounded-full flex-row items-center gap-1">
                          <Moon size={12} color="white" />
                          <Text className="text-white text-xs font-bold">
                            CLOSING SALE
                          </Text>
                        </View>
                        <Text className="text-amber-400 text-sm line-through">
                          Nu. {product.price.toLocaleString()}
                        </Text>
                      </View>
                      <View className="bg-amber-100 px-3 py-1 rounded-full">
                        <Text className="text-amber-700 text-xs font-semibold">
                          Save Nu. {savings.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-end justify-between">
                      <View>
                        <Text className="text-xs text-amber-600 mb-1">Closing Sale Price</Text>
                        <Text className="text-3xl font-bold text-amber-600">
                          Nu. {product.current_price?.toLocaleString()}
                        </Text>
                      </View>
                      <View className="items-end">
                        <View className="flex-row items-center gap-1 mb-1">
                          <Clock size={12} color="#D97706" />
                          <Text className="text-xs text-amber-600 font-medium">Ends in</Text>
                        </View>
                        <CountdownTimer endsAt={product.discount_ends_at} />
                      </View>
                    </View>

                    <Text className="text-xs text-amber-500 mt-3 text-center">
                      🌙 Grab it before it's gone!
                    </Text>
                  </View>
                ) : (
                  /* ========== REGULAR DISCOUNT (Non-Food) ========== */
                  <View className="bg-gradient-to-r from-primary/5 to-green-50 p-5 rounded-3xl border border-primary/10">
                    <View className="flex-row items-center justify-between mb-3">
                      <View className="flex-row items-center gap-2">
                        <View className="bg-red-500 px-3 py-1.5 rounded-full flex-row items-center gap-1">
                          <Sparkles size={12} color="white" />
                          <Text className="text-white text-xs font-bold">
                            {product.discount_percent}% OFF
                          </Text>
                        </View>
                        <Text className="text-gray-400 text-sm line-through">
                          Nu. {product.price.toLocaleString()}
                        </Text>
                      </View>
                      <View className="bg-green-100 px-3 py-1 rounded-full">
                        <Text className="text-green-600 text-xs font-semibold">
                          Save Nu. {savings.toLocaleString()}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-end justify-between">
                      <View>
                        <Text className="text-xs text-gray-500 mb-1">Sale Price</Text>
                        <Text className="text-3xl font-bold text-primary">
                          Nu. {product.current_price?.toLocaleString()}
                        </Text>
                      </View>
                      <View className="items-end">
                        <View className="flex-row items-center gap-1 mb-1">
                          <Clock size={12} color="#EF4444" />
                          <Text className="text-xs text-red-500 font-medium">Ends in</Text>
                        </View>
                        <CountdownTimer endsAt={product.discount_ends_at} />
                      </View>
                    </View>
                  </View>
                )
              ) : (
                <View className="flex-row items-baseline gap-2">
                  <Text className="text-3xl font-bold text-primary">
                    Nu. {product.price.toLocaleString()}
                  </Text>
                  <Text className="text-sm text-gray-400">fixed price</Text>
                </View>
              )}
            </Animated.View>

            {/* Seller Card */}
            {product.profiles?.name && (
              <Animated.View
                entering={FadeInDown.duration(300).delay(350)}
                className="bg-gray-50 p-5 rounded-3xl mb-6"
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(users)/profile/${product.user_id}`)}
                  className="flex-row items-center"
                >
                  {/* Avatar */}
                  <View className="relative">
                    {(product.profiles as any)?.avatar_url ? (
                      <Image
                        source={{ uri: (product.profiles as any).avatar_url }}
                        className="w-14 h-14 rounded-2xl bg-gray-200"
                      />
                    ) : (
                      <View className="w-14 h-14 bg-primary/10 rounded-2xl items-center justify-center">
                        <User size={24} color="#094569" />
                      </View>
                    )}
                    {/* Online Indicator */}
                    <View className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white" />
                  </View>

                  {/* Seller Info */}
                  <View className="flex-1 ml-4">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-base font-bold text-gray-900">
                        {product.profiles.name}
                      </Text>
                      <Verified size={16} color="#094569" />
                    </View>
                    <View className="flex-row items-center gap-3 mt-1">
                      <View className="flex-row items-center gap-1">
                        <Star size={12} color="#FBBF24" fill="#FBBF24" />
                        <Text className="text-xs text-gray-600">4.9</Text>
                      </View>
                      <Text className="text-xs text-gray-400">•</Text>
                      <Text className="text-xs text-gray-500">Active seller</Text>
                    </View>
                  </View>

                  {/* View Profile Arrow */}
                  <View className="bg-white w-10 h-10 rounded-xl items-center justify-center shadow-sm">
                    <ArrowLeft size={18} color="#094569" style={{ transform: [{ rotate: '180deg' }] }} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Description Section */}
            <Animated.View entering={FadeInDown.duration(300).delay(400)}>
              <Text className="text-lg font-bold text-gray-900 mb-3">
                About this product
              </Text>
              <Text className="text-base text-gray-600 leading-7 mb-6">
                {product.description || "No description provided for this product."}
              </Text>
            </Animated.View>

            {/* Details Grid */}
            <Animated.View
              entering={FadeInDown.duration(300).delay(450)}
              className="flex-row flex-wrap gap-3 mb-6"
            >
              <View className="bg-gray-50 px-4 py-3 rounded-2xl flex-row items-center gap-2">
                <Clock size={16} color="#6B7280" />
                <Text className="text-sm text-gray-600">
                  {new Date(product.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Text>
              </View>
              <View className="bg-gray-50 px-4 py-3 rounded-2xl flex-row items-center gap-2">
                <ShoppingBag size={16} color="#6B7280" />
                <Text className="text-sm text-gray-600">In stock</Text>
              </View>
            </Animated.View>

            {/* Report Link */}
            <Animated.View entering={FadeInDown.duration(300).delay(500)}>
              <TouchableOpacity
                onPress={handleReportProduct}
                className="flex-row items-center justify-center gap-2 py-3"
                activeOpacity={0.7}
              >
                <Flag size={14} color="#9CA3AF" />
                <Text className="text-sm text-gray-400">Report this listing</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Floating Bottom Action Bar */}
      <Animated.View
        entering={FadeInUp.duration(400).delay(300)}
        className="absolute bottom-0 left-0 right-0"
      >
        <BlurView intensity={80} tint="light" className="border-t border-gray-100">
          <View className="px-6 py-4 pb-8 flex-row gap-4">
            {/* Message Seller Button */}
            <TouchableOpacity
              onPress={handleMessageSeller}
              activeOpacity={0.8}
              className="flex-1 bg-primary py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg"
              style={{
                shadowColor: "#094569",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <MessageCircle size={20} color="white" />
              <Text className="text-white font-bold text-base">Message Seller</Text>
            </TouchableOpacity>

            {/* Quick Actions */}
            <TouchableOpacity
              onPress={toggleBookmark}
              activeOpacity={0.8}
              className={`w-14 h-14 rounded-2xl items-center justify-center border-2 ${
                isBookmarked ? 'bg-primary/10 border-primary' : 'bg-white border-gray-200'
              }`}
            >
              <Bookmark
                size={22}
                color={isBookmarked ? "#094569" : "#6B7280"}
                fill={isBookmarked ? "#094569" : "transparent"}
              />
            </TouchableOpacity>
          </View>
        </BlurView>
      </Animated.View>

      {/* Report Modal */}
      {currentUser && product && product.user_id && (
        <ReportProductModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          productId={product.id}
          productName={product.name}
          productOwnerId={product.user_id as string}
          currentUserId={currentUser.id}
          onReportSuccess={() => {
            setShowReportModal(false);
            showSuccessPopup("Report submitted successfully");
          }}
        />
      )}

      {/* Success/Error Popups */}
      <PopupMessage visible={showSuccess} type="success" message={popupMessage} />
      <PopupMessage visible={showError} type="error" message={popupMessage} />
    </View>
  );
}
