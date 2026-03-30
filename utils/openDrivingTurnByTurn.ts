import { ActionSheetIOS, Linking, Platform } from "react-native";

async function tryOpenUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

function destinationEnc(latitude: number, longitude: number): string {
  return encodeURIComponent(`${latitude},${longitude}`);
}

/**
 * Android: Google Maps turn-by-turn (`google.navigation`).
 * iOS: Google Maps app if installed, else Google Maps in browser (universal link).
 */
export async function openGoogleDrivingDirections(
  latitude: number,
  longitude: number,
): Promise<boolean> {
  const enc = destinationEnc(latitude, longitude);
  const https = `https://www.google.com/maps/dir/?api=1&destination=${enc}&travelmode=driving`;

  if (Platform.OS === "android") {
    return tryOpenUrl(`google.navigation:q=${latitude},${longitude}`);
  }

  const gMaps = `comgooglemaps://?daddr=${enc}&directionsmode=driving`;
  try {
    if (await Linking.canOpenURL(gMaps)) {
      if (await tryOpenUrl(gMaps)) return true;
    }
  } catch {
    /* continue */
  }
  return tryOpenUrl(https);
}

/** iOS Apple Maps driving directions. On Android, falls back to Google (no Apple Maps). */
export async function openAppleMapsDrivingDirections(
  latitude: number,
  longitude: number,
): Promise<boolean> {
  const enc = destinationEnc(latitude, longitude);
  if (Platform.OS === "ios") {
    return tryOpenUrl(`maps://?daddr=${enc}&dirflg=d`);
  }
  return openGoogleDrivingDirections(latitude, longitude);
}

export type IosMapChoiceResult = "opened" | "failed" | "cancelled";

/**
 * iOS: action sheet — Google Maps (listed first), Apple Maps, Cancel.
 * On other platforms, opens Google directions and returns "opened" | "failed".
 */
export function openIosDrivingDirectionsWithMapChoice(
  latitude: number,
  longitude: number,
): Promise<IosMapChoiceResult> {
  if (Platform.OS !== "ios") {
    return openGoogleDrivingDirections(latitude, longitude).then((ok) =>
      ok ? "opened" : "failed",
    );
  }

  return new Promise((resolve) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: "Open directions in",
        options: ["Google Maps", "Apple Maps", "Cancel"],
        cancelButtonIndex: 2,
      },
      (buttonIndex) => {
        void (async () => {
          if (buttonIndex === 0) {
            resolve(
              (await openGoogleDrivingDirections(latitude, longitude))
                ? "opened"
                : "failed",
            );
            return;
          }
          if (buttonIndex === 1) {
            resolve(
              (await openAppleMapsDrivingDirections(latitude, longitude))
                ? "opened"
                : "failed",
            );
            return;
          }
          resolve("cancelled");
        })();
      },
    );
  });
}

/**
 * Opens driving directions without asking which app (e.g. non-iOS or programmatic use).
 * Android: Google navigation. iOS: Google app → Google web → Apple Maps.
 */
export async function openDrivingTurnByTurn(
  latitude: number,
  longitude: number,
): Promise<boolean> {
  const enc = destinationEnc(latitude, longitude);
  const https = `https://www.google.com/maps/dir/?api=1&destination=${enc}&travelmode=driving`;

  if (Platform.OS === "android") {
    return tryOpenUrl(`google.navigation:q=${latitude},${longitude}`);
  }

  if (Platform.OS === "ios") {
    const gMaps = `comgooglemaps://?daddr=${enc}&directionsmode=driving`;
    try {
      if (await Linking.canOpenURL(gMaps)) {
        if (await tryOpenUrl(gMaps)) return true;
      }
    } catch {
      /* continue */
    }
    if (await tryOpenUrl(https)) return true;
    if (await tryOpenUrl(`maps://?daddr=${enc}&dirflg=d`)) return true;
  }

  return tryOpenUrl(https);
}
