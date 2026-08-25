/**
 * useWhatsNew
 *
 * Tracks the last app version whose "What's New" changelog the user has
 * seen, persisted via AsyncStorage, so WhatsNewGate can auto-show the modal
 * once per new release.
 *
 * Usage:
 *   const { hasUnseen, loading, markSeen } = useWhatsNew();
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { LATEST_WHATS_NEW_VERSION } from "@/constants/whatsNew";

const STORAGE_KEY = "nmz_whats_new_last_seen_v1";

export function useWhatsNew() {
  const [lastSeenVersion, setLastSeenVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        setLastSeenVersion(raw);
      } catch (err) {
        console.warn("[useWhatsNew] Failed to load state:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Mark the latest release as seen and persist it. */
  const markSeen = useCallback(async () => {
    setLastSeenVersion(LATEST_WHATS_NEW_VERSION);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, LATEST_WHATS_NEW_VERSION);
    } catch (err) {
      console.warn("[useWhatsNew] Failed to persist:", err);
    }
  }, []);

  /** True once the latest release hasn't been marked seen yet. */
  const hasUnseen = !loading && lastSeenVersion !== LATEST_WHATS_NEW_VERSION;

  return { lastSeenVersion, loading, hasUnseen, markSeen };
}
