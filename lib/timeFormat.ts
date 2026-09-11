/**
 * Whether this phone tells the time in twelve hours or twenty-four.
 *
 * Setlog wrote its own "3pm" everywhere, which is the wrong answer for
 * roughly half the world and for anybody who has turned 24-hour on. The
 * clock a clip is stamped with, the hours on the day grid and the prompt
 * window are all read as *the time*, so they have to read the way this
 * phone's own clock does.
 *
 * **Two sources, in order of how much they actually know:**
 *
 *  1. `expo-localization` — `getCalendars()[0].uses24hourClock` is the OS
 *     setting itself, on both platforms. It is loaded through a guarded
 *     `require` rather than a static import, so the app runs identically
 *     whether or not the module has been installed and rebuilt yet.
 *  2. `Intl` — correct on iOS, where the system toggle is reflected in the
 *     locale handed to apps. On Android it answers from the *locale*, not
 *     the toggle: an en-US phone switched to 24-hour still reports h12. So
 *     it is the fallback, never the first answer, and the gap is why (1)
 *     exists at all.
 *
 * Resolved once and cached: it is a system setting, and re-deriving it for
 * every clip in a scrolling feed would be an `Intl` construction per row.
 * Changing it in Settings is an app restart's worth of change, which is
 * exactly what people expect of it.
 */

let cached: boolean | null = null;

const fromLocalization = (): boolean | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-localization");
    const calendars = mod?.getCalendars?.();
    const uses24 = calendars?.[0]?.uses24hourClock;
    return typeof uses24 === "boolean" ? uses24 : null;
  } catch {
    // Not installed — the Intl answer below still gets iOS right.
    return null;
  }
};

const fromIntl = (): boolean => {
  try {
    const resolved = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
    }).resolvedOptions() as Intl.ResolvedDateTimeFormatOptions & {
      hourCycle?: string;
      hour12?: boolean;
    };
    if (typeof resolved.hour12 === "boolean") return !resolved.hour12;
    if (resolved.hourCycle) return resolved.hourCycle === "h23" || resolved.hourCycle === "h24";
  } catch {
    // Some Android builds ship without full Intl.
  }
  // Last resort: format a known afternoon and look for a meridiem.
  try {
    const printed = new Date(2020, 0, 1, 13, 0).toLocaleTimeString();
    return !/[ap]\.?m\.?/i.test(printed);
  } catch {
    return false;
  }
};

/** True when this phone shows 14:00 rather than 2pm. */
export const uses24HourClock = (): boolean => {
  if (cached == null) cached = fromLocalization() ?? fromIntl();
  return cached;
};

/** Only for tests and the dev preview, which need to see both. */
export const __setClockOverride = (value: boolean | null) => {
  cached = value;
};

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * An hour on its own — "3pm", or "15:00".
 *
 * Twenty-four-hour time has no bare-hour form that reads as a time: "15"
 * alone is a number, so the minutes are printed even though they are always
 * zero. Twelve-hour time does have one, and "3:00pm" in a grid cell is two
 * characters of noise per tile.
 */
export const formatHourLabel = (hour: number): string => {
  if (uses24HourClock()) return `${pad(hour)}:00`;
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "am" : "pm"}`;
};

/** A clock time — "3:04pm", or "15:04". */
export const formatClockTime = (d: Date = new Date()): string => {
  const h24 = d.getHours();
  const minutes = pad(d.getMinutes());
  if (uses24HourClock()) return `${pad(h24)}:${minutes}`;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${minutes}${h24 < 12 ? "am" : "pm"}`;
};
