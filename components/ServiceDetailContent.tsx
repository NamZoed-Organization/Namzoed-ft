/**
 * A service, in the same shape as a product.
 *
 * The two screens had drifted into different apps: a product got a fixed
 * 4:5 hero, a glass header floating over it and a white content card; a
 * service got a 45%-of-screen parallax hero that morphed height as you
 * scrolled, its own header, its own everything. They are the same kind of
 * page — a picture, a name, who is behind it, and one way to get in touch —
 * and a seller who lists both had to learn two of them.
 *
 * So this mirrors `ProductDetailContent` deliberately, down to the prop
 * surface: `heroSlot`, `topInset`, `showHeader` and `ownsStatusBar` are
 * here for the same reason they are there — a peek sheet grows into this
 * screen and needs to lend it a hero that can change size while everything
 * beneath it stays put.
 *
 * The one honest difference is the price: a service has none (§ Tagged
 * products). Where a product prints an amount, this prints who provides it
 * and what kind of work it is, because those are the facts somebody is
 * actually deciding on.
 */

import RestrictedContentGate from "@/components/ui/RestrictedContentGate";
import { useViewableContent } from "@/hooks/useViewableContent";
import { canView } from "@/lib/safeContent";
import ProfilePreviewTrigger from "@/components/profile/ProfilePreviewTrigger";
import SellerCredibilityCard from "@/components/SellerCredibilityCard";
import SellerRatingSheet from "@/components/SellerRatingSheet";
import CarouselDots from "@/components/ui/CarouselDots";
import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { useProfilePreviewElevation } from "@/contexts/ProfilePreviewContext";
import { useUser } from "@/contexts/UserContext";
import { useSellerRating } from "@/hooks/useSellerRating";
import type { ContextDropTarget } from "@/components/ContextDrop";
import type { ProviderServiceWithDetails } from "@/lib/servicesService";
import { getInitials } from "@/utils/initials";
import { beginNavHandoff } from "@/utils/navHandoff";
import { useAppRouter } from "@/utils/navigation";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import MaskedView from "@react-native-masked-view/masked-view";
import {
  ChevronLeft,
  MessageCircle,
  Send,
  Tag,
  Verified,
  Wrench,
} from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN_WIDTH = Dimensions.get("window").width;
const PRIMARY = "#094569";
/** The same 4:5 frame a product's hero uses — the whole point is that the
 *  two screens have one geometry. */
const RATIO_PORTRAIT = 4 / 5;
export const SERVICE_HERO_HEIGHT = SCREEN_WIDTH / RATIO_PORTRAIT;

/** Copied from the product screen so the two headers fade identically. */
const HEADER_BLUR_FADE_STOPS = {
  colors: ["rgba(0,0,0,1)", "rgba(0,0,0,0.85)", "rgba(0,0,0,0)"] as const,
  locations: [0, 0.6, 1] as const,
};

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
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        {
          width: 36,
          height: 36,
          borderRadius: 18,
          borderCurve: "continuous",
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.75)",
        },
        style,
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

export interface ServiceDetailContentProps {
  service: ProviderServiceWithDetails;
  onBack: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Wraps navigation *away*, so an overlay can shrink itself back first. */
  onNavigateAway?: (navigate: () => void) => void;
  /** A sheet growing into this screen supplies its own hero. */
  heroSlot?: React.ReactNode;
  topInset?: number;
  showHeader?: boolean;
  ownsStatusBar?: boolean;
  /**
   * Whether the page scrolls at all.
   *
   * The peek sheet turns it off while it is still a preview: reading
   * through a 70% window is a letterbox, and a live scroller there makes
   * the pull-up feel like a second hidden gesture. The sheet takes the
   * vertical until it *is* the screen.
   */
  scrollEnabled?: boolean;
  /** Told the scroll position, so the sheet knows when a downward drag
   *  means "put it back" rather than "scroll up past the top". */
  onScrollOffset?: (y: number) => void;
}

