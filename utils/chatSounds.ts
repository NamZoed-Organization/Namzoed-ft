/**
 * chatSounds.ts
 * Provides notification sounds and haptic feedback for chat events.
 *
 * Royalty-free SFX source: Mixkit Free License (https://mixkit.co/free-sound-effects/)
 *
 * To swap in a local bundled asset (recommended for production offline use),
 * replace RECEIVE_SOUND_SOURCE with:
 *   require("../assets/sounds/message.wav")
 * and place your royalty-free .wav or .mp3 file at that path.
 */

import * as Haptics from "expo-haptics";

// ─── Local bundled notification sound ────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RECEIVE_SOUND_SOURCE = require("../assets/sounds/notification.mp3");

type CachedReceiveSound = import("expo-av").Audio.Sound;

// ─── Module-level sound cache ─────────────────────────────────────────────────
let _receiveSound: CachedReceiveSound | null = null;
let _loadingReceive = false;

async function getReceiveSound(): Promise<CachedReceiveSound | null> {
  if (_receiveSound) return _receiveSound;
  if (_loadingReceive) return null;
  _loadingReceive = true;
  try {
    const { Audio } = await import("expo-av");
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });
    const { sound } = await Audio.Sound.createAsync(RECEIVE_SOUND_SOURCE, {
      shouldPlay: false,
      volume: 0.55,
      isLooping: false,
    });
    _receiveSound = sound;
    return sound;
  } catch {
    // Loading failed — silently degrade (e.g. ExponentAV not linked)
    return null;
  } finally {
    _loadingReceive = false;
  }
}

/**
 * Pre-warms the receive sound so the first message plays without a loading
 * delay. Call this once when the chat screen mounts.
 */
export function preloadChatSounds(): void {
  void getReceiveSound();
}

/**
 * Plays the incoming-message notification sound.
 * Silently no-ops if the sound cannot be loaded (e.g. offline).
 */
export async function playReceiveSound(): Promise<void> {
  try {
    const sound = await getReceiveSound();
    if (!sound) return;
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // Non-critical — audio errors should never surface to the user
  }
}

/**
 * Plays a light impact haptic when the user sends a message.
 */
export async function triggerSendHaptic(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

/**
 * Plays a success-notification haptic when a message is received.
 */
export async function triggerReceiveHaptic(): Promise<void> {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
}

/**
 * Plays the outgoing-message sound from the local asset bundle.
 * Silently no-ops on error so message sending is never blocked.
 */
export async function playSendSound(): Promise<void> {
  try {
    const { Audio } = await import("expo-av");
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../assets/sounds/sendmessage.mp3"),
      { shouldPlay: true, volume: 0.8 },
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {}
}

/**
 * Releases cached sound objects. Call from the chat screen's cleanup / unmount.
 */
export function unloadChatSounds(): void {
  if (_receiveSound) {
    _receiveSound.unloadAsync().catch(() => {});
    _receiveSound = null;
  }
}
