/**
 * useSellerRating
 *
 * Everything a detail screen needs to let somebody rate the business behind
 * what they're looking at: which work profile the rating keys off, what it's
 * called, whether this person has already rated it, and the open/closed state
 * of the sheet.
 *
 * Lives in one place because the product screen and the service screen ask
 * the same question of the same table and would otherwise each grow their own
 * copy — and they must agree on the two rules that are easy to get wrong:
 * you never rate your own business, and the prompt after leaving a review
 * only appears for somebody who hasn't rated this business yet. A prompt that
 * reappears after every review is how a useful question turns into nagging.
 */

import {
  fetchMySellerRating,
  fetchSellerShop,
  type BusinessKind,
} from "@/lib/sellerService";
import { useCallback, useEffect, useState } from "react";

interface Args {
  /** The owner's profile id — whose work profile the rating belongs to. */
  ownerUserId?: string | null;
  /** Who is rating. Empty for a signed-out reader, which disables all of it. */
  buyerId?: string | null;
  /** Known already on the service screen, which joins the provider row. Saves
   *  the lookup; omit it and the owner's work profile is resolved instead. */
  providerId?: string | null;
  /** Used only if the work profile has no name of its own — on a product
   *  page that is the seller's own name, which is what a small shop here is
   *  called anyway. A screen that already knows the business name and skips
   *  the lookup (the service screen) passes it here too, where it is the only
   *  candidate and so wins by default. */
  fallbackName?: string | null;
  kind: BusinessKind;
}

export interface SellerRatingTarget {
  /** Null until resolved, or when there is nothing rateable here. */
  providerId: string | null;
  businessName: string;
  kind: BusinessKind;
  /** False while unresolved, so nothing renders a rate button too early. */
  canRate: boolean;
  hasRated: boolean;
  sheetOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
  /** Opens the sheet only for somebody who hasn't rated yet — the post-review
   *  prompt, as opposed to the deliberate "Rate" tap. */
  promptIfUnrated: () => void;
  /** Call after a successful submit so the prompt doesn't return. */
  markRated: () => void;
}

export function useSellerRating({
  ownerUserId,
  buyerId,
  providerId: knownProviderId,
  fallbackName,
  kind,
}: Args): SellerRatingTarget {
  const [providerId, setProviderId] = useState<string | null>(knownProviderId ?? null);
  const [shopName, setShopName] = useState<string>("");
  const [hasRated, setHasRated] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Nobody rates their own business, so the whole thing stays inert there —
  // including the lookups, which would otherwise run on every own-product view
  // for no possible outcome.
  const isOwn = !!ownerUserId && !!buyerId && ownerUserId === buyerId;
  const enabled = !!buyerId && !isOwn;

  useEffect(() => {
    if (!enabled || knownProviderId || !ownerUserId) return;
    let cancelled = false;
    (async () => {
      const shop = await fetchSellerShop(ownerUserId);
      if (cancelled || !shop) return;
      setProviderId(shop.id);
      setShopName(shop.name?.trim() || "");
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, knownProviderId, ownerUserId]);

  useEffect(() => {
    if (knownProviderId) setProviderId(knownProviderId);
  }, [knownProviderId]);

  useEffect(() => {
    if (!enabled || !providerId || !buyerId) return;
    let cancelled = false;
    (async () => {
      const mine = await fetchMySellerRating(providerId, buyerId);
      if (!cancelled) setHasRated(mine != null);
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, providerId, buyerId]);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);
  const promptIfUnrated = useCallback(() => {
    if (!hasRated) setSheetOpen(true);
  }, [hasRated]);
  const markRated = useCallback(() => setHasRated(true), []);

  return {
    providerId: enabled ? providerId : null,
    // Falls back rather than printing an empty name in "Rate ___". The
    // business profile does the same thing for the same reason: most small
    // shops here never name themselves.
    businessName:
      shopName ||
      fallbackName?.trim() ||
      (kind === "service" ? "this provider" : "this seller"),
    kind,
    canRate: enabled && !!providerId,
    hasRated,
    sheetOpen,
    openSheet,
    closeSheet,
    promptIfUnrated,
    markRated,
  };
}