export default function ServiceDetailContent({
  service,
  onBack,
  onRefresh,
  refreshing = false,
  onNavigateAway,
  heroSlot,
  topInset,
  showHeader = true,
  ownsStatusBar = true,
  scrollEnabled = true,
  onScrollOffset,
}: ServiceDetailContentProps) {
  const router = useAppRouter();
  const insets = useSafeAreaInsets();
  const { currentUser } = useUser();

  const provider = service.service_providers;
  const providerUserId = provider?.user_id ?? "";
  const providerProfile = (provider as any)?.profiles ?? null;
  const providerName =
    provider?.name || providerProfile?.name || "Unknown provider";
  const providerAvatar = provider?.profile_url || providerProfile?.avatar_url;
  const isOwnService = !!currentUser?.id && currentUser.id === providerUserId;
  const sellerPreviewElevation = useProfilePreviewElevation(providerUserId);

  // A service had no rating of its own and no way to reach the provider's —
  // the page was a reputation dead end. It gets the same block a product
  // does, worded for a provider rather than a shop, and the same sheet. The
  // provider row is already joined here, so neither needs a lookup.
  const sellerRating = useSellerRating({
    ownerUserId: providerUserId,
    buyerId: currentUser?.id,
    providerId: provider?.id,
    fallbackName: provider?.name,
    kind: "service",
  });

  const images = useMemo(
    () => (service.images ?? []).filter(Boolean),
    [service.images],
  );
  const hasImages = images.length > 0;
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeIndexRef = useRef(0);

  const navigateAway = useCallback(
    (navigate: () => void) => {
      if (onNavigateAway) onNavigateAway(navigate);
      else navigate();
    },
    [onNavigateAway],
  );

  const openProvider = () =>
    navigateAway(() =>
      router.push(
        isOwnService
          ? "/(users)/profile?tab=work"
          : (`/(users)/profile/${providerUserId}?tab=work` as any),
      ),
    );

  const messageProvider = () => {
    if (isOwnService || !providerUserId) return;
    navigateAway(() => {
      beginNavHandoff();
      router.push(`/(users)/chat/${providerUserId}` as any);
    });
  };

  /**
   * A link, a share, a search result or a notification can land somebody on
   * this screen directly, so filtering the lists it is reached from is not
   * enough — the gate has to be here too, where the content would otherwise
   * be drawn (`lib/safeContent.ts`).
   */
  const { viewer } = useViewableContent();
  const mayView = canView(service, viewer, service.service_providers?.user_id);

  const handleShare = () => {
    Share.share({
      message: `${service.name} — on Namzoed`,
      url: `https://namzoed.com/service/${service.id}`,
    }).catch(() => {});
  };

  if (!mayView) {
    return (
      <RestrictedContentGate
        onBack={onBack}
        reason={viewer.safeView ? "safeView" : "age"}
      />
    );
  }

  return (
    <View className="flex-1 bg-[#FAFBFC]">
      {ownsStatusBar && <StatusBar barStyle="dark-content" />}

      {showHeader && (
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
              <BlurView
                tint="systemChromeMaterial"
                intensity={70}
                style={StyleSheet.absoluteFill}
              />
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
            onPress={openProvider}
            style={[
              { flexDirection: "row", alignItems: "center", flex: 1 },
              sellerPreviewElevation,
            ]}
            activeOpacity={0.7}
          >
            <ProfilePreviewTrigger userId={providerUserId} name={providerName}>
              {providerAvatar ? (
                <ProgressiveImage
                  uri={providerAvatar}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
                  showProgress={false}
                  priority="high"
                  backgroundColor="#e5e7eb"
                />
              ) : (
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    borderCurve: "continuous",
                    backgroundColor: "#e0e7ef",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: PRIMARY }}>
                    {getInitials(providerName)}
                  </Text>
                </View>
              )}
            </ProfilePreviewTrigger>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Text
                  style={{ fontSize: 14, fontWeight: "700", color: "#111" }}
                  numberOfLines={1}
                >
                  {providerName}
                </Text>
                {provider?.verification_status === "verified" && (
                  <Verified size={13} color={PRIMARY} />
                )}
              </View>
            </View>
          </TouchableOpacity>

          <HeaderGlassButton onPress={handleShare} style={{ marginLeft: 8 }}>
            <Send size={17} color="#374151" />
          </HeaderGlassButton>
        </View>
      )}

      <ScrollView
        className="flex-1"
        scrollEnabled={scrollEnabled}
        onScroll={(e) => onScrollOffset?.(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: topInset ?? insets.top + 56,
          paddingBottom: isOwnService ? 16 : Math.max(insets.bottom, 16) + 52,
        }}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PRIMARY}
              colors={[PRIMARY]}
            />
          ) : undefined
        }
      >
        {/* The hero, or the one a sheet lent us. */}
        {heroSlot ?? (
          <View style={{ position: "relative" }}>
            <View
              style={{
                height: SERVICE_HERO_HEIGHT,
                overflow: "hidden",
                backgroundColor: "#000",
              }}
            >
              {hasImages ? (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onScroll={(e) => {
                    const idx = Math.min(
                      images.length - 1,
                      Math.max(
                        0,
                        Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH),
                      ),
                    );
                    if (idx !== activeIndexRef.current) {
                      activeIndexRef.current = idx;
                      setActiveImageIndex(idx);
                    }
                  }}
                  scrollEventThrottle={16}
                  style={{ width: SCREEN_WIDTH, height: "100%" }}
                >
                  {images.map((uri, index) => (
                    <View
                      key={`${uri}-${index}`}
                      style={{ width: SCREEN_WIDTH, height: "100%", backgroundColor: "#000" }}
                    >
                      <ProgressiveImage
                        uri={uri}
                        style={{ width: SCREEN_WIDTH, height: "100%" }}
                        contentFit="cover"
                        showProgress={false}
                        recyclingKey={uri}
                        priority={index === 0 ? "high" : "normal"}
                        transition={onRefresh ? undefined : 0}
                      />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <View className="bg-gray-200 items-center justify-center" style={{ flex: 1 }}>
                  <Wrench size={56} color="#D1D5DB" />
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
            </View>

            {images.length > 1 && (
              <CarouselDots activeIndex={activeImageIndex} total={images.length} />
            )}
          </View>
        )}

        {/* Content card — the product screen's own shape. */}
        <View className="bg-white">
          <View className="px-6 pt-6 pb-8">
            <View className="flex-row flex-wrap gap-2 mb-4">
              {service.service_categories?.name && (
                <View className="bg-primary/10 px-4 py-1.5 rounded-full flex-row items-center gap-1.5">
                  <Tag size={12} color={PRIMARY} />
                  <Text className="text-xs font-semibold text-primary">
                    {service.service_categories.name}
                  </Text>
                </View>
              )}
            </View>

            <Text className="text-2xl font-bold text-gray-900 mb-4 leading-tight">
              {service.name}
            </Text>

            {/* Where a product prints a price. A service has none, so this
                is who does the work — the fact somebody is deciding on. */}
            <TouchableOpacity
              onPress={openProvider}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#F5F7F9",
                borderRadius: 16,
                borderCurve: "continuous",
                padding: 12,
                marginBottom: 20,
              }}
            >
              {providerAvatar ? (
                <ProgressiveImage
                  uri={providerAvatar}
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                  showProgress={false}
                />
              ) : (
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    borderCurve: "continuous",
                    backgroundColor: "#E0E7EF",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 15, fontWeight: "700", color: PRIMARY }}>
                    {getInitials(providerName)}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text
                    numberOfLines={1}
                    style={{ fontSize: 15.5, fontWeight: "700", color: "#111" }}
                  >
                    {providerName}
                  </Text>
                  {provider?.verification_status === "verified" && (
                    <Verified size={14} color={PRIMARY} />
                  )}
                </View>
                <Text style={{ fontSize: 13, color: "#6B7280", marginTop: 1 }}>
                  {provider?.verification_status === "verified"
                    ? "Verified provider"
                    : "Service provider"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* What is actually known about the provider — the same block
                the product screen shows above its reviews, and the only way
                a rating reaches this page at all. */}
            {!!providerUserId && (
              <View style={{ marginBottom: 20 }}>
                <SellerCredibilityCard
                  ownerId={providerUserId}
                  kind="service"
                  onRate={sellerRating.canRate ? sellerRating.openSheet : undefined}
                  hasRated={sellerRating.hasRated}
                  onPress={openProvider}
                />
              </View>
            )}

            {!!service.description && (
              <>
                <Text className="text-base font-bold text-gray-900 mb-2">
                  About this service
                </Text>
                <Text className="text-[15px] leading-6 text-gray-600">
                  {service.description}
                </Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* One way to get in touch, in the same place the product screen puts
          its own — and absent on your own service, where messaging yourself
          is the only thing it could do. */}
      {!isOwnService && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: Math.max(insets.bottom, 12),
            backgroundColor: "rgba(255,255,255,0.94)",
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: "#E5E7EB",
          }}
        >
          <TouchableOpacity
            onPress={messageProvider}
            activeOpacity={0.85}
            style={{
              backgroundColor: PRIMARY,
              borderRadius: 999,
              borderCurve: "continuous",
              paddingVertical: 13,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <MessageCircle size={17} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 15.5, fontWeight: "700" }}>
              Message provider
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {sellerRating.providerId && currentUser?.id && (
        <SellerRatingSheet
          visible={sellerRating.sheetOpen}
          onClose={sellerRating.closeSheet}
          providerId={sellerRating.providerId}
          buyerId={currentUser.id}
          businessName={sellerRating.businessName}
          kind={sellerRating.kind}
          onSubmitted={sellerRating.markRated}
        />
      )}
    </View>
  );
}

