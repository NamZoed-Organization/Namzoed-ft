// components/NavigationLogger.tsx
import { usePathname, useSegments } from "expo-router";
import { useEffect, useRef } from "react";

/**
 * NavigationLogger component
 * Logs route changes globally - add once to root layout
 */
export function NavigationLogger() {
  const pathname = usePathname();
  const segments = useSegments();
  const prevPathRef = useRef<string>("");

  useEffect(() => {
    // Only log if path actually changed
    if (pathname !== prevPathRef.current) {
      const timestamp = new Date().toLocaleTimeString();

      console.log("📂 Segments:", segments.join(" → "));

      if (prevPathRef.current) {
      }

      prevPathRef.current = pathname;
    }
  }, [pathname, segments]);

  return null; // This component only logs, doesn't render anything
}
