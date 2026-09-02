/**
 * ProductDetailContent
 *
 * The product-detail screen's actual render — header, hero carousel, price/
 * description/reviews body, floating action pill, modals. Pulled out of
 * app/(users)/product/[id].tsx so the same content can be mounted two ways:
 * that route (for deep links — notifications, chat context cards, search)
 * and ProductDetailOverlay (the Home/Categories-grid-tap fast path), exactly
 * how FeedPost is shared between app/(users)/post/[id].tsx and
 * PostDetailOverlay.
 *
 * Takes a fully-loaded `product` (never null) and an `onBack` — the caller
 * owns fetching-by-id, loading/error states, and what "back" means (a real
 * router.back() for the route, or the overlay's shrink-down animation).
 */

import CountdownTimer from "@/components/CountdownTimer";
import MarketplaceImageViewer from "@/components/modals/MarketplaceImageViewer";
import PostFeedbackOverlay from "@/components/modals/PostFeedbackOverlay";
import ProductReviews from "@/components/ProductReviews";
import ReportProductModal from "@/components/modals/ReportProductModal";
import ShareComposerModal from "@/components/modals/ShareComposerModal";
import { ContextDropTarget } from "@/components/ContextDrop";
import CarouselDots from "@/components/ui/CarouselDots";
import PopupMessage from "@/components/ui/PopupMessage";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { useUser } from "@/contexts/UserContext";
import { RATIO_PORTRAIT } from "@/lib/postMediaDisplay";
import { ProductWithUser } from "@/lib/productsService";
import { buildProductExternalSharePayload } from "@/lib/shareUtils";
import { supabase } from "@/lib/supabase";
import { EdgeGestureCarouselHandle, registerEdgeGestureCarousel } from "@/utils/edgeGestureRegistry";
import { useAppRouter } from "@/utils/navigation";
import { getInitials } from "@/utils/initials";
import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bookmark,
  ChevronLeft,
  Clock,
  MessageCircle,
  Moon,
  Package,
  Send,
  ShoppingBag,
  Sparkles,
  Tag,
  Verified,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#094569";

// Same glassmorphism recipe as FeedPost's own detail-mode header buttons.
const HEADER_GLASS_BUTTON_SIZE = 36;
const HEADER_GLASS_BUTTON_STYLE = {
  width: HEADER_GLASS_BUTTON_SIZE,
  height: HEADER_GLASS_BUTTON_SIZE,
  borderRadius: HEADER_GLASS_BUTTON_SIZE / 2,
  borderCurve: "continuous",
  alignItems: "center" as const,
  justifyContent: "center" as const,
  overflow: "hidden" as const,
  borderWidth: StyleSheet.hairlineWidth,
  borderTopColor: "rgba(255,255,255,0.55)",
  borderLeftColor: "rgba(255,255,255,0.25)",
  borderRightColor: "rgba(255,255,255,0.25)",
  borderBottomColor: "rgba(0,0,0,0.08)",
  backgroundColor: Platform.OS === "ios" ? "transparent" : "rgba(255,255,255,0.77)",
};

// Fades the header's blur out at its bottom edge — same recipe as FeedPost's
// own detail-mode header (components/FeedPost.tsx headerBlurFadeStops).
function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}
function headerBlurFadeStops() {
  const STEPS = 5;
  const locations = Array.from(
    { length: STEPS + 1 },
    (_, i) => i / STEPS,
  ) as unknown as [number, number, ...number[]];
  const colors = Array.from({ length: STEPS + 1 }, (_, i) => {
    const alpha = 1 - smoothstep(i / STEPS);
    return `rgba(255,255,255,${alpha.toFixed(3)})`;
  }) as unknown as [string, string, ...string[]];
  return { colors, locations };
}
const HEADER_BLUR_FADE_STOPS = headerBlurFadeStops();

