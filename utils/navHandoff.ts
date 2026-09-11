// utils/navHandoff.ts
/**
 * The wait between committing to a screen and that screen actually being
 * there.
 *
 * The stack animates with `animation: "none"` (app/_layout.tsx), so a push
 * into a heavy screen — chat above all, which is thousands of lines of
 * component before its own skeleton can paint — shows nothing at all for a
 * beat: the old screen just sits there. That reads as a tap that didn't
 * take, and it is worst in ContextDrop's "Contact Author" drop, where the
 * gesture has already ended, the dome is gone, and there is nothing left on
 * screen saying anything is happening.
 *
 * So the navigation says when it starts and the destination says when it
 * has arrived, and in between `NavHandoffOverlay` (mounted once, in the
 * root layout) puts the app's standard LoadingOverlay up. It is deliberately
 * a module-level store rather than a context: the two ends of the handoff
 * are on opposite sides of a navigation — the screen that begins it is often
 * being replaced by the one that ends it — so there is no component that
 * spans both. `useAppRouter`'s own debounce (utils/navigation.ts) is
 * module-level for the same reason.
 *
 * `begin` is safe to call for a navigation that never happens: a handoff
 * that nobody ends is dropped after HANDOFF_TIMEOUT_MS, since a scrim that
 * blocks the whole app is not a thing to leave to chance.
 */

import { useSyncExternalStore } from "react";

/** Longer than any screen in this app takes to mount, short enough that a
 *  handoff nobody ended is a blink and not a lockout. */
const HANDOFF_TIMEOUT_MS = 5000;
/** A wait shorter than this never gets an overlay at all. A scrim that
 *  fades in and straight back out is a flicker, and a navigation that was
 *  quick enough not to need explaining should not get explained. */
const SHOW_DELAY_MS = 120;

let active = false;
/** Fires SHOW_DELAY_MS in, and again at HANDOFF_TIMEOUT_MS — one handle,
 *  since the second is only ever armed once the first has fired. */
let timeout: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (active === next) return;
  active = next;
  listeners.forEach((l) => l());
}

function clearTimer() {
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }
}

/**
 * A screen is being navigated to and will take a moment to arrive. Call it
 * immediately before the `push`, and make sure the destination calls
 * `endNavHandoff` once it renders.
 */
export function beginNavHandoff() {
  clearTimer();
  timeout = setTimeout(() => {
    set(true);
    timeout = setTimeout(() => {
      timeout = null;
      set(false);
    }, HANDOFF_TIMEOUT_MS);
  }, SHOW_DELAY_MS);
}

/** The destination is on screen. Harmless when no handoff is in flight. */
export function endNavHandoff() {
  clearTimer();
  set(false);
}

export function useNavHandoff() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => active,
    () => false,
  );
}
