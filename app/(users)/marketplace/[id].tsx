import MarketplaceImageViewer from "@/components/modals/MarketplaceImageViewer";
import ReportProductModal from "@/components/modals/ReportProductModal";
import PopupMessage from "@/components/ui/PopupMessage";
import { useUser } from "@/contexts/UserContext";
import {
  fetchMarketplaceItemById,
  MarketplaceItemWithUser,
} from "@/lib/postMarketPlace";
import { supabase } from "@/lib/supabase";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useAppRouter } from "@/utils/navigation";
import {
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Flag,
  MapPin,
  MessageCircle,
  Tag,
  Verified,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

function DetailSkeleton() {
  const shimmerAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    const shimmer = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(shimmerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        RNAnimated.timing(shimmerAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]),
    );
    shimmer.start();
    return () => shimmer.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View className="flex-1 bg-[#FAFBFC]">
      <StatusBar barStyle="light-content" />
      <RNAnimated.View style={{ opacity, height: IMAGE_HEIGHT }} className="w-full bg-gray-200" />
      <View className="bg-white flex-1 px-6 pt-8">
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

export default function MarketplaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useAppRouter();
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();

  const [item, setItem] = useState<MarketplaceItemWithUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const imageScrollRef = useRef<ScrollView>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sellerVerified, setSellerVerified] = useState(false);

  const [popup, setPopup] = useState<{
    visible: boolean;
    type: "success" | "error" | "warning" | "white";
    title: string;
    message: string;
  }>({ visible: false, type: "success", title: "", message: "" });

  const showPopup = (
    type: "success" | "error" | "warning" | "white",
    title: string,
    message: string,
  ) => {
    setPopup({ visible: true, type, title, message });
    setTimeout(() => setPopup((p) => ({ ...p, visible: false })), 2500);
  };

  const loadItem = useCallback(
    async (isRefreshing = false) => {
      if (!id) return;
      try {
        if (!isRefreshing) setIsLoading(true);
        const data = await fetchMarketplaceItemById(id);
        setItem(data);

        if (data?.user_id) {
          supabase
            .from("service_providers")
            .select("verification_status")
            .eq("user_id", data.user_id)
            .maybeSingle()
            .then(({ data: sp }) =>
              setSellerVerified(sp?.verification_status === "verified"),
            );
        }

        if (currentUser) {
          const { data: bookmarkData } = await supabase
            .from("user_bookmarks")
            .select("*")
            .eq("user_id", currentUser.id)
            .eq("marketplace_id", id)
            .maybeSingle();
          setIsBookmarked(!!bookmarkData);
        }
      } catch (error) {
        console.error("Error loading item:", error);
        showPopup("error", "Error", "Failed to load item details");
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [id, currentUser],
  );

  useFocusEffect(useCallback(() => { loadItem(); }, [loadItem]));

  useFocusEffect(
    useCallback(() => {
      const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
        handleGoBack();
        return true;
      });
      return () => backHandler.remove();
    }, []),
  );

  const handleGoBack = () => {
    if (router.canGoBack()) { router.back(); return; }
    router.push("/marketplace" as any);
  };

  const handleRefresh = () => { setRefreshing(true); loadItem(true); };

  const handleMessage = () => {
    if (currentUser?.id === item?.user_id) {
      showPopup("warning", "Your Listing", "This is your own listing");
      return;
    }
    if (item?.user_id) {
      router.push({
        pathname: "/(users)/chat/[id]",
        params: {
          id: String(item.user_id),
          context_product_id: String(item.id),
          context_product_title: item.title,
          context_product_price: String(item.price || ""),
          context_product_image: item.images?.[0] || "",
          context_source: "marketplace",
        },
      } as any);
    }
  };

  const handleReportItem = () => {
    if (!currentUser) {
      showPopup("error", "Sign In Required", "Please sign in to report items");
      return;
    }
    setShowReportModal(true);
  };

  const toggleBookmark = async () => {
    if (!currentUser) {
      showPopup("error", "Sign In Required", "Please sign in to bookmark items");
      return;
    }
    if (!item) return;
    const previousState = isBookmarked;
    setIsBookmarked(!isBookmarked);
    try {
      if (previousState) {
        const { error } = await supabase
          .from("user_bookmarks")
          .delete()
          .eq("user_id", currentUser.id)
          .eq("marketplace_id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_bookmarks").insert({
          user_id: currentUser.id,
          marketplace_id: item.id,
        });
        if (error) throw error;
      }
    } catch (err) {
      console.error("Bookmark error:", err);
      setIsBookmarked(previousState);
      showPopup("error", "Update Failed", "Failed to update bookmark");
    }
  };

  const isOwnItem = currentUser?.id === item?.user_id;

  if (isLoading) return <DetailSkeleton />;

  if (!item) {
    return (
      <View className="flex-1 justify-center items-center bg-[#FAFBFC] px-6">
        <StatusBar barStyle="dark-content" />
        <Text className="text-xl font-bold text-gray-900 mb-2">Item Not Found</Text>
        <Text className="text-gray-500 text-center mb-8">
          This listing may have been removed.
        </Text>
        <TouchableOpacity
          className="bg-primary px-8 py-4 rounded-2xl"
          onPress={handleGoBack}
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold text-base">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const images = item.images || [];

  const scrollToImage = (index: number) => {
    setActiveImageIndex(index);
    imageScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  const sellerName = item.profiles?.name || "Anonymous";
  const sellerInitial = sellerName.charAt(0).toUpperCase();

  return (
    <View className="flex-1 bg-[#FAFBFC]">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bounces
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#094569"
            colors={["#094569"]}
          />
        }
      >
        {/* Hero Image */}
        <View style={{ height: IMAGE_HEIGHT }}>
          {images.length > 0 ? (
            <ScrollView
              ref={imageScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(
                  e.nativeEvent.contentOffset.x / SCREEN_WIDTH,
                );
                setActiveImageIndex(idx);
              }}
              scrollEventThrottle={16}
              style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
            >
              {images.map((imageUrl, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={0.95}
                  onPress={() => {
                    setActiveImageIndex(index);
                    setShowImageViewer(true);
                  }}
                >
                  <Image
                    source={{ uri: imageUrl }}
                    style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View
              style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
              className="bg-gray-200 items-center justify-center"
            >
              <Tag size={64} color="#D1D5DB" />
            </View>
          )}

          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "transparent", "transparent", "rgba(0,0,0,0.3)"]}
            locations={[0, 0.3, 0.7, 1]}
            className="absolute inset-0"
            pointerEvents="none"
          />

          {/* Top Nav */}
          <View className="absolute top-0 left-0 right-0 pt-14 px-5">
            <View className="flex-row justify-between items-center">
              <TouchableOpacity
                onPress={handleGoBack}
                activeOpacity={0.8}
                className="w-11 h-11 rounded-full overflow-hidden"
              >
                <BlurView intensity={30} tint="dark" className="flex-1 items-center justify-center">
                  <ArrowLeft size={22} color="white" strokeWidth={2.5} />
                </BlurView>
              </TouchableOpacity>

              <View className="flex-row gap-3">
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
                <TouchableOpacity
                  onPress={handleReportItem}
                  activeOpacity={0.8}
                  className="w-11 h-11 rounded-full overflow-hidden"
                >
                  <BlurView intensity={30} tint="dark" className="flex-1 items-center justify-center">
                    <Flag size={20} color="white" />
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
        </View>

        {/* Content Card */}
        <View className="bg-white min-h-screen">
          <View className="px-6 pt-6 pb-32">
            {/* Type badge + first 2 tags */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              <View className="bg-primary/10 px-4 py-1.5 rounded-full flex-row items-center gap-1.5">
                <Tag size={12} color="#094569" />
                <Text className="text-xs font-semibold text-primary uppercase">
                  {item.type.replace("_", " ")}
                </Text>
              </View>
              {item.tags?.slice(0, 2).map((tag, i) => (
                <View key={i} className="bg-gray-100 px-3 py-1.5 rounded-full">
                  <Text className="text-xs text-gray-600">{tag}</Text>
                </View>
              ))}
            </View>

            {/* Title */}
            <Text className="text-2xl font-bold text-gray-900 mb-4 leading-tight">
              {item.title}
            </Text>

            {/* Price */}
            {(item.type === "rent" ||
              item.type === "second_hand" ||
              item.type === "job_vacancy") &&
              item.price > 0 && (
                <View className="flex-row items-baseline gap-2 mb-6">
                  <Text className="text-3xl font-bold text-primary">
                    Nu. {item.price.toLocaleString()}
                  </Text>
                  {item.type === "rent" && (
                    <Text className="text-sm text-gray-400">/ month</Text>
                  )}
                </View>
              )}

            {/* Seller Card */}
            <View className="bg-gray-50 p-5 rounded-3xl mb-6">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => router.push(`/(users)/profile/${item.user_id}` as any)}
                className="flex-row items-center"
              >
                <View className="relative">
                  {item.profiles?.avatar_url ? (
                    <Image
                      source={{ uri: item.profiles.avatar_url }}
                      className="w-14 h-14 rounded-2xl bg-gray-200"
                    />
                  ) : (
                    <View className="w-14 h-14 bg-primary/10 rounded-2xl items-center justify-center">
                      <Text style={{ fontSize: 22, fontWeight: "700", color: "#094569" }}>
                        {sellerInitial}
                      </Text>
                    </View>
                  )}
                </View>

                <View className="flex-1 ml-4">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-base font-bold text-gray-900">{sellerName}</Text>
                    {sellerVerified && (
                      <View className="flex-row items-center bg-blue-50 border border-[#094569] rounded-full px-2 py-0.5 gap-1">
                        <Verified size={11} color="#094569" />
                        <Text className="text-[10px] font-semibold text-[#094569] leading-none">
                          Verified
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-gray-500 mt-1">Active seller</Text>
                </View>

                <View className="bg-white w-10 h-10 rounded-xl items-center justify-center shadow-sm">
                  <ArrowLeft
                    size={18}
                    color="#094569"
                    style={{ transform: [{ rotate: "180deg" }] }}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* Description */}
            {item.type === "job_vacancy" &&
            typeof item.description === "object" &&
            "description" in item.description ? (
              <>
                <View className="mb-4">
                  <Text className="text-lg font-bold text-gray-900 mb-3">Job Description</Text>
                  <Text className="text-base text-gray-600 leading-7">
                    {item.description.description}
                  </Text>
                </View>
                {item.description.requirements && (
                  <View className="mb-4">
                    <Text className="text-lg font-bold text-gray-900 mb-3">Requirements</Text>
                    <Text className="text-base text-gray-600 leading-7">
                      {item.description.requirements}
                    </Text>
                  </View>
                )}
                {item.description.responsibilities && (
                  <View className="mb-6">
                    <Text className="text-lg font-bold text-gray-900 mb-3">Responsibilities</Text>
                    <Text className="text-base text-gray-600 leading-7">
                      {item.description.responsibilities}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View className="mb-6">
                <Text className="text-lg font-bold text-gray-900 mb-3">About this listing</Text>
                <Text className="text-base text-gray-600 leading-7">
                  {typeof item.description === "string"
                    ? item.description
                    : item.description &&
                      typeof item.description === "object" &&
                      "text" in item.description
                    ? (item.description as any).text
                    : "No description provided."}
                </Text>
              </View>
            )}

            {/* Details Grid */}
            <View className="flex-row flex-wrap gap-3 mb-6">
              {item.dzongkhag && (
                <View className="bg-gray-50 px-4 py-3 rounded-2xl flex-row items-center gap-2">
                  <MapPin size={16} color="#6B7280" />
                  <Text className="text-sm text-gray-600">{item.dzongkhag}</Text>
                </View>
              )}
              <View className="bg-gray-50 px-4 py-3 rounded-2xl flex-row items-center gap-2">
                <Calendar size={16} color="#6B7280" />
                <Text className="text-sm text-gray-600">
                  {new Date(item.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </View>

            {/* Remaining tags */}
            {item.tags && item.tags.length > 2 && (
              <View className="flex-row flex-wrap gap-2 mb-6">
                {item.tags.slice(2).map((tag: string, index: number) => (
                  <View key={index} className="bg-gray-100 px-3 py-1.5 rounded-full">
                    <Text className="text-xs text-gray-600">{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Report Link */}
            <TouchableOpacity
              onPress={handleReportItem}
              className="flex-row items-center justify-center gap-2 py-3"
              activeOpacity={0.7}
            >
              <Flag size={14} color="#9CA3AF" />
              <Text className="text-sm text-gray-400">Report this listing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Floating Bottom Bar */}
      {!isOwnItem && (
        <View className="absolute bottom-0 left-0 right-0">
          <BlurView intensity={80} tint="light" className="border-t border-gray-100">
            <View
              className="px-6 py-4 flex-row gap-4"
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            >
              <TouchableOpacity
                onPress={handleMessage}
                activeOpacity={0.8}
                className="flex-1 bg-primary py-4 rounded-2xl flex-row items-center justify-center gap-2"
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

              <TouchableOpacity
                onPress={toggleBookmark}
                activeOpacity={0.8}
                className={`w-14 h-14 rounded-2xl items-center justify-center border-2 ${
                  isBookmarked ? "bg-primary/10 border-primary" : "bg-white border-gray-200"
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

      {/* Modals */}
      {images.length > 0 && (
        <MarketplaceImageViewer
          visible={showImageViewer}
          images={images}
          initialIndex={activeImageIndex}
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {currentUser?.id && item && item.user_id && (
        <ReportProductModal
          visible={showReportModal}
          onClose={() => setShowReportModal(false)}
          productId={item.id}
          productName={item.title}
          productOwnerId={item.user_id}
          currentUserId={currentUser.id}
          onReportSuccess={() => setShowReportModal(false)}
        />
      )}

      <PopupMessage
        visible={popup.visible}
        type={popup.type}
        title={popup.title}
        message={popup.message}
      />
    </View>
  );
}
