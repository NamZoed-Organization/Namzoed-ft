import {
    EarlyAccessBadgeType,
    getActiveBadge,
    subscribeToActiveBadge,
} from '@/lib/earlyAccessService';
import { useEffect, useState } from 'react';

/**
 * Returns the badge the given user has chosen to display on their profile.
 * Updates instantly when setActiveBadge() is called anywhere in the app.
 */
export function useEarlyAccessBadge(
  userId?: string | null,
): EarlyAccessBadgeType {
  const [badgeType, setBadgeType] = useState<EarlyAccessBadgeType>(null);

  useEffect(() => {
    if (!userId) { setBadgeType(null); return; }

    let cancelled = false;

    // Initial fetch
    getActiveBadge(userId)
      .then((t) => { if (!cancelled) setBadgeType(t); })
      .catch(() => { if (!cancelled) setBadgeType(null); });

    // Live updates — fires synchronously when setActiveBadge() resolves
    const unsubscribe = subscribeToActiveBadge(userId, (t) => {
      if (!cancelled) setBadgeType(t);
    });

    return () => { cancelled = true; unsubscribe(); };
  }, [userId]);

  return badgeType;
}
