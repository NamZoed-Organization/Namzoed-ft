/**
 * Product detail screen
 *
 * Navigated to from notifications, chat context cards, search, "view all"
 * pushes, etc. — everywhere except the Categories/Marketplace grid tap
 * (which morphs into ProductDetailOverlay instead). Shows the product using
 * the shared ProductDetailContent component.
 *
 * Wrapped in the same ContextDrop gesture ProductDetailOverlay uses
 * (edge-swipe back, with a "drop to Message Seller" dome) so that behavior
 * isn't grid-exclusive — the native-stack edge-swipe is turned off for this
 * screen so it doesn't fight ContextDrop's own edge gesture for the same
 * touch zone.
 *
 * Presented as a transparentModal (not the navigator's default opaque
 * "card") so whatever screen this was opened from stays mounted and visible
 * underneath instead of being detached, matching ProductDetailOverlay's own
 * "real screen shows through while dragging" behavior even though this
 * route is a genuine stack push rather than an in-tree overlay.
 */

import ContextDrop from "@/components/ContextDrop";
import ProductDetailContent, { PRODUCT_HERO_HEIGHT, useProductContactSellerTarget } from "@/components/ProductDetailContent";
import { useUser } from "@/contexts/UserContext";
import { fetchProductById, ProductWithUser } from "@/lib/productsService";
import { useAppRouter } from "@/utils/navigation";
import { Stack, useLocalSearchParams } from "expo-router";
import { Package } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Animated as RNAnimated,
    BackHandler,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

// Hoisted to a stable module-level reference — Stack.Screen's `options` prop
// drives navigation.setOptions() internally, and passing a fresh object
// literal on every render was retriggering that (and the parent navigator
// re-rendering this screen in response) in a tight loop, tripping React's
// "Maximum update depth exceeded" guard. These values are static, so a
// stable reference is all that's needed — no useMemo required.
const PRODUCT_SCREEN_OPTIONS = {
  gestureEnabled: false,
  presentation: "transparentModal" as const,
  // "none" made every non-grid entry point (search, notifications, chat
  // context cards, deep links, profile grid — see comment above) snap in
  // instantly with no visible transition at all. The Categories/Marketplace-
  // grid-tap path (ProductDetailOverlay) never goes through this route, so
  // it's unaffected.
  animation: "fade" as const,
  animationDuration: 220,
  contentStyle: { backgroundColor: "transparent" },
};

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
      <RNAnimated.View style={{ opacity, height: PRODUCT_HERO_HEIGHT }} className="w-full bg-gray-200" />
      <View className="bg-white flex-1 px-6 pt-8">
        <RNAnimated.View style={{ opacity, borderRadius: 16, borderCurve: "continuous" }} className="h-8 bg-gray-100 w-3/4 mb-4" />
        <RNAnimated.View style={{ opacity, borderRadius: 16, borderCurve: "continuous" }} className="h-10 bg-gray-100 w-1/2 mb-6" />
        <RNAnimated.View style={{ opacity, borderRadius: 24, borderCurve: "continuous" }} className="h-20 bg-gray-50 w-full mb-6" />
        <RNAnimated.View style={{ opacity, borderRadius: 12, borderCurve: "continuous" }} className="h-4 bg-gray-100 w-full mb-3" />
        <RNAnimated.View style={{ opacity, borderRadius: 12, borderCurve: "continuous" }} className="h-4 bg-gray-100 w-full mb-3" />
        <RNAnimated.View style={{ opacity, borderRadius: 12, borderCurve: "continuous" }} className="h-4 bg-gray-100 w-2/3" />
      </View>
    </View>
  );
}

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useAppRouter();
  const { currentUser } = useUser();

  const [product, setProduct] = useState<ProductWithUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadProduct = useCallback(
    async (isRefreshing = false) => {
      if (!id) return;
      if (!isRefreshing) setLoading(true);
      setError(null);
      try {
        const data = await fetchProductById(id);
        setProduct(data);
      } catch (err: any) {
        console.error("Error loading product:", err);
        setError(err.message || "Failed to load product");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  // Plain effect on id change rather than useFocusEffect — this screen is
  // presented as a transparentModal (see Stack.Screen options below) so the
  // screen underneath stays mounted/focusable behind it. useFocusEffect's
  // refire-on-every-focus-event semantics fight that: the navigator can
  // toggle focus between the two overlapping screens, and each focus firing
  // loadProduct() (setLoading / setProduct / ...) synchronously kept
  // re-triggering more focus/update cycles until React's nested-update-depth
  // guard tripped ("Maximum update depth exceeded").
  useEffect(() => {
    loadProduct();
  }, [id]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else if (product?.category) {
      router.push(`/categories/${product.category}`);
    } else {
      router.push("/categories");
    }
  }, [router, product?.category]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleGoBack();
      return true;
    });
    return () => backHandler.remove();
  }, [handleGoBack]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadProduct(true);
  };

  const contactSellerTarget = useProductContactSellerTarget(product, currentUser?.id);

  return (
    <>
      {/* Native-stack's own edge-swipe would otherwise compete with
          ContextDrop's for the same left-edge touch zone. transparentModal
          (+ transparent contentStyle, since Android's screens otherwise
          paint an opaque backing) keeps the previous screen mounted and
          visible behind this one. */}
      <Stack.Screen options={PRODUCT_SCREEN_OPTIONS} />
      <ContextDrop enabled={!loading} onDismiss={handleGoBack} target={contactSellerTarget}>
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
              style={{ borderRadius: 16, borderCurve: "continuous" }}
              className="bg-primary px-8 py-4 shadow-lg"
              onPress={handleGoBack}
              activeOpacity={0.8}
            >
              <Text className="text-white font-bold text-base">Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ProductDetailContent
            product={product}
            onBack={handleGoBack}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        )}
      </ContextDrop>
    </>
  );
}
