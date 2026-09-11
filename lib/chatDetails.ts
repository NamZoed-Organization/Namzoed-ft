/**
 * Everything a conversation has in it, other than the conversation.
 *
 * The chat screen holds one page of messages and streams the rest as you
 * scroll — fine for reading, useless for "where is that photo she sent in
 * May". These queries go at the pair's whole history instead, filtered by
 * kind, for `app/(users)/chat/details/[id].tsx`.
 *
 * The pair filter is the same `or(and(…),and(…))` the chat screen uses: a
 * conversation is not a row anywhere, it is two people's ids in either
 * order.
 */

import { isVideoUrl } from "./postsService";
import { supabase } from "./supabase";

/** The wrappers a message body can carry. Defined here because two screens
 *  now have to read past them — the chat renders them, and search and the
 *  link list have to show the sentence rather than the envelope. */
export const REPLY_META_PREFIX = "[reply-meta]";
export const REPLY_META_SUFFIX = "[/reply-meta]";
export const PRODUCT_META_PREFIX = "[product-meta]";
export const PRODUCT_META_SUFFIX = "[/product-meta]";

/** A message body with its metadata envelopes removed — what was typed. */
export const stripMessageMeta = (raw?: string | null): string => {
  let content = typeof raw === "string" ? raw : "";
  const strip = (prefix: string, suffix: string): boolean => {
    if (!content.startsWith(prefix)) return false;
    const end = content.indexOf(suffix);
    if (end < 0) return false;
    content = content.slice(end + suffix.length).replace(/^\n/, "");
    return true;
  };
  // Either wrapper, either order, up to three deep — the same bound the chat
  // screen's own parser uses.
  for (let i = 0; i < 3; i++) {
    if (strip(PRODUCT_META_PREFIX, PRODUCT_META_SUFFIX)) continue;
    if (strip(REPLY_META_PREFIX, REPLY_META_SUFFIX)) continue;
    break;
  }
  return content;
};

/** Deliberately conservative: a bare "www." or a trailing bracket dragged
 *  into a URL makes a link that opens nothing, which is worse than a link
 *  this misses. */
const URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/gi;

export const extractUrls = (text?: string | null): string[] => {
  if (!text) return [];
  return (text.match(URL_PATTERN) ?? []).map((u) => u.replace(/[.,;:!?]+$/, ""));
};

export type ChatMediaItem = {
  id: string;
  url: string;
  kind: "image" | "video" | "gif";
  createdAt: string;
  mine: boolean;
};

export type ChatLinkItem = {
  id: string;
  url: string;
  /** The sentence it arrived in, so a bare link has context. */
  text: string;
  createdAt: string;
  mine: boolean;
};

export type ChatVoiceItem = {
  id: string;
  url: string;
  durationSeconds: number;
  createdAt: string;
  mine: boolean;
};

export type ChatSearchHit = {
  id: string;
  text: string;
  createdAt: string;
  mine: boolean;
};

/** Newest first everywhere: what you are looking for in a long conversation
 *  is far more often recent than ancient. */
const ORDER = { column: "created_at", ascending: false } as const;

const pairFilter = (me: string, them: string) =>
  `and(sender_id.eq.${me},receiver_id.eq.${them}),and(sender_id.eq.${them},receiver_id.eq.${me})`;

const gifUrl = (content?: string | null): string | null => {
  if (!content) return null;
  try {
    const payload = JSON.parse(content);
    const url = payload?.url ?? payload?.uri;
    return typeof url === "string" && url ? url : null;
  } catch {
    return null;
  }
};

/**
 * Everything with a picture in it, both directions.
 *
 * Two things were wrong here and they compounded. It selected and filtered
 * on `messages.video_url`, **a column that does not exist** — chat has never
 * had one. PostgREST answered the whole query with 42703, the throw landed
 * in the screen's catch, and the tab said "No images or videos" to everyone,
 * about every conversation, whoever had sent them. It read as a filter bug
 * ("it must only show theirs") and was a dead query.
 *
 * And it only ever looked at `image_url`. A chat message carries its first
 * picture there and *all* of them in `image_urls`
 * (supabase/migrations/add_chat_image_groups.sql), so once the query ran,
 * sending four pictures would still have produced one tile.
 *
 * Video is not a column either: chat sends video through the same fields and
 * it is told apart by the file extension, exactly as the message bubbles do
 * it (`isVideoUrl`). One rule for what a URL is, in one place.
 */
