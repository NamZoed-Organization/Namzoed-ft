import ContextDrop, { ContextDropTarget } from "@/components/ContextDrop";
import CountdownTimer from "@/components/CountdownTimer";
import MarketplaceImageViewer from "@/components/modals/MarketplaceImageViewer";
import PostFeedbackOverlay from "@/components/modals/PostFeedbackOverlay";
import ProductReviews from "@/components/ProductReviews";
import ReportProductModal from "@/components/modals/ReportProductModal";
import ShareComposerModal from "@/components/modals/ShareComposerModal";
import PopupMessage from "@/components/ui/PopupMessage";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { useUser } from "@/contexts/UserContext";
import { fetchProductById, ProductWithUser } from "@/lib/productsService";
import { buildProductExternalSharePayload } from "@/lib/shareUtils";
import { supabase } from "@/lib/supabase";
import { registerEdgeGestureCarousel } from "@/utils/edgeGestureRegistry";
import { useAppRouter } from "@/utils/navigation";
import { getInitials } from "@/utils/initials";
import MaskedView from "@react-native-masked-view/masked-view";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams } from "expo-router";
import {
    ChevronLeft,
    Clock,
    MessageCircle,
    Moon,
    Package,
    Send,
    ShoppingBag,
    Sparkles,
    Star,
    Tag,
    Verified
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    BackHandler,
    Dimensions,
    Image,
    Platform,
    RefreshControl,
    Animated as RNAnimated,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PRIMARY = "#094569";

// Same glassmorphism recipe as FeedPost's own detail-mode header buttons
// (components/FeedPost.tsx HeaderGlassButton) — reused here so this page's
// header reads as the same visual system as the post-detail screen.
const HEADER_GLASS_BUTTON_SIZE = 36;
const HEADER_GLASS_BUTTON_STYLE = {
  width: HEADER_GLASS_BUTTON_SIZE,
  height: HEADER_GLASS_BUTTON_SIZE,
  borderRadius: HEADER_GLASS_BUTTON_SIZE / 2,
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

// Fades the header's blur out at its bottom edge (via a MaskedView gradient
// mask) instead of a flat translucent bar with a hard edge — same recipe as
// FeedPost's own detail-mode header (components/FeedPost.tsx
// headerBlurFadeStops) so this reads as no visible background, just a
// blurred trail-off, matching the post-detail screen exactly. Smoothstep
// (not a plain linear fade) because a linear fade still has a non-zero
// slope right where it hits 0 alpha, which the eye picks out as a seam.
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

// Hoisted to a stable module-level reference — Stack.Screen's `options` prop
// drives navigation.setOptions() internally, and passing a fresh object
// literal on every render was retriggering that (and the parent navigator
// re-rendering this screen in response) in a tight loop, tripping React's
// "Maximum update depth exceeded" guard. These values are static, so a
// stable reference is all that's needed — no useMemo required.
const PRODUCT_SCREEN_OPTIONS = {
  gestureEnabled: false,
  presentation: "transparentModal" as const,
  animation: "none" as const,
  contentStyle: { backgroundColor: "transparent" },
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.5;
const MIN_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.35;
const MAX_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.65;

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
  // Registered with the shared edge-gesture registry below so ContextDrop's
  // own left-edge swipe-back backs off while this carousel isn't on its
  // first image — otherwise a mid-carousel "swipe right to see the previous
  // image" gesture gets hijacked into a screen dismiss. Same pattern as
  // FeedPost.tsx's MediaCarousel — see utils/edgeGestureRegistry.ts.
  const carouselContainerRef = useRef<View>(null);
  const carouselBoundsRef = useRef<{ top: number; bottom: number } | null>(null);

  // Image viewer state
  const [showImageViewer, setShowImageViewer] = useState(false);

  // Bookmark State
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Refresh & Report State
  const [refreshing, setRefreshing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showFeedbackOverlay, setShowFeedbackOverlay] = useState(false);
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

  // Plain effect on id change rather than useFocusEffect — this screen is
  // now presented as a transparentModal (see Stack.Screen options below) so
  // the screen underneath stays mounted/focusable behind it, same as
  // app/(users)/post/[id].tsx. useFocusEffect's refire-on-every-focus-event
  // semantics fight that: the navigator can toggle focus between the two
  // overlapping screens, and each focus firing loadProduct() (setLoading /
  // setProduct / ...) synchronously kept re-triggering more focus/update
  // cycles until React's nested-update-depth guard tripped ("Maximum update
  // depth exceeded"). post/[id].tsx already loads its data this same way
  // (a plain effect on id) specifically because of this same modal shape.
  useEffect(() => {
    loadProduct();
  }, [id, currentUser?.id]);

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

  const remeasureCarousel = useCallback(() => {
    carouselContainerRef.current?.measureInWindow((_x, y, _w, h) => {
      carouselBoundsRef.current = { top: y, bottom: y + h };
    });
  }, []);

  useEffect(() => {
    remeasureCarousel();
  }, [activeImageIndex, remeasureCarousel]);

  useEffect(() => {
    if (productImageUrls.length <= 1) return;
    return registerEdgeGestureCarousel({
      getBounds: () => carouselBoundsRef.current,
      hasPrevious: () => activeImageIndexRef.current > 0,
    });
  }, [productImageUrls.length]);

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

  // Edge-swipe "drop to Message Seller" — same ContextDrop target shape as
  // the post-detail screen's "Contact Author" (app/(users)/post/[id].tsx).
  const canMessageSeller = !!product && currentUser?.id !== product.user_id;
  const contactSellerTarget = useMemo<ContextDropTarget | null>(() => {
    if (!canMessageSeller) return null;
    return {
      label: "Message Seller",
      armedLabel: "Drop to Message Seller",
      icon: <MessageCircle size={18} color="#fff" fill="none" />,
      armedIcon: <MessageCircle size={18} color={PRIMARY} fill={PRIMARY} />,
      onDrop: handleMessageSeller,
    };
  }, [canMessageSeller, handleMessageSeller]);

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

  // Long-press on the hero image — same "hold to report" affordance as
  // posts (see FeedPost's handleImageLongPress): shows the dark
  // PostFeedbackOverlay first, and only opens the report modal once the
  // user taps "Report" on it.
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

  const scrollToImage = (index: number) => {
    setActiveImageIndex(index);
    imageScrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };
  const savings = product?.is_currently_active
    ? product.price - (product.current_price || 0)
    : 0;

  return (
    <>
      {/* Native-stack's own edge-swipe would otherwise compete with
          ContextDrop's for the same left-edge touch zone. transparentModal
          (+ transparent contentStyle, since Android's screens otherwise
          paint an opaque backing) keeps the previous screen mounted and
          visible behind this one — same treatment as app/(users)/post/[id].tsx. */}
      <Stack.Screen options={PRODUCT_SCREEN_OPTIONS} />
      <ContextDrop enabled={!loading} onDismiss={() => router.back()} target={contactSellerTarget}>
      {loading ? (
        <DetailSkeleton />
      ) : error || !product ? (
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
      ) : (
    <View className="flex-1 bg-[#FAFBFC]">
      <StatusBar
        barStyle="dark-content"
      />

      {/* Pinned header — floats above the media with a translucent blurred
          bar (same glassmorphism as FeedPost's onBack detail header),
          showing seller identity in place of the old plain back-only nav
          that used to float directly over the hero image. */}
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
          // No real blur on Android — approximate the same smoothed fade
          // with a plain opacity gradient instead of a flat translucent fill.
          <LinearGradient
            colors={["rgba(255,255,255,0.8)", "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        <HeaderGlassButton onPress={handleGoBack} style={{ marginRight: 10 }}>
          <ChevronLeft size={20} color="#111" />
        </HeaderGlassButton>

        <TouchableOpacity
          onPress={() => router.push(`/(users)/profile/${product.user_id}`)}
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
        contentContainerStyle={{ paddingTop: insets.top + 56, paddingBottom: isOwnProduct ? 16 : 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#094569"
            colors={["#094569"]}
          />
        }
      >
        {/* Hero Image Section — in-flow below the pinned header now, not
            full-bleed behind it, so it no longer needs its own back/share
            buttons layered on top (those moved to the header). */}
        {/* No onLayout here deliberately — this wraps a height-animating
            RNAnimated.View (see animatedHeroHeight below), and onLayout can
            fire on every frame of that transition under the New
            Architecture. The [activeImageIndex]-keyed effect above already
            re-measures on every swipe, which is the only time the registry
            actually needs fresh bounds. */}
        <View ref={carouselContainerRef} collapsable={false} style={{ position: "relative" }}>
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
                  onLongPress={isOwnProduct ? undefined : handleImageLongPress}
                  delayLongPress={350}
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

          {!isOwnProduct && (
            <PostFeedbackOverlay
              visible={showFeedbackOverlay}
              onClose={() => setShowFeedbackOverlay(false)}
              onReport={handleReportFromOverlay}
            />
          )}
        </RNAnimated.View>
        </View>

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

            {/* Seller identity now lives in the pinned header (avatar, name,
                verified badge, tap-to-profile) — no separate card here,
                same as the post-detail screen keeping author identity only
                in its header rather than duplicating it in the body. */}

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
          </View>

          {/* Timestamp row + hairline divider directly above Reviews —
              mirrors FeedPost's own date row just above its Comments
              section, tying the reviews section into the page the same way. */}
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

          <View className="pb-8" />
        </View>
      </ScrollView>

      {/* Floating action pill - Only show for other users' products. No
          full-width bar/blur behind it (transparent) and no profile avatar
          here — "write a review" now lives inline in ProductReviews' own
          trigger row, same as InlineComments' "Add a comment…" row on the
          post-detail screen. This is just two actions enclosed in one
          floating input-shaped pill: save (star) before Message Seller. */}
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
              <Star
                size={20}
                color={isBookmarked ? "#FBBF24" : "#6B7280"}
                fill={isBookmarked ? "#FBBF24" : "transparent"}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleMessageSeller}
              activeOpacity={0.8}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
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
      )}
      </ContextDrop>
    </>
  );
}
