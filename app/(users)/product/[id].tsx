import CountdownTimer from "@/components/CountdownTimer";
import MarketplaceImageViewer from "@/components/modals/MarketplaceImageViewer";
import ReportProductModal from "@/components/modals/ReportProductModal";
import ShareComposerModal from "@/components/modals/ShareComposerModal";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import { fetchProductById, ProductWithUser } from "@/lib/productsService";
import { buildProductExternalSharePayload } from "@/lib/shareUtils";
import { supabase } from "@/lib/supabase";
import { useAppRouter } from "@/utils/navigation";
import { getInitials } from "@/utils/initials";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import {
    Bookmark,
    ChevronLeft,
    ChevronRight,
    Clock,
    Flag,
    MessageCircle,
    Moon,
    Package,
    Share2,
    ShoppingBag,
    Sparkles,
    Tag,
    Verified
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    BackHandler,
    Dimensions,
    Image,
    RefreshControl,
    Animated as RNAnimated,
    ScrollView,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.5;
const MIN_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.35;
const MAX_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.65;

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
      ]),
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
      <RNAnimated.View
        style={{ opacity, height: IMAGE_HEIGHT }}
        className="w-full bg-gray-200"
      />
      <View className="bg-white flex-1 px-6 pt-8">
        <RNAnimated.View
          style={{ opacity }}
          className="h-8 bg-gray-100 rounded-2xl w-3/4 mb-4"
        />
        <RNAnimated.View
          style={{ opacity }}
          className="h-10 bg-gray-100 rounded-2xl w-1/2 mb-6"
        />
        <RNAnimated.View
          style={{ opacity }}
          className="h-20 bg-gray-50 rounded-3xl w-full mb-6"
        />
        <RNAnimated.View
          style={{ opacity }}
          className="h-4 bg-gray-100 rounded-xl w-full mb-3"
        />
        <RNAnimated.View
          style={{ opacity }}
          className="h-4 bg-gray-100 rounded-xl w-full mb-3"
        />
        <RNAnimated.View
          style={{ opacity }}
          className="h-4 bg-gray-100 rounded-xl w-2/3"
        />
      </View>
    </View>
  );
}

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useAppRouter();
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();

  const [product, setProduct] = useState<ProductWithUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [sellerVerified, setSellerVerified] = useState(false);
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<number, number>>({});
  const imageScrollRef = useRef<ScrollView>(null);
  const imageScrollX = useRef(new RNAnimated.Value(0)).current;
  const animatedHeroHeight = useRef(new RNAnimated.Value(IMAGE_HEIGHT)).current;
  const activeImageIndexRef = useRef(0);

  // Image viewer state
  const [showImageViewer, setShowImageViewer] = useState(false);

  // Bookmark State
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Refresh & Report State
  const [refreshing, setRefreshing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showShareComposer, setShowShareComposer] = useState(false);

  // Popup states
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupTitle, setPopupTitle] = useState("");

  const productImageUrls = useMemo(
    () =>
      (product?.images ?? []).filter(
        (uri): uri is string => typeof uri === "string" && uri.length > 0,
      ),
    [product?.images],
  );
  const productImagesKey = useMemo(
    () => productImageUrls.join("||"),
    [productImageUrls],
  );

  const showSuccessPopup = (message: string, title: string = "Success") => {
    setPopupMessage(message);
    setPopupTitle(title);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const showErrorPopup = (message: string, title: string = "Error") => {
    setPopupMessage(message);
    setPopupTitle(title);
    setShowError(true);
    setTimeout(() => setShowError(false), 2500);
  };

  // Load product data
  const loadProduct = useCallback(
    async (isRefreshing = false) => {
      if (!id) return;

      if (!isRefreshing) setLoading(true);
      setError(null);
      try {
        const data = await fetchProductById(id);
        setProduct(data);

        if (data?.user_id) {
          supabase
            .from("service_providers")
            .select("verification_status")
            .eq("user_id", data.user_id)
            .maybeSingle()
            .then(({ data: sp }) => setSellerVerified(sp?.verification_status === "verified"));
        }

        if (currentUser) {
          const { data: bookmarkData } = await supabase
            .from("user_bookmarks")
            .select("*")
            .eq("user_id", currentUser.id)
            .eq("product_id", id)
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
    },
    [id, currentUser],
  );

  useFocusEffect(
    useCallback(() => {
      loadProduct();
    }, [loadProduct]),
  );

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        handleGoBack();
        return true;
      },
    );
    return () => backHandler.remove();
  }, [product]);

  useEffect(() => {
    const imageUrls = productImageUrls;

    setImageAspectRatios({});
    animatedHeroHeight.setValue(IMAGE_HEIGHT);
    setActiveImageIndex(0);
    activeImageIndexRef.current = 0;

    if (!imageUrls.length) return;

    let cancelled = false;

    imageUrls.forEach((uri, index) => {
      Image.getSize(
        uri,
        (width, height) => {
          if (cancelled || !width || !height) return;
          const ratio = width / height;
          setImageAspectRatios((prev) => {
            if (prev[index]) return prev;
            return { ...prev, [index]: ratio };
          });
        },
        () => {
          // Keep fallback height when metadata can't be resolved.
        },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [product?.id, productImagesKey]);

  const getImageHeightForIndex = useCallback(
    (index: number) => {
      const ratio = imageAspectRatios[index] || imageAspectRatios[0];
      if (!ratio) return IMAGE_HEIGHT;

      const calculatedHeight = SCREEN_WIDTH / ratio;
      return Math.min(
        MAX_IMAGE_HEIGHT,
        Math.max(MIN_IMAGE_HEIGHT, calculatedHeight),
      );
    },
    [imageAspectRatios],
  );

  useEffect(() => {
    const imageUrls = productImageUrls;
    if (!imageUrls.length) {
      animatedHeroHeight.setValue(IMAGE_HEIGHT);
      return;
    }

    if (activeImageIndex >= imageUrls.length) {
      setActiveImageIndex(0);
      activeImageIndexRef.current = 0;
      return;
    }

    RNAnimated.timing(animatedHeroHeight, {
      toValue: getImageHeightForIndex(activeImageIndex),
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [activeImageIndex, getImageHeightForIndex, productImagesKey, animatedHeroHeight]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (product?.category) {
      router.push(`/categories/${product.category}`);
    } else {
      router.push("/categories");
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadProduct(true);
  };

  const toggleBookmark = async () => {
    if (!currentUser) {
      showErrorPopup("Please sign in to save items", "Sign In Required");
      return;
    }
    if (!product) return;

    const previousState = isBookmarked;
    setIsBookmarked(!isBookmarked);

    try {
      if (previousState) {
        const { error } = await supabase
          .from("user_bookmarks")
          .delete()
          .eq("user_id", currentUser.id)
          .eq("product_id", product.id);
        if (error) throw error;
        showSuccessPopup("Removed from saves", "Removed!");
      } else {
        const { error } = await supabase.from("user_bookmarks").insert({
          user_id: currentUser.id,
          product_id: product.id,
        });
        if (error) throw error;
        showSuccessPopup("Saved to collection", "Saved!");
      }
    } catch (err) {
      console.error("Bookmark error:", err);
      setIsBookmarked(previousState);
      showErrorPopup("Failed to update bookmark", "Update Failed");
    }
  };

  const handleMessageSeller = () => {
    if (!product) return;
    router.push({
      pathname: "/(users)/chat/[id]",
      params: {
        id: String(product.user_id),
        context_product_id: String(product.id),
        context_product_title: product.name,
        context_product_price: String(product.current_price || product.price || ""),
        context_product_image: product.images?.[0] || "",
        context_source: "product",
        context_caption: product.description || "",
        context_date: product.created_at || "",
        context_username: product.profiles?.name || "",
        context_verified: product.isVerified ? "true" : "",
      },
    });
  };

  // Check if viewing own product
  const isOwnProduct = currentUser?.id === product?.user_id;

  const handleShare = async () => {
    if (!product) return;
    setShowShareComposer(true);
  };

  const productSharePayload = useMemo(() => {
    if (!product) return null;
    return buildProductExternalSharePayload({
      id: String(product.id),
      name: product.name,
      price: product.current_price || product.price,
      imageUrl: product.images?.[0],
    });
  }, [product]);

  const handleReportProduct = () => {
    if (!currentUser) {
      showErrorPopup("Please sign in to report products", "Sign In Required");
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

  const hasImages = productImageUrls.length > 0;
  const images = productImageUrls;

  const scrollToImage = (index: number) => {
    setActiveImageIndex(index);
    imageScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };
  const savings = product.is_currently_active
    ? product.price - (product.current_price || 0)
    : 0;

  return (
    <View className="flex-1 bg-[#FAFBFC]">
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bounces={true}
        contentContainerStyle={{ paddingBottom: isOwnProduct ? 16 : 120 }}
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
        <RNAnimated.View style={{ height: animatedHeroHeight, overflow: "hidden" }}>
          {hasImages ? (
            <RNAnimated.ScrollView
              ref={imageScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={RNAnimated.event(
                [{ nativeEvent: { contentOffset: { x: imageScrollX } } }],
                {
                  useNativeDriver: false,
                  listener: (e: any) => {
                    const x = e?.nativeEvent?.contentOffset?.x || 0;
                    const rawIndex = x / SCREEN_WIDTH;
                    const leftIndex = Math.max(0, Math.floor(rawIndex));
                    const rightIndex = Math.min(images.length - 1, leftIndex + 1);
                    const t = Math.max(0, Math.min(1, rawIndex - leftIndex));

                    const leftHeight = getImageHeightForIndex(leftIndex);
                    const rightHeight = getImageHeightForIndex(rightIndex);
                    const nextHeight = leftHeight + (rightHeight - leftHeight) * t;
                    animatedHeroHeight.setValue(nextHeight);

                    const idx = Math.round(rawIndex);
                    if (idx !== activeImageIndexRef.current) {
                      activeImageIndexRef.current = idx;
                      setActiveImageIndex(idx);
                    }
                  },
                },
              )}
              scrollEventThrottle={16}
              style={{ width: SCREEN_WIDTH, height: "100%" }}
            >
              {images.map((imageUrl, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.95}
                  style={{ width: SCREEN_WIDTH, height: "100%", backgroundColor: "#0F172A" }}
                  onPress={() => {
                    setActiveImageIndex(index);
                    setShowImageViewer(true);
                  }}
                >
                  <RNAnimated.Image
                    source={{ uri: imageUrl }}
                    style={{
                      width: SCREEN_WIDTH,
                      height: "100%",
                      transform: [
                        {
                          translateX: imageScrollX.interpolate({
                            inputRange: [
                              (index - 1) * SCREEN_WIDTH,
                              index * SCREEN_WIDTH,
                              (index + 1) * SCREEN_WIDTH,
                            ],
                            outputRange: [18, 0, -18],
                            extrapolate: "clamp",
                          }),
                        },
                        {
                          scale: imageScrollX.interpolate({
                            inputRange: [
                              (index - 1) * SCREEN_WIDTH,
                              index * SCREEN_WIDTH,
                              (index + 1) * SCREEN_WIDTH,
                            ],
                            outputRange: [1.06, 1, 1.06],
                            extrapolate: "clamp",
                          }),
                        },
                      ],
                    }}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ))}
            </RNAnimated.ScrollView>
          ) : (
            <View
              className="bg-gray-200 items-center justify-center"
              style={{ width: SCREEN_WIDTH, height: "100%" }}
            >
              <Package size={64} color="#D1D5DB" />
            </View>
          )}

          {/* Gradient Overlay */}
          <LinearGradient
            colors={[
              "rgba(0,0,0,0.5)",
              "transparent",
              "transparent",
              "rgba(0,0,0,0.3)",
            ]}
            locations={[0, 0.3, 0.7, 1]}
            className="absolute inset-0"
            pointerEvents="none"
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
                <BlurView
                  intensity={30}
                  tint="dark"
                  className="flex-1 items-center justify-center"
                >
                  <ChevronLeft size={22} color="white" strokeWidth={2.5} />
                </BlurView>
              </TouchableOpacity>

              {/* Right Actions */}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleShare}
                  activeOpacity={0.8}
                  className="w-11 h-11 rounded-full overflow-hidden"
                >
                  <BlurView
                    intensity={30}
                    tint="dark"
                    className="flex-1 items-center justify-center"
                  >
                    <Share2 size={20} color="white" />
                  </BlurView>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={toggleBookmark}
                  activeOpacity={0.8}
                  className="w-11 h-11 rounded-full overflow-hidden"
                >
                  <BlurView
                    intensity={30}
                    tint="dark"
                    className="flex-1 items-center justify-center"
                  >
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

          {/* Image Pagination: Dots + Counter */}
          {images.length > 1 && (
            <View
              style={{
                position: "absolute",
                bottom: 16,
                left: 0,
                right: 0,
                alignItems: "center",
                gap: 10,
              }}
            >
              {/* Counter pill */}
              <View
                style={{
                  backgroundColor: "rgba(0,0,0,0.5)",
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}>
                  {activeImageIndex + 1} / {images.length}
                </Text>
              </View>

              {/* Dots */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {images.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => scrollToImage(index)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={{
                        height: 7,
                        borderRadius: 999,
                        width: activeImageIndex === index ? 22 : 7,
                        backgroundColor: activeImageIndex === index ? "#fff" : "rgba(255,255,255,0.4)",
                      }}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </RNAnimated.View>

        {/* Content Card */}
        <View className="bg-white">
          <View className="px-6 pt-6 pb-8">
            {/* Category & Tags */}
            <View
              className="flex-row flex-wrap gap-2 mb-4"
            >
              <View className="bg-primary/10 px-4 py-1.5 rounded-full flex-row items-center gap-1.5">
                <Tag size={12} color="#094569" />
                <Text className="text-xs font-semibold text-primary">
                  {product.category}
                </Text>
              </View>
              {product.tags?.slice(0, 2).map((tag, i) => (
                <View key={i} className="bg-gray-100 px-3 py-1.5 rounded-full">
                  <Text className="text-xs text-gray-600">{tag}</Text>
                </View>
              ))}
            </View>

            {/* Product Title */}
            <Text
              className="text-2xl font-bold text-gray-900 mb-4 leading-tight"
            >
              {product.name}
            </Text>

            {/* Price Section - Closing Sale for Food, Regular Discount for others */}
            <View
              className="mb-6"
            >
              {product.is_currently_active ? (
                product.category === "food" ? (
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
                        <Text className="text-xs text-amber-600 mb-1">
                          Closing Sale Price
                        </Text>
                        <Text className="text-3xl font-bold text-amber-600">
                          Nu. {product.current_price?.toLocaleString()}
                        </Text>
                      </View>
                      <View className="items-end">
                        <View className="flex-row items-center gap-1 mb-1">
                          <Clock size={12} color="#D97706" />
                          <Text className="text-xs text-amber-600 font-medium">
                            Ends in
                          </Text>
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
                        <Text className="text-xs text-gray-500 mb-1">
                          Sale Price
                        </Text>
                        <Text className="text-3xl font-bold text-primary">
                          Nu. {product.current_price?.toLocaleString()}
                        </Text>
                      </View>
                      <View className="items-end">
                        <View className="flex-row items-center gap-1 mb-1">
                          <Clock size={12} color="#EF4444" />
                          <Text className="text-xs text-red-500 font-medium">
                            Ends in
                          </Text>
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
            </View>

            {/* Seller Card */}
            {product.profiles?.name && (
              <View
                className="bg-gray-50 p-5 rounded-3xl mb-6"
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    router.push(`/(users)/profile/${product.user_id}`)
                  }
                  className="flex-row items-center mb-4"
                >
                  {/* Avatar */}
                  <View className="relative">
                    {(product.profiles as any)?.avatar_url ? (
                      <Image
                        source={{ uri: (product.profiles as any).avatar_url }}
                        className="w-14 h-14 rounded-2xl bg-gray-200"
                      />
                    ) : (
                      <View className="w-14 h-14 bg-[#e0e7ef] rounded-2xl items-center justify-center">
                        <Text style={{ fontSize: 20, fontWeight: '700', color: '#094569' }}>
                          {getInitials(product.profiles?.name)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Seller Info */}
                  <View className="flex-1 ml-4">
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <Text className="text-base font-bold text-gray-900">
                        {product.profiles.name}
                      </Text>
                      {sellerVerified && (
                        <View className="flex-row items-center bg-blue-50 border border-[#094569] rounded-full px-2 py-0.5 gap-1">
                          <Verified size={11} color="#094569" />
                          <Text className="text-[10px] font-msemibold text-[#094569] leading-none">Verified</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-xs text-gray-500 mt-1">Active seller</Text>
                  </View>

                  {/* View Profile Arrow */}
                  <View className="bg-white/90 border border-gray-200 w-10 h-10 rounded-xl items-center justify-center">
                    <ChevronRight size={18} color="#094569" strokeWidth={2.5} />
                  </View>
                </TouchableOpacity>

              </View>
            )}

            {/* Description Section */}
            <View>
              <Text className="text-lg font-bold text-gray-900 mb-3">
                About this product
              </Text>
              <Text className="text-base text-gray-600 leading-7 mb-6">
                {product.description ||
                  "No description provided for this product."}
              </Text>
            </View>

            {/* Details Grid */}
            <View
              className="flex-row flex-wrap gap-3 mb-6"
            >
              <View className="bg-gray-50 px-4 py-3 rounded-2xl flex-row items-center gap-2">
                <Clock size={16} color="#6B7280" />
                <Text className="text-sm text-gray-600">
                  {new Date(product.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <View className="bg-gray-50 px-4 py-3 rounded-2xl flex-row items-center gap-2">
                <ShoppingBag size={16} color="#6B7280" />
                <Text className="text-sm text-gray-600">In stock</Text>
              </View>
            </View>

            {/* Report Link */}
            <View>
              <TouchableOpacity
                onPress={handleReportProduct}
                className="flex-row items-center justify-center gap-2 py-3"
                activeOpacity={0.7}
              >
                <Flag size={14} color="#9CA3AF" />
                <Text className="text-sm text-gray-400">
                  Report this listing
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Action Bar - Only show for other users' products */}
      {!isOwnProduct && (
        <View className="absolute bottom-0 left-0 right-0">
          <BlurView
            intensity={80}
            tint="light"
            className="border-t border-gray-100"
          >
            <View
              className="px-6 py-4 flex-row gap-4"
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            >
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
                <Text className="text-white font-bold text-base">
                  Message Seller
                </Text>
              </TouchableOpacity>

              {/* Quick Actions */}
              <TouchableOpacity
                onPress={toggleBookmark}
                activeOpacity={0.8}
                className={`w-14 h-14 rounded-2xl items-center justify-center border-2 ${
                  isBookmarked
                    ? "bg-primary/10 border-primary"
                    : "bg-white border-gray-200"
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
        </View>
      )}

      {/* Report Modal */}
      {currentUser && product && product.user_id && (
        <ReportProductModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          productId={product.id}
          productName={product.name}
          productOwnerId={product.user_id as string}
          currentUserId={currentUser.id || ""}
          onReportSuccess={() => {
            setShowReportModal(false);
            showSuccessPopup("Report submitted successfully", "Reported!");
          }}
        />
      )}

      {/* Image Viewer Modal */}
      {images.length > 0 && (
        <MarketplaceImageViewer
          visible={showImageViewer}
          images={images}
          initialIndex={activeImageIndex}
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {product && productSharePayload && (
        <ShareComposerModal
          visible={showShareComposer}
          onClose={() => setShowShareComposer(false)}
          heading="Share product"
          sharePayload={productSharePayload}
          inAppContextParams={{
            context_product_id: String(product.id),
            context_product_title: product.name,
            context_product_price: String(product.current_price || product.price || ""),
            context_product_image: product.images?.[0] || "",
            context_source: "product",
            context_caption: product.description || "",
            context_date: product.created_at || "",
            context_username: product.profiles?.name || "",
            context_verified: product.isVerified ? "true" : "",
          }}
        />
      )}

      {/* Success/Error Popups */}
      <PopupMessage
        visible={showSuccess}
        type="success"
        title={popupTitle}
        message={popupMessage}
      />
      <PopupMessage
        visible={showError}
        type="error"
        title={popupTitle}
        message={popupMessage}
      />
    </View>
  );
}
