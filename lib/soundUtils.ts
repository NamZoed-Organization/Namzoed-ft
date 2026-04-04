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
    const { createAudioPlayer, setAudioModeAsync } = await import("expo-audio");
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });
    const player = createAudioPlayer(SOUND_SOURCES[name], { keepAudioSessionActive: true });
    player.volume = 0.8;

    const subscription = player.addListener("playbackStatusUpdate", (status) => {
      if (status.didJustFinish) {
        subscription.remove();
        player.remove();
      }
    });

    player.play();
  } catch {
    // e.g. native module missing (Expo Go mismatch), web, or playback failure
  }
}
