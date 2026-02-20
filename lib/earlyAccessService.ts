import { supabase } from '@/lib/supabase';

/**
 * The early-access badge tiers for Namzoed's founding community members.
 * These correspond to `badge_id` values stored in the `user_badges` table.
 *
 *  "founding"  – most exclusive (waitlisted + early signup)
 *  "waitlist"  – on the waitlist
 *  "tester"    – signed up before Feb 28 2026
 *  "genesis"   – on waitlist OR signed up early (union of both)
 *  null        – user has no early-access badge
 *
 * Future badge IDs (e.g. 'fire_horse_2026') are separate campaigns and are
 * returned by getAllUserBadges() / getUserBadgesWithSkins().
 */
export type EarlyAccessBadgeType = 'founding' | 'waitlist' | 'tester' | 'genesis' | null;

/**
 * How a badge is displayed.  Stored per-row in user_badges.selected_skin.
 *   'luxury'  — metallic shimmer border (available now)
 *   'neon'    — electric glow outline  (Season 2)
 *   'minimal' — clean hairline tag     (Season 2)
 */
export type BadgeSkin = 'luxury' | 'neon' | 'minimal';

/** A single row from the user_badges table. */
export interface UserBadge {
  badge_id:      string;
  selected_skin?: BadgeSkin;   // optional — removed from DB schema, kept for back-compat
  earned_at:     string;
}

/** Priority order used to pick the most exclusive early-access badge. */
const EARLY_ACCESS_PRIORITY: NonNullable<EarlyAccessBadgeType>[] = [
  'founding',
  'waitlist',
  'tester',
  'genesis',
];

// ── In-memory caches ─────────────────────────────────────────────────────────
const primaryBadgeCache = new Map<string, { badgeType: EarlyAccessBadgeType; skin: BadgeSkin }>();
const allBadgesCache    = new Map<string, UserBadge[]>();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the most exclusive early-access badge tier AND its chosen skin.
 * Results are cached in memory so repeat calls are instant.
 */
export async function getEarlyAccessBadge(
  userId: string,
): Promise<EarlyAccessBadgeType> {
  const result = await getPrimaryBadgeWithSkin(userId);
  return result?.badgeType ?? null;
}

/**
 * Returns the primary (most exclusive) early-access badge together with the
 * skin the user has selected for it.  Null when the user has no badge.
 */
export async function getPrimaryBadgeWithSkin(
  userId: string,
): Promise<{ badgeType: EarlyAccessBadgeType; skin: BadgeSkin } | null> {
  if (!userId) return null;

  if (primaryBadgeCache.has(userId)) {
    return primaryBadgeCache.get(userId)!;
  }

  try {
    const { data, error } = await supabase
      .from('user_badges')
      .select('badge_id, selected_skin')
      .eq('user_id', userId)
      .in('badge_id', EARLY_ACCESS_PRIORITY);

    if (error) {
      console.warn('[EarlyAccess] Badge fetch failed:', error.message);
      return null;
    }

    const rows = (data ?? []) as { badge_id: string; selected_skin: string }[];
    const primaryId = EARLY_ACCESS_PRIORITY.find((tier) =>
      rows.some((r) => r.badge_id === tier),
    ) ?? null;

    const primaryRow = rows.find((r) => r.badge_id === primaryId);
    const result = {
      badgeType: primaryId as EarlyAccessBadgeType,
      skin:      (primaryRow?.selected_skin ?? 'luxury') as BadgeSkin,
    };

    primaryBadgeCache.set(userId, result);
    return result;
  } catch (err) {
    console.warn('[EarlyAccess] Badge fetch exception:', err);
    return null;
  }
}

/**
 * Returns ALL badges the user has earned (including future campaign badges),
 * each with its chosen skin, ordered by earned_at ascending.
 */
export async function getUserBadgesWithSkins(userId: string): Promise<UserBadge[]> {
  if (!userId) return [];

  if (allBadgesCache.has(userId)) {
    return allBadgesCache.get(userId)!;
  }

  try {
    const { data, error } = await supabase
      .from('user_badges')
      .select('badge_id, selected_skin, earned_at')
      .eq('user_id', userId)
      .order('earned_at', { ascending: true });

    if (error) {
      console.warn('[EarlyAccess] Full badges fetch failed:', error.message);
      return [];
    }

    const badges = (data ?? []) as UserBadge[];
    allBadgesCache.set(userId, badges);
    return badges;
  } catch (err) {
    console.warn('[EarlyAccess] Full badges fetch exception:', err);
    return [];
  }
}

