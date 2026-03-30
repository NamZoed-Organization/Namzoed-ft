import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import { PROVIDER_GOOGLE } from "react-native-maps";

/**
 * On Android, `PROVIDER_GOOGLE` expects your app’s Maps SDK key in the native manifest.
 *
 * **Expo Go:** use the host app’s Maps wiring — omit `provider` (`undefined`). Do not rely on
 * `Constants.appOwnership` (often `null` in recent SDKs); use `isRunningInExpoGo()` instead.
 *
 * **Dev / release builds:** pass `PROVIDER_GOOGLE` and set the key via `app.config.js` +
 * `react-native-maps` plugin (or prebuild).
 */
export function androidMapProvider(): typeof PROVIDER_GOOGLE | undefined {
  if (Platform.OS !== "android") return undefined;
  if (isRunningInExpoGo()) return undefined;
  return PROVIDER_GOOGLE;
}
