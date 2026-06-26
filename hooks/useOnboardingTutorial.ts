/**
 * useOnboardingTutorial
 *
 * Manages whether the one-time onboarding tutorial has been seen,
 * persisted via AsyncStorage so it only auto-shows on the very first
 * session after install/login.
 *
 * Usage:
 *   const { hasUnseen, loading, markComplete, resetAll } = useOnboardingTutorial();
 *
 *   - hasUnseen  → true when at least one tutorial hasn't been marked done yet
 *   - loading    → true while the stored value is being read from AsyncStorage
 *   - markComplete('addProducts', 'tagInPosts') → persist completion
 *   - resetAll() → clear all state (useful for dev / settings reset)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

// ─── Shared Types ─────────────────────────────────────────────────────────────

/** Stable identifier for each individual tutorial. */
export type TutorialId = "addProducts" | "tagInPosts";

interface TutorialState {
  addProducts: boolean;
  tagInPosts: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "nmz_onboarding_v1";
const DEFAULT_STATE: TutorialState = { addProducts: false, tagInPosts: false };

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnboardingTutorial() {
  const [state, setState] = useState<TutorialState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);

  // Read persisted state once on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          setState(JSON.parse(raw) as TutorialState);
        }
      } catch (err) {
        console.warn("[useOnboardingTutorial] Failed to load state:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /**
   * Mark one or more tutorials as completed and persist to AsyncStorage.
   * Accepts a rest-spread so you can do:
   *   markComplete('addProducts', 'tagInPosts')
   */
  const markComplete = useCallback(async (...ids: TutorialId[]) => {
    setState((prev) => {
      const next: TutorialState = { ...prev };
      for (const id of ids) next[id] = true;
      // Fire-and-forget persist — state is already updated synchronously
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((err) =>
        console.warn("[useOnboardingTutorial] Failed to persist:", err),
      );
      return next;
    });
  }, []);

  /**
   * Clear all tutorial completion state (used by the "reset" dev option
   * or if you want to let the user replay tutorials fresh).
   */
  const resetAll = useCallback(async () => {
    setState(DEFAULT_STATE);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.warn("[useOnboardingTutorial] Failed to reset:", err);
    }
  }, []);

  const allComplete = state.addProducts && state.tagInPosts;

  /**
   * True when the user hasn't seen ALL tutorials yet.
   * Used by the feed screen to decide whether to auto-show the modal.
   */
  const hasUnseen = !loading && !allComplete;

  return { state, loading, hasUnseen, allComplete, markComplete, resetAll };
}
