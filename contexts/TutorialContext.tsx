/**
 * The tutorial engine.
 *
 * It holds three things: which tour is running, where the control it is
 * pointing at physically is, and what the app has just told it happened.
 * The overlay draws from that; the screens only ever do two things —
 * `arrive(screen)` when they open, and `notify(event)` when the user does
 * the thing a step is waiting for.
 *
 * **A step is finished by using the app, not by pressing Next.** That is
 * the whole design: the spotlight leaves a hole where the real control is,
 * so the press that dismisses the step *is* the press that opens the menu.
 * Steps that genuinely have nothing to do — "this is what that means" —
 * carry a Got it, and a tour is not allowed to be all of them.
 *
 * Anchors are measured in window coordinates by the components themselves
 * (`components/tutorial/TutorialAnchor.tsx`) and re-measured on a slow tick
 * while a step is live, because the thing being pointed at can scroll,
 * animate in, or be a tab bar that has just re-laid out. Losing the rect is
 * not fatal: a step with no rect degrades to a bubble that blocks nothing,
 * which is also what happens on a screen where the control was never
 * wrapped.
 */

import { useUser } from "@/contexts/UserContext";
import {
  readTutorialState,
  writeTutorialState,
  type TutorialState,
} from "@/lib/tutorialStore";
import {
  TOURS,
  tourFor,
  type Tour,
  type TourId,
  type TutorialStep,
} from "@/lib/tutorialTours";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The spotlight matches the control's own corner rather than guessing. */
  radius: number;
}

interface TutorialContextValue {
  tour: Tour | null;
  step: TutorialStep | null;
  stepIndex: number;
  /** The rect for the live step's anchor, once it has been measured. */
  rect: AnchorRect | null;
  tipsOff: boolean;
  /** Whether a tour has been run to its last step. */
  isDone: (id: TourId) => boolean;

  /** A screen announcing itself; starts its tour the first time only. */
  arrive: (screen: string) => void;
  /**
   * Replay, or start one from a list. Always runs, tips off or not — it is
   * something the user asked for by name.
   *
   * `markSeen: false` runs one *without* consuming its one automatic
   * airing; the Dev Components preview uses it, so looking at a tour there
   * does not rob the next fresh install of it on the device you are
   * testing on.
   */
  startTour: (id: TourId, options?: { markSeen?: boolean }) => void;
  /** "The user just did X." Advances the step waiting on it, else no-op. */
  notify: (event: string) => void;
  /** The Got it on an explain-only step. */
  next: () => void;
  /** End this tour. It counts as seen, never as done. */
  skip: () => void;
  /** End it and stop offering any of them. */
  turnTipsOff: () => void;
  /** Settings: offer them all again. */
  resetTours: () => void;

  registerAnchor: (id: string, rect: AnchorRect) => void;
  unregisterAnchor: (id: string) => void;

  /**
   * Which overlay actually draws.
   *
   * A React Native `Modal` is its own window, so an overlay mounted at the
   * root is *behind* every modal in the app — and half of what these tours
   * teach (the create menu, the composer, the product form) lives inside
   * one. So each such surface mounts its own `TutorialOverlay` and pushes
   * itself onto this stack; the topmost is the only one that renders, and
   * the rest stand down rather than drawing a second card nobody can see.
   */
  pushHost: (id: string) => void;
  popHost: (id: string) => void;
  topHost: string;
  /** True while this anchor is the one being pointed at — the anchor uses
   *  it to decide whether it is worth re-measuring itself. */
  isAnchorLive: (id: string) => boolean;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useUser();
  const userId = currentUser?.id ? String(currentUser.id) : null;

  const [state, setState] = useState<TutorialState>({
    seen: [],
    done: [],
    tipsOff: false,
  });
  const [loaded, setLoaded] = useState(false);
  const [tourId, setTourId] = useState<TourId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<AnchorRect | null>(null);
  const [hosts, setHosts] = useState<string[]>(["root"]);

