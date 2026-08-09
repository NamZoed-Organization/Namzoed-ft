import Constants from "expo-constants";
import { Linking, Platform } from "react-native";

const IOS_APP_STORE_ID = process.env.EXPO_PUBLIC_IOS_APP_STORE_ID || "";
const ANDROID_PACKAGE_NAME =
  (Constants.expoConfig?.android?.package as string | undefined) ||
  "com.anonymous.Namzoed";

const IOS_STORE_URL = IOS_APP_STORE_ID
  ? `itms-apps://itunes.apple.com/app/id${IOS_APP_STORE_ID}`
  : `https://apps.apple.com/search?term=${encodeURIComponent("Namzoed")}`;
const IOS_STORE_WEB_URL = IOS_APP_STORE_ID
  ? `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`
  : `https://apps.apple.com/search?term=${encodeURIComponent("Namzoed")}`;

const ANDROID_STORE_URL = `market://details?id=${ANDROID_PACKAGE_NAME}`;
const ANDROID_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_NAME}`;

/**
 * Opens the App Store (iOS) or Play Store (Android) listing for this app so
 * the user can update. Tries the native store-app scheme first, falling back
 * to the store's web URL if the app isn't installed. No-op on web.
 */
export const openAppStoreForUpdate = async (): Promise<void> => {
  const primary = Platform.OS === "ios" ? IOS_STORE_URL : Platform.OS === "android" ? ANDROID_STORE_URL : null;
  const fallback = Platform.OS === "ios" ? IOS_STORE_WEB_URL : Platform.OS === "android" ? ANDROID_STORE_WEB_URL : null;
  if (!fallback) return;

  try {
    await Linking.openURL(primary || fallback);
  } catch {
    try {
      await Linking.openURL(fallback);
    } catch {
      // Best effort only — nothing more we can do if both fail.
    }
  }
};

/**
 * Compares two "1.2.3"-style version strings.
 * Returns -1 if `a` < `b`, 0 if equal, 1 if `a` > `b`.
 * Uneven segment counts and non-numeric segments are treated as 0.
 */
export const compareVersions = (a: string, b: string): -1 | 0 | 1 => {
  const partsA = a.trim().split(".");
  const partsB = b.trim().split(".");
  const length = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < length; i++) {
    const numA = parseInt(partsA[i] ?? "0", 10) || 0;
    const numB = parseInt(partsB[i] ?? "0", 10) || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
};

/** The app's own bundled version, e.g. "1.0.2". */
export const getCurrentAppVersion = (): string =>
  Constants.expoConfig?.version || "0.0.0";
