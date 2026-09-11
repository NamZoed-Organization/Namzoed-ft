/**
 * SellerCredibilityCard
 *
 * The seller block on a product page: who you'd be buying from, and what is
 * actually known about how they trade.
 *
 * Two kinds of signal, deliberately kept apart and labelled as what they are
 * (see lib/sellerService.ts):
 *
 *   - the verification badge and the objective rates (on-time dispatch,
 *     cancellations)
 *     — facts, hard to game, and the only things a "Trusted" badge is
 *     derived from;
 *   - the three DSR dimensions — opinions, averaged over a trailing window.
 *
 * What it will NOT do is invent confidence. A shop with no measured orders
 * reads as "New shop", not as 100% on-time — a null rate rendered as a
 * number is the single most misleading thing a page like this can do, and in
 * a trust-scarce market it is the whole reason the block exists.
 *
 * Follows UI_STANDARD.md: white block on the grey, `MODAL_RADIUS`, lucide
 * icons in one weight and one colour, hairline separator.
 */

import {
  fetchSellerMetrics,
  fetchSellerShop,
  fetchShopRatingSummary,
  RATING_DIMENSION_LABELS,
  sellerTier,
  type BusinessKind,
  type SellerMetrics,
  type SellerShop,
  type SellerTier,
  type ShopRatingSummary,
} from "@/lib/sellerService";
import { MODAL_RADIUS } from "@/constants/theme";
import { BadgeCheck, ChevronRight, Star, Store as StoreIcon } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const PRIMARY = "#094569";
const ACTION = "#0369A1";

const TIER_LABEL: Record<BusinessKind, Record<SellerTier | "unverified", string>> = {
  // Not "unverified seller": this person is selling their own used things in
  // the marketplace, which is a legitimate thing to be, not a failed shop.
  shop: {
    unverified: "Individual seller",
    new: "New shop",
    standard: "Shop",
    trusted: "Trusted shop",
  },
  // A carpenter does not have a shop, and calling their page one is the same
  // mistake as printing "Delivery" on their rating — see
  // RATING_DIMENSION_LABELS, which this parallels.
  service: {
    unverified: "Independent provider",
    new: "New provider",
    standard: "Provider",
    trusted: "Trusted provider",
  },
};

interface SellerCredibilityCardProps {
  /** The product's `user_id`; the work profile is resolved from it. */
  ownerId: string;
  onPress?: () => void;
  /** Renders nothing at all for a seller with no verified shop. Right on a
   *  work profile (which is the shop, so an unverified one has nothing to
   *  say); wrong on a product page, where a shopper still needs to know who
   *  the seller is. */
  hideWhenUnverified?: boolean;
  /** Which wording the tier line and the three dimensions use. */
  kind?: BusinessKind;
  /** Supplied by a screen that can open the seller-rating sheet. Absent on
   *  your own business and for a signed-out reader, where the card is a
   *  statement rather than something to answer. */
  onRate?: () => void;
  /** Changes the verb only — the action is the same sheet either way, since
   *  a rating is editable. */
  hasRated?: boolean;
}