  const anchors = useRef<Map<string, AnchorRect>>(new Map());
  /** Tours started since the app launched, whatever storage says. The
   *  belt to `seen`'s braces — a write that has not landed yet must not
   *  let a tour start a second time. */
  const startedThisSession = useRef<Set<TourId>>(new Set());
  /** Read by callbacks that must not re-subscribe on every step. */
  const stateRef = useRef(state);
  stateRef.current = state;

  const tour = tourId ? TOURS[tourId] : null;
  const step = tour ? (tour.steps[stepIndex] ?? null) : null;
  const anchorId = step?.anchor ?? null;

  // ── Persistence ──────────────────────────────────────────────────────

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    // A different account has its own record — a shared phone's second user
    // has not been shown anything, and the first user's session guard says
    // nothing about them.
    startedThisSession.current.clear();
    readTutorialState(userId).then((s) => {
      if (!alive) return;
      stateRef.current = s;
      setState(s);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const persist = useCallback(
    (next: TutorialState) => {
      setState(next);
      writeTutorialState(userId, next);
    },
    [userId],
  );

  // ── Anchors ──────────────────────────────────────────────────────────

  const registerAnchor = useCallback((id: string, next: AnchorRect) => {
    anchors.current.set(id, next);
  }, []);

  const unregisterAnchor = useCallback((id: string) => {
    anchors.current.delete(id);
  }, []);

  const isAnchorLive = useCallback((id: string) => anchorId === id, [anchorId]);

  const pushHost = useCallback((id: string) => {
    setHosts((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const popHost = useCallback((id: string) => {
    setHosts((prev) => prev.filter((h) => h !== id));
  }, []);

  const topHost = hosts[hosts.length - 1] ?? "root";

  /**
   * The live anchor's rect, watched rather than read once.
   *
   * The control a step points at is routinely not on screen yet when the
   * step begins — a menu item inside a sheet that is still opening, a tab
   * bar that re-lays out — so this polls its own registry slowly while the
   * step is live rather than trusting a single measurement. It stops the
   * moment the step does.
   */
  useEffect(() => {
    if (!anchorId) {
      setRect(null);
      return;
    }
    const read = () => {
      const next = anchors.current.get(anchorId) ?? null;
      setRect((prev) => {
        if (prev === next) return prev;
        if (
          prev &&
          next &&
          prev.x === next.x &&
          prev.y === next.y &&
          prev.width === next.width &&
          prev.height === next.height
        ) {
          return prev;
        }
        return next;
      });
    };
    read();
    const tick = setInterval(read, 350);
    return () => clearInterval(tick);
  }, [anchorId, stepIndex]);

  // ── Running a tour ───────────────────────────────────────────────────

  const startTour = useCallback(
    (id: TourId, options?: { markSeen?: boolean }) => {
      setTourId(id);
      setStepIndex(0);
      setRect(null);
      startedThisSession.current.add(id);
      if (options?.markSeen === false) return;

      const prev = stateRef.current;
      if (!prev.seen.includes(id)) {
        const next = { ...prev, seen: [...prev.seen, id] };
        // Written into the ref as well as through `persist`: the state it
        // mirrors only updates on the next render, and `arrive` may be
        // called again before that — which is how the same tour started
        // twice on one screen.
        stateRef.current = next;
        persist(next);
      }
    },
    [persist],
  );

  const finish = useCallback(
    (completed: boolean) => {
      const id = tourId;
      setTourId(null);
      setStepIndex(0);
      setRect(null);
      if (!id || !completed) return;
      const prev = stateRef.current;
      if (!prev.done.includes(id)) {
        persist({ ...prev, done: [...prev.done, id] });
      }
    },
    [persist, tourId],
  );

  const advance = useCallback(() => {
    if (!tour) return;
    setStepIndex((i) => {
      if (i + 1 < tour.steps.length) return i + 1;
      // Last step: end it, and remember it was run all the way.
      finish(true);
      return 0;
    });
  }, [finish, tour]);

  const next = useCallback(() => {
    if (step?.advance.on !== "next") return;
    advance();
  }, [advance, step]);

  /**
   * Something happened in the app.
   *
   * Deliberately a no-op when nothing is waiting on it, so a screen can
   * report what it did without knowing whether a tour is running — which is
   * what keeps these calls one line at the call site instead of a
   * conditional.
   */
  const notify = useCallback(
    (event: string) => {
      if (!step) return;
      if (step.advance.on !== "action") return;
      if (step.advance.event !== event) return;
      advance();
    },
    [advance, step],
  );

  /**
   * A screen saying it has been reached.
   *
   * **A tour auto-starts exactly once, ever.** Every guard here exists
   * because a tutorial that comes back is worse than one that never ran:
   *
   *  - `userId == null` refuses to start anything before the account is
   *    known. This was the repeat nobody could explain — on a cold start
   *    `currentUser` is briefly null, so a tour would start, be marked seen
   *    against the `anon` key, and then be offered *again* the moment the
   *    real id arrived and its own (empty) record was read.
   *  - `startedThisSession` catches the same tour being announced twice
   *    before the write has landed — two screens mounting in one frame, or a
   *    screen remounting on a tab switch.
   *  - `seen` is the persisted half, written the moment a tour starts rather
   *    than when it finishes: walking away from one is not a reason to be
   *    ambushed by it tomorrow.
   *  - `done` is belt and braces; a finished tour is seen by definition.
   *
   * Replaying is a deliberate act from Settings, which calls `startTour`
   * directly and does not come through here.
   */
  const arrive = useCallback(
    (screen: string) => {
      if (!loaded || !userId) return;
      if (stateRef.current.tipsOff) return;
      if (tourId) return; // One at a time; the first one gets to finish.
      const candidate = tourFor(screen);
      if (!candidate) return;
      if (startedThisSession.current.has(candidate.id)) return;
      if (stateRef.current.seen.includes(candidate.id)) return;
      if (stateRef.current.done.includes(candidate.id)) return;
      startTour(candidate.id);
    },
    [loaded, startTour, tourId, userId],
  );

  const skip = useCallback(() => finish(false), [finish]);

  const turnTipsOff = useCallback(() => {
    finish(false);
    persist({ ...stateRef.current, tipsOff: true });
  }, [finish, persist]);

  /** "Show the tips again" — the one thing that undoes any of this, and it
   *  has to clear the session's own record too, or nothing would come back
   *  until the app was restarted. */
  const resetTours = useCallback(() => {
    const cleared = { seen: [], done: [], tipsOff: false };
    stateRef.current = cleared;
    startedThisSession.current.clear();
    persist(cleared);
  }, [persist]);

  const isDone = useCallback((id: TourId) => state.done.includes(id), [state.done]);

  const value = useMemo<TutorialContextValue>(
    () => ({
      tour,
      step,
      stepIndex,
      rect,
      tipsOff: state.tipsOff,
      isDone,
      arrive,
      startTour,
      notify,
      next,
      skip,
      turnTipsOff,
      resetTours,
      registerAnchor,
      unregisterAnchor,
      isAnchorLive,
      pushHost,
      popHost,
      topHost,
    }),
    [
      arrive,
      isAnchorLive,
      isDone,
      next,
      notify,
      popHost,
      pushHost,
      rect,
      registerAnchor,
      resetTours,
      skip,
      startTour,
      state.tipsOff,
      step,
      stepIndex,
      topHost,
      tour,
      turnTipsOff,
      unregisterAnchor,
    ],
  );

  return (
    <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>
  );
}

/**
 * The engine, or a set of no-ops.
 *
 * Screens call `notify` and `arrive` unconditionally, and some of them
 * render outside the provider (a modal presented from a route that mounts
 * its own tree, Dev Components rendering a component in isolation). A
 * missing provider must not throw there — the tutorial is the least
 * important thing on any screen it appears on.
 */
export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  return ctx ?? NOOP;
}

const NOOP: TutorialContextValue = {
  tour: null,
  step: null,
  stepIndex: 0,
  rect: null,
  tipsOff: false,
  isDone: () => false,
  arrive: () => {},
  startTour: () => {},
  notify: () => {},
  next: () => {},
  skip: () => {},
  turnTipsOff: () => {},
  resetTours: () => {},
  registerAnchor: () => {},
  unregisterAnchor: () => {},
  isAnchorLive: () => false,
  pushHost: () => {},
  popHost: () => {},
  topHost: "root",
};
