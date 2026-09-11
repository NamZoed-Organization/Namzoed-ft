// lib/historyService.ts
//
// The viewer's own record of what they've looked at — what the History card
// on the profile opens. See supabase/migrations/create_view_history.sql for
// why this is separate from post_views (owner-facing counts) and
// user_interactions (product analytics).

import { LISTING_CARD_RATIO } from "@/components/GridCard";
import { ratioForUniformMode } from "@/lib/postMediaDisplay";
import { supabase } from "@/lib/supabase";

export type HistoryContentType =
  | "post"
  | "video"
  | "product"
  | "service"
  | "marketplace";

export interface HistoryEntry {
  type: HistoryContentType;
  id: string;
  viewedAt: string;
  title: string;
  /** Who made it — shown on the card's footer row. */
  authorName?: string | null;
  authorAvatar?: string | null;
  /** Trailing footer text: a price, or the category for a service. */
  meta?: string | null;
  imageUri?: string | null;
  isVideo?: boolean;
  /** Real media aspect ratio, so the waterfall columns balance on actual
   *  card heights rather than a uniform guess. */
  ratio: number;
  /** Route to reopen the item. */
  href: string;
}

/** Products, listings and services are shown in a fixed frame, matching the
 *  marketplace/product grids elsewhere in the app. */
/** Products and listings share one frame across the whole app — see
 *  LISTING_CARD_RATIO in components/GridCard.tsx, which is where it is
 *  decided. History mixes posts and listings in one waterfall, so it is the
 *  screen where a disagreement about this shows up first. */
const LISTING_RATIO = LISTING_CARD_RATIO;

interface HistoryRow {
  content_type: HistoryContentType;
  content_id: string;
  viewed_at: string;
}

// One write per item per session is plenty — the row only stores "last
// viewed", so re-recording the same thing while scrolling back and forth
// would be pure write traffic for an identical result.
const recordedThisSession = new Set<string>();

/**
 * Note that the user viewed something. Fire-and-forget: history is a
 * convenience, never worth surfacing an error or blocking a screen for.
 *
 * Viewing your own content is skipped — history is for finding your way back
 * to other people's things, and your own are already on your profile.
 */
