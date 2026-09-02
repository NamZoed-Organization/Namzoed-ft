/**
 * MarketplaceDetailContent
 *
 * The marketplace-listing-detail screen's actual render — parallax hero
 * carousel (each image's own real aspect ratio, clamped between MIN/MAX),
 * seller card, description, floating "Message Seller" bar, modals. Pulled
 * out of app/(users)/marketplace/[id].tsx so the same content can be
 * mounted two ways: that route (for deep links) and MarketplaceDetailOverlay
 * (the Marketplace-grid-tap fast path) — same split ProductDetailContent /
 * product/[id].tsx uses, itself mirroring FeedPost / post/[id].tsx.
 *
 * Takes a fully-loaded `item` (never null) and an `onBack` — the caller owns
 * fetching-by-id, loading/error states, and what "back" means.
 */

import MarketplaceImageViewer from "@/components/modals/MarketplaceImageViewer";
import ReportProductModal from "@/components/modals/ReportProductModal";
import PopupMessage from "@/components/ui/PopupMessage";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { ContextDropTarget } from "@/components/ContextDrop";
import { useUser } from "@/contexts/UserContext";
import {
  MarketplaceItemWithUser,
} from "@/lib/postMarketPlace";
import { supabase } from "@/lib/supabase";
import { EdgeGestureCarouselHandle, registerEdgeGestureCarousel } from "@/utils/edgeGestureRegistry";
import { useAppRouter } from "@/utils/navigation";
import { BlurView } from "expo-blur";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bookmark,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flag,
  MapPin,
  MessageCircle,
  Tag,
  Verified,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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

const PRIMARY = "#094569";
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
// Default/at-rest hero height before any per-image aspect ratio resolves —
// also the exact height MarketplaceDetailOverlay's hero grows to, so the
// crossfade is a same-size swap; this component's own resize-to-real-ratio
// effect below then continues seamlessly after that, whether it started
// from a direct route load or from the overlay's crossfade.
export const MARKETPLACE_HERO_HEIGHT = SCREEN_HEIGHT * 0.5;
const MIN_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.35;
const MAX_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.65;

// Hero parallax only ever animates `transform` (translateX/scale) via style,
// driven with useNativeDriver: false (it must share a JS listener with the
// height-morph logic above) — so it's safe to swap the plain RN
// Animated.Image for an animated wrapper around expo-image, picking up
// cachePolicy caching without touching the animation itself.
const AnimatedHeroImage = RNAnimated.createAnimatedComponent(ExpoImage);

export interface MarketplaceDetailContentProps {
  item: MarketplaceItemWithUser;
  onBack: () => void;
  /** Pull-to-refresh — omit to render without a RefreshControl (the overlay
   * path has no live re-fetch loop of its own). */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Wraps any navigation AWAY from this screen (seller profile, message
   * seller) — MarketplaceDetailOverlay passes `(navigate) => commitClose(navigate)`
   * so it shrinks back down to the grid first, mirroring
   * ProductDetailContent/FeedPost's onNavigateAway. */
  onNavigateAway?: (navigate: () => void) => void;
}

