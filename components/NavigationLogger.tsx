// components/NavigationLogger.tsx
import { usePathname, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";

/**
 * NavigationLogger component
 * Logs route changes globally — add once to root layout.
 *
 * Must be rendered AFTER <Stack> so the navigation state is available.
 * We delay one frame to avoid the "stale" crash that occurs when
 * navigation hooks run before the navigator has initialised.
 */
export function NavigationLogger() {
  const [ready, setReady] = useState(false);

  // Wait one frame so the Stack navigator can set up its state first.
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!ready) return null;

  return <NavigationLoggerInner />;
}

function NavigationLoggerInner() {
  const pathname = usePathname();
  const segments = useSegments();
  const prevPathRef = useRef<string>("");

  useEffect(() => {
    if (pathname && pathname !== prevPathRef.current) {
      console.log("📂 Segments:", segments?.join(" → "));
      prevPathRef.current = pathname;
    }
  }, [pathname, segments]);

  return null;
}
