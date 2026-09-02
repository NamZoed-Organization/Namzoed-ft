import MarketplaceImageViewer from "@/components/modals/MarketplaceImageViewer";
import PopupMessage from "@/components/ui/PopupMessage";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { useUser } from "@/contexts/UserContext";
import {
  fetchProviderServiceById,
  ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { supabase } from "@/lib/supabase";
import { useAppRouter } from "@/utils/navigation";
import { getInitials } from "@/utils/initials";
import { BlurView } from "expo-blur";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Href, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageCircle,
  Tag,
  User,
  Verified,
  Wrench,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.45;
const MIN_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.32;
const MAX_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.62;

// Hoisted to a stable module-level reference — same reasoning as
// PRODUCT_SCREEN_OPTIONS / POST_SCREEN_OPTIONS / MARKETPLACE_SCREEN_OPTIONS
// (a fresh literal each render retriggers navigation.setOptions() and can
// trip React's nested-update guard). Unlike those three, this screen has no
// overlay counterpart and isn't a transparentModal — it's a plain opaque
// push, so it just needs a real animation instead of the root layout's
// default "none" (which made every services-grid tap snap in instantly).
const SERVICE_SCREEN_OPTIONS = {
  animation: "slide_from_right" as const,
};

// Hero parallax only ever animates `transform` (translateX/scale) via style,
// driven with useNativeDriver: false (it must share a JS listener with the
// height-morph logic above) — so it's safe to swap the plain RN
// Animated.Image for an animated wrapper around expo-image, picking up
// cachePolicy caching without touching the animation itself.
const AnimatedHeroImage = RNAnimated.createAnimatedComponent(ExpoImage);

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
          style={{ opacity, borderRadius: 16, borderCurve: "continuous" }}
          className="h-8 bg-gray-100 w-3/4 mb-4"
        />
        <RNAnimated.View
          style={{ opacity, borderRadius: 16, borderCurve: "continuous" }}
          className="h-10 bg-gray-100 w-1/2 mb-6"
        />
        <RNAnimated.View
          style={{ opacity, borderRadius: 24, borderCurve: "continuous" }}
          className="h-20 bg-gray-50 w-full mb-6"
        />
        <RNAnimated.View
          style={{ opacity, borderRadius: 12, borderCurve: "continuous" }}
          className="h-4 bg-gray-100 w-full mb-3"
        />
        <RNAnimated.View
          style={{ opacity, borderRadius: 12, borderCurve: "continuous" }}
          className="h-4 bg-gray-100 w-full mb-3"
        />
        <RNAnimated.View
          style={{ opacity, borderRadius: 12, borderCurve: "continuous" }}
          className="h-4 bg-gray-100 w-2/3"
        />
      </View>
    </View>
  );
}

