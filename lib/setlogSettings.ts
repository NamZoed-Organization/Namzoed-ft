/**
 * Setlog's settings, which are two different kinds of thing.
 *
 * **Camera defaults** — orientation, length, quality, flash, zoom — are a
 * way of holding *this phone*, so they live in `AsyncStorage` and never
 * leave it. They are what the camera opens on; the camera's own controls
 * still change any of them for one take without writing anything back.
 *
 * **The hourly prompt** follows the person, so it lives on their profile.
 * It is **off by default and stays off** until somebody turns it on: the
 * prompt is the loop, and it is also the most intrusive thing this app
 * could do.
 *
 * ## The version gate
 *
 * Setlog ships in 2.0.0, which is not released yet — the build people are
 * running today is older and has no Setlog tab. A push about it would send
 * them to a screen that does not exist for them, so:
 *
 *  - the client refuses to write an opt-in from a build without the
 *    feature, and
 *  - every opt-in records the version it was made on, which the
 *    `setlog_prompt_recipients` view and every sender must filter by.
 *
 * `SETLOG_FEATURE_VERSION` is the one place that number is written down.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { formatHourLabel } from "./timeFormat";
import {
  CAPTURE_MODES,
  DEFAULT_CAPTURE_MODE,
  DEFAULT_VIDEO_QUALITY,
  type CaptureMode,
  type VideoQuality,
} from "./setlogService";

// ── The version gate ────────────────────────────────────────────────────

/**
 * The app version Setlog ships in — the one in `app.json`, not a future
 * one. Nothing below this may be notified about Setlog, because nothing
 * below this can open it.
 *
 * Keep the two in step: if this ever reads higher than the version actually
 * being built, the gate closes on everybody, including the build that has
 * the feature.
 */
export const SETLOG_FEATURE_VERSION = "2.0.0";

const runningVersion = (): string =>
  Constants.expoConfig?.version ?? "0.0.0";

/** Numeric compare, not string: "2.10.0" is newer than "2.9.0" and sorts
 *  the other way as text. */
const compareVersions = (a: string, b: string): number => {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
};

/** Whether this build may be notified about Setlog at all. */
export const setlogNotificationsSupported = (): boolean =>
  compareVersions(runningVersion(), SETLOG_FEATURE_VERSION) >= 0;

// ── Camera defaults (this device) ───────────────────────────────────────

export type FrameOrientation = "landscape" | "portrait";
export type FlashMode = "off" | "on" | "auto";

export interface CameraDefaults {
  frame: FrameOrientation;
  mode: CaptureMode;
  quality: VideoQuality;
  flash: FlashMode;
  /** Index into the camera's own zoom stops. */
  zoomIndex: number;
  /** Self-timer, in seconds. 0 is off. */
  timerSeconds: number;
  facing: "front" | "back";
}

export const DEFAULT_CAMERA_DEFAULTS: CameraDefaults = {
  frame: "landscape",
  mode: DEFAULT_CAPTURE_MODE,
  quality: DEFAULT_VIDEO_QUALITY,
  flash: "off",
  zoomIndex: 1,
  timerSeconds: 0,
  facing: "back",
};

const CAMERA_KEY = "@setlog_camera_defaults";

export const loadCameraDefaults = async (): Promise<CameraDefaults> => {
  try {
    const raw = await AsyncStorage.getItem(CAMERA_KEY);
    if (!raw) return DEFAULT_CAMERA_DEFAULTS;
    const stored = JSON.parse(raw) as Partial<CameraDefaults>;
    // Merged rather than trusted: a stored blob from an older build can be
    // missing keys, and a mode that no longer exists must not reach the
    // camera as `undefined.ms`.
    return {
      ...DEFAULT_CAMERA_DEFAULTS,
      ...stored,
      mode:
        stored.mode && stored.mode in CAPTURE_MODES
          ? stored.mode
          : DEFAULT_CAMERA_DEFAULTS.mode,
    };
  } catch {
    return DEFAULT_CAMERA_DEFAULTS;
  }
};

export const saveCameraDefaults = async (
  defaults: CameraDefaults,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(CAMERA_KEY, JSON.stringify(defaults));
  } catch {
    // A preference that failed to persist is not worth interrupting anyone
    // over; it simply comes back as the default next time.
  }
};