/**
 * Persists a new skin choice for one of the user's badges and invalidates
 * the in-memory caches so the next fetch reflects the change.
 */
export async function updateBadgeSkin(
  userId:  string,
  badgeId: string,
  skin:    BadgeSkin,
): Promise<boolean> {
  if (!userId || !badgeId) return false;

  try {
    const { error } = await supabase
      .from('user_badges')
      .update({ selected_skin: skin })
      .eq('user_id', userId)
      .eq('badge_id', badgeId);

    if (error) {
      console.warn('[EarlyAccess] Skin update failed:', error.message);
      return false;
    }

    // Invalidate caches so the next read hits the DB
    primaryBadgeCache.delete(userId);
    allBadgesCache.delete(userId);
    return true;
  } catch (err) {
    console.warn('[EarlyAccess] Skin update exception:', err);
    return false;
  }
}

/**
 * Clears all cached badge data for a specific user, or the entire cache
 * when called without arguments (e.g. on logout).
 */
export function clearBadgeCache(userId?: string): void {
  if (userId) {
    primaryBadgeCache.delete(userId);
    allBadgesCache.delete(userId);
    activeBadgeCache.delete(userId);
  } else {
    primaryBadgeCache.clear();
    allBadgesCache.clear();
    activeBadgeCache.clear();
  }
}

// ── New API (active badge selection + skin-free badge list) ──────────────────

const activeBadgeCache   = new Map<string, EarlyAccessBadgeType>();
// Subscribers notified synchronously whenever a user's active badge changes.
const activeBadgeSubs    = new Map<string, Set<(badge: EarlyAccessBadgeType) => void>>();

/** Subscribe to active-badge changes for a user. Returns an unsubscribe fn. */
export function subscribeToActiveBadge(
  userId: string,
  cb: (badge: EarlyAccessBadgeType) => void,
): () => void {
  if (!activeBadgeSubs.has(userId)) activeBadgeSubs.set(userId, new Set());
  activeBadgeSubs.get(userId)!.add(cb);
  return () => activeBadgeSubs.get(userId)?.delete(cb);
}

/**
 * Returns the badge the user has pinned as their profile badge.
 * Reads `profiles.active_badge_id` first; falls back to the highest-priority
 * badge from user_badges when the profile column is NULL.
 */
export async function getActiveBadge(userId: string): Promise<EarlyAccessBadgeType> {
  if (!userId) return null;
  if (activeBadgeCache.has(userId)) return activeBadgeCache.get(userId)!;

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('active_badge_id')
      .eq('id', userId)
      .single();

    if (profile?.active_badge_id) {
      const tier = profile.active_badge_id as EarlyAccessBadgeType;
      activeBadgeCache.set(userId, tier);
      return tier;
    }

    // Fall back to priority order
    const fallback = await getEarlyAccessBadge(userId);
    activeBadgeCache.set(userId, fallback);
    return fallback;
  } catch (err) {
    console.warn('[EarlyAccess] getActiveBadge exception:', err);
    return null;
  }
}

/**
 * Returns all badges the user has earned (badge_id + earned_at only).
 */
export async function getUserBadges(userId: string): Promise<UserBadge[]> {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from('user_badges')
      .select('badge_id, earned_at')
      .eq('user_id', userId)
      .order('earned_at', { ascending: true });

    if (error) {
      console.warn('[EarlyAccess] getUserBadges failed:', error.message);
      return [];
    }
    return (data ?? []) as UserBadge[];
  } catch (err) {
    console.warn('[EarlyAccess] getUserBadges exception:', err);
    return [];
  }
}

/**
 * Pins `badgeId` as the user's active profile badge by writing to
 * `profiles.active_badge_id`, then updates the local cache.
 */
export async function setActiveBadge(userId: string, badgeId: string): Promise<boolean> {
  if (!userId || !badgeId) return false;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ active_badge_id: badgeId })
      .eq('id', userId);

    if (error) {
      console.warn('[EarlyAccess] setActiveBadge failed:', error.message);
      return false;
    }

    const tier = badgeId as EarlyAccessBadgeType;
    activeBadgeCache.set(userId, tier);
    activeBadgeSubs.get(userId)?.forEach(cb => cb(tier));
    return true;
  } catch (err) {
    console.warn('[EarlyAccess] setActiveBadge exception:', err);
    return false;
  }
}

