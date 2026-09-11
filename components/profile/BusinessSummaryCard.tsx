/**
 * BusinessSummaryCard
 *
 * The Business card on a profile, sitting with Norbu Wallet and History and
 * built the same way: no border, `bg-white/[0.07]` on the cover gradient,
 * icon and title on one line, detail beneath.
 *
 * The right-hand side is the point of it. A business avatar there said
 * nothing a visitor didn't already know from the profile they were looking
 * at, so it shows what the business actually *sells* instead: a product
 * thumbnail with its price over it, or — for a business that only offers
 * services — the name of a service. One glance answers "what is this shop",
 * which the logo never did.
 */

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { businessDisplayName, hasBusiness } from "@/lib/sellerService";
import { supabase } from "@/lib/supabase";
import { compactPrice } from "@/utils/price";
import { Briefcase, Verified, Wrench } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export interface Showcase {
  kind: "product" | "service";
  imageUrl: string | null;
  /** Products only. */
  price: number | null;
  /** Services only: the name when there is exactly one, otherwise null. */
  name: string | null;
  /** Services only. Above one, the count is the honest summary — naming a
   *  single service out of five implies that is what the business does. */
  serviceCount?: number;
}

interface BusinessSummaryCardProps {
  userId: string;
  providerId?: string | null;
  /** What they named their business, if they ever did. */
  providerName?: string | null;
  /** Their own name, used when they never named the business — which is what
   *  a small shop is called anyway. */
  fallbackName?: string | null;
  isVerified: boolean;
  onPress: () => void;
  /** Dev only: stands in for the fetch, so the fixture-driven preview can
   *  show the card without a business behind it. */
  previewShowcase?: Showcase | null;
}

export default function BusinessSummaryCard({
  userId,
  providerId,
  providerName,
  fallbackName,
  isVerified,
  onPress,
  previewShowcase,
}: BusinessSummaryCardProps) {
  const [fetched, setShowcase] = useState<Showcase | null>(null);
  const showcase = previewShowcase !== undefined ? previewShowcase : fetched;
  const [productCount, setProductCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);

  useEffect(() => {
    if (!userId || previewShowcase !== undefined) return;
    let cancelled = false;

    (async () => {
      // A product first: it carries a price and an image, which says more in
      // a thumbnail than a service name can.
      const { data: products, count: productTotal } = await supabase
        .from("products")
        .select("images,price,current_price", { count: "exact" })
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (cancelled) return;
      setProductCount(productTotal ?? 0);

      const product = products?.[0];
      if (product?.images?.length) {
        setShowcase({
          kind: "product",
          imageUrl: product.images[0],
          // The live price when a discount is running, so the card can't
          // advertise a number the product page then contradicts.
          price: product.current_price ?? product.price ?? null,
          name: null,
        });
        return;
      }

      if (!providerId) return;
      // Reached whether or not there was a product, so the count is right
      // even for a business that sells both.
      // Fetched with an exact count, because what to show depends on how
      // many there are, not just what the newest one is called.
      const { data: services, count } = await supabase
        .from("provider_services")
        .select("name,images", { count: "exact" })
        .eq("provider_id", providerId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (cancelled) return;
      setServiceCount(count ?? 0);

      const service = services?.[0];
      if (!service) return;
      setShowcase({
        kind: "service",
        imageUrl: service.images?.[0] ?? null,
        price: null,
        name: service.name ?? null,
        serviceCount: count ?? 1,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, providerId, previewShowcase]);

  // The card decides, because it is the thing that knows. Judging by the
  // name alone (which every call site used to do) hid the card for sellers
  // who listed products long before the work profile existed and never named
  // anything — leaving their products live in shopping and unreachable from
  // their own profile, the worst of both.
  //
  // Counts arrive after the fetch, so an unnamed business briefly renders
  // nothing and then appears. That is the right way round: showing a card
  // and retracting it would be worse than showing it a moment late.
  if (!hasBusiness({ providerName, productCount, serviceCount })) return null;

  const businessName = businessDisplayName(providerName, fallbackName);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={{ borderRadius: 8, borderCurve: "continuous" }}
      className="mb-2 py-[9px] px-3 flex-row items-center bg-white/[0.07]"
    >
      <View className="flex-1 pr-3">
        <View className="flex-row items-center gap-1.5">
          <Briefcase size={16} color="#fff" />
          <Text className="text-sm font-semibold text-white">Business</Text>
          {isVerified && <Verified size={13} color="#7FD1FF" />}
        </View>
        <Text className="text-xs font-regular text-white/60 mt-0.5" numberOfLines={1}>
          {businessName}
        </Text>
      </View>

      {showcase?.kind === "product" && showcase.imageUrl ? (
        <View
          style={{ width: 46, height: 46, borderRadius: 6, borderCurve: "continuous", overflow: "hidden" }}
          className="bg-white/10"
        >
          <ProgressiveImage
            uri={showcase.imageUrl}
            style={{ width: "100%", height: "100%" }}
            showProgress={false}
          />
          {showcase.price != null && (
            // Over the image rather than beside it: the card is one row
            // high, and a price on its own line would push it taller than
            // the Wallet and History cards it sits with.
            <View
              style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
              className="bg-black/55 py-0.5 items-center"
            >
              <Text className="text-[10px] font-semibold text-white">
                {compactPrice(showcase.price)}
              </Text>
            </View>
          )}
        </View>
      ) : showcase?.kind === "service" ? (
        <View className="flex-row items-center gap-1.5 max-w-[45%]">
          <Wrench size={13} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />
          <Text className="text-xs font-medium text-white/70" numberOfLines={1}>
            {/* One service is worth naming; five are not summarised by
                naming the newest, which reads as "this is what they do"
                and is wrong four times out of five. */}
            {(showcase.serviceCount ?? 1) > 1
              ? `${showcase.serviceCount} services`
              : showcase.name}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