export const fetchChatMedia = async (
  me: string,
  them: string,
  limit = 300,
): Promise<ChatMediaItem[]> => {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, image_url, image_urls, message_type, content, created_at")
    .or(pairFilter(me, them))
    // Two chained .or() calls are AND-ed by PostgREST — the pair, and then
    // the kind — which is the intended reading and is what it does.
    .or("image_url.not.is.null,image_urls.not.is.null,message_type.in.(gif,sticker)")
    .order(ORDER.column, { ascending: ORDER.ascending })
    .limit(limit);
  if (error) throw error;

  const items: ChatMediaItem[] = [];
  for (const row of data ?? []) {
    const mine = String((row as any).sender_id) === String(me);
    const createdAt = String((row as any).created_at);
    const id = String((row as any).id);

    // Every picture in the message, oldest rows included: they predate
    // `image_urls` and carry only the single `image_url`.
    const urls: string[] = Array.isArray((row as any).image_urls)
      ? (row as any).image_urls.filter(Boolean)
      : [];
    const all = urls.length > 0 ? urls : [(row as any).image_url].filter(Boolean);

    if (all.length > 0) {
      all.forEach((url: string, i: number) => {
        items.push({
          // One message of four pictures is four tiles, so the id has to
          // distinguish them or the grid renders one and drops three.
          id: all.length > 1 ? `${id}-${i}` : id,
          url,
          kind: isVideoUrl(url) ? "video" : "image",
          createdAt,
          mine,
        });
      });
      continue;
    }

    const url = gifUrl((row as any).content);
    if (url) items.push({ id, url, kind: "gif", createdAt, mine });
  }
  return items;
};

export const fetchChatVoice = async (
  me: string,
  them: string,
  limit = 200,
): Promise<ChatVoiceItem[]> => {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, audio_url, audio_duration, created_at")
    .or(pairFilter(me, them))
    .not("audio_url", "is", null)
    .order(ORDER.column, { ascending: ORDER.ascending })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    url: String(row.audio_url),
    durationSeconds: Number(row.audio_duration ?? 0),
    createdAt: String(row.created_at),
    mine: String(row.sender_id) === String(me),
  }));
};

/**
 * Links are found in the text, not stored as their own kind — so this pulls
 * the messages that contain "http" and pulls the URLs out of them. One
 * message with three links is three rows: you are looking for a link, not
 * for the message that happened to carry it.
 */
export const fetchChatLinks = async (
  me: string,
  them: string,
  limit = 300,
): Promise<ChatLinkItem[]> => {
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, content, created_at")
    .or(pairFilter(me, them))
    .ilike("content", "%http%")
    .order(ORDER.column, { ascending: ORDER.ascending })
    .limit(limit);
  if (error) throw error;

  const items: ChatLinkItem[] = [];
  for (const row of data ?? []) {
    const text = stripMessageMeta((row as any).content).trim();
    for (const [i, url] of extractUrls(text).entries()) {
      items.push({
        id: `${(row as any).id}-${i}`,
        url,
        text,
        createdAt: String((row as any).created_at),
        mine: String((row as any).sender_id) === String(me),
      });
    }
  }
  return items;
};

/**
 * Search the whole conversation, not the page that happens to be loaded.
 *
 * Matched server-side against the raw body, which can also hit text inside a
 * shared card's metadata — a false positive that still shows the message it
 * was found in, which is the answer somebody searching wanted anyway.
 */
export const searchChatMessages = async (
  me: string,
  them: string,
  query: string,
  limit = 60,
): Promise<ChatSearchHit[]> => {
  const term = query.trim();
  if (!term) return [];
  // % and _ are wildcards in ilike; a search for "50%" must not match
  // everything.
  const escaped = term.replace(/[%_\\]/g, (c) => `\\${c}`);
  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_id, content, created_at")
    .or(pairFilter(me, them))
    .ilike("content", `%${escaped}%`)
    .order(ORDER.column, { ascending: ORDER.ascending })
    .limit(limit);
  if (error) throw error;

  return (data ?? [])
    .map((row: any) => ({
      id: String(row.id),
      text: stripMessageMeta(row.content).trim(),
      createdAt: String(row.created_at),
      mine: String(row.sender_id) === String(me),
    }))
    .filter((hit) => hit.text.length > 0);
};
