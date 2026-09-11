/**
 * Which conversations are silenced, and where that is kept.
 *
 * Per device, in AsyncStorage, keyed by the signed-in account — muting is a
 * "not on this phone right now" decision rather than a property of the
 * friendship, and it has never been on the server. Two screens set it now
 * (the inbox's swipe action and a chat's details screen), so the key and its
 * shape live here rather than being spelled out in both: a second copy of
 * `muted_conversations_${id}` is a mute that silently only half works.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

export const mutedConversationsKey = (userId?: string | null) =>
  userId ? `muted_conversations_${userId}` : null;

export const loadMutedConversations = async (
  userId?: string | null,
): Promise<Set<string>> => {
  const key = mutedConversationsKey(userId);
  if (!key) return new Set();
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    // A mute list that fails to read is a chat that makes a sound, which is
    // recoverable; throwing here would take the inbox down with it.
    return new Set();
  }
};

export const saveMutedConversations = async (
  userId: string | null | undefined,
  muted: Set<string>,
): Promise<void> => {
  const key = mutedConversationsKey(userId);
  if (!key) return;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(Array.from(muted)));
  } catch {
    // Same reasoning as above.
  }
};

/** Flip one conversation and persist, returning the new set. */
export const toggleMutedConversation = async (
  userId: string | null | undefined,
  partnerId: string,
  current?: Set<string>,
): Promise<Set<string>> => {
  const set = new Set(current ?? (await loadMutedConversations(userId)));
  if (set.has(partnerId)) set.delete(partnerId);
  else set.add(partnerId);
  await saveMutedConversations(userId, set);
  return set;
};

export const isConversationMuted = async (
  userId: string | null | undefined,
  partnerId: string,
): Promise<boolean> => (await loadMutedConversations(userId)).has(partnerId);
