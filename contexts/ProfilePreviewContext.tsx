/**
 * ProfilePreviewContext
 *
 * The preview expands *inside* the avatar (see ProfilePreviewTrigger), so
 * there is no host and no shared card. This does three small things none of
 * which the trigger can do alone:
 *
 *  1. keeps one island open at a time, which matters when two avatars sit
 *     close enough together for a second hold to land before the first has
 *     closed;
 *  2. publishes *whose* preview is open, so the row containing that avatar
 *     can raise itself while it is;
 *  3. owns the dismiss. The card stays up after the finger lifts, so
 *     something has to catch the next tap anywhere on screen — and an avatar
 *     buried in a comment row can't.
 *
 * (2) exists because zIndex only orders siblings. An island can out-stack
 * everything inside its own row on its own, but not a Follow pill that is its
 * uncle, or the next row in a list — those are ordered by ancestors that have
 * to raise themselves. `useProfilePreviewElevation` is how they do it.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, StyleSheet } from "react-native";

interface OpenPreview {
  /** Unique per trigger, so duplicates of the same user don't fight. */
  key: string;
  userId: string;
}

interface ProfilePreviewContextValue {
  open: OpenPreview | null;
  setOpen: (next: OpenPreview) => void;
  close: () => void;
}

const ProfilePreviewContext = createContext<ProfilePreviewContextValue | null>(null);

export function ProfilePreviewProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState<OpenPreview | null>(null);

  const setOpen = useCallback((next: OpenPreview) => setOpenState(next), []);
  const close = useCallback(() => setOpenState(null), []);

  // Android's back button is a dismiss like any other.
  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setOpenState(null);
      return true;
    });
    return () => sub.remove();
  }, [open]);

  const value = useMemo(() => ({ open, setOpen, close }), [open, setOpen, close]);

  return (
    <ProfilePreviewContext.Provider value={value}>
      {children}
      {/* The dismiss catcher. Deliberately transparent rather than a dim: the
          card is embedded in its own row, which sits BELOW this, so a scrim
          would fall over the card as well as everything else. It only exists
          while something is open, so it blocks nothing the rest of the time.

          It also swallows the tap that dismisses, which is right — the first
          tap after a peek should put the card away, not also open whatever it
          landed on. */}
      {open ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      ) : null}
    </ProfilePreviewContext.Provider>
  );
}

/** Null when there's no provider above — a trigger rendered outside the app
 *  shell simply renders its avatar and does nothing on hold. */
export function useOptionalProfilePreview() {
  return useContext(ProfilePreviewContext);
}

/**
 * Style for a container that has to rise above its siblings while the preview
 * of `userId` is open — the comment row, the post's author row, a seller row.
 * Spread it onto that container's style; it's null the rest of the time, so
 * paint order is untouched when nothing is open.
 */
/**
 * Style for a container that has to sit above its siblings so a preview
 * expanding inside it isn't painted under them — a post's author row against
 * its Follow pill, a seller row against the header's buttons.
 *
 * **Static on purpose.** The obvious version returns this only while that
 * user's preview is open, and it does not work: changing `zIndex` reorders
 * native subviews, reordering cancels every touch inside that subtree, and
 * the touch inside that subtree is the hold that opened the preview. It
 * cancels itself. Since the island is collapsed and overlaps nothing at rest,
 * being permanently above its siblings costs nothing and is stable.
 */
export const PROFILE_PREVIEW_ELEVATION = { zIndex: 1 } as const;

export function useProfilePreviewElevation(_userId?: string | null) {
  return PROFILE_PREVIEW_ELEVATION;
}

/** The same, shaped for a list where it's applied per row. */
export function useProfilePreviewElevator() {
  return useCallback((_userId?: string | null) => PROFILE_PREVIEW_ELEVATION, []);
}
