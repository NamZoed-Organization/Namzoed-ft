import {
  EarlyAccessBadgeType,
  getActiveBadge,
  subscribeToActiveBadge,
} from "@/lib/earlyAccessService";
import { useEffect, useState } from "react";
import { InteractionManager } from "react-native";

/**
 * Returns the badge the given user has chosen to display on their profile.
 * Updates instantly when setActiveBadge() is called anywhere in the app.
 */
export function useEarlyAccessBadge(
  userId?: string | null,
): EarlyAccessBadgeType {
  const [badgeType, setBadgeType] = useState<EarlyAccessBadgeType>(null);

  useEffect(() => {
    if (!userId) {
      setBadgeType(null);
      return;
    }

    let cancelled = false;

    const task = InteractionManager.runAfterInteractions(() => {
      getActiveBadge(userId)
        .then((t) => {
          if (!cancelled) setBadgeType(t);
        })
        .catch(() => {
          if (!cancelled) setBadgeType(null);
        });
    });

    const unsubscribe = subscribeToActiveBadge(userId, (t) => {
      if (!cancelled) setBadgeType(t);
    });

    return () => {
      cancelled = true;
      task.cancel();
      unsubscribe();
    };
  }, [userId]);

  return badgeType;
}
