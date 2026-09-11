/**
 * The Services tab: the services themselves, in the grid the other three
 * tabs use.
 *
 * It used to be a *directory* — one white group of rows, each a category you
 * tapped through to reach anything real. That was the right answer to the
 * question it was asked (nineteen long names, no pictures, and tiles that
 * truncated them all), but it was the wrong question: Home, Shopping and
 * Marketplace all open onto **content**, and this one opened onto a table of
 * contents. Four tabs on one bar, three of which show you things and one of
 * which shows you a menu, is the inconsistency worth fixing.
 *
 * So the categories became what they are on Marketplace — a filter row above
 * the grid — and the grid shows what people actually came for: a provider's
 * service, its photograph, and whose it is. Nothing is lost from the
 * directory that mattered: every category is still one tap away, and the
 * long names now sit in a scrolling row where they have the width to be read
 * rather than in a tile that cut them in half.
 *
 * Bookings stay their own group. A ground or a room is booked by the slot
 * rather than by contacting somebody, so they are two rows above the grid on
 * "All" — not two more filters, which would make them look like kinds of
 * service they are not.
 */

import GridCard, { gridCardHeight, LISTING_CARD_RATIO, type GridCardSourceRect } from "@/components/GridCard";
import ServiceDetailOverlay from "@/components/ServiceDetailOverlay";
import MasonryGrid from "@/components/MasonryGrid";
import CategoryFilterRow from "@/components/ui/CategoryFilterRow";
import GridSkeleton from "@/components/ui/GridSkeleton";
import PullToRefresh from "@/components/ui/PullToRefresh";
import TopNavbar from "@/components/ui/TopNavbar";
import { useTabBarScroll } from "@/contexts/TabBarScrollContext";
import { serviceCategories } from "@/data/servicecategory";
import { useScreenAnalytics } from "@/hooks/useAnalytics";
import { useViewableContent } from "@/hooks/useViewableContent";
import { Screens } from "@/lib/analyticsService";
import { CACHE_SEED_LIMIT, readCache, writeCache } from "@/lib/queryCache";
import {
  fetchAllProviderServices,
  type ProviderServiceWithDetails,
} from "@/lib/servicesService";
import { useAppRouter } from "@/utils/navigation";
import { Href } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CACHE_KEY = "services:pool";
/** One session, the whole pool — the same shape Marketplace uses, and for
 *  the same reason: switching a filter must not cost a round trip. */
const POOL_SIZE = 200;

/** "All" plus every category, in the data file's own order. */
const FILTERS = [
  { key: "all", label: "All" },
  ...serviceCategories.map((c) => ({ key: c.slug, label: c.name })),
];