export async function recordView(
  type: HistoryContentType,
  contentId: string,
  viewerId: string | undefined | null,
  ownerId?: string | null,
): Promise<void> {
  if (!viewerId || !contentId) return;
  if (ownerId && ownerId === viewerId) return;

  const key = `${viewerId}:${type}:${contentId}`;
  if (recordedThisSession.has(key)) return;
  recordedThisSession.add(key);

  try {
    const { error } = await supabase.from("view_history").upsert(
      {
        user_id: viewerId,
        content_type: type,
        content_id: contentId,
        viewed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,content_type,content_id" },
    );
    if (error) throw error;
  } catch {
    // Let a later visit try again rather than losing the entry for the
    // rest of the session.
    recordedThisSession.delete(key);
  }
}

/** Forgets this session's dedup keys — call after clearing history so the
 *  next view is recorded again rather than being suppressed. */
export function resetRecordedViews(): void {
  recordedThisSession.clear();
}

// ─── Reading ──────────────────────────────────────────────────────────────

const isVideoUrl = (url?: string | null) =>
  !!url && /\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i.test(url);

/**
 * The user's history, newest first, with each row hydrated from whatever it
 * points at. Entries whose content has since been deleted are dropped —
 * the row stays in the table (harmless) but there's nothing to show or open.
 */
export async function fetchHistory(
  userId: string,
  limit = 200,
): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from("view_history")
    .select("content_type, content_id, viewed_at")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  const rows = (data ?? []) as HistoryRow[];
  if (rows.length === 0) return [];

  // One query per content type rather than per row.
  const idsFor = (type: HistoryContentType) =>
    rows.filter((r) => r.content_type === type).map((r) => r.content_id);

  const postIds = [...idsFor("post"), ...idsFor("video")];
  const productIds = idsFor("product");
  const serviceIds = idsFor("service");
  const marketplaceIds = idsFor("marketplace");

  const [posts, products, services, marketplace] = await Promise.all([
    postIds.length
      ? supabase
          .from("posts")
          .select(
            "id, content, images, media_display, profiles:user_id ( name, avatar_url )",
          )
          .in("id", postIds)
      : Promise.resolve({ data: [] as any[] }),
    productIds.length
      ? supabase
          .from("products")
          .select(
            "id, name, price, images, category, profiles:user_id ( name, avatar_url )",
          )
          .in("id", productIds)
      : Promise.resolve({ data: [] as any[] }),
    serviceIds.length
      ? supabase
          .from("provider_services")
          .select("id, name, images, service_categories ( name )")
          .in("id", serviceIds)
      : Promise.resolve({ data: [] as any[] }),
    marketplaceIds.length
      ? supabase
          .from("marketplace")
          .select(
            "id, title, price, images, type, profiles:user_id ( name, avatar_url )",
          )
          .in("id", marketplaceIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const byId = (list: any[] | null) =>
    new Map((list ?? []).map((row) => [row.id as string, row]));

  const postMap = byId(posts.data);
  const productMap = byId(products.data);
  const serviceMap = byId(services.data);
  const marketplaceMap = byId(marketplace.data);

  const entries: HistoryEntry[] = [];

  for (const row of rows) {
    const viewedAt = row.viewed_at;
    switch (row.content_type) {
      case "post":
      case "video": {
        const post = postMap.get(row.content_id);
        if (!post) break;
        const media = (post.images ?? []) as string[];
        // A "video" entry is one the user actually watched, so prefer the
        // clip itself for the thumbnail; a plain post shows its first image.
        const image =
          row.content_type === "video"
            ? media.find(isVideoUrl) ?? media[0]
            : media[0];
        entries.push({
          type: row.content_type,
          id: row.content_id,
          viewedAt,
          title: post.content?.trim() || "Post",
          authorName: post.profiles?.name ?? null,
          authorAvatar: post.profiles?.avatar_url ?? null,
          imageUri: image ?? null,
          isVideo: isVideoUrl(image),
          ratio:
            post.media_display?.ratios?.[0] ??
            ratioForUniformMode(post.media_display?.mode ?? "portrait"),
          href: `/(users)/post/${row.content_id}`,
        });
        break;
      }
      case "product": {
        const product = productMap.get(row.content_id);
        if (!product) break;
        entries.push({
          type: "product",
          id: row.content_id,
          viewedAt,
          title: product.name ?? "Product",
          authorName: product.profiles?.name ?? null,
          authorAvatar: product.profiles?.avatar_url ?? null,
          meta:
            product.price != null
              ? `Nu. ${product.price.toLocaleString()}`
              : product.category,
          imageUri: product.images?.[0] ?? null,
          ratio: LISTING_RATIO,
          href: `/(users)/product/${row.content_id}`,
        });
        break;
      }
      case "service": {
        const service = serviceMap.get(row.content_id);
        if (!service) break;
        entries.push({
          type: "service",
          id: row.content_id,
          viewedAt,
          title: service.name ?? "Service",
          meta: service.service_categories?.name ?? null,
          imageUri: service.images?.[0] ?? null,
          ratio: LISTING_RATIO,
          href: `/(users)/servicedetail/${row.content_id}`,
        });
        break;
      }
      case "marketplace": {
        const item = marketplaceMap.get(row.content_id);
        if (!item) break;
        entries.push({
          type: "marketplace",
          id: row.content_id,
          viewedAt,
          title: item.title ?? "Listing",
          authorName: item.profiles?.name ?? null,
          authorAvatar: item.profiles?.avatar_url ?? null,
          meta: item.price > 0 ? `Nu. ${item.price.toLocaleString()}` : item.type,
          imageUri: item.images?.[0] ?? null,
          ratio: LISTING_RATIO,
          href: `/(users)/marketplace/${row.content_id}`,
        });
        break;
      }
    }
  }

  return entries;
}

/** Wipes the user's history. */
export async function clearHistory(userId: string): Promise<void> {
  const { error } = await supabase
    .from("view_history")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
  resetRecordedViews();
}
