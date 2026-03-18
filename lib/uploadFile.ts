import { File } from 'expo-file-system/next';
import { supabase } from './supabase';

/**
 * Upload a local file URI to Supabase Storage.
 * Uses expo-file-system File class (new API, SDK 55+).
 */
export const uploadFileToSupabase = async (
  fileUri: string,
  bucket: string,
  filePath: string,
  contentType: string = 'image/jpeg',
  upsert: boolean = false,
): Promise<void> => {
  const file = new File(fileUri);
  const bytes = await file.bytes();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filePath, bytes, { contentType, upsert });

  if (error) throw error;
};
