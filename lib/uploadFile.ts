import { File } from "expo-file-system";
import { supabase } from "./supabase";
import { moderateImage } from "./imageModeration";
import { prepareImageForUpload, type ImageUploadPreset } from "./imageUpload";

/**
 * Upload a local file URI to Supabase Storage.
 * Uses expo-file-system File class (new API, SDK 55+).
 *
 * Images are resized first (lib/imageUpload.ts) — "photo" unless the caller
 * names another preset, or passes `image: false` for a picture that was
 * already made at its final size (a video poster).
 */
export const uploadFileToSupabase = async (
  fileUri: string,
  bucket: string,
  filePath: string,
  contentType: string = "image/jpeg",
  upsert: boolean = false,
  opts: { skipImageModeration?: boolean; image?: ImageUploadPreset | false } = {},
): Promise<void> => {
  let uri = fileUri;
  let type = contentType;
  if (type.startsWith("image/") && opts.image !== false) {
    const prepared = await prepareImageForUpload(fileUri, contentType, opts.image ?? "photo");
    uri = prepared.uri;
    type = prepared.contentType;
  }

  // Safety net for image uploads (avatars, chat, etc.): scan with Google
  // Vision before the bytes ever leave the device. The post flow scans at
  // selection time and passes skipImageModeration to avoid a redundant scan.
  if (type.startsWith("image/") && !opts.skipImageModeration) {
    const result = await moderateImage(uri);
    if (result.decision === "block") {
      throw new Error(
        result.reason ||
          "Image blocked: it appears to contain disallowed content.",
      );
    }
  }

  const file = new File(uri);
  const bytes = await file.bytes();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, bytes, { contentType: type, upsert, cacheControl: "31536000" });

  if (error) throw error;
};
