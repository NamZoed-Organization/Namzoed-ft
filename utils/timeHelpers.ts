/**
 * Time Helper Utilities for Closing Sale Banner
 * Handles calculations for 3pm-10pm daily closing sale window
 */

export type TimeWindow = "before" | "during" | "after";

/**
 * Get the current time window relative to 3pm-10pm closing sale
 * @returns 'before' | 'during' | 'after'
 */
export function getCurrentTimeWindow(): TimeWindow {
  const now = new Date();
  const currentHour = now.getHours();

  if (currentHour < 15) {
    return "before"; // Before 3pm
  } else if (currentHour >= 15 && currentHour < 22) {
    return "during"; // Between 3pm-10pm
  } else {
    return "after"; // After 10pm
  }
}

/**
 * Check if closing sale is currently active (3pm-10pm)
 * @returns true if current time is between 3pm-10pm
 */
export function isClosingSaleActive(): boolean {
  return getCurrentTimeWindow() === "during";
}

/**
 * Get seconds until next closing sale start (3pm today or tomorrow)
 * @returns Number of seconds until 3pm
 */
export function getTimeUntilClosingSaleStart(): number {
  const now = new Date();
  const today3pm = new Date(now);
  today3pm.setHours(15, 0, 0, 0);

  if (now < today3pm) {
    // 3pm is today
    return Math.floor((today3pm.getTime() - now.getTime()) / 1000);
  } else {
    // 3pm is tomorrow
    const tomorrow3pm = new Date(today3pm);
    tomorrow3pm.setDate(tomorrow3pm.getDate() + 1);
    return Math.floor((tomorrow3pm.getTime() - now.getTime()) / 1000);
  }
}

/**
 * Get seconds until closing sale ends (10pm today)
 * Only valid when called during the 8pm-10pm window
 * @returns Number of seconds until 10pm
 */
export function getTimeUntilClosingSaleEnd(): number {
  const now = new Date();
  const today10pm = new Date(now);
  today10pm.setHours(22, 0, 0, 0);

  return Math.floor((today10pm.getTime() - now.getTime()) / 1000);
}

/**
 * Format seconds into human-readable countdown
 * @param seconds - Number of seconds
 * @returns Formatted string like "3h 45m 12s" or "45m 30s" or "30s"
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0s";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Format seconds into compact countdown (hours+minutes OR minutes+seconds)
 * @param seconds - Number of seconds
 * @returns Formatted string like "3h 45m" (if hours) or "45m 30s" (if no hours)
 */
export function formatCompactCountdown(seconds: number): string {
  if (seconds <= 0) return "0s";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    // Show hours and minutes only (no seconds)
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    // Show minutes and seconds
    return `${minutes}m ${secs}s`;
  } else {
    // Show only seconds
    return `${secs}s`;
  }
}

/**
 * Get countdown value based on current time window
 * @returns Number of seconds for appropriate countdown
 */
export function getCountdownSeconds(): number {
  const timeWindow = getCurrentTimeWindow();

  switch (timeWindow) {
    case "before":
      return getTimeUntilClosingSaleStart();
    case "during":
      return getTimeUntilClosingSaleEnd();
    case "after":
      return getTimeUntilClosingSaleStart(); // Next day's 3pm
    default:
      return 0;
  }
}

/**
 * Get display text based on current time window
 * @returns Object with title and subtitle text
 */
export function getCountdownDisplayText(): { title: string; subtitle: string } {
  const timeWindow = getCurrentTimeWindow();

  switch (timeWindow) {
    case "before":
      return {
        title: "Closing Sale Tonight!",
        subtitle: "Starts in",
      };
    case "during":
      return {
        title: "CLOSING SALE NOW!",
        subtitle: "Ends in",
      };
    case "after":
      return {
        title: "🌙 Next Closing Sale Tomorrow",
        subtitle: "Starts in",
      };
    default:
      return {
        title: "Closing Sale",
        subtitle: "",
      };
  }
}
