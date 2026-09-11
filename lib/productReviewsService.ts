/**
 * productReviewsService.ts
 *
 * CRUD for `product_reviews` — one star rating + optional text comment, plus
 * optional image/video attachments and an optional voice note, per
 * (product, user), editable/deletable by its author. Deliberately simpler
 * than commentsService.ts's post-comments system in one way: no replies, no
 * likes — a review is rating + comment + media, not a second comment
 * thread. See supabase/migrations/20260826120000_create_product_reviews.sql,
 * 20260827120000_add_product_review_media.sql, and
 * 20260827130000_add_product_review_voice_notes.sql for the tables/
 * triggers/RLS this talks to.
 */

import { notifyProductReviewed } from "@/services/notificationService";
import { supabase } from "./supabase";

export type ReviewMediaType = "image" | "video";

/** One image/video attached to a review, ordered — same shape as
 * commentsService's CommentMediaItem so review media can be handed straight
 * to CommentMediaGallery without remapping. */
export interface ProductReviewMedia {
  id: string;
  url: string;
  type: ReviewMediaType;
  duration?: number | null;
  /** UI-only: true while this specific item is still uploading. */
  isOptimistic?: boolean;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string;
  rating: number;
  text: string | null;
  created_at: string;
  updated_at: string;
  media?: ProductReviewMedia[];
  /** Voice note only — image/video attachments live in `media` above. */
  media_url?: string | null;
  media_type?: "audio" | null;
  media_duration?: number | null;
  // ── Added with the catalog foundation migration ──────────────────────
  title?: string | null;
  /** False on every review written before orders exist. Disclosed rather
   *  than assumed — see the EU Omnibus Directive and the FTC rule. */
  verified_purchase?: boolean;
  /** Maintained by a trigger over product_review_helpful, so it can't be
   *  inflated by a client that just increments. */
  helpful_count?: number;
  status?: "published" | "pending" | "hidden" | "removed";
  user?: {
    id: string;
    name: string;
    avatar_url?: string | null;
  };
}

/** Batch-fetch product_review_media rows for a set of review ids, grouped
 * and ordered by position — mirrors commentsService's fetchCommentMediaMap. */
async function fetchReviewMediaMap(reviewIds: string[]): Promise<Map<string, ProductReviewMedia[]>> {
  const map = new Map<string, ProductReviewMedia[]>();
  if (reviewIds.length === 0) return map;

  const { data } = await supabase
    .from("product_review_media")
    .select("id, review_id, media_url, media_type, media_duration, position")
    .in("review_id", reviewIds)
    .order("position", { ascending: true });

  for (const row of (data ?? []) as any[]) {
    const list = map.get(row.review_id) ?? [];
    list.push({ id: row.id, url: row.media_url, type: row.media_type, duration: row.media_duration });
    map.set(row.review_id, list);
  }
  return map;
}

/** Replaces a review's attached media wholesale — simplest correct approach
 * for an editable review (vs. diffing add/remove), matches the "you're
 * replacing your review" mental model the composer already has for
 * rating/text. */
async function replaceReviewMedia(
  reviewId: string,
  media: { url: string; type: ReviewMediaType; duration?: number }[],
): Promise<ProductReviewMedia[]> {
  await supabase.from("product_review_media").delete().eq("review_id", reviewId);
  if (media.length === 0) return [];

  const rows = media.map((m, i) => ({
    review_id: reviewId,
    media_url: m.url,
    media_type: m.type,
    media_duration: m.duration ?? null,
    position: i,
  }));
  const { data, error } = await supabase
    .from("product_review_media")
    .insert(rows)
    .select("id, media_url, media_type, media_duration, position")
    .order("position", { ascending: true });

  if (error || !data) {
    console.error("[productReviewsService] replaceReviewMedia error:", error?.message);
    return [];
  }
  return data.map((row) => ({ id: row.id, url: row.media_url, type: row.media_type, duration: row.media_duration }));
}

export async function fetchProductReviews(productId: string): Promise<ProductReview[]> {
  const { data, error } = await supabase
    .from("product_reviews")
    .select("*, user:user_id(id, name, avatar_url)")
    .eq("product_id", productId)
    // Moderated-away reviews stay in the table but off the page. Every row
    // written before this column existed defaults to 'published', so this
    // filter excludes nothing that used to be shown.
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[productReviewsService] fetchProductReviews error:", error.message);
    return [];
  }

  const reviews = (data ?? []) as unknown as ProductReview[];
  const mediaMap = await fetchReviewMediaMap(reviews.map((r) => r.id));
  return reviews.map((r) => ({ ...r, media: mediaMap.get(r.id) ?? [] }));
}

