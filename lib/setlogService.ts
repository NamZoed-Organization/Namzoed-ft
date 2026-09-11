/**
 * Setlog — closed-group hourly mini-vlogs.
 *
 * A "log" is a room a small group shares. Every hour a prompt fires, each
 * member records one ~2s clip, and the hour's clips sit side by side. The
 * schema and the reasoning behind it are in
 * `supabase/migrations/create_setlog.sql`.
 *
 * Three rules this module exists to keep in one place:
 *  - A slot is a *local* (day, hour) pair, never a timestamp. "3pm" has to
 *    mean 3pm to everyone in the log, including the member who is abroad.
 *  - The clip cap is the feature, not a setting. `SETLOG_CLIP_MS` is the
 *    only place it is written down.
 *  - Clips live in a private bucket, so every read goes through a signed
 *    URL. Nothing here ever returns a permanent link.
 */

import { resolveClipUrls, warmClips } from "./setlogMediaCache";
import { CLIP_BUCKET } from "./setlogSigning";
import { formatClockTime, formatHourLabel } from "./timeFormat";
import { supabase } from "./supabase";
import { invalidateCache, peekCache, readCache, writeCache } from "./queryCache";
import { File } from "expo-file-system";

/**
 * How a clip was captured.
 *
 * `ms` is the length the shutter records for; every mode stops itself, so
 * there is no free-running record button anywhere in Setlog. `rate` is
 * *playback* speed, never capture speed — nothing re-encodes on the device,
 * so a timelapse is thirty real seconds played back six times fast, which
 * is what a timelapse looks like arrived at from the other end.
 *
 * `native` is the odd one out: it means "whatever the system camera
 * produced", and only rows written while capture briefly went through the
 * system camera carry it. Nothing writes it now.
 */
export const CAPTURE_MODES = {
  photo: { label: "Photo", short: "Photo", ms: 0, rate: 1 },
  "2s": { label: "2 seconds", short: "2s", ms: 2000, rate: 1 },
  "5s": { label: "5 seconds", short: "5s", ms: 5000, rate: 1 },
  jumpcut: { label: "Jumpcut", short: "10s", ms: 10000, rate: 2 },
  timelapse: { label: "Timelapse", short: "30s", ms: 30000, rate: 6 },
  native: { label: "Video", short: "Video", ms: 0, rate: 1 },
} as const;

export type CaptureMode = keyof typeof CAPTURE_MODES;

/** The order the one mode button cycles through. `native` is not in it:
 *  it is a record of the past, not a thing you can choose. */
export const CAPTURE_MODE_ORDER: CaptureMode[] = [
  "2s",
  "5s",
  "jumpcut",
  "timelapse",
  "photo",
];
export const DEFAULT_CAPTURE_MODE: CaptureMode = "2s";

/** The default mode's length. Kept as its own name because the two-second
 *  clip is still what the product is about. */
export const SETLOG_CLIP_MS = CAPTURE_MODES[DEFAULT_CAPTURE_MODE].ms;

export type VideoQuality = "480p" | "720p" | "1080p";
export const VIDEO_QUALITIES: VideoQuality[] = ["480p", "720p", "1080p"];
export const DEFAULT_VIDEO_QUALITY: VideoQuality = "720p";

// ── Types ───────────────────────────────────────────────────────────────

export interface SetlogMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: "owner" | "member";
}

export interface Setlog {
  /** Null for a log nobody named — see `setlogDisplayName`. */
  name: string | null;
  id: string;
  ownerId: string;
  inviteCode: string;
  memberCap: number;
  /** The log that is simply yours, created on your first recording. */
  isPersonal: boolean;
  createdAt: string;
}

/** What to print for a log that was never named. Naming is optional now, so
 *  every surface needs the same fallback rather than its own. */
export const setlogDisplayName = (log: {
  name: string | null;
  isPersonal: boolean;
}): string =>
  log.name?.trim() || (log.isPersonal ? "Your log" : "Untitled log");

/** One recording: the row, not the file. `storagePath` is where the bytes
 *  are; the URL is signed on read and never stored (see SIGNED_URL_TTL_S). */
