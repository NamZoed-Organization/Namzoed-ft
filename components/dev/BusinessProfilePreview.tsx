/**
 * BusinessProfilePreview  (dev only)
 *
 * A business profile driven by fixtures instead of the database, so the shape
 * of every business type can be seen without creating an account, verifying a
 * licence, and adding services and products for each one.
 *
 * It composes the REAL components — BusinessProfileHeader, ProfileTabRow, the
 * `businessTabs` mapping — rather than mock-ups of them. A preview built from
 * lookalikes tells you how the lookalikes render; this one breaks the moment
 * the real thing changes, which is the only way it stays worth trusting.
 *
 * Not reachable outside Settings › Dev Components.
 */

import BusinessProfileHeader from "@/components/profile/BusinessProfileHeader";
import ProfileTabRow from "@/components/profile/ProfileTabRow";
import SellerCredibilityCard from "@/components/SellerCredibilityCard";
import { GRID_BACKGROUND } from "@/components/MasonryGrid";
import { businessTabs, type BusinessSection } from "@/lib/businessSections";
import { compactPrice } from "@/utils/price";
import { serviceCategories } from "@/data/servicecategory";
import BusinessSummaryCard from "@/components/profile/BusinessSummaryCard";
import { ShopReviewsView } from "@/components/profile/ShopReviews";
import type {
  ProductRatingRollup,
  SellerRating,
  ShopRatingSummary,
} from "@/lib/sellerService";
import { ChevronLeft, Wrench } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** The types worth eyeballing: one per distinct section set, plus "unset" for
 *  the fallback, which is what every existing business gets until someone
 *  picks a type. */
const PRESETS = [
  { slug: "taxi-services", label: "Taxi" },
  { slug: "restaurants-fastfoods", label: "Restaurant" },
  { slug: "repair-maintenance", label: "Repairs" },
  { slug: "beauty-health", label: "Salon" },
  { slug: "groceries", label: "Grocery" },
  { slug: "hotels", label: "Hotel" },
  { slug: null, label: "No type set" },
] as const;

const FIXTURES = {
  products: [
    { id: "p1", name: "Wardrobe, almost new", price: 12000 },
    { id: "p2", name: "Crochet roses", price: 450 },
    { id: "p3", name: "Ezay, 250g", price: 120 },
    { id: "p4", name: "Imported blender", price: 1_250_000 },
  ],
  services: [
    { id: "s1", name: "Airport transfer" },
    { id: "s2", name: "City ride" },
    { id: "s3", name: "Intercity, Thimphu–Paro" },
  ],
  // Deliberately not all five stars: a preview where everything is perfect
  // hides how a mixed set actually reads, and the dimension row is only
  // interesting when the three numbers differ.
  ratings: [
    {
      id: "r1",
      buyerId: "b1",
      buyerName: "Sonam",
      buyerAvatarUrl: null,
      asDescribed: 5,
      service: 5,
      delivery: 4,
      comment: "Arrived on time and the car was clean. Would book again.",
      createdAt: new Date(Date.now() - 2 * 86400_000).toISOString(),
      overall: 4.7,
    },
    {
      id: "r2",
      buyerId: "b2",
      buyerName: "Pema",
      buyerAvatarUrl: null,
      asDescribed: 4,
      service: 5,
      delivery: 3,
      // One with no comment, because plenty of real ratings have none and
      // the row has to hold together without one.
      comment: null,
      createdAt: new Date(Date.now() - 9 * 86400_000).toISOString(),
      overall: 4,
    },
    {
      id: "r3",
      buyerId: "b3",
      buyerName: "Tashi",
      buyerAvatarUrl: null,
      asDescribed: 2,
      service: 3,
      delivery: 2,
      comment: "Took much longer than agreed and I had to call twice.",
      createdAt: new Date(Date.now() - 40 * 86400_000).toISOString(),
      overall: 2.3,
    },
  ] as SellerRating[],
  summary: {
    asDescribed: 3.7,
    service: 4.3,
    delivery: 3,
    ratingCount: 3,
    overall: 3.7,
  } as ShopRatingSummary,
  // Deliberately higher than the trading score above: the two numbers say
  // different things, and a preview where they agree hides the whole reason
  // they are shown separately.
  productRollup: {
    average: 4.4,
    reviewCount: 37,
    ratedProducts: 6,
  } as ProductRatingRollup,
};

interface BusinessProfilePreviewProps {
  visible: boolean;
  onClose: () => void;
}