// ── The hourly prompt (this person) ─────────────────────────────────────

export interface SetlogPrompt {
  enabled: boolean;
  /** Local hours, inclusive of `from`, exclusive of `to`. */
  fromHour: number;
  toHour: number;
  /** The build the opt-in was made on. Senders filter on it. */
  appVersion: string | null;
  /**
   * The recorder's IANA zone, e.g. `Asia/Thimphu`.
   *
   * Load-bearing: the window is in *local* hours and the sender is a cron
   * job running in UTC, so without this it cannot tell whether 3pm has
   * arrived for this person. An offset would drift through DST; the zone
   * name does not.
   */
  timezone: string | null;
}

/** The device's own zone, or null if the platform will not say. */
const deviceTimezone = (): string | null => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};

/** Off, and a window that matches waking hours for when it is turned on.
 *  A prompt that can fire at 4am is a prompt that gets the app deleted. */
export const DEFAULT_SETLOG_PROMPT: SetlogPrompt = {
  enabled: false,
  fromHour: 8,
  toHour: 22,
  appVersion: null,
  timezone: null,
};

/**
 * Postgres' "column does not exist".
 *
 * `setlog_prefs` arrives in a migration, and a build running against a
 * database that has not had it applied yet should still show its camera
 * defaults rather than an error screen. The prompt simply reads as off,
 * which is also what it is: nothing can be delivered without the column.
 */
const UNDEFINED_COLUMN = "42703";

export const fetchSetlogPrompt = async (
  userId: string,
): Promise<SetlogPrompt> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("setlog_prefs")
    .eq("id", userId)
    .maybeSingle();

  if (error?.code === UNDEFINED_COLUMN) {
    console.warn(
      "[setlog] profiles.setlog_prefs is missing — run supabase/migrations/add_setlog_notification_prefs.sql. The hourly prompt is unavailable until then.",
    );
    return DEFAULT_SETLOG_PROMPT;
  }
  if (error) throw error;

  const raw = (data?.setlog_prefs ?? {}) as Record<string, unknown>;
  return {
    enabled: raw.enabled === true,
    fromHour:
      typeof raw.from_hour === "number"
        ? raw.from_hour
        : DEFAULT_SETLOG_PROMPT.fromHour,
    toHour:
      typeof raw.to_hour === "number" ? raw.to_hour : DEFAULT_SETLOG_PROMPT.toHour,
    appVersion: typeof raw.app_version === "string" ? raw.app_version : null,
    timezone: typeof raw.timezone === "string" ? raw.timezone : null,
  };
};

export const saveSetlogPrompt = async (
  userId: string,
  prompt: SetlogPrompt,
): Promise<void> => {
  // The gate, enforced where the write happens rather than only where the
  // switch is drawn: a build without the feature can never record itself as
  // wanting to hear about it.
  const enabled = prompt.enabled && setlogNotificationsSupported();

  const { error } = await supabase
    .from("profiles")
    .update({
      setlog_prefs: {
        enabled,
        from_hour: prompt.fromHour,
        to_hour: prompt.toHour,
        // Cleared on opt-out so a stale version can never look like a live
        // subscription to a sender reading the column.
        app_version: enabled ? runningVersion() : null,
        // Re-read on every save rather than kept from the first one: people
        // move, and a window set in Thimphu should still mean 8am after
        // they land somewhere else.
        timezone: enabled ? deviceTimezone() : null,
        updated_at: new Date().toISOString(),
      },
    })
    .eq("id", userId);

  if (error?.code === UNDEFINED_COLUMN) {
    throw new Error(
      "The hourly prompt needs a database update that hasn't been applied yet.",
    );
  }
  if (error) throw error;
};