export interface SetlogClip {
  id: string;
  setlogId: string;
  userId: string;
  day: string;
  slotHour: number;
  storagePath: string;
  durationMs: number;
  isLate: boolean;
  /** Written over the video after recording, never before. Kept as text
   *  rather than burned into the pixels — see the second migration. */
  title: string | null;
  mediaType: "video" | "photo";
  captureMode: CaptureMode;
  /** What the recorder asked for, not a guarantee about the file — see the
   *  third migration. */
  videoQuality: VideoQuality | null;
  createdAt: string;
}

/** One hour of one log: who recorded, who didn't. Whether the hour is the
 *  open one is deliberately not on here — the screen owns the clock and
 *  passes it down, so there is no second copy of "now" to disagree with. */
export interface SetlogSlot {
  hour: number;
  clips: SetlogClip[];
}

export interface Slot {
  day: string;
  hour: number;
}

// ── Slots ───────────────────────────────────────────────────────────────

/** Local calendar day as `YYYY-MM-DD`. `toISOString()` is UTC, so a clip
 *  recorded at 11pm in Thimphu would file itself under tomorrow. */
export const localDay = (d: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const currentSlot = (d: Date = new Date()): Slot => ({
  day: localDay(d),
  hour: d.getHours(),
});

/** "3:47pm" — the clock as it reads on the capture screen, where the exact
 *  minute is the thing being recorded. Slots are still hours; this is what
 *  a person sees, not what a clip is filed under. */
export const formatClock = (d: Date = new Date()): string => formatClockTime(d);

/** "3pm", "12am" — the hour as a person says it, not as a clock prints it. */
export const formatHour = (hour: number): string => formatHourLabel(hour);

// ── Identity ────────────────────────────────────────────────────────────

/** Every policy in the schema is written against `auth.uid()`, so the id a
 *  screen passes in is never trusted for a write. */
export const resolveUserId = async (
  fallback?: string | null,
): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? fallback ?? null;
};

// ── Reads ───────────────────────────────────────────────────────────────

const rowToSetlog = (r: any): Setlog => ({
  id: String(r.id),
  name: r.name == null ? null : String(r.name),
  ownerId: String(r.owner_id),
  inviteCode: String(r.invite_code),
  memberCap: Number(r.member_cap),
  isPersonal: Boolean(r.is_personal),
  createdAt: String(r.created_at),
});

const rowToClip = (r: any): SetlogClip => ({
  id: String(r.id),
  setlogId: String(r.setlog_id),
  userId: String(r.user_id),
  day: String(r.day),
  slotHour: Number(r.slot_hour),
  storagePath: String(r.storage_path),
  durationMs: Number(r.duration_ms),
  isLate: Boolean(r.is_late),
  title: r.title == null ? null : String(r.title),
  mediaType: r.media_type === "photo" ? "photo" : "video",
  captureMode: (r.capture_mode ?? "2s") as CaptureMode,
  videoQuality: (r.video_quality ?? null) as VideoQuality | null,
  createdAt: String(r.created_at),
});

/**
 * Names and faces for a set of user ids.
 *
 * A separate query rather than a PostgREST embed: every table here has its
 * `user_id` foreign key on `auth.users`, which is where identity actually
 * lives, and PostgREST can only embed across a foreign key it can see —
 * `profiles:user_id (...)` asks it to join `public.setlog_members` to
 * `public.profiles` through a constraint that does not exist, and fails
 * with PGRST200. Every other feature in this app reads profiles the same
 * way (see the conversation fetch in the Messages screen).
 */
const fetchProfiles = async (
  userIds: string[],
): Promise<Map<string, { name: string; avatarUrl: string | null }>> => {
  const out = new Map<string, { name: string; avatarUrl: string | null }>();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (ids.length === 0) return out;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, avatar_url")
    .in("id", ids);
  // A missing profile is a name we can't print, not a reason to fail the
  // screen — the rows fall back to "Unknown" below.
  if (error) {
    console.error("Error fetching setlog member profiles:", error);
    return out;
  }
  for (const p of data ?? []) {
    out.set(String((p as any).id), {
      name: (p as any).name || "Unknown",
      avatarUrl: (p as any).avatar_url ?? null,
    });
  }
  return out;
};

/** A clip as the feed needs it: enough to play it and say whose it is. */
export interface SetlogFeedItem extends SetlogClip {
  authorName: string;
  authorAvatarUrl: string | null;
  isMine: boolean;
  logName: string | null;
  logIsPersonal: boolean;
  /** Signed, and therefore temporary — see `signClips`. */
  url: string | null;
}

