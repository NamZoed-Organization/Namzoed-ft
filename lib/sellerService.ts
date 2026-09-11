/**
 * Seller Service
 *
 * The seller's shop, and the two kinds of reputation that attach to it.
 *
 * **The shop is the work profile.** There is no separate `stores` table:
 * `service_providers` already carries the license document and the
 * `verification_status` that reviewing it sets, and every profile has one
 * row from signup. A second table would give the app two answers to "is this
 * a verified seller" and they would drift. So "has a shop" means exactly
 * one thing — `verification_status === 'verified'` — and that is what gates
 * listing on the shopping catalogue. Unverified people selling their own
 * used things belong in `marketplace`, which is what it is for.
 *
 * The central rule from the requirements doc, and the reason this file is
 * separate from productReviewsService: **product ratings and seller ratings
 * are different things and must never be merged.** A seller shouldn't be
 * punished for a manufacturer's bad product, and a good product shouldn't be
 * dragged down by one seller's slow delivery. Every major marketplace
 * (Amazon, eBay, Taobao, Shopee, Flipkart, Walmart) arrived at that split
 * independently. `fetchProductRatingRollup` below is not a loophole: it
 * summarises the product side so a business profile can show both numbers
 * beside each other under their own labels. Nothing averages the two
 * together, and nothing should.
 *
 * Two kinds, deliberately:
 *   - `seller_ratings`  subjective, three-dimensional (as-described, service,
 *                       delivery), the Taobao DSR shape. Buyers write these.
 *   - `seller_metrics`  objective and computed — cancellation rate, on-time
 *                       dispatch, defects. Nobody writes these from the app;
 *                       they're what badges should actually be gated on,
 *                       because stars are gameable and a cancellation rate
 *                       isn't.
 */

import { supabase } from "@/lib/supabase";

export type VerificationStatus = "verified" | "pending" | "not_verified";

export interface SellerShop {
  /** service_providers.id — what seller_ratings and seller_metrics key off. */
  id: string;
  userId: string;
  name: string | null;
  bio: string | null;
  logoUrl: string | null;
  verificationStatus: VerificationStatus;
  /** The only thing that means "this is a shop". */
  isVerified: boolean;
}

function toShop(row: any): SellerShop {
  const status = (row.verification_status ?? "not_verified") as VerificationStatus;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name ?? null,
    bio: row.master_bio ?? null,
    logoUrl: row.profile_url ?? null,
    verificationStatus: status,
    isVerified: status === "verified",
  };
}

/**
 * Every profile has a work-profile row, so this returns one for anybody —
 * including people who have never sold anything. Check `isVerified` to know
 * whether they have a shop; the row's existence means nothing on its own.
 */
