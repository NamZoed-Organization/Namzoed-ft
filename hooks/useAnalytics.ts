/**
 * useAnalytics hook
 *
 * Provides convenient helpers for tracking user interactions on a given screen.
 * Automatically includes the current user ID so callers don't need to pass it.
 *
 * @example
 * const { trackTap, trackView, trackFeature } = useAnalytics(Screens.FEED);
 *
 * // Track a button tap
 * trackTap(Elements.LIKE_BUTTON, Features.POST_LIKE, { post_id: post.id });
 *
 * // Track a screen view on mount
 * trackView();
 *
 * // Track any feature usage
 * trackFeature(Features.SEARCH, Elements.SEARCH_BAR, { query: text });
 */

import { useUser } from "@/contexts/UserContext";
import {
  Action,
  Actions,
  Element,
  Feature,
  Features,
  Screen,
  trackInteraction,
} from "@/lib/analyticsService";
import { useCallback, useEffect } from "react";

export function useAnalytics(screen: Screen | string) {
  const { currentUser } = useUser();
  const userId = currentUser?.id ?? null;

  /** Track a screen view automatically on mount */
  const trackView = useCallback(
    (metadata?: Record<string, unknown>) => {
      trackInteraction({
        userId,
        screen,
        feature: Features.SCREEN_VIEW,
        action: Actions.VIEW,
        metadata,
      });
    },
    [userId, screen]
  );

  /** Track a button/element tap */
  const trackTap = useCallback(
    (
      element: Element | string,
      feature?: Feature | string,
      metadata?: Record<string, unknown>
    ) => {
      trackInteraction({
        userId,
        screen,
        feature: feature ?? Features.SCREEN_VIEW,
        element,
        action: Actions.TAP,
        metadata,
      });
    },
    [userId, screen]
  );

  /** Track any feature usage with full control */
  const trackFeature = useCallback(
    (
      feature: Feature | string,
      element?: Element | string,
      action: Action | string = Actions.TAP,
      metadata?: Record<string, unknown>
    ) => {
      trackInteraction({
        userId,
        screen,
        feature,
        element,
        action,
        metadata,
      });
    },
    [userId, screen]
  );

  return { trackView, trackTap, trackFeature };
}

/**
 * useScreenAnalytics — auto-tracks a screen view on mount.
 * Drop this into any screen component to get page view tracking for free.
 *
 * @example
 * useScreenAnalytics(Screens.MARKETPLACE);
 */
export function useScreenAnalytics(
  screen: Screen | string,
  metadata?: Record<string, unknown>
) {
  const { trackView } = useAnalytics(screen);

  useEffect(() => {
    trackView(metadata);
    // Only track once on mount — metadata is intentionally excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackView]);

  return useAnalytics(screen);
}
