/**
 * Hashtag parsing.
 *
 * The character class is deliberate rather than `\p{L}`: Hermes' unicode
 * property escapes aren't something to rely on across the RN versions this
 * app ships to, and the app's audience writes in Dzongkha as well as
 * English — so Latin, digits, underscore and the Tibetan block (U+0F00–
 * U+0FFF, which Dzongkha uses) are matched explicitly.
 */

const HASHTAG_BODY = "[A-Za-z0-9_\\u0F00-\\u0FFF]{2,50}";
/** `g` only — build a fresh RegExp per use, since `lastIndex` is stateful. */
const hashtagPattern = () => new RegExp(`#(${HASHTAG_BODY})`, "g");

export const TERM_MIN_LENGTH = 2;
export const TERM_MAX_LENGTH = 50;

/**
 * The one place a term's storage form is decided — lower-cased, trimmed,
 * inner whitespace collapsed, no leading '#'. Everything written to
 * search_signals goes through here so "Hiking", "#hiking" and " hiking "
 * are one trend rather than three.
 *
 * Returns null for anything too short or too long to be worth counting.
 */
export function normalizeTerm(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const term = raw
    .trim()
    .replace(/^#+/, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (term.length < TERM_MIN_LENGTH || term.length > TERM_MAX_LENGTH) {
    return null;
  }
  return term;
}

/** Every distinct hashtag in a body of text, normalised, in first-seen order. */
export function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const found: string[] = [];
  const seen = new Set<string>();
  const pattern = hashtagPattern();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const term = normalizeTerm(match[1]);
    if (term && !seen.has(term)) {
      seen.add(term);
      found.push(term);
    }
  }
  return found;
}

export type TextSegment =
  | { type: "text"; value: string }
  | { type: "hashtag"; value: string; term: string };

/**
 * Splits text into plain runs and hashtags for rendering. `value` keeps the
 * text exactly as the author wrote it (including the '#' and their casing);
 * `term` is the normalised form to search on.
 */
export function splitByHashtags(text: string | null | undefined): TextSegment[] {
  if (!text) return [];
  const segments: TextSegment[] = [];
  const pattern = hashtagPattern();
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const term = normalizeTerm(match[1]);
    if (!term) continue;
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "hashtag", value: match[0], term });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}