export async function fetchSellerShop(userId: string): Promise<SellerShop | null> {
  const { data, error } = await supabase
    .from("service_providers")
    .select("id,user_id,name,master_bio,profile_url,verification_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return toShop(data);
}

/** Whether this user may list on the shopping catalogue. The database
 *  enforces the same rule on insert; this is so the app can say so first,
 *  rather than letting someone fill in a form and then fail. */
export async function canListProducts(userId: string): Promise<boolean> {
  const shop = await fetchSellerShop(userId);
  return !!shop?.isVerified;
}

// ─── Subjective: the three DSR dimensions ───────────────────────────────

export interface ShopRatingSummary {
  asDescribed: number | null;
  service: number | null;
  delivery: number | null;
  ratingCount: number;
  /** Mean of whichever dimensions have been rated — for a single headline
   *  number. Null until there is at least one rating; showing 0 for "not yet
   *  rated" reads as "rated badly", which is the opposite of the truth. */
  overall: number | null;
}

/**
 * Averaged over a trailing window (default 180 days, matching Taobao's
 * six-month DSR) rather than all time, so a shop that has fixed its
 * problems isn't defined by its first month forever.
 */
export async function fetchShopRatingSummary(
  providerId: string,
  windowDays = 180,
): Promise<ShopRatingSummary> {
  const empty: ShopRatingSummary = {
    asDescribed: null,
    service: null,
    delivery: null,
    ratingCount: 0,
    overall: null,
  };

  const { data, error } = await supabase.rpc("provider_rating_summary", {
    target_provider_id: providerId,
    window_days: windowDays,
  });
  if (error) {
    console.error("Failed to fetch shop rating summary:", error);
    return empty;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.rating_count) return empty;

  const dims = [row.as_described, row.service, row.delivery]
    .map((v: any) => (v == null ? null : Number(v)))
    .filter((v): v is number => v != null);

  return {
    asDescribed: row.as_described == null ? null : Number(row.as_described),
    service: row.service == null ? null : Number(row.service),
    delivery: row.delivery == null ? null : Number(row.delivery),
    ratingCount: Number(row.rating_count),
    overall: dims.length
      ? Math.round((dims.reduce((a, b) => a + b, 0) / dims.length) * 100) / 100
      : null,
  };
}

/**
 * Dimensions are nullable because they are optional to answer: a buyer with
 * an opinion about the service and none about delivery leaves delivery blank.
 * Blank must arrive here as null, never as 0 — the column only accepts 1-5,
 * and a stored zero would read as "rated badly" rather than "not rated".
 */
export async function submitSellerRating(input: {
  providerId: string;
  buyerId: string;
  orderId?: string | null;
  asDescribed: number | null;
  service: number | null;
  delivery: number | null;
  comment?: string | null;
}): Promise<boolean> {
  const { error } = await supabase.from("seller_ratings").upsert(
    {
      provider_id: input.providerId,
      buyer_id: input.buyerId,
      order_id: input.orderId ?? null,
      as_described: input.asDescribed ?? null,
      service: input.service ?? null,
      delivery: input.delivery ?? null,
      comment: input.comment ?? null,
    },
    { onConflict: "provider_id,buyer_id,order_id" },
  );
  if (error) {
    console.error("Failed to submit seller rating:", error);
    return false;
  }
  return true;
}

// ─── Objective: computed performance ────────────────────────────────────

export interface SellerMetrics {
  providerId: string;
  onTimeDispatchRate: number | null;
  cancellationRate: number | null;
  returnRate: number | null;
  orderDefectRate: number | null;
  avgResponseHours: number | null;
  ordersInWindow: number;
  windowDays: number;
  updatedAt: string | null;
}

/**
 * Null on every rate means "not measured yet", which is the honest state
 * until orders exist — a product page must render that as "New seller"
 * rather than as 0%, which would read as perfect.
 */
export async function fetchSellerMetrics(providerId: string): Promise<SellerMetrics | null> {
  const { data, error } = await supabase
    .from("seller_metrics")
    .select("*")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    providerId: data.provider_id,
    onTimeDispatchRate: data.on_time_dispatch_rate == null ? null : Number(data.on_time_dispatch_rate),
    cancellationRate: data.cancellation_rate == null ? null : Number(data.cancellation_rate),
    returnRate: data.return_rate == null ? null : Number(data.return_rate),
    orderDefectRate: data.order_defect_rate == null ? null : Number(data.order_defect_rate),
    avgResponseHours: data.avg_response_hours == null ? null : Number(data.avg_response_hours),
    ordersInWindow: data.orders_in_window ?? 0,
    windowDays: data.window_days ?? 90,
    updatedAt: data.updated_at ?? null,
  };
}

export type SellerTier = "new" | "standard" | "trusted";

/**
 * Derived from the objective metrics, never from stars — the whole point of
 * measuring them. Thresholds are the doc's suggested starting point
 * (cancellation <2%, on-time >90%, defects <2%), deliberately achievable for
 * a small Bhutanese shop rather than Amazon's ODR <1%.
 *
 * A shop with too little history is "new", not "standard": Mercado Libre
 * requires a minimum sales count before showing reputation at all, for the
 * good reason that three orders can't distinguish a good shop from a lucky
 * one.
 */
