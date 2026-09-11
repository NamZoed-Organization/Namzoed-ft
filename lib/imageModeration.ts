import type { ContentRating } from "@/types/post";
import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "./supabase";

export type ModerationDecision = "block" | "age_restrict" | "allow";

// Vision only needs a modestly-sized image for SafeSearch. Downscaling keeps the
// base64 payload well under the edge function's request limit so large photos
// don't fail the scan (and silently fall through to "allow").
const VISION_MAX_DIMENSION = 1024;

const toScannableBase64 = async (fileUri: string): Promise<string> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      fileUri,
      [{ resize: { width: VISION_MAX_DIMENSION } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      },
    );
    if (result.base64) return result.base64;
  } catch (err) {
    console.warn("[imageModeration] downscale failed, using original:", err);
  }
  // Fallback: original bytes — still works, just a larger payload.
  return new File(fileUri).base64();
};

export interface ModerationResult {
  decision: ModerationDecision;
  /** Suggested content rating implied by the image. */
  rating: ContentRating;
  /** Detected categories (e.g. "nudity", "cigarette", "condom"). */
  categories: string[];
  /** User-facing reason when the image is blocked. */
  reason?: string;
}

export interface PostImagesModeration {
  blocked: boolean;
  blockedReasons: string[];
  /** Strictest rating implied across all scanned images. */
  rating: ContentRating;
  categories: string[];
}

const RATING_RANK: Record<ContentRating, number> = {
  general: 0,
  sensitive: 1,
  "18_plus": 2,
  review_required: 3,
};

export const stricterRating = (
  a: ContentRating,
  b: ContentRating,
): ContentRating => (RATING_RANK[a] >= RATING_RANK[b] ? a : b);

/**
 * Moderate a single local image via the Google Vision edge function.
 * On a transient failure it fails open (allow) so an outage doesn't block all
 * uploads — Vision is the single source of truth for image moderation.
 */
export const moderateImage = async (
  fileUri: string,
): Promise<ModerationResult> => {
  try {
    const imageBase64 = await toScannableBase64(fileUri);

    const { data, error } = await supabase.functions.invoke<ModerationResult>(
      "moderate-image",
      { body: { imageBase64 } },
    );

    if (error || !data || !data.decision) {
      throw error ?? new Error("Empty moderation response");
    }

    return data;
  } catch (err) {
    console.warn(
      "[imageModeration] Vision scan failed; allowing image (fail-open):",
      err,
    );
    return { decision: "allow", rating: "general", categories: [] };
  }
};
