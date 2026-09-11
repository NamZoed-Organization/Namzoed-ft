/**
 * ShopReviews
 *
 * The Reviews tab of a work profile — the business's own reputation, as
 * distinct from any one product's.
 *
 * One reputation covers both halves of a work profile. A shop and a service
 * provider are asked the same three questions about different transactions,
 * so they share `seller_ratings` rather than running two systems that would
 * have to be kept honest separately. Only the wording changes with the kind
 * of business (see RATING_DIMENSION_LABELS).
 *
 * What this is NOT is the product reviews. Those live on each product and
 * are about the item; these are about trading with this business. Merging
 * them is the thing the whole schema is arranged to prevent — a seller
 * shouldn't be punished for a manufacturer's bad product, and a good product
 * shouldn't be dragged down by one seller's slow delivery.
 *
 * They are not merged, but they are no longer hidden from each other either.
 * Every product review a business earns used to stop at the product it was
 * left on, so a shop with two hundred of them still read "No ratings yet" on
 * the one page a buyer checks before dealing with it. So the catalogue's
 * ratings roll up here as their own labelled line, under their own heading,
 * beside the trading score rather than averaged into it.
 */

import ProgressiveImage from "@/components/ui/ProgressiveImage";
import CircularLoader from "@/components/ui/CircularLoader";
import {
  fetchProductRatingRollup,
  fetchSellerRatings,
  fetchShopRatingSummary,
  RATING_DIMENSION_LABELS,
  type BusinessKind,
  type ProductRatingRollup,
  type SellerRating,
  type ShopRatingSummary,
} from "@/lib/sellerService";
import StarRating from "@/components/ui/StarRating";
import { ChevronRight, Package, User } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const PRIMARY = "#094569";

function fmt(dateStr: string) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const days = Math.floor(diff / 86400);
  return days < 7 ? `${days}d` : `${Math.floor(days / 7)}w`;
}

interface ShopReviewsProps {
  providerId: string;
  kind: BusinessKind;
  /** The owner's profile id — what the product catalogue is keyed by. Absent
   *  only where the page couldn't resolve one, in which case the product line
   *  is simply not shown. */
  ownerUserId?: string | null;
  /** Jumps to the Products tab, so the rolled-up number leads somewhere. */
  onOpenProducts?: () => void;
}

/** Fetches, then renders the view below. Split so a fixture-driven preview
 *  can exercise the real presentation without a database — see
 *  components/dev/BusinessProfilePreview. */