export default function ServiceDetail() {
  const router = useAppRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();
  const [service, setService] = useState<ProviderServiceWithDetails | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const imageScrollRef = useRef<ScrollView>(null);
  const imageScrollX = useRef(new RNAnimated.Value(0)).current;
  const animatedHeroHeight = useRef(new RNAnimated.Value(IMAGE_HEIGHT)).current;
  const activeImageIndexRef = useRef(0);
  const [imageAspectRatios, setImageAspectRatios] = useState<
    Record<number, number>
  >({});
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupTitle, setPopupTitle] = useState("");

  const serviceImageUrls = useMemo(
    () =>
      (service?.images ?? []).filter(
        (uri): uri is string => typeof uri === "string" && uri.length > 0,
      ),
    [service?.images],
  );
  const serviceImagesKey = useMemo(
    () => serviceImageUrls.join("||"),
    [serviceImageUrls],
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

  const loadService = useCallback(
    async (isRefreshing = false) => {
      if (!id) return;
      try {
        if (!isRefreshing) setLoading(true);
        const data = await fetchProviderServiceById(id);
        setService(data);

        if (currentUser) {
          const { data: bookmarkData } = await supabase
            .from("user_bookmarks")
            .select("*")
            .eq("user_id", currentUser.id)
            .eq("service_id", id)
            .single();
          setIsBookmarked(!!bookmarkData);
        }
      } catch (error) {
        console.error("Error loading service:", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, currentUser],
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadService(true);
  };

  const toggleBookmark = async () => {
    if (!currentUser) {
      showErrorPopup("Please sign in to save items", "Sign In Required");
      return;
    }
    if (!service) return;

    const previousState = isBookmarked;
    setIsBookmarked(!isBookmarked);

    try {
      if (previousState) {
        const { error } = await supabase
          .from("user_bookmarks")
          .delete()
          .eq("user_id", currentUser.id)
          .eq("service_id", service.id);
        if (error) throw error;
        showSuccessPopup("Removed from saves", "Removed!");
      } else {
        const { error } = await supabase.from("user_bookmarks").insert({
          user_id: currentUser.id,
          service_id: service.id,
        });
        if (error) throw error;
        showSuccessPopup("Saved to collection", "Saved!");
      }
    } catch (err: any) {
      console.error("Bookmark error:", err);
      setIsBookmarked(previousState);
      showErrorPopup(
        err?.message || "Failed to update bookmark",
        "Update Failed",
      );
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadService();
    }, [loadService]),
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
  }, [service]);

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else if (service?.category_id) {
      const categorySlug = service.service_categories?.slug;
      if (categorySlug) {
        router.push(`/services/${categorySlug}` as Href);
      } else {
        router.push("/services" as Href);
      }
    } else {
      router.push("/services" as Href);
    }
  };

  const handleViewProvider = () => {
    if (!service) return;
    const providerId = service.service_providers?.user_id;
    if (providerId === currentUser?.id) {
      router.push("/(users)/profile?tab=work" as Href);
    } else {
      router.push(`/(users)/profile/${providerId}?tab=work` as Href);
    }
  };

  const handleMessageProvider = () => {
    if (!service) return;
    const providerId = service.service_providers?.user_id;
    if (providerId === currentUser?.id) return;
    if (providerId) {
      router.push(`/(users)/chat/${providerId}` as Href);
    }
  };

  useEffect(() => {
    setImageAspectRatios({});
    animatedHeroHeight.setValue(IMAGE_HEIGHT);
    setActiveImageIndex(0);
    activeImageIndexRef.current = 0;

    if (!serviceImageUrls.length) return;
    let cancelled = false;

    serviceImageUrls.forEach((uri, index) => {
      Image.getSize(
        uri,
        (width, height) => {
          if (cancelled || !width || !height) return;
          const ratio = width / height;
          setImageAspectRatios((prev) =>
            prev[index] ? prev : { ...prev, [index]: ratio },
          );
        },
        () => {
          // fallback
        },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [service?.id, serviceImageUrls, serviceImagesKey, animatedHeroHeight]);

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
    if (!serviceImageUrls.length) {
      animatedHeroHeight.setValue(IMAGE_HEIGHT);
      return;
    }
    if (activeImageIndex >= serviceImageUrls.length) {
      setActiveImageIndex(0);
      activeImageIndexRef.current = 0;
      return;
    }

    RNAnimated.timing(animatedHeroHeight, {
      toValue: getImageHeightForIndex(activeImageIndex),
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [
    activeImageIndex,
    serviceImageUrls.length,
    getImageHeightForIndex,
    animatedHeroHeight,
  ]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={SERVICE_SCREEN_OPTIONS} />
        <DetailSkeleton />
      </>
    );
  }

  if (!service) {
    return (
      <View className="flex-1 justify-center items-center bg-[#FAFBFC] px-6">
        <Stack.Screen options={SERVICE_SCREEN_OPTIONS} />
        <StatusBar barStyle="dark-content" />
        <View className="w-24 h-24 bg-gray-100 rounded-full items-center justify-center mb-6">
          <Wrench size={40} color="#9CA3AF" />
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-2">
          Service Not Found
        </Text>
        <Text className="text-gray-500 text-center mb-8">
          We couldn&apos;t find this service. It may have been removed.
        </Text>
        <TouchableOpacity
          style={{ borderRadius: 16, borderCurve: "continuous" }}
          className="bg-primary px-8 py-4 shadow-lg"
          onPress={handleGoBack}
          activeOpacity={0.8}
        >
          <Text className="text-white font-bold text-base">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasImages = serviceImageUrls.length > 0;
  const images = serviceImageUrls;
  const isOwnService = currentUser?.id === service.service_providers?.user_id;
  const providerName =
    service.service_providers?.name ||
    service.service_providers?.profiles?.name ||
    "Unknown Provider";
  const providerImage =
    service.service_providers?.profile_url ||
    service.service_providers?.profiles?.avatar_url;
  const categoryName = service.service_categories?.name || "Service";

  return (
    <View className="flex-1 bg-[#FAFBFC]">
      <Stack.Screen options={SERVICE_SCREEN_OPTIONS} />
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

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
        <RNAnimated.View
          style={{ height: animatedHeroHeight, overflow: "hidden" }}
        >
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
                  listener: (event: any) => {
                    const x = event?.nativeEvent?.contentOffset?.x || 0;
                    const rawIndex = x / SCREEN_WIDTH;
                    const leftIndex = Math.max(0, Math.floor(rawIndex));
                    const rightIndex = Math.min(
                      images.length - 1,
                      leftIndex + 1,
                    );
                    const t = Math.max(0, Math.min(1, rawIndex - leftIndex));
                    const leftHeight = getImageHeightForIndex(leftIndex);
                    const rightHeight = getImageHeightForIndex(rightIndex);
                    animatedHeroHeight.setValue(
                      leftHeight + (rightHeight - leftHeight) * t,
                    );

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
                  style={{
                    width: SCREEN_WIDTH,
                    height: "100%",
                    backgroundColor: "#0F172A",
                  }}
                  onPress={() => {
                    setActiveImageIndex(index);
                    setShowImageViewer(true);
                  }}
                >
                  <AnimatedHeroImage
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
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    recyclingKey={imageUrl}
                    priority={index === 0 ? "high" : "normal"}
                  />
                </TouchableOpacity>
              ))}
            </RNAnimated.ScrollView>
          ) : (
            <View
              className="bg-gray-200 items-center justify-center"
              style={{ width: SCREEN_WIDTH, height: "100%" }}
            >
              <Wrench size={64} color="#D1D5DB" />
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
                  borderCurve: "continuous",
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 11, fontWeight: "600" }}
                >
                  {activeImageIndex + 1} / {images.length}
                </Text>
              </View>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                {images.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => {
                      setActiveImageIndex(index);
                      imageScrollRef.current?.scrollTo({
                        x: index * SCREEN_WIDTH,
                        animated: true,
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <View
                      style={{
                        height: 7,
                        borderRadius: 999,
                        borderCurve: "continuous",
                        width: activeImageIndex === index ? 22 : 7,
                        backgroundColor:
                          activeImageIndex === index
                            ? "#fff"
                            : "rgba(255,255,255,0.4)",
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
          <View className="px-6 pt-6 pb-32">
            {/* Category Badge */}
            <View className="flex-row flex-wrap gap-2 mb-4">
              <View className="bg-primary/10 px-4 py-1.5 rounded-full flex-row items-center gap-1.5">
                <Tag size={12} color="#094569" />
                <Text className="text-xs font-semibold text-primary">
                  {categoryName}
                </Text>
              </View>
            </View>

            {/* Service Name */}
            <Text className="text-2xl font-bold text-gray-900 mb-6 leading-tight">
              {service.name}
            </Text>

            {/* Provider Card */}
            <View
              style={{ borderRadius: 24, borderCurve: "continuous" }} className="bg-gray-50 p-5 mb-6">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleViewProvider}
                className="flex-row items-center mb-4"
              >
                {/* Avatar */}
                <View className="relative">
                  {providerImage ? (
                    <ProgressiveImage
                      uri={providerImage}
                      style={{ width: 56, height: 56, borderRadius: 16 }}
                      showProgress={false}
                      priority="high"
                      backgroundColor="#e5e7eb"
                    />
                  ) : (
                    <View
                      style={{ borderRadius: 16, borderCurve: "continuous" }} className="w-14 h-14 bg-[#e0e7ef] items-center justify-center">
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: "700",
                          color: "#094569",
                        }}
                      >
                        {getInitials(providerName)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Provider Info */}
                <View className="flex-1 ml-4">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-base font-bold text-gray-900">
                      {providerName}
                    </Text>
                    {(service.service_providers as any)?.verification_status ===
                      "verified" && (
                      <View className="flex-row items-center bg-blue-50 border border-[#094569] rounded-full px-2 py-0.5 gap-1">
                        <Verified size={11} color="#094569" />
                        <Text className="text-[10px] font-msemibold text-[#094569] leading-none">
                          Verified
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-xs text-gray-500 mt-1">
                    Service Provider
                  </Text>
                  {service.service_providers?.email_active &&
                  service.service_providers?.email ? (
                    <Text
                      className="text-xs text-gray-500 mt-1"
                      numberOfLines={1}
                    >
                      ✉ {service.service_providers.email}
                    </Text>
                  ) : null}
                  {service.service_providers?.contact_active &&
                  service.service_providers?.contact ? (
                    <Text
                      className="text-xs text-gray-500 mt-1"
                      numberOfLines={1}
                    >
                      📞 {service.service_providers.contact}
                    </Text>
                  ) : null}
                </View>

                {/* View Profile Arrow */}
                <View
                  style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-white w-10 h-10 items-center justify-center shadow-sm">
                  <ChevronRight size={18} color="#094569" />
                </View>
              </TouchableOpacity>
            </View>

            {/* Description Section */}
            <View>
              <Text className="text-lg font-bold text-gray-900 mb-3">
                About this service
              </Text>
              <Text className="text-base text-gray-600 leading-7 mb-6">
                {service.description ||
                  "No description provided for this service."}
              </Text>
            </View>

            {/* Details Grid */}
            <View className="flex-row flex-wrap gap-3 mb-6">
              <View
                style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-gray-50 px-4 py-3 flex-row items-center gap-2">
                <Clock size={16} color="#6B7280" />
                <Text className="text-sm text-gray-600">
                  {new Date((service as any).created_at).toLocaleDateString(
                    "en-US",
                    {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    },
                  )}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Image Viewer Modal */}
      {images.length > 0 && (
        <MarketplaceImageViewer
          visible={showImageViewer}
          images={images}
          initialIndex={activeImageIndex}
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {/* Popups */}
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

      {/* Floating Bottom Action Bar - Only for other providers */}
      {!isOwnService && (
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
              {/* Message Provider Button */}
              <TouchableOpacity
                onPress={handleMessageProvider}
                activeOpacity={0.8}
                className="flex-1 bg-primary py-4 flex-row items-center justify-center gap-2 shadow-lg"
                style={{ shadowColor: "#094569",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 8, borderRadius: 16, borderCurve: "continuous" }}
              >
                <MessageCircle size={20} color="white" />
                <Text className="text-white font-bold text-base">
                  Message Provider
                </Text>
              </TouchableOpacity>

              {/* View Profile Button */}
              <TouchableOpacity
                style={{ borderRadius: 16, borderCurve: "continuous" }}
                onPress={handleViewProvider}
                activeOpacity={0.8}
                className="w-14 h-14 items-center justify-center border-2 bg-white border-gray-200"
              >
                <User size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </BlurView>
        </View>
      )}
    </View>
  );
}