export default function BusinessProfilePreview({
  visible,
  onClose,
}: BusinessProfilePreviewProps) {
  const insets = useSafeAreaInsets();
  const [slug, setSlug] = useState<string | null>("taxi-services");
  const [verified, setVerified] = useState(true);
  const [ownerView, setOwnerView] = useState(false);
  const [withRatings, setWithRatings] = useState(true);
  const [serviceCount, setServiceCount] = useState(5);
  const [hasProducts, setHasProducts] = useState(false);
  // The group that had no card at all before: products listed, business never
  // named. Worth being able to see, since it is likely the largest one.
  const [named, setNamed] = useState(true);
  // Starts on the personal profile, because that is where a business is
  // reached from — previewing the business page alone skips the step where
  // you find out whether the card that leads to it says anything useful.
  const [screen, setScreen] = useState<"personal" | "business">("personal");
  const [activeTab, setActiveTab] = useState<BusinessSection>("products");

  const tabs = useMemo(() => businessTabs(slug), [slug]);
  const categoryName = serviceCategories.find((c) => c.slug === slug)?.name ?? null;

  // The selected tab can vanish when the type changes — a taxi has no
  // Products — so fall back rather than render nothing.
  const currentTab = tabs.some((t) => t.key === activeTab) ? activeTab : tabs[0].key;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 bg-white" style={{ paddingBottom: insets.bottom }}>
        <StatusBar barStyle="light-content" />

        {screen === "personal" ? (
          // The part of the personal profile that changes: the action block
          // where the Business card sits with Norbu Wallet and History, on
          // the cover gradient they all live on.
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <View style={{ backgroundColor: "#1b3b52", paddingTop: insets.top + 24, paddingBottom: 20, paddingHorizontal: 16 }}>
              <View className="flex-row items-center mb-4">
                <View className="w-[86px] h-[86px] rounded-full bg-white/15 border border-white" />
                <View className="flex-1 ml-4">
                  <Text className="text-3xl font-mbold text-white">You</Text>
                  <Text className="text-sm font-regular text-white/50 mt-0.5">
                    NamZoed ID: tshe85D7
                  </Text>
                </View>
              </View>

              <BusinessSummaryCard
                userId="preview"
                providerId="preview"
                providerName={named ? (categoryName ? `Demo ${categoryName.split(",")[0]}` : "Demo Business") : null}
                fallbackName="You"
                isVerified={verified}
                onPress={() => setScreen("business")}
                previewShowcase={
                  hasProducts
                    ? {
                        kind: "product",
                        imageUrl: null,
                        price: FIXTURES.products[3].price,
                        name: null,
                      }
                    : serviceCount > 0
                      ? {
                          kind: "service",
                          imageUrl: null,
                          price: null,
                          name: FIXTURES.services[0].name,
                          serviceCount,
                        }
                      : null
                }
              />

              <View className="flex-row gap-2">
                <View
                  style={{ borderRadius: 8, borderCurve: "continuous" }}
                  className="flex-1 py-[9px] px-3 items-start bg-white/[0.07]"
                >
                  <Text className="text-sm font-semibold text-white">Norbu Wallet</Text>
                  <Text className="text-xs font-regular text-white/60 mt-0.5">
                    Manage your balance
                  </Text>
                </View>
                <View
                  style={{ borderRadius: 8, borderCurve: "continuous" }}
                  className="flex-1 py-[9px] px-3 items-start bg-white/[0.07]"
                >
                  <Text className="text-sm font-semibold text-white">History</Text>
                  <Text className="text-xs font-regular text-white/60 mt-0.5">
                    Everything you&apos;ve viewed
                  </Text>
                </View>
              </View>
            </View>

            <View className="px-5 py-6">
              <Text className="text-sm text-gray-400">
                Tap the Business card to open the business profile.
              </Text>
            </View>
          </ScrollView>
        ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <BusinessProfileHeader
            providerId={null}
            seedId={slug ?? "preview"}
            name={categoryName ? `Demo ${categoryName.split(",")[0]}` : "Demo Business"}
            bio="A fixture, so the shape of the page can be judged without inventing a real business first."
            logoUrl={null}
            dzongkhag={null}
            trade={categoryName}
            previewRatings={withRatings ? FIXTURES.summary : null}
            verification={verified ? "verified" : "not_verified"}
            productCount={hasProducts ? FIXTURES.products.length : 0}
            serviceCount={serviceCount}
            isOwnProfile={ownerView}
            topInset={insets.top + 8}
          />

          {/* The real card. It reads live data, so on a preview it renders
              nothing — which is itself worth seeing: it is what an
              unverified business looks like. */}
          <View className="px-4 mt-2 mb-3">
            <SellerCredibilityCard ownerId="preview" hideWhenUnverified />
          </View>

          <ProfileTabRow tabs={tabs} activeKey={currentTab} onChange={setActiveTab} />

          <View style={{ backgroundColor: GRID_BACKGROUND, minHeight: 260, padding: 14 }}>
            {currentTab === "products" || currentTab === "menu" ? (
              <View className="flex-row flex-wrap">
                {FIXTURES.products.map((product) => (
                  <View key={product.id} className="w-[50%] p-1.5">
                    <View
                      style={{ borderRadius: 12, borderCurve: "continuous" }}
                      className="bg-white overflow-hidden border border-gray-100"
                    >
                      <View className="w-full h-28 bg-gray-100" />
                      <View className="p-2.5">
                        <Text className="text-sm font-msemibold text-gray-900" numberOfLines={2}>
                          {product.name}
                        </Text>
                        {/* Exercises compactPrice: 1,250,000 must read
                            "Nu. 1.25M", 450 must stay exact. */}
                        <Text className="text-sm font-mbold text-primary mt-1">
                          {compactPrice(product.price)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : currentTab === "services" || currentTab === "fares" ? (
              <View className="flex-row flex-wrap">
                {FIXTURES.services.map((service) => (
                  <View key={service.id} className="w-[50%] p-1.5">
                    <View
                      style={{ borderRadius: 12, borderCurve: "continuous" }}
                      className="bg-white overflow-hidden border border-gray-100"
                    >
                      <View className="w-full h-28 bg-gray-100 items-center justify-center">
                        <Wrench size={26} strokeWidth={1.5} color="#9CA3AF" />
                      </View>
                      <View className="p-2.5">
                        <Text className="text-sm font-msemibold text-gray-900" numberOfLines={2}>
                          {service.name}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : currentTab === "portfolio" ? (
              <View className="flex-row flex-wrap">
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} className="w-[33.33%] p-1">
                    <View
                      style={{ borderRadius: 8, borderCurve: "continuous" }}
                      className="bg-white h-24 border border-gray-100"
                    />
                  </View>
                ))}
              </View>
            ) : (
              // The REAL reviews view, on fixtures. Toggling ratings off
              // shows its empty state, which is what every business sees
              // until orders exist and is therefore the one worth checking.
              <View style={{ marginHorizontal: -14, backgroundColor: "#fff", paddingBottom: 8 }}>
                <ShopReviewsView
                  loading={false}
                  kind={slug === "groceries" || slug == null ? "shop" : "service"}
                  summary={withRatings ? FIXTURES.summary : null}
                  ratings={withRatings ? FIXTURES.ratings : []}
                  // Tied to the Products toggle, not the Ratings one, so the
                  // third state is reachable: a business nobody has rated as a
                  // seller whose products are reviewed anyway, which is what
                  // every existing shop looks like the day this ships.
                  rollup={hasProducts ? FIXTURES.productRollup : null}
                  onOpenProducts={() => setActiveTab("products")}
                />
              </View>
            )}
          </View>
        </ScrollView>
        )}

        {/* Controls pinned at the bottom, out of the way of the page being
            judged. */}
        <View
          className="border-t border-gray-100 bg-white px-3 pt-2.5 pb-1"
          style={{ paddingBottom: 8 }}
        >
          <View className="flex-row items-center justify-between px-1 mb-2">
            <Text className="text-xs font-semibold text-gray-500">
              {tabs.map((t) => t.label).join(" · ")}
            </Text>
            <TouchableOpacity onPress={onClose} className="flex-row items-center">
              <ChevronLeft size={16} color="#6B7280" />
              <Text className="text-xs font-semibold text-gray-500">Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {PRESETS.map((preset) => (
              <Chip
                key={preset.label}
                label={preset.label}
                active={slug === preset.slug}
                onPress={() => setSlug(preset.slug)}
              />
            ))}
          </ScrollView>

          <View className="flex-row mt-1">
            <Chip
              label={verified ? "Verified" : "Unverified"}
              active={verified}
              onPress={() => setVerified((v) => !v)}
            />
            <Chip
              label={ownerView ? "Owner view" : "Visitor view"}
              active={ownerView}
              onPress={() => setOwnerView((v) => !v)}
            />
            <Chip
              label={withRatings ? "With ratings" : "No ratings"}
              active={withRatings}
              onPress={() => setWithRatings((v) => !v)}
            />
            <Chip
              label={`${serviceCount} services`}
              active={serviceCount > 0}
              // Cycles 0 → 1 → 5, the three cases that render differently:
              // nothing, a named service, and a count.
              onPress={() => setServiceCount((n) => (n === 0 ? 1 : n === 1 ? 5 : 0))}
            />
            <Chip
              label={hasProducts ? "Has products" : "No products"}
              active={hasProducts}
              onPress={() => setHasProducts((v) => !v)}
            />
            <Chip
              label={named ? "Named business" : "Unnamed"}
              active={named}
              onPress={() => setNamed((v) => !v)}
            />
            <Chip
              label={screen === "personal" ? "Personal" : "Business"}
              active={screen === "business"}
              onPress={() => setScreen((v) => (v === "personal" ? "business" : "personal"))}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderCurve: "continuous",
        backgroundColor: active ? "#094569" : "#f3f4f6",
        marginRight: 8,
        marginBottom: 6,
      }}
    >
      <Text
        style={{ fontSize: 12, fontWeight: "600", color: active ? "#fff" : "#111" }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
