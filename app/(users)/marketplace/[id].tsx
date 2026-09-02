/**
 * Marketplace listing detail screen
 *
 * Navigated to from notifications, chat context cards, search, "view all"
 * pushes, etc. — everywhere except the Marketplace grid tap (which morphs
 * into MarketplaceDetailOverlay instead). Shows the listing using the
 * shared MarketplaceDetailContent component.
 *
 * Wrapped in ContextDrop (edge-swipe back, with a "drop to Message Seller"
 * dome) so that behavior isn't grid-exclusive — same treatment
 * app/(users)/product/[id].tsx and app/(users)/post/[id].tsx already give
 * their own detail screens. The native-stack edge-swipe is turned off so it
 * doesn't fight ContextDrop's own edge gesture for the same touch zone, and
 * this is presented as a transparentModal so the screen this was opened
 * from stays mounted/visible underneath instead of being detached.
 */

import ContextDrop from "@/components/ContextDrop";
import MarketplaceDetailContent, { MARKETPLACE_HERO_HEIGHT, useMarketplaceContactSellerTarget } from "@/components/MarketplaceDetailContent";
import { useUser } from "@/contexts/UserContext";
import {
  fetchMarketplaceItemById,
  MarketplaceItemWithUser,
} from "@/lib/postMarketPlace";
import { useAppRouter } from "@/utils/navigation";
import { Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Animated as RNAnimated,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Hoisted to a stable module-level reference — same reasoning as
// PRODUCT_SCREEN_OPTIONS / POST_SCREEN_OPTIONS (a fresh literal each render
// retriggers navigation.setOptions() and can trip React's nested-update
// guard).
const MARKETPLACE_SCREEN_OPTIONS = {
  gestureEnabled: false,
  presentation: "transparentModal" as const,
  // "none" made every non-grid entry point (search, notifications, chat
  // context cards, deep links, profile grid — see comment above) snap in
  // instantly with no visible transition at all. The Marketplace-grid-tap
  // path (MarketplaceDetailOverlay) never goes through this route, so it's
  // unaffected.
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
      <RNAnimated.View style={{ opacity, height: MARKETPLACE_HERO_HEIGHT }} className="w-full bg-gray-200" />
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

export default function MarketplaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useAppRouter();
  const { currentUser } = useUser();

  const [item, setItem] = useState<MarketplaceItemWithUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadItem = useCallback(
    async (isRefreshing = false) => {
      if (!id) return;
      try {
        if (!isRefreshing) setIsLoading(true);
        const data = await fetchMarketplaceItemById(id);
        setItem(data);
      } catch (error) {
        console.error("Error loading item:", error);
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [id],
  );

  // Plain effect on id change rather than useFocusEffect — this screen is
  // now presented as a transparentModal (see Stack.Screen options below) so
  // the screen underneath stays mounted/focusable behind it. useFocusEffect's
  // refire-on-every-focus-event semantics fight that — see product/[id].tsx
  // and post/[id].tsx's own identical comment for the "Maximum update depth
  // exceeded" loop this avoids.
  useEffect(() => {
    loadItem();
  }, [id]);

  const handleGoBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.push("/marketplace" as any);
  }, [router]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
      handleGoBack();
      return true;
    });
    return () => backHandler.remove();
  }, [handleGoBack]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadItem(true);
  };

  const contactSellerTarget = useMarketplaceContactSellerTarget(item, currentUser?.id);

  return (
    <>
      <Stack.Screen options={MARKETPLACE_SCREEN_OPTIONS} />
      <ContextDrop enabled={!isLoading} onDismiss={handleGoBack} target={contactSellerTarget}>
        {isLoading ? (
          <DetailSkeleton />
        ) : !item ? (
          <View className="flex-1 justify-center items-center bg-[#FAFBFC] px-6">
            <StatusBar barStyle="dark-content" />
            <Text className="text-xl font-bold text-gray-900 mb-2">Item Not Found</Text>
            <Text className="text-gray-500 text-center mb-8">
              This listing may have been removed.
            </Text>
            <TouchableOpacity
              style={{ borderRadius: 16, borderCurve: "continuous" }}
              className="bg-primary px-8 py-4"
              onPress={handleGoBack}
              activeOpacity={0.8}
            >
              <Text className="text-white font-bold text-base">Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <MarketplaceDetailContent
            item={item}
            onBack={handleGoBack}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        )}
      </ContextDrop>
    </>
  );
}