/**
 * The "drop to message the provider" target, so a service dismissed by the
 * edge gesture can hand off the same way a product does
 * (`useProductContactSellerTarget` is its twin).
 */
export function useServiceContactProviderTarget(
  service: ProviderServiceWithDetails | null,
  currentUserId: string | undefined,
): ContextDropTarget | null {
  const router = useAppRouter();
  const providerUserId = service?.service_providers?.user_id;
  const canMessage = !!providerUserId && currentUserId !== providerUserId;

  return useMemo<ContextDropTarget | null>(() => {
    if (!canMessage || !service || !providerUserId) return null;
    return {
      label: "Message Provider",
      armedLabel: "Drop to Message Provider",
      icon: <MessageCircle size={18} color="#fff" fill="none" />,
      armedIcon: <MessageCircle size={18} color={PRIMARY} fill={PRIMARY} />,
      onDrop: () => {
        // The chat screen is a heavy mount and the stack does not animate,
        // so the drop would otherwise land on a screen that just sits there
        // — see utils/navHandoff.ts.
        beginNavHandoff();
        router.push({
          pathname: "/(users)/chat/[id]",
          params: {
            id: String(providerUserId),
            context_service_id: String(service.id),
            context_service_title: service.name,
            context_service_image: service.images?.[0] ?? "",
            context_source: "service",
          },
        } as any);
      },
    };
  }, [canMessage, providerUserId, router, service]);
}
