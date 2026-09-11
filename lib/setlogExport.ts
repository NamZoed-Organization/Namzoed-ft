/**
 * Taking a day out of Setlog.
 *
 * Two halves, because the two media are not equally exportable on a phone:
 *
 *  - **Photos become a collage**, and that is a real file produced here.
 *    `react-native-view-shot` flattens a laid-out grid into a JPEG, which is
 *    the same trick the story composer uses to burn text into an image.
 *
 *  - **Videos become a reel**, played back to back in order — in the app.
 *    Stitching them into one file needs an encoder, and there is not one on
 *    the device: `expo-video` plays and `expo-camera` records, neither
 *    concatenates, and no ffmpeg is bundled. That is a server-side render
 *    job, and it is not built. Nothing here pretends otherwise.
 *
 * Clips come back oldest-first — the opposite of the feed — because a day
 * read as a story runs forwards.
 */

import { File } from "expo-file-system";
import { supabase } from "./supabase";
import { resolveClipUrls } from "./setlogMediaCache";
import {
  localDay,
  resolveUserId,
  type SetlogClip,
} from "./setlogService";

const CLIP_BUCKET = "setlog-clips";
const SIGNED_URL_TTL_S = 60 * 60;

export interface DayExport {
  day: string;
  /** Oldest first: a day read as a story runs forwards. */
  videos: (SetlogClip & { url: string | null })[];
  photos: (SetlogClip & { url: string | null })[];
}

/** Everything the user themselves recorded on a day, in the order it
 *  happened. Their own only — an export is a thing you put your name to,
 *  and other people's clips are theirs to export. */
export const getDayExport = async (
  day: string = localDay(),
): Promise<DayExport> => {
  const uid = await resolveUserId();
  if (!uid) return { day, videos: [], photos: [] };

  const { data, error } = await supabase
    .from("setlog_clips")
    .select("*")
    .eq("user_id", uid)
    .eq("day", day)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const clips: SetlogClip[] = (data ?? []).map((r: any) => ({
    id: String(r.id),
    setlogId: String(r.setlog_id),
    userId: String(r.user_id),
    day: String(r.day),
    slotHour: Number(r.slot_hour),
    storagePath: String(r.storage_path),
    durationMs: Number(r.duration_ms),
    isLate: Boolean(r.is_late),
    title: r.title == null ? null : String(r.title),
    mediaType: r.media_type === "photo" ? "photo" : "video",
    captureMode: r.capture_mode ?? "2s",
    videoQuality: r.video_quality ?? null,
    createdAt: String(r.created_at),
  }));

  // Local first — an export of your own day should not download the day
  // back from the server (lib/setlogMediaCache.ts).
  const urls = await resolveClipUrls(clips);
  const withUrls = clips.map((c) => ({ ...c, url: urls[c.storagePath] ?? null }));

  return {
    day,
    videos: withUrls.filter((c) => c.mediaType === "video"),
    photos: withUrls.filter((c) => c.mediaType === "photo"),
  };
};

/**
 * Put a finished collage where it can be linked to.
 *
 * The path shape is load-bearing: the bucket's policies read the log id off
 * the first folder and the owner off the second, so an export files itself
 * under the same log its clips came from rather than somewhere new that no
 * policy covers.
 */
export const uploadCollage = async (
  setlogId: string,
  day: string,
  fileUri: string,
): Promise<string> => {
  const uid = await resolveUserId();
  if (!uid) throw new Error("Sign in first.");

  const path = `${setlogId}/${uid}/exports/${day}-collage.jpg`;
  const bytes = await new File(fileUri).bytes();

  const { error } = await supabase.storage
    .from(CLIP_BUCKET)
    .upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "31536000",
    });
  if (error) throw error;

  const { data, error: signErr } = await supabase.storage
    .from(CLIP_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_S);
  if (signErr) throw signErr;
  return data.signedUrl;
};