export default function MarketplaceDetailContent({ item, onBack, onRefresh, refreshing = false, onNavigateAway }: MarketplaceDetailContentProps) {
  const router = useAppRouter();
  const { currentUser } = useUser();
  const insets = useSafeAreaInsets();

  const navigateAway = useCallback(
    (navigate: () => void) => {
      if (onNavigateAway) onNavigateAway(navigate);
      else navigate();
    },
    [onNavigateAway],
  );

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const imageScrollRef = useRef<ScrollView>(null);
  const imageScrollX = useRef(new RNAnimated.Value(0)).current;
  const animatedHeroHeight = useRef(new RNAnimated.Value(MARKETPLACE_HERO_HEIGHT)).current;
  const activeImageIndexRef = useRef(0);
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<number, number>>({});
  const [showReportModal, setShowReportModal] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [sellerVerified, setSellerVerified] = useState(false);

  // Registered with the shared edge-gesture registry so ContextDrop's own
  // left-edge swipe-back backs off while this carousel isn't on its first
  // image — same pattern as ProductDetailContent/FeedPost's MediaCarousel.
  const carouselContainerRef = useRef<View>(null);
  const edgeGestureHandleRef = useRef<EdgeGestureCarouselHandle | null>(null);

  const imageUrls = useMemo(
    () => (item.images ?? []).filter((uri): uri is string => typeof uri === "string" && uri.length > 0),
    [item.images],
  );
  const imageUrlsKey = useMemo(() => imageUrls.join("||"), [imageUrls]);

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

  // Seller verification badge — self-contained so both the route and the
  // overlay get it without the caller needing to also fetch it.
  useEffect(() => {
    let cancelled = false;
    if (!item.user_id) return;
    supabase
      .from("service_providers")
      .select("verification_status")
      .eq("user_id", item.user_id)
      .maybeSingle()
      .then(({ data: sp }) => {
        if (!cancelled) setSellerVerified(sp?.verification_status === "verified");
      });
    return () => {
      cancelled = true;
    };
  }, [item.user_id]);

  // Bookmark state — same self-contained treatment.
  useEffect(() => {
    let cancelled = false;
    if (!currentUser) {
      setIsBookmarked(false);
      return;
    }
    supabase
      .from("user_bookmarks")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("marketplace_id", item.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsBookmarked(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [item.id, currentUser?.id]);

  const remeasureCarousel = useCallback(() => {
    carouselContainerRef.current?.measureInWindow((_x, y, _w, h) => {
      edgeGestureHandleRef.current?.setBounds(y, y + h);
    });
  }, []);

  useEffect(() => {
    remeasureCarousel();
  }, [activeImageIndex, remeasureCarousel]);

  useEffect(() => {
    edgeGestureHandleRef.current?.setHasPrevious(activeImageIndex > 0);
  }, [activeImageIndex]);

  useEffect(() => {
    if (imageUrls.length <= 1) return;
    const handle = registerEdgeGestureCarousel();
    edgeGestureHandleRef.current = handle;
    return () => {
      handle.unregister();
      edgeGestureHandleRef.current = null;
    };
  }, [imageUrls.length]);

  const handleMessage = useCallback(() => {
    if (currentUser?.id === item.user_id) {
      showPopup("warning", "Your Listing", "This is your own listing");
      return;
    }
    navigateAway(() =>
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
      } as any),
    );
  }, [currentUser?.id, item, navigateAway, router]);

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

  const isOwnItem = currentUser?.id === item.user_id;

  useEffect(() => {
    setImageAspectRatios({});
    animatedHeroHeight.setValue(MARKETPLACE_HERO_HEIGHT);
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
          setImageAspectRatios((prev) => (prev[index] ? prev : { ...prev, [index]: ratio }));
        },
        () => {
          // keep fallback
        },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [item.id, imageUrls, imageUrlsKey, animatedHeroHeight]);

  const getImageHeightForIndex = useCallback(
    (index: number) => {
      const ratio = imageAspectRatios[index] || imageAspectRatios[0];
      if (!ratio) return MARKETPLACE_HERO_HEIGHT;
      const calculatedHeight = SCREEN_WIDTH / ratio;
      return Math.min(MAX_IMAGE_HEIGHT, Math.max(MIN_IMAGE_HEIGHT, calculatedHeight));
    },
    [imageAspectRatios],
  );

  useEffect(() => {
    if (!imageUrls.length) {
      animatedHeroHeight.setValue(MARKETPLACE_HERO_HEIGHT);
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
  }, [activeImageIndex, imageUrls.length, getImageHeightForIndex, animatedHeroHeight]);

  const images = imageUrls;

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
        contentContainerStyle={{ paddingBottom: isOwnItem ? 16 : 120 }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#094569"
              colors={["#094569"]}
            />
          ) : undefined
        }
      >
        {/* Hero Image */}
        <View ref={carouselContainerRef} collapsable={false} onLayout={remeasureCarousel}>
        <RNAnimated.View style={{ height: animatedHeroHeight, overflow: "hidden" }}>
          {images.length > 0 ? (
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
                    animatedHeroHeight.setValue(leftHeight + (rightHeight - leftHeight) * t);

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
              style={{ width: SCREEN_WIDTH, height: "100%" }}
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
                onPress={onBack}
                activeOpacity={0.8}
                className="w-11 h-11 rounded-full overflow-hidden"
              >
                <BlurView intensity={30} tint="dark" className="flex-1 items-center justify-center">
                  <ChevronLeft size={22} color="white" strokeWidth={2.5} />
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
                  borderCurve: "continuous",
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
                        borderCurve: "continuous",
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
        </View>

        {/* Content Card */}
        <View className="bg-white">
          <View className="px-6 pt-6 pb-8">
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
            <View
              style={{ borderRadius: 24, borderCurve: "continuous" }} className="bg-gray-50 p-5 mb-6">
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigateAway(() => router.push(`/(users)/profile/${item.user_id}` as any))}
                className="flex-row items-center"
              >
                <View className="relative">
                  {item.profiles?.avatar_url ? (
                    <ProgressiveImage
                      uri={item.profiles.avatar_url}
                      style={{ width: 56, height: 56, borderRadius: 16 }}
                      showProgress={false}
                      priority="high"
                      backgroundColor="#e5e7eb"
                    />
                  ) : (
                    <View
                      style={{ borderRadius: 16, borderCurve: "continuous" }} className="w-14 h-14 bg-primary/10 items-center justify-center">
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

                <View
                  style={{ borderRadius: 12, borderCurve: "continuous" }} className="bg-white w-10 h-10 items-center justify-center shadow-sm">
                  <ChevronRight size={18} color="#094569" />
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
                <View
                  style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-gray-50 px-4 py-3 flex-row items-center gap-2">
                  <MapPin size={16} color="#6B7280" />
                  <Text className="text-sm text-gray-600">{item.dzongkhag}</Text>
                </View>
              )}
              <View
                style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-gray-50 px-4 py-3 flex-row items-center gap-2">
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
                className="flex-1 bg-primary py-4 flex-row items-center justify-center gap-2"
                style={{ shadowColor: "#094569",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 8, borderRadius: 16, borderCurve: "continuous" }}
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

      {currentUser?.id && item.user_id && (
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

/** Builds the shared "drop to Message Seller" ContextDrop target for a
 * marketplace listing — same shape as ProductDetailContent's contact-seller
 * target, for callers (the route wrapper and MarketplaceDetailOverlay) to
 * hand to their own ContextDrop wrapping this component. */
export function useMarketplaceContactSellerTarget(
  item: MarketplaceItemWithUser | null,
  currentUserId: string | undefined,
): ContextDropTarget | null {
  const router = useAppRouter();
  const canMessage = !!item && currentUserId !== item.user_id;
  return useMemo<ContextDropTarget | null>(() => {
    if (!canMessage || !item) return null;
    return {
      label: "Message Seller",
      armedLabel: "Drop to Message Seller",
      icon: <MessageCircle size={18} color="#fff" fill="none" />,
      armedIcon: <MessageCircle size={18} color={PRIMARY} fill={PRIMARY} />,
      onDrop: () => {
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
      },
    };
  }, [canMessage, item, router]);
}
