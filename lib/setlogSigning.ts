/**
 * Signed URLs for Setlog clips.
 *
 * Split out of `setlogService` to break a require cycle, not because
 * signing wanted a module of its own. `setlogMediaCache` needs a signer —
 * a cached clip plays from disk, an uncached one needs a URL — and
 * `setlogService` needs the cache, so the two imported each other. Metro
 * allows that and warns about it, and the warning is worth taking
 * seriously even when the cycle happens to be safe: the safety rested on
 * every reference sitting inside a function body, which is a property
 * nobody can see from the import line and the next edit quietly breaks.
 *
 * This is the piece both sides actually share, so it is the piece that
 * moves. Dependencies now run one way — mediaCache → signing, service →
 * signing — and neither of the two big modules imports the other at
 * runtime. `setlogService` still re-exports `signClips`, so nothing that
 * imported it from there has to change.
 *
 * It deliberately takes `{ storagePath }` rather than a `SetlogClip`: the
 * only thing signing needs from a clip is where the bytes are, and typing
 * it that way is what keeps this module from importing the service back
 * and rebuilding the cycle in type form.
 */

import { readCache, writeCache } from "./queryCache";
import { supabase } from "./supabase";

export const CLIP_BUCKET = "setlog-clips";

/**
 * How long a signed clip URL stays good.
 *
 * A week, not an hour — and the reason is the video cache, not patience.
 * `expo-video` keys its cache on the source URI, so a URL that rotates
 * hourly makes the same clip a new cache entry every hour: the bytes are
 * paid for again and again, and the 512MB budget set in `app/_layout.tsx`
 * fills with duplicates of a handful of clips. A stable URL is what makes
 * that cache work at all.
 *
 * The cost is that a leaked link stays good for a week rather than an
 * hour. For a closed group's own clips that is the right trade; it is not
 * one to copy for anything more sensitive.
 */
export const SIGNED_URL_TTL_S = 60 * 60 * 24 * 7;

/** Re-signed this long before expiry, so a URL never dies mid-scroll. */
export const SIGNED_URL_REFRESH_MARGIN_MS = 60 * 60 * 1000;

interface SignedUrlEntry {
  url: string;
  expiresAt: number;
}

const URL_CACHE_KEY = "setlog:signed-urls";
let urlCache: Record<string, SignedUrlEntry> | null = null;

const loadUrlCache = async (): Promise<Record<string, SignedUrlEntry>> => {
  if (urlCache) return urlCache;
  const cached = await readCache<Record<string, SignedUrlEntry>>(URL_CACHE_KEY);
  urlCache = cached?.data ?? {};
  return urlCache;
};

/**
 * Playable URLs for a set of clips. The bucket is private, so this is the
 * only way a clip is ever watched; the map is keyed by storage path because
 * that is what a clip row carries.
 *
 * Cached, because a stable URL is the whole point (see the TTL above) and
 * because re-signing a day you already have is a round trip for nothing.
 * Only the paths that are missing or close to expiry are sent, and they go
 * in one batch — `createSignedUrls`, never one call per clip.
 */
export const signClips = async (
  clips: { storagePath: string }[],
): Promise<Record<string, string>> => {
  if (clips.length === 0) return {};

  const cache = await loadUrlCache();
  const now = Date.now();
  const out: Record<string, string> = {};
  const missing: string[] = [];

  for (const clip of clips) {
    const entry = cache[clip.storagePath];
    if (entry && entry.expiresAt - now > SIGNED_URL_REFRESH_MARGIN_MS) {
      out[clip.storagePath] = entry.url;
    } else {
      missing.push(clip.storagePath);
    }
  }

  if (missing.length > 0) {
    const { data, error } = await supabase.storage
      .from(CLIP_BUCKET)
      .createSignedUrls(missing, SIGNED_URL_TTL_S);
    if (error) throw error;

    const expiresAt = now + SIGNED_URL_TTL_S * 1000;
    for (const row of data ?? []) {
      if (row.signedUrl && row.path) {
        out[row.path] = row.signedUrl;
        cache[row.path] = { url: row.signedUrl, expiresAt };
      }
    }
    // Entries for clips nobody asks about any more are dropped on the way
    // out, so this never becomes an ever-growing blob in AsyncStorage.
    for (const [path, entry] of Object.entries(cache)) {
      if (entry.expiresAt <= now) delete cache[path];
    }
    await writeCache(URL_CACHE_KEY, cache);
  }

  return out;
};
