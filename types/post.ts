import type { PostMediaDisplay } from "@/lib/postMediaDisplay";

// Content rating for moderation
export type ContentRating =
  | "general"
  | "sensitive"
  | "18_plus"
  | "review_required";
export type ModerationStatus = "approved" | "pending_review" | "rejected";

/**
 * Suggestion for content rating during post creation
 * Helps users see what keywords were detected and allows them to override
 */

/**
 * Represents auto-detected content rating suggestion during post creation
 * Allows user to confirm, override, or customize the suggested tag
 */
export interface ContentRatingSuggestion {
  suggested: ContentRating;
  confidence: "high" | "medium" | "low";
  detectedKeywords?: string[];
}

/**
 * Something for sale, linked from a post.
 *
 * Anyone can tag anyone's product or service, not only their own — a post
 * about a shop is worth more to that shop than a post *by* it, and the
 * whole point of allowing it is that somebody else's audience becomes the
 * seller's. So the row carries who it belongs to: the card credits the
 * seller rather than implying the poster is selling it.
 *
 * `kind` decides where tapping it goes — a product screen or a service
 * detail. It is optional because every post tagged before services could be
 * tagged holds a product and says nothing; absent means "product".
 * `price` is optional for the same reason in reverse: a service has none.
 */
export interface TaggedProduct {
  id: string;
  name: string;
  price?: number;
  image?: string;
  current_price?: number;
  is_currently_active?: boolean;
  discount_percent?: number;
  kind?: "product" | "service";
  /** The seller/provider, so the card can credit them. */
  owner_id?: string;
  owner_name?: string;
  /**
   * Where on the picture this was pinned, if it was.
   *
   * `x`/`y` are fractions of the image it belongs to, so the label lands on
   * the jacket at any size the feed draws it; `image` is that picture's
   * index in `images`. Absent on every post tagged before pinning existed,
   * and on any tag added from the list rather than the picture — which is
   * why it is optional rather than defaulted to a corner. It rides along in
   * the existing `tagged_products` JSON, so pinning cost no migration.
   */
  pin?: { image: number; x: number; y: number; side: "left" | "right" };
}

// Tagged account reference stored on a post
export interface TaggedAccount {
  id: string;
  name: string;
  avatar_url?: string | null;
}

// Post data interface for displaying posts in the feed
export interface PostData {
  id: string;
  userId: string;
  username?: string;
  profilePic?: string;
  content: string;
  images: string[];
  /** BlurHash per image (aligned with `images`); from `posts.blur_hashes`.
   *  Absent/null entries → progressive loader falls back to a solid colour. */
  blurHashes?: (string | null)[];
  date: Date;
  likes: number;
  comments: number;
  shares: number;
  /** From `posts.media_display`; absent on older rows → feed measures URLs */
  mediaDisplay?: PostMediaDisplay;
  /** From `posts.location_name`; alternates with timestamp in the feed header */
  locationName?: string;
  tagged_products?: TaggedProduct[];
  tagged_accounts?: TaggedAccount[];
  isVerified?: boolean;
  /** Content rating: general, sensitive, 18_plus, or review_required */
  contentRating?: ContentRating;
  /** Moderation status: approved, pending_review, or rejected */
  moderationStatus?: ModerationStatus;
  /** Internal notes from moderators */
  moderationNotes?: string;
  /** Denormalized view count from posts.view_count — only populated for feed display */
  view_count?: number;
}
