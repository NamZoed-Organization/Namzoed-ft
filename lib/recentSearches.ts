import AsyncStorage from "@react-native-async-storage/async-storage";

// Recent search terms, persisted per-user so a shared device doesn't leak
// one account's search history into another's.
const KEY_PREFIX = "recentSearches:v1:";
const MAX_ENTRIES = 10;

function storageKey(userId?: string | null): string {
  return `${KEY_PREFIX}${userId || "guest"}`;
}

export async function getRecentSearches(userId?: string | null): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Adds/bumps a term to the front, de-duplicated case-insensitively. */
export async function addRecentSearch(
  userId: string | null | undefined,
  term: string,
): Promise<string[]> {
  const trimmed = term.trim();
  if (!trimmed) return getRecentSearches(userId);
  const existing = await getRecentSearches(userId);
  const next = [
    trimmed,
    ...existing.filter((t) => t.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX_ENTRIES);
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // best-effort cache; ignore storage failures
  }
  return next;
}

export async function removeRecentSearch(
  userId: string | null | undefined,
  term: string,
): Promise<string[]> {
  const existing = await getRecentSearches(userId);
  const next = existing.filter((t) => t !== term);
  try {
    await AsyncStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export async function clearRecentSearches(userId?: string | null): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}