export function sellerTier(metrics: SellerMetrics | null): SellerTier {
  if (!metrics || metrics.ordersInWindow < 10) return "new";
  const { cancellationRate, onTimeDispatchRate, orderDefectRate } = metrics;
  if (cancellationRate == null || onTimeDispatchRate == null) return "standard";
  const trusted =
    cancellationRate < 2 &&
    onTimeDispatchRate > 90 &&
    (orderDefectRate == null || orderDefectRate < 2);
  return trusted ? "trusted" : "standard";
}

// ─── Business reputation, read side ─────────────────────────────────────

/**
 * The three dimensions carry over between a shop and a service provider —
 * the same buyer question asked of a different transaction — so they share
 * one table and one reputation rather than two systems to keep honest. Only
 * the wording changes, because "delivery" is the wrong word for a carpenter
 * and "timeliness" is the wrong word for a parcel.
 */
export const RATING_DIMENSION_LABELS = {
  shop: { asDescribed: "As described", service: "Service", delivery: "Delivery" },
  service: { asDescribed: "As described", service: "Professionalism", delivery: "Timeliness" },
} as const;

export type BusinessKind = keyof typeof RATING_DIMENSION_LABELS;

/**
 * Which wording a work profile should use. A business that does both is
 * labelled as a shop: a buyer reading "Delivery" on a listing they had
 * delivered is right, while "Timeliness" on a parcel is vague.
 */
export function businessKind(hasProducts: boolean, hasServices: boolean): BusinessKind {
  if (hasProducts) return "shop";
  return hasServices ? "service" : "shop";
}

export interface SellerRating {
  id: string;
  buyerId: string;
  buyerName: string | null;
  buyerAvatarUrl: string | null;
  asDescribed: number | null;
  service: number | null;
  delivery: number | null;
  comment: string | null;
  createdAt: string;
  /** Mean of whichever dimensions this buyer answered. */
  overall: number | null;
}

export async function fetchSellerRatings(
  providerId: string,
  limit = 50,
): Promise<SellerRating[]> {
  const { data, error } = await supabase
    .from("seller_ratings")
    .select(
      "id,buyer_id,as_described,service,delivery,comment,created_at,buyer:buyer_id(name,avatar_url)",
    )
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch seller ratings:", error);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const dims = [row.as_described, row.service, row.delivery]
      .map((v: any) => (v == null ? null : Number(v)))
      .filter((v): v is number => v != null);
    return {
      id: row.id,
      buyerId: row.buyer_id,
      buyerName: row.buyer?.name ?? null,
      buyerAvatarUrl: row.buyer?.avatar_url ?? null,
      asDescribed: row.as_described == null ? null : Number(row.as_described),
      service: row.service == null ? null : Number(row.service),
      delivery: row.delivery == null ? null : Number(row.delivery),
      comment: row.comment ?? null,
      createdAt: row.created_at,
      overall: dims.length
        ? Math.round((dims.reduce((a, b) => a + b, 0) / dims.length) * 10) / 10
        : null,
    };
  });
}

/**
 * This buyer's own rating of this business, if they have left one.
 *
 * Scoped to `order_id IS NULL`, which is the row `submitSellerRating` upserts
 * until orders exist — the same key its ON CONFLICT target resolves to. Once
 * there are orders this becomes a per-order lookup and this function needs the
 * order id too; it is written narrow rather than "latest rating by this
 * buyer", so that day is a compile error rather than a silently wrong row.
 */
export async function fetchMySellerRating(
  providerId: string,
  buyerId: string,
): Promise<MySellerRating | null> {
  if (!providerId || !buyerId) return null;
  const { data, error } = await supabase
    .from("seller_ratings")
    .select("as_described,service,delivery,comment")
    .eq("provider_id", providerId)
    .eq("buyer_id", buyerId)
    .is("order_id", null)
    .maybeSingle();
  if (error || !data) return null;
  return {
    asDescribed: data.as_described == null ? null : Number(data.as_described),
    service: data.service == null ? null : Number(data.service),
    delivery: data.delivery == null ? null : Number(data.delivery),
    comment: data.comment ?? null,
  };
}

