import { File } from "expo-file-system";
import { supabase } from "./supabase";
import { moderateImage } from "./imageModeration";

/**
 * Upload a local file URI to Supabase Storage.
 * Uses expo-file-system File class (new API, SDK 55+).
 */
export const uploadFileToSupabase = async (
  fileUri: string,
  bucket: string,
  filePath: string,
  contentType: string = "image/jpeg",
  upsert: boolean = false,
  opts: { skipImageModeration?: boolean } = {},
): Promise<void> => {
  // Safety net for image uploads (avatars, chat, etc.): scan with Google
  // Vision before the bytes ever leave the device. The post flow scans at
  // selection time and passes skipImageModeration to avoid a redundant scan.
  if (contentType.startsWith("image/") && !opts.skipImageModeration) {
    const result = await moderateImage(fileUri);
    if (result.decision === "block") {
      throw new Error(
        result.reason ||
          "Image blocked: it appears to contain disallowed content.",
      );
    }
  }

  const file = new File(fileUri);
  const bytes = await file.bytes();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, bytes, { contentType, upsert, cacheControl: "31536000" });

  if (error) throw error;
};
