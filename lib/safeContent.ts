/**
 * One rule for who may see what, applied to everything the app shows.
 *
 * Safe View, an unverified age and being under 18 were enforced on posts and
 * on nothing else — so a reader protected in the feed could walk into the
 * same picture through Shopping, the Marketplace, Services, search, or a
 * shared link, none of which asked. That is not a gap in a feature; it is
 * the feature not existing outside one screen.
 *
 * So the decision lives here, in one function that takes *any* row carrying
 * `content_rating` / `moderation_status`, and every list and every detail
 * screen goes through it. A call site that compares ratings by hand is a
 * call site that will be missed the next time the rules change.
 *
 * **Defaulting is deliberate.** A row from a table that has no rating column
 * yet, or one written before the column existed, reads as `general` — the
 * status quo, rather than hiding the whole catalogue on the day the
 * migration lands. What it buys is somewhere for a scan or a moderator to
 * write a verdict; the gate is only as good as what is written into it, and
 * that is worth saying out loud rather than pretending otherwise.
 */

import { canViewContent } from "@/lib/contentClassifier";
import type { ContentRating, ModerationStatus } from "@/types/post";

/**
 * What the gate needs from a row. Everything else about it is irrelevant —
 * which is also why the functions below are constrained to `object` rather
 * than to this: every field here is optional, so TypeScript's weak-type
 * check refuses any row that happens to carry none of them yet, and that is
 * precisely the row this has to keep working for.
 */
export interface RatedRow {
  content_rating?: ContentRating | string | null;
  moderation_status?: ModerationStatus | string | null;
}

/** The reader, as far as this decision is concerned. */
export interface Viewer {
  safeView: boolean;
  userAge?: number | null;
  isAgeVerified?: boolean;
  /** Their own things are always theirs to see, whatever the rating. */
  userId?: string | null;
}

const ratingOf = (row: object): ContentRating =>
  ((row as RatedRow)?.content_rating as ContentRating) || "general";

const statusOf = (row: object): ModerationStatus =>
  ((row as RatedRow)?.moderation_status as ModerationStatus) || "approved";

/**
 * Whether this reader may see this row.
 *
 * Two questions, and both have to pass: has moderation cleared it, and does
 * the audience rating allow this reader. They are separate on purpose — a
 * listing pulled for review is hidden from everyone regardless of Safe View,
 * and a perfectly approved 18+ listing is still hidden from a minor.
 */
export const canView = (row: object, viewer: Viewer, ownerId?: string | null): boolean => {
  // Your own listing never disappears on you: you would have no way to find
  // it and take it down, which is the one thing you must always be able to
  // do with something you posted.
  if (ownerId && viewer.userId && ownerId === viewer.userId) return true;

  const status = statusOf(row);
  if (status === "rejected" || status === "pending_review") return false;

  return canViewContent(
    ratingOf(row),
    viewer.userAge,
    viewer.isAgeVerified,
    viewer.safeView,
  );
};

/** The same decision over a list — what every browse and search calls. */
export const filterViewable = <T extends object>(
  rows: T[] | null | undefined,
  viewer: Viewer,
  ownerIdOf?: (row: T) => string | null | undefined,
): T[] =>
  (rows ?? []).filter((row) => canView(row, viewer, ownerIdOf?.(row) ?? null));

/**
 * Whether anything was withheld, so a screen can say so.
 *
 * Silently returning a shorter list is how somebody concludes the app is
 * broken or empty. A grid that says "3 hidden by Safe View" is telling the
 * truth and pointing at the switch that changes it.
 */
export const countHidden = <T extends object>(
  rows: T[] | null | undefined,
  viewer: Viewer,
  ownerIdOf?: (row: T) => string | null | undefined,
): number => (rows?.length ?? 0) - filterViewable(rows, viewer, ownerIdOf).length;
