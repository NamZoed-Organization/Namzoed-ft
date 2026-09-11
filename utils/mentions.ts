/**
 * Mentions.
 *
 * Stored as `@[Display Name](uuid)` and rendered as just the name, bold and
 * tappable. The `@` is how you *write* one, not what a mention looks like —
 * once somebody has been picked out of a list, the symbol has done its job
 * and leaving it in makes the sentence read like a machine wrote it.
 *
 * The id travels with the name because a name is not an identity: two
 * people share one, and anybody can change theirs. The link has to keep
 * working after both.
 *
 * The name is stored alongside rather than looked up per render — a comment
 * list would otherwise need a query per author mentioned, and the stored
 * copy is what the writer actually saw when they chose it.
 */

/** `g` only — build a fresh RegExp per use, since `lastIndex` is stateful. */
const mentionPattern = () =>
  /@\[([^\]]{1,60})\]\(([0-9a-fA-F-]{36})\)/g;

/**
 * What is being typed after an `@`, if the cursor is inside one.
 *
 * Deliberately narrow: it stops at whitespace, so "@" alone opens the list
 * and a space closes it, and it refuses to fire inside an already-inserted
 * mention — otherwise finishing one would immediately start another.
 */
export function findActiveMentionQuery(
  text: string,
  cursor: number,
): { query: string; start: number } | null {
  const upToCursor = text.slice(0, cursor);
  const at = upToCursor.lastIndexOf("@");
  if (at === -1) return null;

  // Inside a completed mention's own markup, `@` is punctuation.
  const pattern = mentionPattern();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (at >= match.index && at < match.index + match[0].length) return null;
  }

  // An `@` glued to the end of a word is an email or a handle, not a
  // mention being started.
  const before = at > 0 ? upToCursor[at - 1] : " ";
  if (!/\s|[([]/.test(before)) return null;

  const query = upToCursor.slice(at + 1);
  if (/\s/.test(query)) return null;
  if (query.length > 40) return null;

  return { query, start: at };
}

/** A person picked out of the list, as the composer remembers them. */
export interface PickedMention {
  id: string;
  /** Exactly what was written into the field. */
  name: string;
}

/** The name as it is written into a field and stored: the brackets and
 *  parentheses are the storage format's own punctuation, so a name
 *  containing them could not survive a round trip. */
export const mentionDisplayName = (name: string) =>
  name.replace(/[[\]()]/g, "").trim() || "Someone";

/**
 * Replace the `@query` the cursor is in with the person's **name**.
 *
 * The field shows what the comment will say, not how it is stored: seeing
 * `@[Karma Dorji](8f3c…)` sitting in the input is the storage format leaking
 * into the one place the writer is looking, and it made a finished mention
 * read like a mistake. The markup is rebuilt from the picked names on the
 * way out — see `toStorageText`.
 */
export function applyMention(
  text: string,
  active: { query: string; start: number },
  user: { id: string; name: string },
): { text: string; cursor: number } {
  const name = mentionDisplayName(user.name);
  const before = text.slice(0, active.start);

  // The whole word goes, not just the part left of the caret. Somebody who
  // types "@karma", moves back into the middle of it and then picks a name
  // should not be left holding the tail of what they typed.
  const rest = text.slice(active.start + 1 + active.query.length);
  const trailing = rest.match(/^\S*/)?.[0].length ?? 0;
  const after = rest.slice(trailing);
  // A trailing space, because the next thing typed is almost never
  // punctuation glued to a name.
  const spaced = after.startsWith(" ") ? after : ` ${after}`;
  return {
    text: `${before}${name}${spaced}`,
    cursor: before.length + name.length + 1,
  };
}

/**
 * Turn what the field shows back into what gets stored.
 *
 * Each pick is one instance: two mentions of the same person are two entries
 * and become two links, in the order they were made. Longest names first, so
 * "Karma Dorji" is matched before a "Karma" picked later in the same
 * sentence takes half of it.
 *
 * A name the writer has since edited no longer matches and is left as plain
 * text — the only alternative is guessing which edit still meant that
 * person, and a mention that quietly points at somebody else is far worse
 * than one that quietly stops being a link.
 */
export function toStorageText(
  display: string,
  picked: PickedMention[],
): string {
  if (picked.length === 0) return display;

  // Ranges are claimed against the *original* text and the output is built
  // once at the end. Rewriting the string as it goes is the obvious version
  // and it is wrong: after "Karma Dorji" becomes `@[Karma Dorji](…)`, a
  // shorter "Karma" picked later matches inside the markup that was just
  // written, and nests one mention inside another.
  const claims: { start: number; end: number; mention: PickedMention }[] = [];
  const order = [...picked].sort((a, b) => b.name.length - a.name.length);

  for (const mention of order) {
    if (!mention.name) continue;
    let from = 0;
    for (;;) {
      const at = display.indexOf(mention.name, from);
      if (at === -1) break;
      const end = at + mention.name.length;
      // Only a whole word: "Karma" inside "Karmarkar" is not a mention.
      const before = at > 0 ? display[at - 1] : " ";
      const after = end < display.length ? display[end] : " ";
      const wholeWord = !/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after);
      const overlaps = claims.some((c) => at < c.end && end > c.start);
      if (wholeWord && !overlaps) {
        claims.push({ start: at, end, mention });
        break;
      }
      from = at + 1;
    }
  }

  if (claims.length === 0) return display;

  claims.sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const claim of claims) {
    out +=
      display.slice(cursor, claim.start) +
      `@[${claim.mention.name}](${claim.mention.id})`;
    cursor = claim.end;
  }
  return out + display.slice(cursor);
}

export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; userId: string };

/** Split stored text into plain runs and mentions, in order. */
export function splitByMentions(
  text: string | null | undefined,
): MentionSegment[] {
  if (!text) return [];
  const segments: MentionSegment[] = [];
  const pattern = mentionPattern();
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "mention", value: match[1], userId: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }
  return segments;
}

/** Every distinct person mentioned, in first-seen order. */
export function extractMentionIds(text: string | null | undefined): string[] {
  if (!text) return [];
  const ids: string[] = [];
  const pattern = mentionPattern();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (!ids.includes(match[2])) ids.push(match[2]);
  }
  return ids;
}

/**
 * The text as a person reads it — markup resolved to plain names.
 *
 * For anywhere a mention cannot be tapped: a notification body, a push, a
 * preview line. Showing `@[Karma](8f3c…)` in a notification would be the
 * storage format leaking into somebody's lock screen.
 */
export function plainMentionText(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(mentionPattern(), (_, name) => name);
}
