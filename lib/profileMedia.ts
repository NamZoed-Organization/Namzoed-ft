// lib/profileMedia.ts
//
// Saving a profile photo or a cover photo, end to end: upload, profile row
// update, and cleanup of the file it replaced. Both the profile screen and
// the Edit Profile hub do this, and the cover half in particular has a
// detail that's easy to get wrong in a second copy — the gradient hue has to
// be read off the *local* file before the upload so the new cover and its
// matching colors land together (see lib/coverTheme.ts).

import { cacheCoverHue, extractCoverHue } from "@/lib/coverHue";
import { getRandomHue } from "@/lib/coverTheme";
import {
  deleteAvatar,
  deleteCoverImage,
  updateUserProfile,
  uploadAvatar,
  uploadCoverImage,
} from "@/lib/profileService";

/** Uploads a new avatar, points the profile at it, and bins the old file. */
export async function saveAvatarPhoto(
  userId: string,
  localUri: string,
  previousUrl?: string | null,
): Promise<string> {
  const publicUrl = await uploadAvatar(localUri, userId);
  await updateUserProfile(userId, { avatar_url: publicUrl });

  if (previousUrl) {
    deleteAvatar(previousUrl).catch((error) =>
      console.error("Failed to delete previous avatar:", error),
    );
  }

  return publicUrl;
}

export interface SaveCoverOptions {
  previousUrl?: string | null;
  /** Hue to keep if the photo can't be decoded — usually the profile's
   *  current one. A random hue is used when there isn't one. */
  fallbackHue?: number | null;
  /** Fires as soon as the hue is known, before the upload starts, so a
   *  caller can paint the new gradient at the same moment it shows the
   *  local image instead of a beat later. */
  onHueResolved?: (hue: number) => void;
}

/** Uploads a new cover photo and saves it together with the gradient hue
 *  extracted from it, then bins the old file. */
export async function saveCoverPhoto(
  userId: string,
  localUri: string,
  { previousUrl, fallbackHue, onHueResolved }: SaveCoverOptions = {},
): Promise<{ url: string; hue: number }> {
  const hue = (await extractCoverHue(localUri)) ?? fallbackHue ?? getRandomHue();
  onHueResolved?.(hue);

  const publicUrl = await uploadCoverImage(localUri, userId);
  await updateUserProfile(userId, {
    cover_image_url: publicUrl,
    cover_hue: hue,
  });
  // Same photo, new address — carry the hue over so nothing re-extracts it
  // over the network.
  cacheCoverHue(publicUrl, hue);

  if (previousUrl) {
    deleteCoverImage(previousUrl).catch((error) =>
      console.error("Failed to delete previous cover image:", error),
    );
  }

  return { url: publicUrl, hue };
}