function HeaderGlassButton({
  onPress,
  children,
  style,
}: {
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[HEADER_GLASS_BUTTON_STYLE, style]} activeOpacity={0.8}>
      {Platform.OS === "ios" && (
        <BlurView tint="systemChromeMaterial" intensity={50} style={StyleSheet.absoluteFill} />
      )}
      {children}
    </TouchableOpacity>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Fixed 4:5 frame — same as the post-detail carousel (FeedPost's slideH), and
// the exact height ProductDetailOverlay's hero settles to.
export const PRODUCT_HERO_HEIGHT = SCREEN_WIDTH / RATIO_PORTRAIT;

export interface ProductDetailContentProps {
  product: ProductWithUser;
  onBack: () => void;
  /** Pull-to-refresh — omit to render without a RefreshControl (the overlay
   * path has no live re-fetch loop of its own, matching PostDetailOverlay/
   * FeedPost's detail mode, which has no pull-to-refresh either). */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Wraps any navigation AWAY from this screen (seller profile, message
   * seller) — ProductDetailOverlay passes `(navigate) => commitClose(navigate)`
   * so it shrinks back down to the grid first instead of leaving itself
   * open behind the pushed screen, mirroring FeedPost's onNavigateAway. The
   * plain route usage (this component rendered from product/[id].tsx) omits
   * it, so navigation just happens immediately as a normal push. */
  onNavigateAway?: (navigate: () => void) => void;
}

export default function ProductDetailContent({ product, onBack, onRefresh, refreshing = false, onNavigateAway }: ProductDetailContentProps) {
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
  const [sellerVerified, setSellerVerified] = useState(false);
  const activeImageIndexRef = useRef(0);
  // Registered with the shared edge-gesture registry so ContextDrop's own
  // left-edge swipe-back backs off while this carousel isn't on its first
  // image — otherwise a mid-carousel "swipe right to see the previous image"
  // gesture gets hijacked into a screen dismiss. Same pattern as FeedPost's
  // MediaCarousel — see utils/edgeGestureRegistry.ts.
  const carouselContainerRef = useRef<View>(null);
  const edgeGestureHandleRef = useRef<EdgeGestureCarouselHandle | null>(null);

  const [showImageViewer, setShowImageViewer] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFeedbackOverlay, setShowFeedbackOverlay] = useState(false);
  const [showShareComposer, setShowShareComposer] = useState(false);

  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupTitle, setPopupTitle] = useState("");

  const productImageUrls = useMemo(
    () =>
      (product.images ?? []).filter(
        (uri): uri is string => typeof uri === "string" && uri.length > 0,
      ),
    [product.images],
  );
  const productImagesKey = useMemo(() => productImageUrls.join("||"), [productImageUrls]);

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

  // Seller verification badge — self-contained so both the route and the
  // overlay get it without the caller needing to also fetch it.
  useEffect(() => {
    let cancelled = false;
    if (!product.user_id) return;
    supabase
      .from("service_providers")
      .select("verification_status")
      .eq("user_id", product.user_id)
      .maybeSingle()
      .then(({ data: sp }) => {
        if (!cancelled) setSellerVerified(sp?.verification_status === "verified");
      });
    return () => {
      cancelled = true;
    };
  }, [product.user_id]);

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
      .eq("product_id", product.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) setIsBookmarked(!!data);
      });
    return () => {
      cancelled = true;
    };
  }, [product.id, currentUser?.id]);

  useEffect(() => {
    setActiveImageIndex(0);
    activeImageIndexRef.current = 0;
  }, [product.id, productImagesKey]);

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
    if (productImageUrls.length <= 1) return;
    const handle = registerEdgeGestureCarousel();
    edgeGestureHandleRef.current = handle;
    return () => {
      handle.unregister();
      edgeGestureHandleRef.current = null;
    };
  }, [productImageUrls.length]);

  const toggleBookmark = async () => {
    if (!currentUser) {
      showErrorPopup("Please sign in to save items", "Sign In Required");
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

  const handleMessageSeller = useCallback(() => {
    navigateAway(() =>
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
      }),
    );
  }, [product, router, navigateAway]);

  const isOwnProduct = currentUser?.id === product.user_id;

  const handleShare = async () => {
    setShowShareComposer(true);
  };

  const productSharePayload = useMemo(() => {
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

  // Long-press on the hero image — same "hold to report" affordance as posts.
  const handleImageLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowFeedbackOverlay(true);
  };

  const handleReportFromOverlay = () => {
    setShowFeedbackOverlay(false);
    handleReportProduct();
  };

  const hasImages = productImageUrls.length > 0;
  const images = productImageUrls;

  const savings = product.is_currently_active ? product.price - (product.current_price || 0) : 0;

  return (
    <View className="flex-1 bg-[#FAFBFC]">
      <StatusBar barStyle="dark-content" />

      {/* Pinned header — floats above the media with a translucent blurred
          bar (same glassmorphism as FeedPost's onBack detail header). */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          flexDirection: "row",
          alignItems: "center",
          paddingTop: insets.top + 10,
          paddingBottom: 10,
          paddingHorizontal: 14,
        }}
      >
        {Platform.OS === "ios" ? (
          <MaskedView
            style={StyleSheet.absoluteFill}
            maskElement={
              <LinearGradient
                colors={HEADER_BLUR_FADE_STOPS.colors}
                locations={HEADER_BLUR_FADE_STOPS.locations}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            }
          >
            <BlurView tint="systemChromeMaterial" intensity={70} style={StyleSheet.absoluteFill} />
          </MaskedView>
        ) : (
          <LinearGradient
            colors={["rgba(255,255,255,0.8)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        <HeaderGlassButton onPress={onBack} style={{ marginRight: 10 }}>
          <ChevronLeft size={20} color="#111" />
        </HeaderGlassButton>

        <TouchableOpacity
          onPress={() => navigateAway(() => router.push(`/(users)/profile/${product.user_id}`))}
          style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
          activeOpacity={0.7}
        >
          {(product.profiles as any)?.avatar_url ? (
            <ProgressiveImage
              uri={(product.profiles as any).avatar_url}
              style={{ width: 36, height: 36, borderRadius: 18 }}
              showProgress={false}
              priority="high"
              backgroundColor="#e5e7eb"
            />
          ) : (
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#e0e7ef", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: PRIMARY }}>
                {getInitials(product.profiles?.name)}
              </Text>
            </View>
          )}
          <View style={{ marginLeft: 10, flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#111" }} numberOfLines={1}>
                {product.profiles?.name || "Unknown seller"}
              </Text>
              {sellerVerified && <Verified size={13} color={PRIMARY} />}
            </View>
          </View>
        </TouchableOpacity>

        <HeaderGlassButton onPress={handleShare} style={{ marginLeft: 8 }}>
          <Send size={17} color="#374151" />
        </HeaderGlassButton>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bounces={true}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: isOwnProduct ? 16 : Math.max(insets.bottom, 16) + 52 }}
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
        {/* Hero Image Section — fixed 4:5 frame, cover-fit images, and
            pagination — same design as the post-detail carousel. */}
        <View ref={carouselContainerRef} collapsable={false} onLayout={remeasureCarousel} style={{ position: "relative" }}>
        <View style={{ height: PRODUCT_HERO_HEIGHT, overflow: "hidden", backgroundColor: "#000" }}>
          {hasImages ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                const idx = Math.min(
                  images.length - 1,
                  Math.max(0, Math.round(x / SCREEN_WIDTH)),
                );
                if (idx !== activeImageIndexRef.current) {
                  activeImageIndexRef.current = idx;
                  setActiveImageIndex(idx);
                }
              }}
              scrollEventThrottle={16}
              style={{ width: SCREEN_WIDTH, height: "100%" }}
            >
              {images.map((imageUrl, index) => (
                <TouchableOpacity
                  key={index}
                  activeOpacity={1}
                  style={{ width: SCREEN_WIDTH, height: "100%", backgroundColor: "#000" }}
                  onPress={() => {
                    setActiveImageIndex(index);
                    setShowImageViewer(true);
                  }}
                  onLongPress={isOwnProduct ? undefined : handleImageLongPress}
                  delayLongPress={350}
                >
                  <ProgressiveImage
                    uri={imageUrl}
                    style={{ width: SCREEN_WIDTH, height: "100%" }}
                    contentFit="cover"
                    showProgress={false}
                    recyclingKey={imageUrl}
                    priority={index === 0 ? "high" : "normal"}
                    // Same reasoning as FeedPost's own detail-mode image: no
                    // onRefresh means this is the overlay path, where the
                    // image was already visible a moment ago (grid
                    // thumbnail, then ProductDetailOverlay's own hero) and
                    // ProductDetailOverlay's own crossfade already handles
                    // the reveal — this component's own fade on top of that
                    // read as the image going black and reloading. Kept for
                    // the plain-route path (onRefresh present), where the
                    // cache may genuinely be cold.
                    transition={onRefresh ? undefined : 0}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View
              className="bg-gray-200 items-center justify-center"
              style={{ width: SCREEN_WIDTH, height: "100%" }}
            >
              <Package size={64} color="#D1D5DB" />
            </View>
          )}

          {images.length > 1 && (
            <View
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                backgroundColor: "rgba(0,0,0,0.55)",
                borderRadius: 999,
                borderCurve: "continuous",
                paddingHorizontal: 8,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                {activeImageIndex + 1}/{images.length}
              </Text>
            </View>
          )}

          {!isOwnProduct && (
            <PostFeedbackOverlay
              visible={showFeedbackOverlay}
              onClose={() => setShowFeedbackOverlay(false)}
              onReport={handleReportFromOverlay}
            />
          )}
        </View>

        {images.length > 1 && (
          <CarouselDots activeIndex={activeImageIndex} total={images.length} />
        )}
        </View>

        {/* Content Card */}
        <View className="bg-white">
          <View className="px-6 pt-6 pb-8">
            <View className="flex-row flex-wrap gap-2 mb-4">
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

            <Text className="text-2xl font-bold text-gray-900 mb-4 leading-tight">
              {product.name}
            </Text>

            <View className="mb-6">
              {product.is_currently_active ? (
                product.category === "food" ? (
                  <View
                    style={{ borderRadius: 24, borderCurve: "continuous" }} className="bg-gradient-to-r from-amber-50 to-orange-50 p-5 border border-amber-200">
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
                  <View
                    style={{ borderRadius: 24, borderCurve: "continuous" }} className="bg-gradient-to-r from-primary/5 to-green-50 p-5 border border-primary/10">
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

            <View>
              <Text className="text-lg font-bold text-gray-900 mb-3">
                About this product
              </Text>
              <Text className="text-base text-gray-600 leading-7 mb-6">
                {product.description || "No description provided for this product."}
              </Text>
            </View>

            <View className="flex-row flex-wrap gap-3 mb-6">
              <View
                style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-gray-50 px-4 py-3 flex-row items-center gap-2">
                <Clock size={16} color="#6B7280" />
                <Text className="text-sm text-gray-600">
                  {new Date(product.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <View
                style={{ borderRadius: 16, borderCurve: "continuous" }} className="bg-gray-50 px-4 py-3 flex-row items-center gap-2">
                <ShoppingBag size={16} color="#6B7280" />
                <Text className="text-sm text-gray-600">In stock</Text>
              </View>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 14,
              paddingTop: 4,
              paddingBottom: 8,
            }}
          >
            <Text style={{ fontSize: 14, color: "#9CA3AF", fontWeight: "500" }}>
              Posted{" "}
              {new Date(product.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>
          <View style={{ height: 1, backgroundColor: "#F3F4F6", marginHorizontal: 14 }} />

          <ProductReviews
            productId={product.id}
            productOwnerId={product.user_id}
            averageRating={product.average_rating}
            reviewCount={product.review_count}
          />
        </View>
      </ScrollView>

      {!isOwnProduct && (
        <View
          className="absolute bottom-0 left-0 right-0 items-end"
          style={{ paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16) }}
          pointerEvents="box-none"
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#fff",
              borderRadius: 999,
              borderCurve: "continuous",
              padding: 4,
              gap: 4,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <TouchableOpacity
              onPress={toggleBookmark}
              activeOpacity={0.8}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}
            >
              <Bookmark
                size={20}
                color={isBookmarked ? "#262626" : "#6B7280"}
                fill={isBookmarked ? "#262626" : "transparent"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleMessageSeller}
              activeOpacity={0.8}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: PRIMARY,
              }}
            >
              <MessageCircle size={19} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {currentUser && product.user_id && (
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

      {images.length > 0 && (
        <MarketplaceImageViewer
          visible={showImageViewer}
          images={images}
          initialIndex={activeImageIndex}
          onClose={() => setShowImageViewer(false)}
        />
      )}

      {productSharePayload && (
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

      <PopupMessage visible={showSuccess} type="success" title={popupTitle} message={popupMessage} />
      <PopupMessage visible={showError} type="error" title={popupTitle} message={popupMessage} />
    </View>
  );
}

/** Builds the shared "drop to Message Seller" ContextDrop target for a
 * product — same shape both product/[id].tsx and ProductDetailOverlay hand
 * to their own ContextDrop wrapping this component. */
export function useProductContactSellerTarget(
  product: ProductWithUser | null,
  currentUserId: string | undefined,
): ContextDropTarget | null {
  const router = useAppRouter();
  const canMessage = !!product && currentUserId !== product.user_id;
  return useMemo<ContextDropTarget | null>(() => {
    if (!canMessage || !product) return null;
    return {
      label: "Message Seller",
      armedLabel: "Drop to Message Seller",
      icon: <MessageCircle size={18} color="#fff" fill="none" />,
      armedIcon: <MessageCircle size={18} color={PRIMARY} fill={PRIMARY} />,
      onDrop: () => {
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
      },
    };
  }, [canMessage, product, router]);
}