/**
 * Make sure an opt-in the sender can actually act on is what is stored.
 *
 * The sender skips anyone whose row has no `timezone` — it has no way to
 * know what hour it is for them, and a prompt at the wrong hour is worse
 * than none — and it skips anyone whose `app_version` is below the build
 * Setlog shipped in. Both of those can be true of a *switched-on* row: the
 * timezone column was added after the opt-in existed, and a person who
 * turned it on and then updated the app carries the old version forever
 * because nothing rewrites the row until they touch the switch again.
 *
 * The result is the worst kind of failure — the switch says on, and nothing
 * ever arrives, with no error anywhere. So both fields are re-stamped from
 * the device whenever the prompt is looked at, and only when they are
 * actually wrong, so this costs nothing on the common path.
 *
 * Returns true when it wrote something, so a screen can say so.
 */
export const repairSetlogPrompt = async (
  userId: string,
  prompt: SetlogPrompt,
): Promise<boolean> => {
  if (!prompt.enabled) return false;
  const zone = deviceTimezone();
  const version = runningVersion();
  const stale =
    (zone != null && prompt.timezone !== zone) || prompt.appVersion !== version;
  if (!stale) return false;

  await saveSetlogPrompt(userId, prompt);
  return true;
};

/**
 * Send yourself the prompt, right now.
 *
 * The hourly prompt has four moving parts — an opt-in row, a cron job, an
 * edge function and OneSignal — and when nothing arrives, *none* of them
 * says which one is broken. This fires both halves for the current user and
 * reports on each separately, so "the in-app one worked and the push
 * didn't" becomes a fact rather than a guess.
 *
 * It deliberately does not go through the scheduled sender: the point is to
 * test everything downstream of it. A reference id of `test-<timestamp>`
 * keeps it out of the hourly job's own duplicate check, so a test can never
 * silence a real prompt for that hour.
 */
export interface TestPromptResult {
  inApp: boolean;
  push: boolean;
  /** Why a half failed, for the row that reports it. */
  detail?: string;
}

export const sendTestSetlogPrompt = async (
  userId: string,
): Promise<TestPromptResult> => {
  const hour = new Date().getHours();
  const title = `It's ${formatHourShort(hour)}`;
  const body = "Two seconds of it? (test)";
  const out: TestPromptResult = { inApp: false, push: false };

  const { error: insertError } = await supabase.from("notifications").insert({
    user_id: userId,
    type: "setlog_prompt",
    actor_id: userId,
    reference_id: `test-${Date.now()}`,
    title,
    body,
    is_read: false,
  });
  if (insertError) out.detail = `In-app: ${insertError.message}`;
  else out.inApp = true;

  try {
    const { error } = await supabase.functions.invoke("send-push-notification", {
      body: {
        recipient_ids: [userId],
        heading: title,
        content: body,
        type: "setlog_prompt",
      },
    });
    if (error) out.detail = [out.detail, `Push: ${error.message}`].filter(Boolean).join(" · ");
    else out.push = true;
  } catch (e: any) {
    out.detail = [out.detail, `Push: ${e?.message ?? "failed"}`]
      .filter(Boolean)
      .join(" · ");
  }

  return out;
};

/** The hour, in this phone's own convention — the test prompt should read
 *  the way the real one will on this device. */
const formatHourShort = (hour: number): string => formatHourLabel(hour);

/** "8am to 10pm", or "08:00 to 22:00" — the window as a sentence, in
 *  whichever clock this phone keeps (`lib/timeFormat.ts`). */
export const formatPromptWindow = (prompt: SetlogPrompt): string =>
  `${formatHourLabel(prompt.fromHour)} to ${formatHourLabel(prompt.toHour)}`;

// ── Asking, once ────────────────────────────────────────────────────────

/**
 * Whether the offer has been made.
 *
 * `_v2` because the first version set this flag *before* asking, so a
 * request that silently no-oped — the OneSignal SDK unavailable, or
 * permission already granted, both of which return without showing
 * anything — burned the one chance to offer it and left the screen looking
 * like it had done nothing. Anyone carrying that flag gets the offer once
 * more under the new key.
 */
const ASKED_KEY = "@setlog_notifications_asked_v2";

export const hasAskedForNotifications = async (): Promise<boolean> => {
  try {
    return (await AsyncStorage.getItem(ASKED_KEY)) === "1";
  } catch {
    return false;
  }
};

export const markAskedForNotifications = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(ASKED_KEY, "1");
  } catch {
    // Worst case the offer is made again — which is a card, not the OS
    // dialog, so it costs nothing irreversible.
  }
};
