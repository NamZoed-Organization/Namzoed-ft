import { Audio } from "expo-av";

const SOUND_SOURCES = {
  comment:      require("@/assets/sounds/comment.mp3"),
  like:         require("@/assets/sounds/like.mp3"),
  notification: require("@/assets/sounds/notification.mp3"),
  sendmessage:  require("@/assets/sounds/sendmessage.mp3"),
} as const;

type SoundName = keyof typeof SOUND_SOURCES;

/** Fire-and-forget sound player. Silently no-ops on any error. */
export async function playSound(name: SoundName): Promise<void> {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(SOUND_SOURCES[name], {
      shouldPlay: true,
      volume: 0.8,
    });
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {}
}
