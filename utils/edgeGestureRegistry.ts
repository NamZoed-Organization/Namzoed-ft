/**
 * Lets a horizontal media carousel (post media, comment media gallery, ...)
 * veto ContextDrop's left-edge swipe-back gesture while a touch starts over
 * it and it isn't on its first page. A rightward swipe from the left edge
 * of a carousel that's mid-scroll means "show the previous image", which is
 * otherwise indistinguishable from "go back" — the two gestures only differ
 * by what's visually underneath the touch, which ContextDrop itself has no
 * way to know. Carousels register their on-screen bounds + current index
 * here; ContextDrop consults it once per gesture-capture check.
 *
 * A plain module-level Map (not React context) on purpose — ContextDrop and
 * any carousel can be arbitrarily far apart in the tree (e.g. a comment's
 * gallery, several list levels below the post's own ContextDrop wrapper),
 * and this only ever needs a synchronous "is this point blocked right now"
 * read at gesture time, not a subscription.
 */

interface RegisteredCarousel {
  /** Current on-screen vertical bounds (window coordinates). */
  getBounds: () => { top: number; bottom: number } | null;
  /** True while there's a previous item a rightward swipe would reveal. */
  hasPrevious: () => boolean;
}

const carousels = new Map<string, RegisteredCarousel>();
let nextId = 0;

/** Call on mount; call the returned cleanup on unmount. */
export function registerEdgeGestureCarousel(carousel: RegisteredCarousel): () => void {
  const id = `carousel-${nextId++}`;
  carousels.set(id, carousel);
  return () => {
    carousels.delete(id);
  };
}

export function isEdgeGestureBlockedAt(y: number): boolean {
  for (const carousel of carousels.values()) {
    if (!carousel.hasPrevious()) continue;
    const bounds = carousel.getBounds();
    if (bounds && y >= bounds.top && y <= bounds.bottom) return true;
  }
  return false;
}
