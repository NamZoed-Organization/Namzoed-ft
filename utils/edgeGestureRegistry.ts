/**
 * Lets a horizontal media carousel (post media, comment media gallery, ...)
 * veto ContextDrop's left-edge swipe-back gesture while a touch starts over
 * it and it isn't on its first page. A rightward swipe from the left edge
 * of a carousel that's mid-scroll means "show the previous image", which is
 * otherwise indistinguishable from "go back" — the two gestures only differ
 * by what's visually underneath the touch, which ContextDrop itself has no
 * way to know. Carousels register their on-screen bounds + current index
 * here; ContextDrop consults it once per gesture-capture check.
 *
 * ContextDrop's gesture (see ContextDrop.tsx) runs entirely as a Reanimated
 * worklet on the UI thread so its recognition/tracking never lags behind a
 * busy JS thread — which means this check must be answerable synchronously
 * FROM the UI thread too. A plain JS Map (readable only from the JS thread)
 * can't do that, so state lives in a single Reanimated shared value instead:
 * carousels push bounds/index updates into it (a normal JS-thread write,
 * same cost as the old ref assignment it replaces), and isEdgeGestureBlockedAt
 * — itself a worklet — reads it back live, with no cross-thread round trip.
 */

import { makeMutable } from "react-native-reanimated";

interface CarouselEntry {
  id: number;
  top: number;
  bottom: number;
  hasPrevious: boolean;
}

export interface EdgeGestureCarouselHandle {
  setBounds: (top: number, bottom: number) => void;
  setHasPrevious: (hasPrevious: boolean) => void;
  unregister: () => void;
}

const registrySV = makeMutable<CarouselEntry[]>([]);
let nextId = 0;

/** Call on mount; call the returned handle's unregister() on unmount. */
export function registerEdgeGestureCarousel(): EdgeGestureCarouselHandle {
  const id = nextId++;
  registrySV.value = [...registrySV.value, { id, top: 0, bottom: 0, hasPrevious: false }];

  // Shared values must be reassigned (not mutated in place) for the new
  // value to actually propagate to the UI thread's copy.
  const patch = (partial: Partial<Omit<CarouselEntry, "id">>) => {
    registrySV.value = registrySV.value.map((entry) =>
      entry.id === id ? { ...entry, ...partial } : entry,
    );
  };

  return {
    setBounds: (top, bottom) => patch({ top, bottom }),
    setHasPrevious: (hasPrevious) => patch({ hasPrevious }),
    unregister: () => {
      registrySV.value = registrySV.value.filter((entry) => entry.id !== id);
    },
  };
}

/** Worklet — called from ContextDrop's own UI-thread gesture callbacks. */
export function isEdgeGestureBlockedAt(y: number): boolean {
  "worklet";
  const list = registrySV.value;
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    if (entry.hasPrevious && y >= entry.top && y <= entry.bottom) return true;
  }
  return false;
}
