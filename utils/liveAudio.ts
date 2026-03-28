import { Platform } from "react-native";
import InCallManager from "react-native-incall-manager";

const AUDIO_RESET_DELAY_MS = 150;
const LIVE_AUDIO_LOG_PREFIX = "[LiveAudio]";

const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function logLiveAudioMode(event: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`${LIVE_AUDIO_LOG_PREFIX} ${event}`, details);
    return;
  }

  console.log(`${LIVE_AUDIO_LOG_PREFIX} ${event}`);
}

interface LiveTeardownOptions {
  leaveCall?: (() => Promise<void>) | null;
  disconnectClient?: (() => Promise<void>) | null;
  details?: Record<string, unknown>;
  label?: string;
}

export async function teardownLiveAudioSession({
  leaveCall,
  disconnectClient,
  details,
  label = "live session",
}: LiveTeardownOptions): Promise<void> {
  if (leaveCall) {
    try {
      logLiveAudioMode(`leaving ${label}`, details);
      await leaveCall();
    } catch (error) {
      console.log(`${LIVE_AUDIO_LOG_PREFIX} leave ${label} failed`, error);
    }
  }

  if (disconnectClient) {
    try {
      logLiveAudioMode(`disconnecting ${label} stream client`, details);
      await disconnectClient();
    } catch (error) {
      console.log(`${LIVE_AUDIO_LOG_PREFIX} disconnect ${label} stream client failed`, error);
    }
  }

  await resetLiveAudioMode().catch(() => undefined);
}

export async function resetLiveAudioMode(): Promise<void> {
  if (Platform.OS !== "android") {
    logLiveAudioMode("skip reset on non-android");
    return;
  }

  logLiveAudioMode("reset requested", {
    platform: Platform.OS,
    delayMs: AUDIO_RESET_DELAY_MS,
  });

  await delay(AUDIO_RESET_DELAY_MS);

  try {
    logLiveAudioMode("setForceSpeakerphoneOn(false)");
    InCallManager.setForceSpeakerphoneOn(false);
  } catch (error) {
    console.log(`${LIVE_AUDIO_LOG_PREFIX} setForceSpeakerphoneOn(false) failed`, error);
  }

  try {
    logLiveAudioMode("setSpeakerphoneOn(false)");
    InCallManager.setSpeakerphoneOn(false);
  } catch (error) {
    console.log(`${LIVE_AUDIO_LOG_PREFIX} setSpeakerphoneOn(false) failed`, error);
  }

  try {
    logLiveAudioMode("stop()");
    InCallManager.stop();
  } catch (error) {
    console.log(`${LIVE_AUDIO_LOG_PREFIX} stop() failed`, error);
  }

  logLiveAudioMode("reset completed");
}
