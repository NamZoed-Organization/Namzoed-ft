/**
 * Getting an export off the phone.
 *
 * Three destinations, and they are not equally possible:
 *
 *  - **The camera roll** needs `expo-media-library`, which is not in the
 *    project. It is loaded through a guarded `require` rather than a static
 *    import, so the screen still runs without it and the button says what
 *    is missing instead of the app failing to start. Install it and the
 *    same button starts working with no other change.
 *
 *  - **The OS share sheet** works today, and is the only route that reaches
 *    every app on the device.
 *
 *  - **A named app** — Instagram, TikTok, X. Only Instagram Stories takes
 *    an image directly, and only by way of the pasteboard; the others take
 *    a link or nothing at all. Each falls back to the share sheet rather
 *    than failing, because a button that opens the wrong thing is still
 *    better than one that opens nothing.
 */

import * as Clipboard from "expo-clipboard";
import { File } from "expo-file-system";
import { Linking, Platform, Share } from "react-native";

export type ShareTarget = "instagram" | "tiktok" | "x";

/** Present only when the dependency is installed. */
const mediaLibrary = (): any | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-media-library");
  } catch {
    return null;
  }
};

export const canSaveToLibrary = (): boolean => mediaLibrary() != null;

/**
 * Save a file to the phone's own photo library.
 *
 * Throws a sentence worth reading rather than a module error, because the
 * likeliest failure is that the dependency was never installed.
 */
export const saveToLibrary = async (fileUri: string): Promise<void> => {
  const lib = mediaLibrary();
  if (!lib) {
    throw new Error(
      "Saving to your photos needs the media library module, which isn't installed in this build yet.",
    );
  }
  const permission = await lib.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      "Namzoed can't save to your photos until you allow it in Settings.",
    );
  }
  await lib.saveToLibraryAsync(fileUri);
};

/** The OS sheet — every app on the device, and the only route that is. */
export const shareFile = async (
  fileUri: string,
  message: string,
  fallbackUrl?: string | null,
): Promise<void> => {
  await Share.share(
    Platform.OS === "ios"
      ? { url: fileUri, message }
      : { message: fallbackUrl ? `${message}\n${fallbackUrl}` : message },
  );
};

const APP_URLS: Record<ShareTarget, string[]> = {
  // Stories takes the pasteboard's image when opened with this scheme.
  instagram: ["instagram-stories://share", "instagram://app"],
  tiktok: ["snssdk1233://", "tiktok://"],
  x: ["twitter://post", "twitter://"],
};

/**
 * Hand an export to one named app.
 *
 * Instagram gets the image itself, through the pasteboard, which is the
 * only way its Stories composer accepts one from outside. The rest get the
 * share sheet, because their composers need an SDK this app does not carry
 * and pretending otherwise would open an empty post.
 */
export const shareToApp = async (
  target: ShareTarget,
  fileUri: string,
  message: string,
  fallbackUrl?: string | null,
): Promise<void> => {
  if (target === "instagram" && Platform.OS === "ios") {
    try {
      const base64 = await new File(fileUri).base64();
      await Clipboard.setImageAsync(base64);
      const url = APP_URLS.instagram[0];
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // Fall through to the sheet.
    }
  }

  for (const url of APP_URLS[target]) {
    try {
      if (await Linking.canOpenURL(url)) {
        // The app is here but cannot be handed the file directly, so the
        // sheet is what actually carries it — opening the app alone would
        // land somebody in an empty composer.
        break;
      }
    } catch {
      // canOpenURL throws on an unlisted scheme; treat as absent.
    }
  }

  await shareFile(fileUri, message, fallbackUrl);
};
