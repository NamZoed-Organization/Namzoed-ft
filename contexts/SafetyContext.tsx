/**
 * SafetyContext
 *
 * Holds the viewer's content-safety state:
 *   - safeView      — when ON (default), mature (sensitive / 18+) content is
 *                     hidden from the feed and never recommended. Only verified
 *                     adults may turn it OFF.
 *   - userAge / isAgeVerified / isAdult — derived from the user's profile so the
 *                     feed can gate 18+ content for minors and unverified users.
 *
 * `safeView` is cached in AsyncStorage for instant startup and synced to
 * `profiles.safe_view` so the preference follows the user across devices.
 */
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/lib/supabase";
import { getAgeFromDate } from "@/utils/age";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const KEY_SAFE_VIEW = "@namzoed_safe_view";

interface SafetyContextValue {
  safeView: boolean;
  setSafeView: (value: boolean) => Promise<void>;
  userAge: number | null;
  isAgeVerified: boolean;
  isAdult: boolean;
  /** Re-read the profile age/verification state. */
  refresh: () => Promise<void>;
}

const SafetyContext = createContext<SafetyContextValue>({
  safeView: true,
  setSafeView: async () => {},
  userAge: null,
  isAgeVerified: false,
  isAdult: false,
  refresh: async () => {},
});

export function SafetyProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useUser();
  const userId = (currentUser as any)?.id as string | undefined;

  const [safeView, setSafeViewState] = useState(true);
  const [userAge, setUserAge] = useState<number | null>(null);
  const [isAgeVerified, setIsAgeVerified] = useState(false);

  // Restore the cached preference immediately (default ON).
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(KEY_SAFE_VIEW);
        if (cached != null) setSafeViewState(cached === "true");
      } catch {
        // keep default
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      setUserAge(null);
      setIsAgeVerified(false);
      return;
    }
    try {
      let { data, error } = await supabase
        .from("profiles")
        .select("birth_date, age_verified, safe_view")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        // PostgREST rejects the whole select when any one column is
        // unknown, so a missing `safe_view` used to take the age fields
        // down with it — isAdult stayed false for everyone, and Safe View
        // was permanently locked with nothing logged anywhere. Age gating
        // must not depend on the preference column being present.
        console.warn(
          "Safety: profile read failed, retrying without safe_view:",
          error.message,
        );
        ({ data, error } = await supabase
          .from("profiles")
          .select("birth_date, age_verified")
          .eq("id", userId)
          .maybeSingle());
      }

      if (error || !data) {
        if (error) console.warn("Safety: profile read failed:", error.message);
        return;
      }

      if (data.birth_date) {
        setUserAge(getAgeFromDate(new Date(data.birth_date)));
      } else {
        setUserAge(null);
      }
      setIsAgeVerified(!!data.age_verified);

      // Server value wins when present; keep the cache in sync.
      if (typeof (data as any).safe_view === "boolean") {
        setSafeViewState((data as any).safe_view);
        AsyncStorage.setItem(KEY_SAFE_VIEW, String((data as any).safe_view)).catch(
          () => {},
        );
      }
    } catch {
      // ignore — keep cached/default values
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSafeView = useCallback(
    async (value: boolean) => {
      setSafeViewState(value);
      try {
        await AsyncStorage.setItem(KEY_SAFE_VIEW, String(value));
      } catch {
        // ignore cache failure
      }
      if (userId) {
        try {
          await supabase
            .from("profiles")
            .update({ safe_view: value })
            .eq("id", userId);
        } catch {
          // ignore — local state already updated
        }
      }
    },
    [userId],
  );

  const isAdult = userAge !== null && userAge >= 18 && isAgeVerified;

  return (
    <SafetyContext.Provider
      value={{ safeView, setSafeView, userAge, isAgeVerified, isAdult, refresh }}
    >
      {children}
    </SafetyContext.Provider>
  );
}

export function useSafety(): SafetyContextValue {
  return useContext(SafetyContext);
}
