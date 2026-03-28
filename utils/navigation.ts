// utils/navigation.ts
// Global navigation debounce — prevents duplicate screen pushes from rapid taps.
import { useRouter } from "expo-router";
import { useMemo } from "react";

let lastNavTime = 0;
const DEBOUNCE_MS = 500;

/**
 * Drop-in replacement for `useRouter()` that debounces push / replace / navigate
 * so rapid taps never stack duplicate screens.  `back()` is never debounced.
 */
export function useAppRouter() {
  const router = useRouter();

  return useMemo(() => {
    const guard = <T extends (...args: any[]) => any>(fn: T): T =>
      ((...args: any[]) => {
        const now = Date.now();
        if (now - lastNavTime < DEBOUNCE_MS) return;
        lastNavTime = now;
        return fn(...args);
      }) as unknown as T;

    return {
      ...router,
      push: guard(router.push),
      replace: guard(router.replace),
      navigate: guard(router.navigate),
      back: router.back, // always instant
    };
  }, [router]);
}
