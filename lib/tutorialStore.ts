/**
 * What the app remembers about the tours: which are finished, and whether
 * the user has told it to stop offering them at all.
 *
 * Per account, because a shared phone is normal here and a second person
 * signing in has not been shown anything. Kept in `AsyncStorage` rather
 * than on the server: it is a preference about this device's UI, and a
 * round trip in front of a tooltip is worse than showing it twice.
 *
 * "Seen" is written the moment a tour *starts*, not when it ends. A tour
 * you began and walked away from has done its job — the alternative is a
 * tutorial that ambushes you again on every visit until you sit through it.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type { TourId } from "./tutorialTours";

const KEY = "nmz_tours_v1";

export interface TutorialState {
  /** Tours already offered, whether or not they were finished. */
  seen: TourId[];
  /** Tours run all the way to the last step. */
  done: TourId[];
  /** "Don't show me these" — nothing auto-starts again. Replays still work. */
  tipsOff: boolean;
}

const EMPTY: TutorialState = { seen: [], done: [], tipsOff: false };

const keyFor = (userId: string | null | undefined) =>
  `${KEY}:${userId || "anon"}`;

export const readTutorialState = async (
  userId: string | null | undefined,
): Promise<TutorialState> => {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<TutorialState>;
    return {
      seen: parsed.seen ?? [],
      done: parsed.done ?? [],
      tipsOff: !!parsed.tipsOff,
    };
  } catch {
    // An unreadable preference is not a reason to fail a screen; it just
    // means the tips get offered again.
    return EMPTY;
  }
};

export const writeTutorialState = async (
  userId: string | null | undefined,
  state: TutorialState,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(state));
  } catch {
    // Nothing to do — worst case the tour is offered once more.
  }
};