export interface MySellerRating {
  asDescribed: number | null;
  service: number | null;
  delivery: number | null;
  comment: string | null;
}

// ─── Product ratings, rolled up to the business ─────────────────────────

export interface ProductRatingRollup {
  /** Review-count-weighted mean across everything this business sells. Null
   *  when nothing it lists has been reviewed. */
  average: number | null;
  /** Total product reviews, not products — the number that makes the average
   *  worth trusting. */
  reviewCount: number;
  /** How many of its products carry at least one review. */
  ratedProducts: number;
}

const EMPTY_ROLLUP: ProductRatingRollup = {
  average: null,
  reviewCount: 0,
  ratedProducts: 0,
};

/**
 * What this business's catalogue is rated, as one number.
 *
 * This is NOT merged into the seller rating and never will be — see the rule
 * at the top of this file. It is the other half of the same question: a
 * shopper asks both "is this shop good to deal with" (seller_ratings) and "is
 * their stuff any good" (this), and a business profile that answers only the
 * first leaves every product review it has earned invisible on the page
 * buyers actually check. So the two sit side by side under separate labels.
 *
 * Weighted by review count rather than averaging the per-product averages: a
 * product with fifty reviews says more about a catalogue than one with a
 * single five-star review, and a plain mean of means lets the latter shout as
 * loudly as the former.
 *
 * Reads the trigger-maintained `products.average_rating`/`review_count`
 * columns, so this costs one indexed select and no joins.
 *
 * Counts everything the person lists, not only what is flagged as a work
 * listing: `hasBusiness` already treats anything listed as the business's, and
 * splitting the rollup would leave reviews stranded on the half of the
 * catalogue the page doesn't show. It also doesn't skip archived products —
 * a review that was earned stays earned, and letting a seller archive their
 * way out of a bad one is the obvious way to game this.
 */
export async function fetchProductRatingRollup(
  ownerUserId: string,
): Promise<ProductRatingRollup> {
  if (!ownerUserId) return EMPTY_ROLLUP;

  const { data, error } = await supabase
    .from("products")
    .select("average_rating,review_count")
    .eq("user_id", ownerUserId)
    .gt("review_count", 0)
    .limit(500);

  if (error) {
    console.error("Failed to fetch product rating rollup:", error);
    return EMPTY_ROLLUP;
  }
  if (!data?.length) return EMPTY_ROLLUP;

  let weighted = 0;
  let reviewCount = 0;
  for (const row of data) {
    const n = Number(row.review_count) || 0;
    const avg = Number(row.average_rating) || 0;
    if (n <= 0) continue;
    weighted += avg * n;
    reviewCount += n;
  }
  if (reviewCount === 0) return EMPTY_ROLLUP;

  return {
    average: Math.round((weighted / reviewCount) * 10) / 10,
    reviewCount,
    ratedProducts: data.length,
  };
}

/**
 * Whether a profile has a business worth showing a card for.
 *
 * Not simply "is `name` set". Every profile has a service_providers row from
 * signup, so a name was the only way to tell a real business from an empty
 * row — but plenty of sellers listed products long before the work profile
 * existed and never named anything. Judging by the name alone left their
 * products live in shopping and unreachable from their own profile, which is
 * the worst of both.
 *
 * So: a business exists if it has been named, OR if it has anything listed.
 * The name falls back to the person's own for display, which is what a small
 * shop is called anyway, and self-corrects the moment they set a real one.
 */
export function hasBusiness(args: {
  providerName?: string | null;
  productCount?: number;
  serviceCount?: number;
}): boolean {
  if (args.providerName?.trim()) return true;
  return (args.productCount ?? 0) > 0 || (args.serviceCount ?? 0) > 0;
}

export function businessDisplayName(
  providerName?: string | null,
  profileName?: string | null,
): string {
  return providerName?.trim() || profileName?.trim() || "Business";
}
