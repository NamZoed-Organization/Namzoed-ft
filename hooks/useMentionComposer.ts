/**
 * The `@` half of a comment composer.
 *
 * Both comment surfaces need it — `CommentsModal` (the feed's sheet) and
 * `InlineComments` (a post opened in detail, and product reviews) — and only
 * one of them ever had it, which is why typing `@` under an open post did
 * nothing at all. One hook rather than a second copy: the two composers sit
 * behind the same comment button on the same post, and a mention picker that
 * exists in one of them is a bug report waiting to happen.
 *
 * **The caret is tracked here, not by the TextInput.** "Which `@` am I
 * inside" is a question about the cursor, and the cursor after a keystroke
 * is not the cursor `onSelectionChange` last reported — that event lands
 * *after* `onChangeText`, so a picker that waits for it is looking at the
 * text with the caret from before the character that opened it, and decides
 * there is no `@` being typed. So the caret is advanced by the length of the
 * change as the change happens, and `onSelectionChange` only corrects it
 * when the user moves the caret themselves.
 *
 * **The field shows the name, not the markup.** Picking somebody writes
 * "Karma Dorji" into the input — `@[Karma Dorji](8f3c…)` sitting in the one
 * place the writer is looking is the storage format leaking out, and it made
 * a finished mention read like something had gone wrong. The composer
 * remembers who was picked and `toStorage()` rebuilds the links on the way
 * out, so nothing about how a mention is stored or notified changes.
 *
 * The TextInput is left **uncontrolled** for selection except for the one
 * frame after a name is inserted. A permanently controlled `selection` fights
 * the native caret on both platforms — the cursor snaps back a character
 * mid-word while typing quickly — and the only moment this needs to move the
 * caret is when it has just rewritten the text underneath it.
 */

import {
  loadMentionGraph,
  searchMentionCandidates,
  type MentionCandidate,
  type MentionGraph,
} from "@/lib/mentionService";
import {
  applyMention,
  findActiveMentionQuery,
  mentionDisplayName,
  toStorageText,
  type PickedMention,
} from "@/utils/mentions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from "react-native";

/** Long enough that a fast typist sends one query per word, short enough
 *  that stopping to look at the list never feels like waiting. */
const SEARCH_DEBOUNCE_MS = 180;

export function useMentionComposer({
  userId,
  /** False while the composer is closed — no graph fetch, no queries. */
  enabled = true,
}: {
  userId?: string | null;
  enabled?: boolean;
}) {
  const [text, setTextState] = useState("");
  const [caret, setCaret] = useState(0);
  /** Set for exactly one render after a mention is inserted; see the header. */
  const [forcedSelection, setForcedSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [graph, setGraph] = useState<MentionGraph>({
    following: new Set<string>(),
    followers: new Set<string>(),
  });
  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  /** Who has been picked, in the order they were picked — one entry per
   *  insertion, so mentioning the same person twice makes two links. */
  const pickedRef = useRef<PickedMention[]>([]);

  const textRef = useRef(text);
  textRef.current = text;
  const caretRef = useRef(caret);
  caretRef.current = caret;

  // Read once per composer session: the follow graph does not change between
  // keystrokes, and re-fetching it per letter is three round trips a
  // character.
  useEffect(() => {
    if (!enabled || !userId) return;
    let alive = true;
    loadMentionGraph(userId).then((g) => {
      if (alive) setGraph(g);
    });
    return () => {
      alive = false;
    };
  }, [enabled, userId]);

  const onChangeText = useCallback((next: string) => {
    // Where the caret must now be: wherever it was, moved by the size of the
    // edit. Right for typing, pasting and deleting alike, which is every way
    // an `@` can arrive.
    const delta = next.length - textRef.current.length;
    const nextCaret = Math.max(0, Math.min(next.length, caretRef.current + delta));
    textRef.current = next;
    caretRef.current = nextCaret;
    setTextState(next);
    setCaret(nextCaret);
  }, []);

  const onSelectionChange = useCallback(
    (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
      const { start } = e.nativeEvent.selection;
      caretRef.current = start;
      setCaret(start);
      setForcedSelection(null);
    },
    [],
  );

  /** Set the field's contents from outside (a draft, a cleared composer). */
  const setText = useCallback((next: string) => {
    textRef.current = next;
    caretRef.current = next.length;
    setTextState(next);
    setCaret(next.length);
  }, []);

  const reset = useCallback(() => {
    setText("");
    setCandidates([]);
    setLoading(false);
    pickedRef.current = [];
  }, [setText]);

  /**
   * What to actually send: the field's text with each picked name turned
   * back into `@[Name](id)`. Call this at submit, never the raw `text`.
   */
  const toStorage = useCallback(
    () => toStorageText(textRef.current, pickedRef.current),
    [],
  );

  const activeMention = useMemo(
    () => (enabled ? findActiveMentionQuery(text, caret) : null),
    [enabled, text, caret],
  );

  useEffect(() => {
    if (!activeMention) {
      setCandidates([]);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchMentionCandidates(activeMention.query, graph, userId)
        .then((found) => {
          if (alive) setCandidates(found);
        })
        .catch(() => {
          if (alive) setCandidates([]);
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [activeMention, graph, userId]);

  const pickMention = useCallback(
    (candidate: MentionCandidate) => {
      if (!activeMention) return;
      pickedRef.current = [
        ...pickedRef.current,
        { id: candidate.id, name: mentionDisplayName(candidate.name) },
      ];
      const next = applyMention(textRef.current, activeMention, candidate);
      textRef.current = next.text;
      caretRef.current = next.cursor;
      setTextState(next.text);
      setCaret(next.cursor);
      setCandidates([]);
      // The caret has to land after the name, or the next keystroke reopens
      // the list from inside the mention that was just finished. This is the
      // one moment the field's selection is driven from here.
      setForcedSelection({ start: next.cursor, end: next.cursor });
    },
    [activeMention],
  );

  /** Spread onto the composer's `TextInput`. */
  const inputProps = {
    value: text,
    onChangeText,
    onSelectionChange,
    ...(forcedSelection ? { selection: forcedSelection } : null),
  };

  return {
    text,
    setText,
    reset,
    toStorage,
    inputProps,
    activeMention,
    candidates,
    loading,
    pickMention,
  };
}