/** Insert the caller's review, or update it in place if they've already
 * reviewed this product (one review per user, enforced by the table's
 * unique constraint). Replaces attached media wholesale on edit. Notifies
 * the product owner on success. */
export async function upsertProductReview(
  productId: string,
  userId: string,
  rating: number,
  text: string,
  media: { url: string; type: ReviewMediaType; duration?: number }[] = [],
  voice?: { url: string; duration: number } | null,
): Promise<ProductReview | null> {
  const { data, error } = await supabase
    .from("product_reviews")
    .upsert(
      {
        product_id: productId,
        user_id: userId,
        rating,
        text: text.trim() || null,
        media_url: voice?.url ?? null,
        media_type: voice ? "audio" : null,
        media_duration: voice?.duration ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id,user_id" },
    )
    .select("*, user:user_id(id, name, avatar_url)")
    .single();

  if (error) {
    console.error("[productReviewsService] upsertProductReview error:", error.message);
    return null;
  }

  const review = data as unknown as ProductReview;
  review.media = await replaceReviewMedia(review.id, media);

  const { data: product } = await supabase
    .from("products")
    .select("user_id")
    .eq("id", productId)
    .maybeSingle();
  if (product?.user_id) {
    notifyProductReviewed(product.user_id, userId, productId, rating, text).catch(() => {});
  }

  return review;
}

export async function deleteProductReview(reviewId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("product_reviews")
    .delete()
    .eq("id", reviewId)
    .eq("user_id", userId);

  if (error) {
    console.error("[productReviewsService] deleteProductReview error:", error.message);
    return false;
  }
  return true;
}

// ─── Rating distribution, helpful votes, verified purchases ─────────────
// Added with the catalog foundation (see
// supabase/migrations/20260905140000_catalog_foundation.sql). Everything
// below is additive: fetchProductReviews and upsertProductReview above are
// unchanged, and reviews written before this existed carry the column
// defaults (unverified, zero helpful votes, published).

export interface RatingBucket {
  rating: number;
  count: number;
  /** Share of all reviews, 0-1 — what the bar's width should be. */
  share: number;
}

/**
 * The 1-5 star histogram for a product, always five buckets even where the
 * count is zero.
 *
 * Baymard's finding is that shoppers lean on the distribution more than on
 * individual reviews, and that most sites either omit it or make it
 * unclickable — so it's a first-class query rather than a reduce over
 * whatever page of reviews happens to be loaded, which would be wrong the
 * moment there is more than one page.
 */
export async function fetchRatingDistribution(productId: string): Promise<RatingBucket[]> {
  const { data, error } = await supabase.rpc("product_rating_distribution", {
    target_product_id: productId,
  });
  if (error) {
    console.error("Failed to fetch rating distribution:", error);
    return [];
  }
  const rows = (data ?? []).map((r: any) => ({
    rating: Number(r.rating),
    count: Number(r.review_count),
  }));
  const total = rows.reduce((sum: number, r: any) => sum + r.count, 0);
  return rows.map((r: any) => ({
    ...r,
    share: total > 0 ? r.count / total : 0,
  }));
}

/**
 * Toggles this user's "helpful" vote. The count on the review is maintained
 * by a trigger over the votes table, so it can't be inflated by a client
 * that just increments — and one person can only ever count once.
 */
export async function toggleReviewHelpful(
  reviewId: string,
  userId: string,
): Promise<boolean | null> {
  const { data: existing } = await supabase
    .from("product_review_helpful")
    .select("review_id")
    .eq("review_id", reviewId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("product_review_helpful")
      .delete()
      .eq("review_id", reviewId)
      .eq("user_id", userId);
    if (error) {
      console.error("Failed to remove helpful vote:", error);
      return null;
    }
    return false;
  }

  const { error } = await supabase
    .from("product_review_helpful")
    .insert({ review_id: reviewId, user_id: userId });
  if (error) {
    console.error("Failed to add helpful vote:", error);
    return null;
  }
  return true;
}

/** Which of these reviews the given user has already marked helpful. */
export async function fetchMyHelpfulVotes(
  reviewIds: string[],
  userId: string,
): Promise<Set<string>> {
  if (!reviewIds.length) return new Set();
  const { data, error } = await supabase
    .from("product_review_helpful")
    .select("review_id")
    .eq("user_id", userId)
    .in("review_id", reviewIds);
  if (error) {
    console.error("Failed to fetch helpful votes:", error);
    return new Set();
  }
  return new Set((data ?? []).map((r: any) => r.review_id));
}
