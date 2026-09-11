/**
 * BusinessProfileHeader
 *
 * The work profile's header, built to mirror the personal profile's so the
 * two read as the same app: the per-user cover gradient behind the whole
 * block, the logo over it, identity to the right, counts beneath, white type
 * throughout.
 *
 * What it adds — and what a personal profile must never have — is the
 * credibility strip: the license badge and the objective rates. That is the
 * reason this page exists at all, and in a market where a buyer has no other
 * way to check a shop, it's the difference between a profile and a
 * storefront.
 *
 * It refuses to invent confidence. A rate that hasn't been measured is
 * absent, not zero; a business with no ratings says so rather than showing
 * a hopeful "5.0". `seller_metrics` is null for everyone until orders exist,
 * so today this shows the badge and nothing else — which is honest, and
 * fills in on its own as the numbers arrive.
 */

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import { useCoverPalette } from "@/hooks/useCoverPalette";
import {
  fetchSellerMetrics,
  fetchShopRatingSummary,
  sellerTier,
  type SellerMetrics,
  type ShopRatingSummary,
} from "@/lib/sellerService";
import { LinearGradient } from "expo-linear-gradient";
import StarRating from "@/components/ui/StarRating";
import { BadgeCheck, MapPin, Store } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";

export type WorkVerification = "verified" | "pending" | "not_verified";

interface BusinessProfileHeaderProps {
  /** service_providers.id — what ratings and metrics key off. */
  providerId?: string | null;
  /** Seeds the cover palette, so a business keeps one colour identity. */
  seedId?: string | null;
  name?: string | null;
  bio?: string | null;
  logoUrl?: string | null;
  dzongkhag?: string | null;
  /** The trade line: their service category, or whatever best names them. */
  trade?: string | null;
  verification: WorkVerification;
  productCount: number;
  serviceCount: number;
  isOwnProfile: boolean;
  /** Height of the fixed bar overlapping this, so the content clears it. */
  topInset: number;
  /** Dev only: stands in for the fetch, so the fixture-driven preview can
   *  show the star row without a provider row behind it. */
  previewRatings?: ShopRatingSummary | null;
}