export default function ShopReviews({
  providerId,
  kind,
  ownerUserId,
  onOpenProducts,
}: ShopReviewsProps) {
  const [summary, setSummary] = useState<ShopRatingSummary | null>(null);
  const [ratings, setRatings] = useState<SellerRating[]>([]);
  const [rollup, setRollup] = useState<ProductRatingRollup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;

    (async () => {
      // All three together: none depends on the others, and the two rating
      // systems are answering different questions about the same business.
      const [s, list, roll] = await Promise.all([
        fetchShopRatingSummary(providerId),
        fetchSellerRatings(providerId),
        ownerUserId ? fetchProductRatingRollup(ownerUserId) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setSummary(s);
      setRatings(list);
      setRollup(roll);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [providerId, ownerUserId]);

  return (
    <ShopReviewsView
      summary={summary}
      ratings={ratings}
      rollup={rollup}
      kind={kind}
      loading={loading}
      onOpenProducts={onOpenProducts}
    />
  );
}

export function ShopReviewsView({
  summary,
  ratings,
  rollup,
  kind,
  loading,
  onOpenProducts,
}: {
  summary: ShopRatingSummary | null;
  ratings: SellerRating[];
  rollup?: ProductRatingRollup | null;
  kind: BusinessKind;
  loading: boolean;
  onOpenProducts?: () => void;
}) {
  const labels = RATING_DIMENSION_LABELS[kind];
  const hasTradingRating = !!summary && summary.ratingCount > 0;
  const hasProductRating = !!rollup && rollup.average != null;

  if (loading) {
    return (
      <View style={{ paddingVertical: 24, alignItems: "center" }}>
        <CircularLoader size="small" color={PRIMARY} />
      </View>
    );
  }

  // Only when the business has neither kind of rating. A shop whose products
  // are reviewed but whom nobody has rated as a seller is not an unrated
  // business, and telling it so was the old behaviour's whole problem.
  if (!hasTradingRating && !hasProductRating) {
    return (
      <View style={{ paddingVertical: 28, alignItems: "center", paddingHorizontal: 24 }}>
        <Text style={{ fontSize: 14, color: "#9CA3AF" }}>No ratings yet</Text>
        {/* Says why, not just that. "No ratings yet" on its own reads as
            neglect; this reads as a business that is simply new. */}
        <Text style={{ fontSize: 12, color: "#D1D5DB", marginTop: 4, textAlign: "center" }}>
          Ratings appear here once buyers have rated{" "}
          {kind === "service" ? "working with this provider" : "buying from this shop"}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16 }}>
      {hasTradingRating && summary ? (
        <>
          {/* Headline: one number, then the three dimensions it is made of, so
              a reader can see *why* it is what it is rather than trusting it. */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14 }}>
            <Text style={{ fontSize: 30, fontWeight: "700", color: "#111" }}>
              {summary.overall?.toFixed(1) ?? "—"}
            </Text>
            <View>
              {summary.overall != null && <StarRating rating={summary.overall} size={14} />}
              <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3 }}>
                {summary.ratingCount} rating{summary.ratingCount === 1 ? "" : "s"} · last 6 months
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 22, paddingBottom: 14 }}>
            <Dimension label={labels.asDescribed} value={summary.asDescribed} />
            <Dimension label={labels.service} value={summary.service} />
            <Dimension label={labels.delivery} value={summary.delivery} />
          </View>
        </>
      ) : (
        // Reached only when the products are rated and the business isn't —
        // so it says what is missing without claiming the page has nothing.
        <View style={{ paddingTop: 16, paddingBottom: 2 }}>
          <Text style={{ fontSize: 14, color: "#9CA3AF" }}>
            No ratings for {kind === "service" ? "working with them" : "buying from them"} yet
          </Text>
        </View>
      )}

      {/* The catalogue's own rating, kept a separate number under a separate
          heading. A buyer asks two questions — is their stuff any good, and
          are they good to deal with — and one average of both answers
          neither. */}
      {hasProductRating && rollup && (
        <ProductRatingRow rollup={rollup} onPress={onOpenProducts} />
      )}

      {/* Separates the summary from what people actually wrote — so it is
          only there when somebody wrote something. */}
      {ratings.length > 0 && (
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "#f0f0f0" }} />
      )}

      {ratings.map((rating) => (
        <View key={rating.id} style={{ flexDirection: "row", paddingVertical: 14 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              borderCurve: "continuous",
              overflow: "hidden",
              backgroundColor: "#E5E7EB",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {rating.buyerAvatarUrl ? (
              <ProgressiveImage
                uri={rating.buyerAvatarUrl}
                style={{ width: "100%", height: "100%" }}
                showProgress={false}
              />
            ) : (
              <User size={16} color="#9CA3AF" strokeWidth={1.8} />
            )}
          </View>

          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#9ca3af" }}>
                {rating.buyerName ?? "Buyer"}
              </Text>
              {rating.overall != null && <StarRating rating={rating.overall} />}
            </View>
            {!!rating.comment && (
              <Text style={{ fontSize: 15, color: "#374151", marginTop: 6, lineHeight: 21 }}>
                {rating.comment}
              </Text>
            )}
            <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
              {fmt(rating.createdAt)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * The product side of the page's reputation: one weighted number over
 * everything the business sells, and a tap through to the catalogue it came
 * from — a rolled-up figure nobody can open is a claim rather than evidence.
 */
function ProductRatingRow({
  rollup,
  onPress,
}: {
  rollup: ProductRatingRollup;
  onPress?: () => void;
}) {
  const average = rollup.average ?? 0;
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          borderCurve: "continuous",
          backgroundColor: "#F5F5F5",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Package size={17} color="#111" strokeWidth={1.8} />
      </View>

      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#111" }}>
          Product ratings
        </Text>
        <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>
          {rollup.reviewCount} review{rollup.reviewCount === 1 ? "" : "s"} across{" "}
          {rollup.ratedProducts} product{rollup.ratedProducts === 1 ? "" : "s"}
        </Text>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <StarRating rating={average} size={13} />
        <Text style={{ fontSize: 15.5, fontWeight: "700", color: PRIMARY }}>
          {average.toFixed(1)}
        </Text>
        {onPress ? <ChevronRight size={16} color="#C7C7CC" /> : null}
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      {body}
    </TouchableOpacity>
  );
}

function Dimension({ label, value }: { label: string; value: number | null }) {
  return (
    <View>
      {/* An unanswered dimension shows a dash, never 0.0 — a buyer who
          skipped the question hasn't rated it badly. */}
      <Text style={{ fontSize: 15.5, fontWeight: "700", color: PRIMARY }}>
        {value == null ? "—" : value.toFixed(1)}
      </Text>
      <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 1 }}>{label}</Text>
    </View>
  );
}