export default function ServiceScreen() {
  const insets = useSafeAreaInsets();
  const router = useAppRouter();
  const { onTabBarScroll } = useTabBarScroll();
  const { trackTap, trackFeature } = useScreenAnalytics(Screens.SERVICES);

  const [active, setActive] = useState("all");
  const [services, setServices] = useState<ProviderServiceWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  // Cache first, network second — the grid paints from the last session's
  // pool instead of a full-page skeleton (lib/queryCache.ts).
  const load = useCallback(async (showLoader: boolean) => {
    try {
      const cached = await readCache<ProviderServiceWithDetails[]>(CACHE_KEY);
      if (cached?.data?.length) {
        setServices(cached.data);
        setLoading(false);
      } else if (showLoader) {
        setLoading(true);
      }

      const fetched = await fetchAllProviderServices(0, POOL_SIZE);
      // Only what is actually live: a paused service in the grid is a tap
      // into a screen that says it is unavailable.
      const live = fetched.filter((s) => s.status !== false);
      setServices(live);
      writeCache(CACHE_KEY, live.slice(0, CACHE_SEED_LIMIT));
    } catch (e) {
      console.error("[services] load failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  /** Safe View, age and verification apply here too — a service listing is
   *  photographs somebody uploaded (`lib/safeContent.ts`). */
  const { filter: filterViewable } = useViewableContent();
  const shown = useMemo(() => {
    const viewable = filterViewable<ProviderServiceWithDetails>(
      services,
      (s) => s.service_providers?.user_id,
    );
    return active === "all"
      ? viewable
      : viewable.filter((s) => s.service_categories?.slug === active);
  }, [active, filterViewable, services]);

  const changeFilter = (slug: string) => {
    if (slug === active) return;
    trackFeature("filter_apply", "filter_button", "tap", { category: slug });
    setActive(slug);
  };

  /**
   * A tile grows into the service screen rather than pushing to it — the
   * same treatment a product tile gets, including the left-edge swipe back
   * and the drop-on-the-dome that messages the provider.
   */
  const [openService_, setOpenService] = useState<{
    service: ProviderServiceWithDetails;
    rect: GridCardSourceRect;
  } | null>(null);

  const openService = useCallback(
    (id: string, rect: GridCardSourceRect) => {
      trackTap("service_card", "service_view", { service_id: id });
      const service = services.find((s) => s.id === id);
      if (service) setOpenService({ service, rect });
      // Not in the pool (a stale tap after a refresh) — the route still
      // works, and is a better answer than nothing happening.
      else router.push(`/(users)/servicedetail/${id}` as Href);
    },
    [router, services, trackTap],
  );

  // Swipe between filters, the same gesture the Marketplace grid has.
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      const idx = FILTERS.findIndex((f) => f.key === active);
      if (e.translationX < -50 && idx < FILTERS.length - 1) {
        changeFilter(FILTERS[idx + 1].key);
      } else if (e.translationX > 50 && idx > 0) {
        changeFilter(FILTERS[idx - 1].key);
      }
    });

  const renderCard = (
    service: ProviderServiceWithDetails,
    columnWidth: number,
    deferred: boolean,
    priority: "low" | "normal" | "high",
  ) => {
    const provider = service.service_providers;
    const providerName =
      provider?.name || (provider as any)?.profiles?.name || "Provider";
    return (
      <GridCard
        id={service.id}
        width={columnWidth}
        ratio={LISTING_CARD_RATIO}
        imageUri={service.images?.[0]}
        title={service.name}
        subtitle={providerName}
        avatarUri={(provider as any)?.profile_url ?? (provider as any)?.profiles?.avatar_url}
        avatarLabel={providerName}
        deferred={deferred}
        priority={priority}
        // A service has no price (§ Tagged products) — what belongs in that
        // corner is which kind of service it is, which is the thing being
        // filtered on.
        footerRight={
          service.service_categories?.name ? (
            <Text
              style={{ fontSize: 12, color: "#9CA3AF", maxWidth: 96 }}
              numberOfLines={1}
            >
              {service.service_categories.name}
            </Text>
          ) : undefined
        }
        onPress={openService}
      />
    );
  };

  return (
    <GestureDetector gesture={swipe}>
      <View className="flex-1 bg-gray-50">
        {/* Fixed — TopNavbar never scrolls away, and the one search on this
            screen is its (§ Header). */}
        <View className="bg-gray-50">
          <TopNavbar
            search={{
              placeholder: "Search services, providers",
              onPress: () => router.push("/(users)/services/search" as Href),
            }}
          />
        </View>

        <PullToRefresh onRefresh={() => load(false)}>
          {({ indicator, scrollEnabled, onScroll }) => (
            <>
              {indicator}
              <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 72 + insets.bottom }}
                onScroll={(e) => {
                  onScroll(e);
                  onTabBarScroll(e);
                }}
                scrollEventThrottle={16}
                scrollEnabled={scrollEnabled}
                bounces={false}
                overScrollMode="never"
              >
                {/* The same row Shopping has, from the same component: a
                    scroll of plain-text filters with a chevron that drops
                    the whole list over it. Twenty categories do not fit on
                    a phone's width, and a row you can only reach the end of
                    by flicking is a list with a hidden half.

                    The two bookings live in that drawer under their own
                    heading rather than as a white block above the grid.
                    They were a separate button because they are not
                    filters — a ground or a room is booked by the slot, so
                    tapping one leaves the screen instead of narrowing it —
                    but that is a reason to label them, not to put them
                    somewhere else entirely. */}
                <CategoryFilterRow
                  items={FILTERS}
                  active={active}
                  onSelect={changeFilter}
                  drawerTitle="All services"
                  links={[
                    {
                      key: "ground-bookings",
                      label: "Grounds",
                      onPress: () => {
                        trackTap("service_card", "category_select", {
                          category: "ground-bookings",
                        });
                        router.push("/services/ground-bookings/ground-booking" as Href);
                      },
                    },
                    {
                      key: "room-booking",
                      label: "Rooms",
                      onPress: () => {
                        trackTap("service_card", "category_select", {
                          category: "room-booking",
                        });
                        router.push("/services/room-booking/room-booking" as Href);
                      },
                    },
                  ]}
                />

                {loading && services.length === 0 ? (
                  <View className="px-3 pt-1">
                    <GridSkeleton rows={3} imageHeight={140} />
                  </View>
                ) : (
                  <View className="pb-6">
                    <MasonryGrid
                      items={shown}
                      loading={false}
                      keyExtractor={(service) => service.id}
                      getHeight={(_service, columnWidth) =>
                        gridCardHeight(LISTING_CARD_RATIO, columnWidth)
                      }
                      emptyText={
                        active === "all"
                          ? "No services yet — the first ones will turn up here."
                          : "Nothing in this category yet. Try another."
                      }
                      renderCard={renderCard}
                    />
                  </View>
                )}

                <View className="h-20" />
              </ScrollView>
            </>
          )}
        </PullToRefresh>
        <ServiceDetailOverlay
          visible={!!openService_}
          service={openService_?.service ?? null}
          sourceRect={openService_?.rect ?? null}
          onClose={() => setOpenService(null)}
        />
      </View>
    </GestureDetector>
  );
}