export default function BusinessProfileHeader({
  providerId,
  seedId,
  name,
  bio,
  logoUrl,
  dzongkhag,
  trade,
  verification,
  productCount,
  serviceCount,
  isOwnProfile,
  topInset,
  previewRatings,
}: BusinessProfileHeaderProps) {
  const [metrics, setMetrics] = useState<SellerMetrics | null>(null);
  const [fetchedRatings, setRatings] = useState<ShopRatingSummary | null>(null);
  const ratings = previewRatings !== undefined ? previewRatings : fetchedRatings;

  const { cover: coverGradient, tintRgb } = useCoverPalette(
    seedId ?? undefined,
    null,
    null,
  );

  useEffect(() => {
    if (!providerId || verification !== "verified") return;
    let cancelled = false;
    (async () => {
      const [m, r] = await Promise.all([
        fetchSellerMetrics(providerId),
        fetchShopRatingSummary(providerId),
      ]);
      if (cancelled) return;
      setMetrics(m);
      setRatings(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [providerId, verification]);

  const isVerified = verification === "verified";
  const tier = isVerified ? sellerTier(metrics) : null;
  const tint = (a: number) => `rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},${a})`;

  return (
    <View>
      {/* The cover runs behind the whole block rather than sitting in a
          strip — the profile screen's own arrangement. */}
      <LinearGradient
        colors={coverGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[tint(0.15), tint(0.5), tint(0.9)]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Light icons: the gradient behind them is dark, so the app's default
          dark-content bar would be unreadable here. */}
      <StatusBar barStyle="light-content" />

      {/* Back and Edit live on the fixed compact bar above this, which is
          always on screen — repeating them here would put two of each in
          view at the top of the page. `topInset` is the room this leaves for
          that bar to sit over. */}
      <View style={{ paddingTop: topInset, paddingHorizontal: 16, paddingBottom: 18 }}>

        {/* Logo + identity, side by side — the profile screen's own row. */}
        <View className="flex-row items-center mb-1">
          <View
            className="w-[86px] h-[86px] rounded-full bg-white/15 overflow-hidden border border-white items-center justify-center"
            style={{ borderCurve: "continuous" }}
          >
            {logoUrl ? (
              <ProgressiveImage
                uri={logoUrl}
                style={{ width: "100%", height: "100%" }}
                showProgress={false}
                priority="high"
              />
            ) : (
              <Store size={32} color="rgba(255,255,255,0.8)" strokeWidth={1.5} />
            )}
          </View>

          <View className="flex-1 ml-4">
            <View className="flex-row items-center gap-1.5 flex-wrap mb-0.5">
              <Text className="text-2xl font-mbold text-white" numberOfLines={2}>
                {name?.trim() || (isOwnProfile ? "Your business" : "Business")}
              </Text>
              {isVerified && <BadgeCheck size={18} color="#7FD1FF" />}
            </View>
            {trade ? (
              <Text className="text-sm font-regular text-white/60" numberOfLines={1}>
                {trade}
              </Text>
            ) : null}
            {dzongkhag ? (
              <View className="flex-row items-center gap-1 mt-0.5">
                <MapPin size={13} color="rgba(255,255,255,0.5)" />
                <Text className="text-sm font-regular text-white/50">{dzongkhag}</Text>
              </View>
            ) : null}
            {/* The rating sits with the identity, right under the trade —
                it's part of who this business is, not a statistic. Absent
                until there is one: a business with no ratings showing "0.0"
                would read as rated badly rather than not yet rated. */}
            {ratings != null && ratings.ratingCount > 0 && ratings.overall != null ? (
              <View className="flex-row items-center gap-1.5 mt-1.5">
                {/* Five stars, not one — the shape is readable at a glance in
                    a way a bare number isn't, which is the whole reason a
                    rating goes here rather than in the counts row. Empty
                    stars are lightened for the dark ground. */}
                <StarRating rating={ratings.overall} size={13} emptyColor="rgba(255,255,255,0.3)" />
                <Text className="text-sm font-mbold text-white">
                  {ratings.overall.toFixed(1)}
                </Text>
                <Text className="text-sm font-regular text-white/50">
                  ({ratings.ratingCount})
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {bio ? (
          <Text className="text-base font-medium text-white/70 mt-3" numberOfLines={3}>
            {bio}
          </Text>
        ) : null}

        {/* Counts — what this business has, not how popular its owner is.
            Followers belong on the personal profile. */}
        <View className="flex-row items-center gap-8 mt-4">
          <Count value={productCount} label="Products" />
          <Count value={serviceCount} label="Services" />

        </View>

        {/* The credibility strip. What is measured, and nothing that isn't. */}
        <View className="flex-row items-center flex-wrap gap-2 mt-4">
          <Chip
            label={
              isVerified
                ? "License verified"
                : verification === "pending"
                  ? "Verification pending"
                  : "Not verified"
            }
            highlight={isVerified}
          />
          {tier === "trusted" && <Chip label="Trusted shop" highlight />}
          {metrics?.onTimeDispatchRate != null && (
            <Chip label={`${metrics.onTimeDispatchRate}% on time`} />
          )}
          {metrics?.avgResponseHours != null && (
            <Chip
              label={
                metrics.avgResponseHours < 1
                  ? "Replies in < 1 hr"
                  : `Replies in ~${Math.round(metrics.avgResponseHours)} hrs`
              }
            />
          )}
        </View>

        {/* Only for the owner, and only while it's actionable — a visitor
            doesn't need to be told the shop they're looking at hasn't sent
            its paperwork. */}
        {isOwnProfile && !isVerified ? (
          <Text className="text-xs text-white/60 mt-3">
            {verification === "pending"
              ? "Your license is being reviewed. You can list products once it's approved."
              : "Upload your business license to list products on shopping."}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Count({ value, label }: { value: number | string; label: string }) {
  return (
    <View className="flex-row items-baseline gap-1">
      <Text className="text-xl font-mbold text-white">{value}</Text>
      <Text className="text-base font-medium text-white/70">{label}</Text>
    </View>
  );
}

function Chip({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <View
      style={{ borderRadius: 999, borderCurve: "continuous" }}
      className={`px-2.5 py-1 border ${
        highlight ? "bg-white/25 border-white/40" : "bg-white/10 border-white/25"
      }`}
    >
      <Text className="text-xs font-semibold text-white">{label}</Text>
    </View>
  );
}
