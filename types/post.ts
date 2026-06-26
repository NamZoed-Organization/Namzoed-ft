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

// Tagged product reference stored on a post
export interface TaggedProduct {
  id: string;
  name: string;
  price: number;
  image?: string;
  current_price?: number;
  is_currently_active?: boolean;
  discount_percent?: number;
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
}
