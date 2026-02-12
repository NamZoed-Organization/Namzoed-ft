import MarketplaceImageViewer from "@/components/modals/MarketplaceImageViewer";
import { useUser } from "@/contexts/UserContext";
import {
  fetchProviderServiceById,
  ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  Href,
  router,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MessageCircle,
  Tag,
  User,
  Verified,
  Wrench,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Dimensions,
  Image,
  Animated as RNAnimated,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

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
      <View className="bg-white -mt-8 rounded-t-[32px] flex-1 px-6 pt-8">
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

export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useUser();
  const [service, setService] = useState<ProviderServiceWithDetails | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(false);

  const loadService = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await fetchProviderServiceById(id);
      setService(data);
    } catch (error) {
      console.error("Error loading service:", error);
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  if (loading) return <DetailSkeleton />;

  if (!service) {
    return (
      <View className="flex-1 justify-center items-center bg-[#FAFBFC] px-6">
        <StatusBar barStyle="dark-content" />
        <View className="w-24 h-24 bg-gray-100 rounded-full items-center justify-center mb-6">
          <Wrench size={40} color="#9CA3AF" />
        </View>
        <Text className="text-xl font-bold text-gray-900 mb-2">
          Service Not Found
        </Text>
        <Text className="text-gray-500 text-center mb-8">
          We couldn't find this service. It may have been removed.
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

  const hasImages = service.images && service.images.length > 0;
  const images = hasImages ? (service.images as string[]) : [];
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
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Hero Image Section */}
        <View style={{ height: IMAGE_HEIGHT }}>
          {hasImages ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(event) => {
                const slideIndex = Math.round(
                  event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
                );
                setActiveImageIndex(slideIndex);
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
              className="bg-gray-200 items-center justify-center"
              style={{ width: SCREEN_WIDTH, height: IMAGE_HEIGHT }}
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
                <ArrowLeft size={22} color="white" strokeWidth={2.5} />
              </BlurView>
            </TouchableOpacity>
          </View>

          {/* Image Pagination Dots */}
          {images.length > 1 && (
            <View className="absolute bottom-6 left-0 right-0 flex-row justify-center gap-2">
              {images.map((_, index) => (
                <View
                  key={index}
                  className={`h-2 rounded-full ${
                    activeImageIndex === index
                      ? "bg-white w-6"
                      : "bg-white/40 w-2"
                  }`}
                />
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
            {/* Category Badge */}
            <Animated.View
              entering={FadeInDown.duration(300).delay(200)}
              className="flex-row flex-wrap gap-2 mb-4"
            >
              <View className="bg-primary/10 px-4 py-1.5 rounded-full flex-row items-center gap-1.5">
                <Tag size={12} color="#094569" />
                <Text className="text-xs font-semibold text-primary">
                  {categoryName}
                </Text>
              </View>
            </Animated.View>

            {/* Service Name */}
            <Animated.Text
              entering={FadeInDown.duration(300).delay(250)}
              className="text-2xl font-bold text-gray-900 mb-6 leading-tight"
            >
              {service.name}
            </Animated.Text>

            {/* Provider Card */}
            <Animated.View
              entering={FadeInDown.duration(300).delay(350)}
              className="bg-gray-50 p-5 rounded-3xl mb-6"
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleViewProvider}
                className="flex-row items-center mb-4"
              >
                {/* Avatar */}
                <View className="relative">
                  {providerImage ? (
                    <Image
                      source={{ uri: providerImage }}
                      className="w-14 h-14 rounded-2xl bg-gray-200"
                    />
                  ) : (
                    <View className="w-14 h-14 bg-primary/10 rounded-2xl items-center justify-center">
                      <User size={24} color="#094569" />
                    </View>
                  )}
                  {(service.service_providers as any)?.status === "verified" && (
                    <View className="absolute -bottom-1 -right-1 w-5 h-5 bg-blue-500 rounded-full border-2 border-white items-center justify-center">
                      <CheckCircle2 size={10} color="white" fill="white" />
                    </View>
                  )}
                </View>

                {/* Provider Info */}
                <View className="flex-1 ml-4">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-gray-900">
                      {providerName}
                    </Text>
                    {(service.service_providers as any)?.status === "verified" && (
                      <Verified size={16} color="#094569" />
                    )}
                  </View>
                  <Text className="text-xs text-gray-500 mt-1">
                    Service Provider
                  </Text>
                </View>

                {/* View Profile Arrow */}
                <View className="bg-white w-10 h-10 rounded-xl items-center justify-center shadow-sm">
                  <ArrowLeft
                    size={18}
                    color="#094569"
                    style={{ transform: [{ rotate: "180deg" }] }}
                  />
                </View>
              </TouchableOpacity>

              {/* Message Button - Only for other providers */}
              {!isOwnService && (
                <TouchableOpacity
                  onPress={handleMessageProvider}
                  activeOpacity={0.8}
                  className="bg-primary flex-row items-center justify-center py-3 rounded-2xl"
                >
                  <MessageCircle size={18} color="white" />
                  <Text className="text-white font-semibold ml-2">
                    Message Provider
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Description Section */}
            <Animated.View entering={FadeInDown.duration(300).delay(400)}>
              <Text className="text-lg font-bold text-gray-900 mb-3">
                About this service
              </Text>
              <Text className="text-base text-gray-600 leading-7 mb-6">
                {service.description ||
                  "No description provided for this service."}
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
                  {new Date(
                    (service as any).created_at,
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
            </Animated.View>
          </View>
        </Animated.View>
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

      {/* Floating Bottom Action Bar - Only for other providers */}
      {!isOwnService && (
        <Animated.View
          entering={FadeInUp.duration(400).delay(300)}
          className="absolute bottom-0 left-0 right-0"
        >
          <BlurView
            intensity={80}
            tint="light"
            className="border-t border-gray-100"
          >
            <View className="px-6 py-4 pb-8 flex-row gap-4">
              {/* Message Provider Button */}
              <TouchableOpacity
                onPress={handleMessageProvider}
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
                  Message Provider
                </Text>
              </TouchableOpacity>

              {/* View Profile Button */}
              <TouchableOpacity
                onPress={handleViewProvider}
                activeOpacity={0.8}
                className="w-14 h-14 rounded-2xl items-center justify-center border-2 bg-white border-gray-200"
              >
                <User size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </BlurView>
        </Animated.View>
      )}
    </View>
  );
}
