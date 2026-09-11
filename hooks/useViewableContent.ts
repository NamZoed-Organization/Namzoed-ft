/**
 * The reader, ready to hand to the gate.
 *
 * Every screen that lists anything needs the same four facts — Safe View,
 * age, whether that age is verified, and who is looking — and every screen
 * that assembled them by hand would eventually assemble them differently.
 * This is the one assembly, and `filter` is the one call.
 *
 *     const { filter, hiddenCount } = useViewableContent();
 *     const shown = filter(products, (p) => p.user_id);
 *
 * The owner accessor is optional and worth passing wherever rows have one:
 * your own listing must never disappear from your own screen, or you would
 * have no way to reach it and take it down.
 */

import { useSafety } from "@/contexts/SafetyContext";
import { useUser } from "@/contexts/UserContext";
import { countHidden, filterViewable, type Viewer } from "@/lib/safeContent";
import { useCallback, useMemo } from "react";

export function useViewableContent() {
  const { safeView, userAge, isAgeVerified } = useSafety();
  const { currentUser } = useUser();

  const viewer = useMemo<Viewer>(
    () => ({
      safeView,
      userAge,
      isAgeVerified,
      userId: currentUser?.id ? String(currentUser.id) : null,
    }),
    [currentUser?.id, isAgeVerified, safeView, userAge],
  );

  const filter = useCallback(
    <T extends object>(
      rows: T[] | null | undefined,
      ownerIdOf?: (row: T) => string | null | undefined,
    ) => filterViewable(rows, viewer, ownerIdOf),
    [viewer],
  );

  const hiddenCount = useCallback(
    <T extends object>(
      rows: T[] | null | undefined,
      ownerIdOf?: (row: T) => string | null | undefined,
    ) => countHidden(rows, viewer, ownerIdOf),
    [viewer],
  );

  return { viewer, filter, hiddenCount };
}
