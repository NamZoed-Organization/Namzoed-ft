import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dimensions, View } from "react-native";

const SCREEN_HEIGHT = Dimensions.get("window").height;
// How far below (or above) the visible viewport an item can still be and
// get mounted for real — a "lookahead" margin so images have a head start
// downloading before they're actually scrolled into view, without mounting
// the whole (potentially huge, e.g. marketplace's 1000-item pool) grid at once.
const REVEAL_LOOKAHEAD = SCREEN_HEIGHT * 1.5;
// Re-measure position on this cadence while anything is still unrevealed —
// cheap enough not to matter (one native measure call, a few times/sec),
// and stops entirely once everything's been revealed (see markAllRevealed).
const POLL_MS = 250;

/**
 * Gates a non-virtualized masonry grid's cards by proximity to the
 * viewport, without needing the ancestor ScrollView/FlatList's scroll
 * offset threaded in as a prop — `measureInWindow` already reports the
 * grid's current on-screen position directly, so a short poll while
 * anything remains unrevealed is enough to drive reveal/priority decisions
 * as the user scrolls, no matter which screen or scroll container it's in.
 */
export function useGridReveal() {
  const containerRef = useRef<View>(null);
  const [containerTop, setContainerTop] = useState<number | null>(null);
  const doneRef = useRef(false);
  // Once an item has been near the viewport at least once, it stays
  // revealed even if the user later scrolls far enough past it that it
  // would otherwise fall back outside the lookahead margin — nothing
  // already shown should pop back into a placeholder.
  const revealedIdsRef = useRef(new Set<string>());

  const measure = useCallback(() => {
    containerRef.current?.measureInWindow((_x, y) => setContainerTop(y));
  }, []);

  // Layout effect (not a plain effect) so the first measurement lands
  // before the initial paint commits — otherwise far off-screen items
  // would briefly mount for real (firing their image requests) on the
  // first frame, then collapse to placeholders once measure() catches up.
  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const id = setInterval(() => {
      if (doneRef.current) return;
      measure();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [measure]);

  // Before the first measurement lands, treat everything as revealed rather
  // than flashing empty placeholders for a frame.
  const isNear = useCallback(
    (id: string, top: number, height: number) => {
      if (revealedIdsRef.current.has(id)) return true;
      if (containerTop === null) return true;
      const windowTop = containerTop + top;
      const near = windowTop < SCREEN_HEIGHT + REVEAL_LOOKAHEAD && windowTop + height > -REVEAL_LOOKAHEAD;
      if (near) revealedIdsRef.current.add(id);
      return near;
    },
    [containerTop],
  );

  const isAboveFold = useCallback(
    (top: number) => containerTop !== null && containerTop + top < SCREEN_HEIGHT,
    [containerTop],
  );

  // Called once everything currently in the grid is revealed — stops the
  // poll until new items arrive and re-arm it (see the effect below).
  const markAllRevealed = useCallback(() => {
    doneRef.current = true;
  }, []);

  const rearm = useCallback(() => {
    doneRef.current = false;
  }, []);

  return { containerRef, isNear, isAboveFold, markAllRevealed, rearm };
}