export default function SellerCredibilityCard({
  ownerId,
  onPress,
  hideWhenUnverified = false,
  kind = "shop",
  onRate,
  hasRated = false,
}: SellerCredibilityCardProps) {
  const [shop, setShop] = useState<SellerShop | null>(null);
  const [metrics, setMetrics] = useState<SellerMetrics | null>(null);
  const [ratings, setRatings] = useState<ShopRatingSummary | null>(null);

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;

    (async () => {
      const found = await fetchSellerShop(ownerId);
      if (cancelled || !found) return;
      setShop(found);

      // Ratings and metrics only exist for a verified shop; asking for them
      // otherwise is a round trip that can only return nothing.
      if (!found.isVerified) return;

      // In parallel — neither depends on the other, and the card renders
      // around whichever lands first.
      const [m, r] = await Promise.all([
        fetchSellerMetrics(found.id),
        fetchShopRatingSummary(found.id),
      ]);
      if (cancelled) return;
      setMetrics(m);
      setRatings(r);
    })();

    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  // Every profile has a work-profile row from signup, so this is present for
  // anybody — but an unverified one is a person, not a shop, and the card
  // says so rather than dressing them up as a storefront.
  if (!shop) return null;
  // On a work profile that isn't a shop there is nothing credible to show,
  // and a card saying "Individual seller" with no numbers is noise.
  if (!shop.isVerified && hideWhenUnverified) return null;

  const tier = shop.isVerified ? sellerTier(metrics) : "unverified";
  const hasRates =
    metrics != null &&
    (metrics.onTimeDispatchRate != null || metrics.cancellationRate != null);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      onPress={onPress}
      style={{
        backgroundColor: "#fff",
        borderRadius: MODAL_RADIUS,
        borderCurve: "continuous",
        padding: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderCurve: "continuous",
            backgroundColor: "#F5F5F5",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <StoreIcon size={18} color="#111" strokeWidth={1.8} />
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 15.5, fontWeight: "600", color: "#111", flexShrink: 1 }}
            >
              {shop.name || "Seller"}
            </Text>
            {/* Tied to the license review on the work profile — the same
                status that gates listing on shopping at all. A badge that
                could be earned by simply existing would be worth nothing. */}
            {shop.isVerified && <BadgeCheck size={14} color={ACTION} />}
          </View>
          <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 1 }}>
            {TIER_LABEL[kind][tier]}
          </Text>
        </View>

        {/* Sits with the seller, not with the reviews: this rates the
            business, and putting it under a list of product reviews is how
            the two get read as one thing. */}
        {onRate && (
          <TouchableOpacity
            onPress={onRate}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              borderCurve: "continuous",
              backgroundColor: "#F5F5F5",
              marginRight: onPress ? 6 : 0,
            }}
          >
            <Star
              size={13}
              color={ACTION}
              fill={hasRated ? ACTION : "transparent"}
              strokeWidth={1.8}
            />
            <Text style={{ fontSize: 12.5, fontWeight: "600", color: ACTION }}>
              {hasRated ? "Rated" : "Rate"}
            </Text>
          </TouchableOpacity>
        )}

        {onPress && <ChevronRight size={18} color="#C7C7CC" />}
      </View>

      {/* Objective performance. Shown only once there is something measured;
          absent rather than zeroed, because "—" and "0%" mean opposite
          things to a shopper. */}
      {hasRates && (
        <>
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: "#f0f0f0",
              marginVertical: 12,
            }}
          />
          <View style={{ flexDirection: "row", gap: 24 }}>
            {metrics?.onTimeDispatchRate != null && (
              <Stat label="On-time dispatch" value={`${metrics.onTimeDispatchRate}%`} />
            )}
            {metrics?.cancellationRate != null && (
              <Stat label="Cancellations" value={`${metrics.cancellationRate}%`} />
            )}
            {metrics?.avgResponseHours != null && (
              <Stat
                label="Replies in"
                value={
                  metrics.avgResponseHours < 1
                    ? "< 1 hr"
                    : `${Math.round(metrics.avgResponseHours)} hrs`
                }
              />
            )}
          </View>
        </>
      )}

      {/* The subjective half, and labelled as the seller's — a shopper must
          never read this as the product's rating. */}
      {ratings != null && ratings.ratingCount > 0 && (
        <>
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: "#f0f0f0",
              marginVertical: 12,
            }}
          />
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#6B7280", marginBottom: 8 }}>
            {kind === "service" ? "Provider ratings" : "Seller ratings"} ·{" "}
            {ratings.ratingCount}
          </Text>
          <View style={{ flexDirection: "row", gap: 24 }}>
            {ratings.asDescribed != null && (
              <Stat
                label={RATING_DIMENSION_LABELS[kind].asDescribed}
                value={ratings.asDescribed.toFixed(1)}
              />
            )}
            {ratings.service != null && (
              <Stat
                label={RATING_DIMENSION_LABELS[kind].service}
                value={ratings.service.toFixed(1)}
              />
            )}
            {ratings.delivery != null && (
              <Stat
                label={RATING_DIMENSION_LABELS[kind].delivery}
                value={ratings.delivery.toFixed(1)}
              />
            )}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={{ fontSize: 15.5, fontWeight: "700", color: PRIMARY }}>{value}</Text>
      <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 1 }}>{label}</Text>
    </View>
  );
}