/** "Today", "Yesterday", "5 Sep" — a day is read as recency, so it uses
 *  words before numbers, the same way the conversation list's timestamps
 *  do. */
export const formatDay = (day: string): string => {
  const today = localDay();
  if (day === today) return "Today";
  const d = new Date(`${day}T00:00:00`);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === localDay(yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

// ── The feed's cache ────────────────────────────────────────────────────

/**
 * A day that has already happened cannot gain a clip.
 *
 * Capture is real-time only and a clip files under the recorder's own local
 * day, so yesterday's feed is finished. That is what makes this cheap: only
 * *today* ever needs revalidating, and every other day can be served from
 * disk forever. "All time" is excluded because it is a scan whose answer
 * changes every time anyone records.
 */
export const isFeedImmutable = (day: string | null): boolean =>
  day != null && day < localDay();

/**
 * Which logs the feed is showing.
 *
 * `mine` is the log the camera creates for you and nobody else is in.
 * `squad` is every other log you are a member of — everyone's clips in
 * them, your own included, because a shared log read as a stream with your
 * own half missing is not the day the group had.
 *
 * The split is by *log*, not by author: which room a clip is in is the
 * thing that decides who can see it, so it is the thing worth splitting on.
 */
export type FeedScope = "mine" | "squad";

const feedCacheKey = (uid: string, day: string | null, scope: FeedScope) =>
  `setlog:feed:${uid}:${scope}:${day ?? "all"}`;

/** Rows are cached; URLs are not — they live in their own cache with their
 *  own expiry, and a signed URL frozen into a row is a link that dies
 *  silently. They are re-attached on read. */
type CachedFeedItem = Omit<SetlogFeedItem, "url">;

/**
 * The cached feed for a day, with fresh URLs attached. `null` when nothing
 * is cached — the caller then falls back to `listFeed`.
 */
export const readCachedFeed = async (
  userId: string | null | undefined,
  day: string | null,
  scope: FeedScope,
): Promise<SetlogFeedItem[] | null> => {
  if (!userId) return null;
  const cached = await readCache<CachedFeedItem[]>(
    feedCacheKey(userId, day, scope),
  );
  if (!cached?.data?.length) return cached?.data ? [] : null;

  // Local first: a cached feed of clips this phone already holds costs no
  // network at all, not even the round trip that used to sign them.
  const urls = await resolveClipUrls(cached.data as SetlogClip[]);
  return cached.data.map((item) => ({
    ...item,
    url: urls[item.storagePath] ?? null,
  }));
};

const writeFeedCache = async (
  userId: string,
  day: string | null,
  scope: FeedScope,
  items: SetlogFeedItem[],
): Promise<void> => {
  // "All time" is deliberately not cached: it is a moving window, so a
  // cached copy is wrong the moment anyone records.
  if (day == null) return;
  const rows: CachedFeedItem[] = items.map(({ url: _url, ...rest }) => rest);
  await writeCache(feedCacheKey(userId, day, scope), rows);
};

export const invalidateFeedCache = async (
  userId: string,
  day: string | null,
): Promise<void> => {
  // Both scopes: an insert arrives without saying which feed it belongs to,
  // and a stale one of the two is the bug this exists to prevent.
  await Promise.all([
    invalidateCache(feedCacheKey(userId, day, "mine")),
    invalidateCache(feedCacheKey(userId, day, "squad")),
  ]);
};

/**
 * Put a clip you just recorded straight into today's cached feed.
 *
 * The row and the author are both already in hand at that moment, so
 * refetching the day to learn what you just did is a round trip that can
 * only tell you what you already know.
 */
export const prependClipToFeedCache = async (
  userId: string,
  clip: SetlogClip,
  author: { name: string; avatarUrl: string | null },
): Promise<void> => {
  // A clip you just recorded lands in your own log.
  const key = feedCacheKey(userId, clip.day, "mine");
  const cached = await readCache<CachedFeedItem[]>(key);
  if (!cached?.data) return; // Nothing cached for that day; let it load.

  const item: CachedFeedItem = {
    ...clip,
    authorName: author.name,
    authorAvatarUrl: author.avatarUrl,
    isMine: true,
    // A clip recorded from the plus button lands in the personal log; the
    // name only matters for the by-line, which your own clips do not show.
    logName: null,
    logIsPersonal: true,
  };
  await writeCache(key, [
    item,
    ...cached.data.filter((c) => c.id !== clip.id),
  ]);
};

/**
 * The logs of one scope, and the rows behind them.
 *
 * Which room a clip is in is what decides who can see it, so the split is
 * by *log*, not by author, and it has to be read before the clips — it
 * decides which clips to ask for at all. Two callers need it (the feed and
 * the day markers on the calendar) and a scope that meant one thing in one
 * of them and something else in the other is the bug this exists to make
 * impossible.
 */
const scopedLogs = async (
  uid: string,
  scope: FeedScope,
): Promise<{ logs: any[]; logIds: string[] }> => {
  const { data: memberships, error: mErr } = await supabase
    .from("setlog_members")
    .select("setlog_id")
    .eq("user_id", uid);
  if (mErr) throw mErr;

  const memberLogIds = (memberships ?? []).map((m: any) => String(m.setlog_id));
  if (memberLogIds.length === 0) return { logs: [], logIds: [] };

  // The whole row, not just the name: a squad row prints the code and the
  // cap as well, and a second read of the same table to learn them would be
  // a round trip for columns already on the wire.
  const { data: myLogs, error: lgErr } = await supabase
    .from("setlogs")
    .select("id, name, is_personal, owner_id, invite_code, member_cap")
    .in("id", memberLogIds);
  if (lgErr) throw lgErr;

  const logs = myLogs ?? [];
  return {
    logs,
    logIds: logs
      .filter((l: any) =>
        scope === "mine" ? l.is_personal === true : l.is_personal !== true,
      )
      .map((l: any) => String(l.id)),
  };
};

/**
 * Everything recorded in the logs the user is in, newest first.
 *
 * Their own clips and everyone else's in the same breath: a personal log
 * and a group log are the same shape, so a feed that showed only your own
 * would make a group you had joined look empty.
 *
 * `day` is `YYYY-MM-DD` local, or `null` for all of it. Today is simply the
 * day that today is — one value on the wire rather than a mode and a date
 * that can disagree — and it is applied in the query rather than to the
 * result, so a day cannot come back empty just because the newest thirty
 * clips happen to be older than it.
 */
export const listFeed = async (
  userId?: string | null,
  day: string | null = localDay(),
  scope: FeedScope = "mine",
  limit = 30,
): Promise<SetlogFeedItem[]> => {
  const uid = await resolveUserId(userId);
  if (!uid) return [];

  const { logs: myLogs, logIds } = await scopedLogs(uid, scope);

  if (logIds.length === 0) {
    await writeFeedCache(uid, day, scope, []);
    return [];
  }

  let query = supabase
    .from("setlog_clips")
    .select("*")
    .in("setlog_id", logIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  // The recorder's own local day, which is the one they mean by "today" —
  // a UTC timestamp range would cut the evening off in Thimphu.
  if (day) query = query.eq("day", day);

  const { data, error } = await query;
  if (error) throw error;

  const clips = (data ?? []).map(rowToClip);
  if (clips.length === 0) {
    // Cached too: a day on which nothing was recorded is a finished
    // answer, and re-asking it on every visit is the same round trip for
    // the same nothing.
    await writeFeedCache(uid, day, scope, []);
    return [];
  }

  const [profiles, urls] = await Promise.all([
    fetchProfiles(clips.map((c) => c.userId)),
    resolveClipUrls(clips),
  ]);

  // And warm whatever is not here yet, in the background, so tapping one of
  // these plays from disk rather than from Supabase (lib/setlogMediaCache.ts).
  warmClips(clips);

  const logById = new Map(
    (myLogs ?? []).map((l: any) => [
      String(l.id),
      { name: l.name == null ? null : String(l.name), isPersonal: !!l.is_personal },
    ]),
  );

  const items = clips.map((clip) => {
    const profile = profiles.get(clip.userId);
    const log = logById.get(clip.setlogId);
    return {
      ...clip,
      authorName: profile?.name || "Unknown",
      authorAvatarUrl: profile?.avatarUrl ?? null,
      isMine: clip.userId === uid,
      logName: log?.name ?? null,
      logIsPersonal: log?.isPersonal ?? false,
      url: urls[clip.storagePath] ?? null,
    };
  });

  await writeFeedCache(uid, day, scope, items);
  return items;
};

/** The `YYYY-MM` a `YYYY-MM-DD` belongs to. A slice rather than a `Date`:
 *  the string is already local, and parsing it only reintroduces the UTC
 *  shift `localDay` exists to avoid. */
export const monthOf = (day: string): string => day.slice(0, 7);

/** The last day of a `YYYY-MM` month as a local `YYYY-MM-DD`. Day 0 of the
 *  following month is the last of this one, which avoids a leap-year table. */
const lastDayOfMonth = (month: string): string => {
  const [y, m] = month.split("-").map(Number);
  return localDay(new Date(y, m, 0));
};

const loggedDaysKey = (uid: string, month: string, scope: FeedScope) =>
  `setlog:days:${uid}:${scope}:${month}`;

/**
 * Which days of a month have anything in them.
 *
 * This is what puts the mark on the calendar: a month of empty circles says
 * nothing about where the days worth opening are, and the whole reason to
 * open the calendar is to go back to one of them.
 *
 * Only the `day` column is read — the calendar needs to know *whether*, not
 * what — and it is read a month at a time, because a month is what is on
 * screen and an unbounded scan of every clip the user has ever recorded is
 * the wrong price for a marker. A month that is over cannot gain a clip
 * (capture is real-time only, and a clip files under the recorder's own
 * local day), so a past month is served from cache forever and only the
 * current one is ever re-asked — the same policy `isFeedImmutable` states
 * for the feed itself.
 */
export const listLoggedDays = async (
  userId: string | null | undefined,
  month: string,
  scope: FeedScope = "mine",
): Promise<string[]> => {
  const uid = await resolveUserId(userId);
  if (!uid) return [];

  const key = loggedDaysKey(uid, month, scope);
  const isPast = month < monthOf(localDay());
  if (isPast) {
    const cached = await readCache<string[]>(key);
    if (cached?.data) return cached.data;
  }

  const { logIds } = await scopedLogs(uid, scope);
  if (logIds.length === 0) {
    await writeCache(key, []);
    return [];
  }

  const { data, error } = await supabase
    .from("setlog_clips")
    .select("day")
    .in("setlog_id", logIds)
    .gte("day", `${month}-01`)
    .lte("day", lastDayOfMonth(month));
  if (error) throw error;

  const days = Array.from(
    new Set((data ?? []).map((row: any) => String(row.day))),
  ).sort();
  await writeCache(key, days);
  return days;
};

/** The days already known for a month, without a round trip — so the
 *  calendar can open with its marks already on rather than painting them a
 *  moment later. `null` when that month has never been read. */
export const peekLoggedDays = (
  userId: string | null | undefined,
  month: string,
  scope: FeedScope = "mine",
): string[] | null =>
  userId ? (peekCache<string[]>(loggedDaysKey(userId, month, scope))?.data ?? null) : null;

/**
 * A squad log as it reads in a list: who is in it, and whether anything
 * happened today.
 *
 * Not a feed item. The Squad half of the tab is a list of *rooms*, so what
 * it needs is the room's own facts — the faces, and whether today is
 * running — and the clips themselves live behind it in the log's day.
 */
export interface SquadLogSummary {
  id: string;
  name: string | null;
  ownerId: string;
  inviteCode: string;
  memberCap: number;
  /** Every member, oldest first, so the faces read in joining order. */
  members: SetlogMember[];
  /** Clips recorded in this log today, by anybody. */
  todayCount: number;
  /** How many people have recorded today — the only count on the surface,
   *  and it is about participation, never popularity (§ Setlog). */
  todayRecorders: number;
}

const squadLogsKey = (uid: string) => `setlog:squads:${uid}`;

/**
 * The squads you are in, with the faces and today's activity.
 *
 * Four reads rather than one per log: the memberships, the logs, every
 * member of those logs in one `in()`, and today's clips across all of them.
 * A query per row is what makes a list of rooms feel slower than the feed
 * it replaced.
 */
export const listSquadLogs = async (
  userId?: string | null,
): Promise<SquadLogSummary[]> => {
  const uid = await resolveUserId(userId);
  if (!uid) return [];

  const { logs, logIds } = await scopedLogs(uid, "squad");
  if (logIds.length === 0) {
    await writeCache(squadLogsKey(uid), []);
    return [];
  }

  const today = localDay();
  const [membersRes, clipsRes] = await Promise.all([
    supabase
      .from("setlog_members")
      .select("setlog_id, user_id, role")
      .in("setlog_id", logIds)
      .order("joined_at", { ascending: true }),
    supabase
      .from("setlog_clips")
      .select("setlog_id, user_id")
      .in("setlog_id", logIds)
      .eq("day", today),
  ]);
  if (membersRes.error) throw membersRes.error;
  if (clipsRes.error) throw clipsRes.error;

  const memberRows = membersRes.data ?? [];
  const profiles = await fetchProfiles(
    memberRows.map((m: any) => String(m.user_id)),
  );

  const membersByLog = new Map<string, SetlogMember[]>();
  for (const m of memberRows) {
    const logId = String((m as any).setlog_id);
    const memberId = String((m as any).user_id);
    const profile = profiles.get(memberId);
    const list = membersByLog.get(logId) ?? [];
    list.push({
      userId: memberId,
      name: profile?.name || "Unknown",
      avatarUrl: profile?.avatarUrl ?? null,
      role: (m as any).role === "owner" ? "owner" : "member",
    });
    membersByLog.set(logId, list);
  }

  const todayByLog = new Map<string, { count: number; who: Set<string> }>();
  for (const c of clipsRes.data ?? []) {
    const logId = String((c as any).setlog_id);
    const entry = todayByLog.get(logId) ?? { count: 0, who: new Set<string>() };
    entry.count += 1;
    entry.who.add(String((c as any).user_id));
    todayByLog.set(logId, entry);
  }

  const summaries: SquadLogSummary[] = logs
    .filter((l: any) => logIds.includes(String(l.id)))
    .map((l: any) => {
      const id = String(l.id);
      const activity = todayByLog.get(id);
      return {
        id,
        name: l.name == null ? null : String(l.name),
        ownerId: String(l.owner_id ?? ""),
        inviteCode: String(l.invite_code ?? ""),
        memberCap: Number(l.member_cap ?? 12),
        members: membersByLog.get(id) ?? [],
        todayCount: activity?.count ?? 0,
        todayRecorders: activity?.who.size ?? 0,
      };
    });

  await writeCache(squadLogsKey(uid), summaries);
  return summaries;
};

/**
 * The last list of squads, so the tab paints before four reads return.
 * `null` when nothing is cached — the caller then falls back to
 * `listSquadLogs`, which it runs either way: a squad's day is other
 * people's and can change while you are looking at it.
 */
export const readCachedSquadLogs = async (
  userId?: string | null,
): Promise<SquadLogSummary[] | null> => {
  if (!userId) return null;
  const cached = await readCache<SquadLogSummary[]>(squadLogsKey(userId));
  return cached?.data ?? null;
};

/** After joining, leaving, renaming or recording — anything that changes
 *  what the list should say about a squad. */
export const invalidateSquadLogs = async (userId: string): Promise<void> => {
  await invalidateCache(squadLogsKey(userId));
};

/** The logs the user is in. Held so the realtime subscription knows which
 *  inserts are worth reacting to without a query per event. */
export const listMyLogIds = async (
  userId?: string | null,
): Promise<string[]> => {
  const uid = await resolveUserId(userId);
  if (!uid) return [];
  const { data, error } = await supabase
    .from("setlog_members")
    .select("setlog_id")
    .eq("user_id", uid);
  if (error) throw error;
  return (data ?? []).map((m: any) => String(m.setlog_id));
};

export const getSetlog = async (setlogId: string): Promise<Setlog | null> => {
  const { data, error } = await supabase
    .from("setlogs")
    .select("*")
    .eq("id", setlogId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSetlog(data) : null;
};

export const getMembers = async (setlogId: string): Promise<SetlogMember[]> => {
  const { data, error } = await supabase
    .from("setlog_members")
    .select("user_id, role")
    .eq("setlog_id", setlogId)
    .order("joined_at", { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  const profiles = await fetchProfiles(rows.map((m: any) => String(m.user_id)));
  return rows.map((m: any) => {
    const userId = String(m.user_id);
    const profile = profiles.get(userId);
    return {
      userId,
      name: profile?.name || "Unknown",
      avatarUrl: profile?.avatarUrl ?? null,
      role: m.role === "owner" ? "owner" : "member",
    };
  });
};

/** One day inside a log, as 24 slots. Every hour is present whether or not
 *  anybody recorded in it — the grid draws the empty ones too, and an hour
 *  missing from the array and an hour nobody filled are different things. */
export const getDay = async (
  setlogId: string,
  day: string,
): Promise<SetlogSlot[]> => {
  const { data, error } = await supabase
    .from("setlog_clips")
    .select("*")
    .eq("setlog_id", setlogId)
    .eq("day", day)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const clips = (data ?? []).map(rowToClip);
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    clips: clips.filter((c) => c.slotHour === hour),
  }));
};

// Signing lives in ./setlogSigning — `setlogMediaCache` needs it too, and
// with it here the two modules imported each other (Metro: "Require cycle").
// Re-exported so every existing importer of `signClips` is unaffected.
export { signClips } from "./setlogSigning";

// ── Writes ──────────────────────────────────────────────────────────────

export const createLog = async (name?: string): Promise<string> => {
  const { data, error } = await supabase.rpc("create_setlog", {
    p_name: name?.trim() || null,
  });
  if (error) throw error;
  return String(data);
};

/**
 * The log that is simply yours, created on first use.
 *
 * This is what the plus button records into. Nobody names a room or invites
 * anyone to get their first two seconds down — those are decisions, and the
 * product's whole claim is that this costs none.
 */
export const ensurePersonalLog = async (): Promise<string> => {
  const { data, error } = await supabase.rpc("ensure_personal_setlog");
  if (error) throw error;
  return String(data);
};

export const joinLog = async (code: string): Promise<string> => {
  const { data, error } = await supabase.rpc("join_setlog", {
    p_code: code.trim(),
  });
  if (error) throw error;
  return String(data);
};

/**
 * Upload a recorded clip and file it in its slot.
 *
 * The path is `<setlog_id>/<user_id>/<day>_<hour>_<time>.<ext>`. The first
 * two folders are load-bearing: the bucket's policies read the log id off
 * one and the owner off the other. The time on the end is what lets an hour
 * hold more than one clip — the hour is what a clip is *filed under*, never
 * a quota, and a per-hour path made every second clip an overwrite of the
 * first.
 */
export const uploadClip = async (params: {
  setlogId: string;
  uri: string;
  durationMs: number;
  slot?: Slot;
  isLate?: boolean;
  /** Written over the video after recording. Optional — an untitled clip is
   *  still the two seconds, and the prompt to name it must never become a
   *  field you have to clear to get past. */
  title?: string | null;
  captureMode?: CaptureMode;
  videoQuality?: VideoQuality | null;
}): Promise<SetlogClip> => {
  const uid = await resolveUserId();
  if (!uid) throw new Error("Sign in to record.");

  const mode = params.captureMode ?? DEFAULT_CAPTURE_MODE;
  const isPhoto = mode === "photo";
  const slot = params.slot ?? currentSlot();
  const path = `${params.setlogId}/${uid}/${slot.day}_${slot.hour}_${Date.now()}.${
    isPhoto ? "jpg" : "mp4"
  }`;

  const bytes = await new File(params.uri).bytes();
  const { error: upErr } = await supabase.storage
    .from(CLIP_BUCKET)
    .upload(path, bytes, {
      contentType: isPhoto ? "image/jpeg" : "video/mp4",
      // Every clip owns a path nothing else can land on, so an upload is
      // never an overwrite and never needs the UPDATE policy.
      upsert: false,
      cacheControl: "31536000",
    });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("setlog_clips")
    .insert({
      setlog_id: params.setlogId,
      user_id: uid,
      day: slot.day,
      slot_hour: slot.hour,
      storage_path: path,
      // Clamped rather than rejected: a recorder that overshoots its own
      // stop by a frame should not lose the moment it just captured.
      // At least 1ms for a video: the system camera does not always report
      // a duration, and the column's CHECK requires one.
      duration_ms: isPhoto
        ? 0
        : Math.min(Math.max(1, Math.round(params.durationMs || 1)), 60000),
      is_late: params.isLate ?? false,
      title: params.title?.trim() ? params.title.trim().slice(0, 60) : null,
      media_type: isPhoto ? "photo" : "video",
      capture_mode: mode,
      video_quality: isPhoto ? null : (params.videoQuality ?? null),
    })
    .select()
    .single();
  if (error) throw error;
  return rowToClip(data);
};
